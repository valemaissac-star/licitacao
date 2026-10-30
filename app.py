from flask import (
    Flask,
    render_template,
    jsonify,
    request
)

import os
import requests
import sys

# ==========================================================
# CAMINHOS DO PROJETO
# ==========================================================

PASTA_RAIZ = os.path.dirname(os.path.abspath(__file__))

if PASTA_RAIZ not in sys.path:
    sys.path.insert(0, PASTA_RAIZ)

# Importa o motor de pesquisa unificado
from pesquisa_antigo import pesquisar_oportunidades

# ==========================================================
# CONFIGURAÇÃO DO FLASK
# ==========================================================

app = Flask(
    __name__,
    template_folder=os.path.join(PASTA_RAIZ, "templates"),
    static_folder=os.path.join(PASTA_RAIZ, "static")
)

# ==========================================================
# VALIDAÇÕES E CONSTANTES
# ==========================================================

UFS_VALIDAS = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
}

STATUS_VALIDOS = {
    "recebendo",
    "propostas_encerradas",
    "encerradas",
    "todos"
}

ESFERAS_VALIDAS = {"F", "E", "M", "D"}
MODALIDADES_VALIDAS = set(range(1, 14))

# REGRA 1 APLICADA: APENAS BENS E SERVICOS
TIPOS_VALIDOS = {"Bens", "Servicos"}

ORCAMENTOS_VALIDOS = {"incluir", "informado", "somente_sigiloso"}
TIPOS_FILTRO_VALOR_VALIDOS = {"item_unitario", "item_total", "oportunidade", "item"}

# ==========================================================
# FUNÇÕES AUXILIARES DE NORMALIZAÇÃO
# ==========================================================

def texto_limpo(valor):
    if valor is None:
        return ""
    return str(valor).strip()

def converter_valor_brasileiro(valor):
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    valor = str(valor).strip()
    if not valor:
        return None
    try:
        valor = (
            valor.replace("R$", "")
                 .replace(" ", "")
                 .replace(".", "")
                 .replace(",", ".")
        )
        return float(valor)
    except (TypeError, ValueError):
        return None

def converter_inteiro_nao_negativo(valor):
    if valor is None:
        return None
    if isinstance(valor, bool):
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    try:
        numero = int(texto)
    except (TypeError, ValueError):
        return None
    if numero < 0:
        return None
    return numero

def normalizar_lista(valor):
    if not isinstance(valor, list):
        return []
    return valor

def normalizar_ufs(valor):
    resultado = []
    for uf in normalizar_lista(valor):
        uf = texto_limpo(uf).upper()
        if uf in UFS_VALIDAS and uf not in resultado:
            resultado.append(uf)
    return resultado

def normalizar_modalidades(valor):
    resultado = []
    for modalidade in normalizar_lista(valor):
        if isinstance(modalidade, dict):
            modalidade = modalidade.get("id")
        try:
            modalidade = int(modalidade)
        except (TypeError, ValueError):
            continue
        if modalidade in MODALIDADES_VALIDAS and modalidade not in resultado:
            resultado.append(modalidade)
    return resultado

def normalizar_esferas(valor):
    resultado = []
    for esfera in normalizar_lista(valor):
        if isinstance(esfera, dict):
            esfera = esfera.get("id")
        esfera = texto_limpo(esfera).upper()
        if esfera in ESFERAS_VALIDAS and esfera not in resultado:
            resultado.append(esfera)
    return resultado

def normalizar_tipos(valor):
    resultado = []
    for tipo in normalizar_lista(valor):
        if isinstance(tipo, dict):
            tipo = tipo.get("id")
        tipo = texto_limpo(tipo)
        if tipo in TIPOS_VALIDOS and tipo not in resultado:
            resultado.append(tipo)
    return resultado

