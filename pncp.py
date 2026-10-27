import requests
import time
import json
import os
from datetime import date, timedelta

PASTA_DADOS = "dados"
PASTA_CACHE = os.path.join(PASTA_DADOS, "cache")
PASTA_CACHE_ITENS = os.path.join(PASTA_DADOS, "cache_itens")
os.makedirs(PASTA_CACHE, exist_ok=True)
os.makedirs(PASTA_CACHE_ITENS, exist_ok=True)

URL_PNCP = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"
URL_API_PNCP = "https://pncp.gov.br/api/pncp/v1"

session = requests.Session()
session.headers.update({
    "Accept": "application/json",
    "User-Agent": "Conecta-Licitacoes/2.1"
})

MAPA_MODALIDADES = {
    "PREGÃO ELETRÔNICO": 6, "PREGÃO": 6, "CONCORRÊNCIA": 4,
    "DISPENSA DE LICITAÇÃO": 8, "DISPENSA": 8, "INEXIGIBILIDADE": 9,
    "CONCURSO": 3, "LEILÃO": 1, "TOMADA DE PREÇOS": 4
}

def requisitar_pncp(parametros, tentativas=5):
    for tentativa in range(1, tentativas + 1):
        try:
            resposta = session.get(URL_PNCP, params=parametros, timeout=15)
            if resposta.status_code == 200:
                return resposta
            if resposta.status_code == 429:
                espera = int(resposta.headers.get("Retry-After", tentativa * 3))
                print(f"\n      [!] PNCP limitou o robô. Aguardando {espera}s para não bloquear...")
                time.sleep(espera)
                continue
            if resposta.status_code in [500, 502, 503, 504]:
                espera = tentativa * 3
                print(f"\n      [!] Instabilidade no PNCP (Erro {resposta.status_code}). Tentando em {espera}s...")
                time.sleep(espera)
                continue
            return None
        except requests.RequestException:
            if tentativa < tentativas:
                time.sleep(2)
    return None

def requisicao_complementar(url, tentativas=3):
    for tentativa in range(1, tentativas + 1):
        try:
            resposta = session.get(url, timeout=15)
            if resposta.status_code == 200: return resposta
            if resposta.status_code == 404: return None
            if resposta.status_code == 429:
                time.sleep(3)
                continue
            return None
        except requests.RequestException:
            if tentativa < tentativas: time.sleep(2)
    return None

def _normalizar_data_pncp(valor):
    if not valor: return None
    texto = str(valor).strip()
    if len(texto) == 10 and texto[4] == "-" and texto[7] == "-": return texto.replace("-", "")
    if len(texto) == 8 and texto.isdigit(): return texto
    return None

# ============================================================
# BUSCA HÍBRIDA: CACHE LOCAL + ATUALIZAÇÃO ONLINE EM TEMPO REAL
# ============================================================

