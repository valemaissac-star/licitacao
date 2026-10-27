import concurrent.futures
import re
import requests

from pncp import (
    buscar_contratacoes,
    buscar_itens_com_status,
    itens_estao_em_cache,
    extrair_identificacao
)

from filtros import (
    aplicar_filtros_estruturais,
    filtrar_itens,
    oportunidade_dentro_faixa_valor,
    oportunidade_atende_quantidade_itens
)

def pesquisar_oportunidades(
    data_pub_inicio=None,
    data_pub_fim=None,
    data_prop_inicio=None,
    data_prop_fim=None,
    modalidades=None,
    ufs=None,
    municipios=None,
    esferas=None,
    tipos=None,
    status="todos",
    palavra=None,
    exclusoes=None,
    valor_minimo=None,
    valor_maximo=None,
    orcamento_sigiloso="incluir",
    tipo_filtro_valor="item_total",
    quantidade_itens_minima=None,
    quantidade_itens_maxima=None,
    numero_pncp=None
):

    if tipo_filtro_valor == "item":
        tipo_filtro_valor = "item_total"

    contratacoes = []
    relatorio = []
    pesquisa_completa = True
    candidatos = []

    print(f"\n[SISTEMA] Backend recebeu Nº PNCP: '{numero_pncp}'")

    # ========================================================
    # BUSCA EXATA POR Nº PNCP (Corta caminho instantâneo)
    # ========================================================
    if numero_pncp and str(numero_pncp).strip():
        limpo = str(numero_pncp).strip()
        print(f"[SISTEMA] Iniciando extração inteligente para o Nº PNCP: {limpo}")
        cnpj = ano = seq_int = seq_str = None
        
        # Padrão flexível: Extrai CNPJ (14), Sequencial e Ano de formatos como 07954480000179-1-026435/2026
        padrao = re.search(r'(\d{14})\D+\d+\D+(\d+)\D+(\d{4})', limpo)
        if padrao:
            cnpj = padrao.group(1)
            seq_str = padrao.group(2)
            seq_int = str(int(seq_str))
            ano = padrao.group(3)
        else:
            numeros = re.findall(r'\d+', limpo)
            if len(numeros) >= 4:
                ano = numeros[-1]
                seq_str = numeros[-2]
                seq_int = str(int(seq_str))
                cnpj = "".join(numeros[:-2])[:14]

        if cnpj and ano and seq_int:
            # O SEGREDO ESTAVA AQUI: A rota pública de pesquisa correta é "api/consulta/v1" e não "api/pncp/v1"
            urls = [
                f"https://pncp.gov.br/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq_int}",
                f"https://pncp.gov.br/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{seq_str}"
            ]
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
            
            for url in urls:
                print(f"[SISTEMA] Consultando API Pública: {url}")
                try:
                    resp = requests.get(url, headers=headers, timeout=15)
                    if resp.status_code == 200:
                        print("[SISTEMA] ✅ Licitação encontrada com sucesso na API Pública!")
                        contratacoes = [resp.json()]
                        break
                    else:
                        print(f"[SISTEMA] ⚠️ Bloqueado ou Não Encontrado. Status: {resp.status_code}")
                except Exception as e:
                    print(f"[SISTEMA] ❌ Falha de conexão na API direta: {e}")
        else:
            print("[SISTEMA] ❌ Não foi possível extrair CNPJ, Ano e Sequencial do texto informado.")
        
        candidatos = contratacoes 
        relatorio = ["Busca exata por Nº PNCP realizada."]
        pesquisa_completa = True

    # ========================================================
    # BUSCA NORMAL (Se a caixa de Nº PNCP estiver vazia)
    # ========================================================
    else:
        print("[SISTEMA] Caixa de Nº PNCP vazia. Iniciando busca normal por datas e estados...")
        contratacoes, relatorio, pesquisa_completa = (
            buscar_contratacoes(
                data_inicial=data_pub_inicio,
                data_final=data_pub_fim,
                modalidades=modalidades or None,
                ufs=ufs or None
            )
        )

        candidatos = aplicar_filtros_estruturais(
            contratacoes=contratacoes,
            municipios=municipios,
            esferas=esferas,
            tipos=tipos,
            status=status,
            dataPublicacaoInicio=data_pub_inicio,
            dataPublicacaoFim=data_pub_fim,
            dataPropostasInicio=data_prop_inicio,
            dataPropostasFim=data_prop_fim,
            numero_pncp=None
        )

    # ========================================================
    # PROCESSAMENTO PARALELO DOS ITENS
    # ========================================================
    resultados = []
    total_candidatos = len(candidatos)

    estatisticas = {
        "itens_lidos_cache": 0,
        "novas_consultas_itens": 0,
        "consultas_itens_falharam": 0,
        "contratacoes_sem_itens": 0
    }

    def processar_candidato_paralelo(licitacao):
        stats_locais = {"lido_cache": 0, "nova_consulta": 0, "falha": 0, "sem_itens": 0}
        
        possui_cache = itens_estao_em_cache(licitacao)
        if possui_cache:
            stats_locais["lido_cache"] = 1
        else:
            stats_locais["nova_consulta"] = 1

        itens, consulta_itens_ok = buscar_itens_com_status(licitacao)

        if not consulta_itens_ok:
            stats_locais["falha"] = 1
            return None, stats_locais

        if not itens:
            stats_locais["sem_itens"] = 1
            return None, stats_locais

        # 1. Filtro da capa para Quantidade de Itens
        if not oportunidade_atende_quantidade_itens(
            itens=itens,
            quantidade_minima=quantidade_itens_minima,
            quantidade_maxima=quantidade_itens_maxima
        ):
            return None, stats_locais

        # 2. Filtro da capa para Valor Total da Oportunidade
        if tipo_filtro_valor == "oportunidade":
            if not oportunidade_dentro_faixa_valor(
                licitacao=licitacao,
                itens=itens,
                valor_minimo=valor_minimo,
                valor_maximo=valor_maximo
            ):
                return None, stats_locais

        # 3. Filtragem nos itens (Palavra, Exclusões, Sigilo, Valores)
        itens_correspondentes = filtrar_itens(
            itens=itens,
            palavra=palavra or None,
            exclusoes=exclusoes or [],
            valor_minimo=valor_minimo,
            valor_maximo=valor_maximo,
            orcamento_sigiloso=orcamento_sigiloso,
            tipo_filtro_valor=tipo_filtro_valor
        )

        tem_filtro_ativo = bool(
            palavra or 
            exclusoes or 
            (valor_minimo is not None) or 
            (valor_maximo is not None) or 
            (orcamento_sigiloso in ["somente_sigiloso", "informado"])
        )
        
        # Se tem filtro ativo e nenhum item sobreviveu, a licitação é descartada
        if tem_filtro_ativo and not itens_correspondentes:
            return None, stats_locais

        alvos_destaque = itens_correspondentes if tem_filtro_ativo else []

        resultado_valido = {
            "licitacao": licitacao,
            "itens": itens,
            "itens_correspondentes": alvos_destaque
        }
        
        return resultado_valido, stats_locais

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futuros = [executor.submit(processar_candidato_paralelo, licitacao) for licitacao in candidatos]
        
        for futuro in concurrent.futures.as_completed(futuros):
            resultado_thread, stats_thread = futuro.result()
            
            estatisticas["itens_lidos_cache"] += stats_thread["lido_cache"]
            estatisticas["novas_consultas_itens"] += stats_thread["nova_consulta"]
            estatisticas["consultas_itens_falharam"] += stats_thread["falha"]
            estatisticas["contratacoes_sem_itens"] += stats_thread["sem_itens"]
            
            if resultado_thread:
                resultados.append(resultado_thread)

    pesquisa_itens_completa = (estatisticas["consultas_itens_falharam"] == 0)

    return {
        "resultados": resultados,
        "total_contratacoes": len(contratacoes),
        "total_candidatos": total_candidatos,
        "total_resultados": len(resultados),
        "itens_lidos_cache": estatisticas["itens_lidos_cache"],
        "novas_consultas_itens": estatisticas["novas_consultas_itens"],
        "consultas_itens_falharam": estatisticas["consultas_itens_falharam"],
        "contratacoes_sem_itens": estatisticas["contratacoes_sem_itens"],
        "pesquisa_contratacoes_completa": pesquisa_completa,
        "pesquisa_itens_completa": pesquisa_itens_completa,
        "relatorio_consultas": relatorio
    }