def normalizar_municipios(valor, ufs_selecionadas):
    resultado = []
    for municipio in normalizar_lista(valor):
        if isinstance(municipio, dict):
            nome = texto_limpo(municipio.get("nome"))
            uf = texto_limpo(municipio.get("uf")).upper()
            identificador = municipio.get("id")
        else:
            nome = texto_limpo(municipio)
            uf = ""
            identificador = None
        if not nome:
            continue
        if uf:
            if uf not in UFS_VALIDAS:
                continue
            if ufs_selecionadas and uf not in ufs_selecionadas:
                continue
        resultado.append({"id": identificador, "nome": nome, "uf": uf})
    return resultado

def normalizar_exclusoes(valor):
    if valor is None:
        return []
    if isinstance(valor, list):
        resultado = []
        for item in valor:
            item = texto_limpo(item)
            if item and item not in resultado:
                resultado.append(item)
        return resultado
    valor = texto_limpo(valor)
    if not valor:
        return []
    valor = valor.replace(";", ",")
    resultado = []
    for item in valor.split(","):
        item = texto_limpo(item)
        if item and item not in resultado:
            resultado.append(item)
    return resultado

# ==========================================================
# ROTAS DO SISTEMA WEB (PÁGINAS)
# ==========================================================

@app.route("/")
def inicio():
    return render_template("pesquisa.html", pagina_atual="pesquisa")

@app.route("/crm")
def crm():
    return render_template("crm.html", pagina_atual="crm")

@app.route("/documentos")
def documentos():
    return render_template("documentos.html", pagina_atual="documentos")

@app.route("/calculadora")
def calculadora():
    return render_template("calculadora.html", pagina_atual="calculadora")

# ==========================================================
# ROTAS DA API
# ==========================================================

@app.route("/api/municipios/<uf>")
def municipios_por_uf(uf):
    uf = uf.strip().upper()
    if uf not in UFS_VALIDAS:
        return jsonify({"erro": "UF inválida."}), 400

    url = f"https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios"
    try:
        resposta = requests.get(url, timeout=20)
        resposta.raise_for_status()
        dados = resposta.json()
        municipios = [
            {"id": m.get("id"), "nome": m.get("nome", ""), "uf": uf}
            for m in dados
        ]
        municipios.sort(key=lambda item: item["nome"])
        return jsonify(municipios)
    except requests.RequestException as erro:
        print("Erro ao consultar municípios:", erro)
        return jsonify({"erro": "Não foi possível carregar os municípios."}), 500