def buscar_contratacoes(data_inicial=None, data_final=None, modalidades=None, ufs=None):
    hoje = date.today()
    inicio = _normalizar_data_pncp(data_inicial)
    
    if not inicio:
        inicio = (hoje - timedelta(days=30)).strftime("%Y%m%d")
        
    fim_publicacao = _normalizar_data_pncp(data_final) or hoje.strftime("%Y%m%d")

    mods = []
    if modalidades:
        lista_mod = modalidades if isinstance(modalidades, list) else [modalidades]
        for m in lista_mod:
            m_str = str(m).strip().upper()
            if m_str in MAPA_MODALIDADES:
                mods.append(MAPA_MODALIDADES[m_str])
            else:
                try:
                    codigo = int(m)
                    if 1 <= codigo <= 13: mods.append(codigo)
                except ValueError: pass
    
    modalidades_finais = list(set(mods)) if mods else list(range(1, 14))

    ufs_finais = [None]
    if ufs:
        lista_ufs = ufs if isinstance(ufs, list) else [ufs]
        ufs_finais = [uf.strip().upper() if uf else None for uf in lista_ufs]

    resultados = {}
    relatorio = []

    print(f"\n[SISTEMA] Iniciando busca no PNCP de {inicio} até {fim_publicacao}...")

    for uf in ufs_finais:
        for modalidade in modalidades_finais:
            nome_cache = f"{inicio}_{fim_publicacao}_{uf or 'TODAS'}_{modalidade}.json"
            caminho_cache = os.path.join(PASTA_CACHE, nome_cache)

            # 1. Carrega dados do cache local primeiro (se existirem) para agilizar
            cache_existe = os.path.exists(caminho_cache)
            idade_horas = 999
            if cache_existe:
                try:
                    idade_horas = (time.time() - os.path.getmtime(caminho_cache)) / 3600
                    with open(caminho_cache, "r", encoding="utf-8") as f:
                        cache_dados = json.load(f)
                        for item in cache_dados: 
                            resultados[item.get("numeroControlePNCP")] = item
                except: pass

            # 2. Se o cache for recente (menos de 30 min), usa-o diretamente. 
            # Caso contrário ou para garantir zero lacunas, faz a busca online incremental.
            if cache_existe and idade_horas < 0.5:
                print(f" ⚡ Rápido (Cache atualizado): UF {uf or 'BR'} | Modalidade {modalidade}")
                relatorio.append({"uf": uf, "modalidade": modalidade, "status": "completo"})
                continue

            print(f" 🌐 Atualizando online: UF {uf or 'BR'} | Modalidade {modalidade}...")
            pagina = 1
            total_paginas = None
            registros_baixados = []
            consulta_completa = False

            while True:
                alvo = f"{total_paginas}" if total_paginas else "?"
                print(f"      -> Baixando página {pagina} de {alvo}...", end="\r")
                
                parametros = {
                    "dataInicial": inicio, 
                    "dataFinal": fim_publicacao,
                    "codigoModalidadeContratacao": modalidade,
                    "pagina": pagina, 
                    "tamanhoPagina": 50
                }
                if uf: parametros["uf"] = uf

                resposta = requisitar_pncp(parametros)
                if resposta is None: break

                try: dados = resposta.json()
                except ValueError: break

                contratacoes = dados.get("data", [])
                if total_paginas is None: total_paginas = dados.get("totalPaginas", 0)

                registros_baixados.extend(contratacoes)

                if total_paginas == 0 or pagina >= total_paginas:
                    consulta_completa = True
                    break

                pagina += 1
                time.sleep(0.3)

            print() # Pula a linha após o progresso
            
            if registros_baixados:
                for lic in registros_baixados:
                    resultados[lic.get("numeroControlePNCP")] = lic
                try:
                    with open(caminho_cache, "w", encoding="utf-8") as f:
                        json.dump(registros_baixados, f, ensure_ascii=False)
                except OSError: pass

            estado = "completo" if consulta_completa else "parcial"
            relatorio.append({"uf": uf, "modalidade": modalidade, "status": estado})

    return list(resultados.values()), relatorio, all(item["status"] == "completo" for item in relatorio)

# ============================================================
# EXTRAÇÃO E ITENS (CACHE DE ITENS)
# ============================================================

def extrair_identificacao(licitacao):
    orgao = licitacao.get("orgaoEntidade") or {}
    cnpj = orgao.get("cnpj") or licitacao.get("orgaoEntidadeCnpj")
    ano = licitacao.get("anoCompra") or licitacao.get("ano")
    sequencial = licitacao.get("sequencialCompra") or licitacao.get("sequencial")
    
    if not cnpj or not ano or not sequencial: return None
    return {"cnpj": str(cnpj), "ano": int(ano), "sequencial": int(sequencial)}

def itens_estao_em_cache(licitacao):
    identificacao = extrair_identificacao(licitacao)
    if not identificacao: return False
    nome_cache = f"{identificacao['cnpj']}_{identificacao['ano']}_{identificacao['sequencial']}.json"
    return os.path.exists(os.path.join(PASTA_CACHE_ITENS, nome_cache))

def buscar_itens_com_status(licitacao, usar_cache=True):
    identificacao = extrair_identificacao(licitacao)
    if not identificacao: return [], False

    nome_cache = f"{identificacao['cnpj']}_{identificacao['ano']}_{identificacao['sequencial']}.json"
    caminho_cache = os.path.join(PASTA_CACHE_ITENS, nome_cache)

    if usar_cache and os.path.exists(caminho_cache):
        try:
            with open(caminho_cache, "r", encoding="utf-8") as arquivo:
                itens = json.load(arquivo)
            if isinstance(itens, list): return itens, True
        except: pass

    url = f"{URL_API_PNCP}/orgaos/{identificacao['cnpj']}/compras/{identificacao['ano']}/{identificacao['sequencial']}/itens"
    resposta = requisicao_complementar(url)

    if resposta is None: return [], False
    try: dados = resposta.json()
    except ValueError: return [], False

    itens = dados if isinstance(dados, list) else (dados.get("data") or dados.get("itens") or [])
    if not isinstance(itens, list): return [], False

    try:
        with open(caminho_cache + ".tmp", "w", encoding="utf-8") as arquivo:
            json.dump(itens, arquivo, ensure_ascii=False, indent=2)
        os.replace(caminho_cache + ".tmp", caminho_cache)
    except OSError: pass

    return itens, True