@app.route("/api/pesquisar", methods=["POST"])
def pesquisar_licitacoes():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({"sucesso": False, "erro": "Os filtros da pesquisa não foram enviados corretamente."}), 400

    status = texto_limpo(dados.get("status"))
    if status not in STATUS_VALIDOS:
        status = "recebendo"

    numero_pncp = texto_limpo(dados.get("numeroPncp"))
    palavra = texto_limpo(dados.get("palavra"))
    exclusoes = normalizar_exclusoes(dados.get("exclusoes"))
    
    modalidades = normalizar_modalidades(dados.get("modalidades"))
    ufs = normalizar_ufs(dados.get("ufs"))
    municipios = normalizar_municipios(dados.get("municipios"), ufs)
    esferas = normalizar_esferas(dados.get("esferas"))
    tipos = normalizar_tipos(dados.get("tipos"))
    
    data_pub_inicio = texto_limpo(dados.get("dataPublicacaoInicio"))
    data_pub_fim = texto_limpo(dados.get("dataPublicacaoFim"))
    data_prop_inicio = texto_limpo(dados.get("dataPropostasInicio"))
    data_prop_fim = texto_limpo(dados.get("dataPropostasFim"))
    
    valor_minimo = converter_valor_brasileiro(dados.get("valorMinimo"))
    valor_maximo = converter_valor_brasileiro(dados.get("valorMaximo"))
    
    tipo_filtro_valor = texto_limpo(dados.get("tipoFiltroValor"))
    if tipo_filtro_valor not in TIPOS_FILTRO_VALOR_VALIDOS:
        tipo_filtro_valor = "item_total"
    if tipo_filtro_valor == "item":
        tipo_filtro_valor = "item_total"

    quantidade_itens_minima = converter_inteiro_nao_negativo(dados.get("quantidadeItensMinima"))
    quantidade_itens_maxima = converter_inteiro_nao_negativo(dados.get("quantidadeItensMaxima"))
    
    orcamento_sigiloso = texto_limpo(dados.get("orcamentoSigiloso"))
    if orcamento_sigiloso not in ORCAMENTOS_VALIDOS:
        orcamento_sigiloso = "incluir"

    # Validações lógicas
    if valor_minimo is not None and valor_minimo < 0:
        return jsonify({"sucesso": False, "erro": "O valor mínimo não pode ser negativo."}), 400
    if valor_maximo is not None and valor_maximo < 0:
        return jsonify({"sucesso": False, "erro": "O valor máximo não pode ser negativo."}), 400
    if valor_minimo is not None and valor_maximo is not None and valor_minimo > valor_maximo:
        return jsonify({"sucesso": False, "erro": "O valor mínimo não pode ser maior que o valor máximo."}), 400

    try:
        resultado = pesquisar_oportunidades(
            data_pub_inicio=data_pub_inicio,
            data_pub_fim=data_pub_fim,
            data_prop_inicio=data_prop_inicio,
            data_prop_fim=data_prop_fim,
            modalidades=modalidades or None,
            ufs=ufs or None,
            municipios=municipios or None,
            esferas=esferas or None,
            tipos=tipos or None,
            status=status,
            palavra=palavra or None,
            exclusoes=exclusoes or None,
            valor_minimo=valor_minimo,
            valor_maximo=valor_maximo,
            orcamento_sigiloso=orcamento_sigiloso,
            tipo_filtro_valor=tipo_filtro_valor,
            quantidade_itens_minima=quantidade_itens_minima,
            quantidade_itens_maxima=quantidade_itens_maxima,
            numero_pncp=numero_pncp or None
        )
    except Exception as erro:
        app.logger.exception("Erro ao executar a pesquisa.")
        return jsonify({"sucesso": False, "erro": "Ocorreu um erro ao consultar as oportunidades.", "detalhes": str(erro)}), 500

    if not isinstance(resultado, dict):
        return jsonify({"sucesso": False, "erro": "O motor de pesquisa retornou uma resposta inválida."}), 500

    resposta = {
        "sucesso": True,
        "resultados": resultado.get("resultados", []),
        "total_contratacoes": resultado.get("total_contratacoes", 0),
        "total_candidatos": resultado.get("total_candidatos", 0),
        "total_resultados": resultado.get("total_resultados", 0),
        "itens_lidos_cache": resultado.get("itens_lidos_cache", 0),
        "novas_consultas_itens": resultado.get("novas_consultas_itens", 0),
        "consultas_itens_falharam": resultado.get("consultas_itens_falharam", 0),
        "contratacoes_sem_itens": resultado.get("contratacoes_sem_itens", 0),
        "pesquisa_contratacoes_completa": resultado.get("pesquisa_contratacoes_completa", False),
        "pesquisa_itens_completa": resultado.get("pesquisa_itens_completa", False),
        "relatorio_consultas": resultado.get("relatorio_consultas", [])
    }

    return jsonify(resposta)

@app.route("/api/arquivos/<cnpj>/<ano>/<sequencial>")
def buscar_arquivos_licitacao(cnpj, ano, sequencial):
    url = f"https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos"
    try:
        resposta = requests.get(url, timeout=15)
        
        if resposta.status_code == 200:
            dados = resposta.json()
            arquivos = dados if isinstance(dados, list) else dados.get('data', [])
            return jsonify({"sucesso": True, "arquivos": arquivos})
            
        return jsonify({"sucesso": False, "erro": "Arquivos não encontrados no PNCP."}), 404
    except Exception as erro:
        return jsonify({"sucesso": False, "erro": f"Erro de conexão: {str(erro)}"}), 500

if __name__ == "__main__":
    print("==========================================")
    print("  CONECTA LICITAÇÕES - SERVIDOR ONLINE    ")
    print("==========================================")
    app.run(debug=True, port=5000, use_reloader=False)