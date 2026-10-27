import unicodedata
from datetime import datetime

def normalizar_texto(texto):
    if not texto:
        return ""
    texto = str(texto).strip().lower()
    return unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')

def texto_contem(texto, palavra):
    if not palavra:
        return True
    return normalizar_texto(palavra) in normalizar_texto(texto)

def normalizar_exclusoes(exclusoes):
    if not exclusoes:
        return []
    if isinstance(exclusoes, str):
        texto = exclusoes.replace(";", ",")
        return [parte.strip() for parte in texto.split(",") if parte.strip()]
    if isinstance(exclusoes, (list, tuple, set)):
        return [str(parte).strip() for parte in exclusoes if str(parte).strip()]
    return [str(exclusoes).strip()]

def contem_exclusao(texto, exclusoes):
    exclusoes = normalizar_exclusoes(exclusoes)
    if not exclusoes:
        return False
    texto = normalizar_texto(texto)
    for palavra in exclusoes:
        palavra = normalizar_texto(palavra)
        if palavra and palavra in texto:
            return True
    return False

def dentro_da_faixa_valor(valor, valor_minimo=None, valor_maximo=None):
    if valor is None:
        return False
    try:
        valor = float(valor)
    except (TypeError, ValueError):
        return False
    if valor_minimo is not None and valor < float(valor_minimo):
        return False
    if valor_maximo is not None and valor > float(valor_maximo):
        return False
    return True

def obter_valor_item(item):
    if item.get("orcamentoSigiloso") is True:
        return None
    valor = item.get("valorTotal")
    if valor is None:
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None

def obter_valor_unitario_item(item):
    if item.get("orcamentoSigiloso") is True:
        return None
    valor = item.get("valorUnitarioEstimado")
    if valor is not None:
        try:
            return float(valor)
        except (TypeError, ValueError):
            pass
    valor_total = obter_valor_item(item)
    quantidade = item.get("quantidade")
    if valor_total is None or quantidade is None:
        return None
    try:
        quantidade = float(quantidade)
    except (TypeError, ValueError):
        return None
    if quantidade <= 0:
        return None
    return valor_total / quantidade

def item_atende_orcamento(item, orcamento_sigiloso="incluir"):
    tem_valor = obter_valor_item(item) is not None
    eh_sigiloso = item.get("orcamentoSigiloso") is True
    if orcamento_sigiloso == "informado":
        return tem_valor
    if orcamento_sigiloso == "somente_sigiloso":
        return eh_sigiloso
    return True

def item_dentro_faixa_valor(item, valor_minimo=None, valor_maximo=None, orcamento_sigiloso="incluir"):
    if not item_atende_orcamento(item, orcamento_sigiloso):
        return False
    valor = obter_valor_item(item)
    if valor is None:
        return True
    if valor_minimo is None and valor_maximo is None:
        return True
    return dentro_da_faixa_valor(valor, valor_minimo, valor_maximo)

def item_dentro_faixa_valor_unitario(item, valor_minimo=None, valor_maximo=None, orcamento_sigiloso="incluir"):
    if not item_atende_orcamento(item, orcamento_sigiloso):
        return False
    valor = obter_valor_unitario_item(item)
    if valor is None:
        return orcamento_sigiloso != "informado"
    if valor_minimo is None and valor_maximo is None:
        return True
    return dentro_da_faixa_valor(valor, valor_minimo, valor_maximo)

def obter_valor_oportunidade(licitacao, itens=None):
    valor_oficial = None
    if isinstance(licitacao, dict):
        valor = licitacao.get("valorTotalEstimado")
        if valor is not None:
            try:
                valor_oficial = float(valor)
            except (TypeError, ValueError):
                valor_oficial = None
        if valor_oficial is not None and valor_oficial != 0:
            return valor_oficial
    if not itens:
        return valor_oficial
    total = 0.0
    for item in itens:
        valor_item = obter_valor_item(item)
        if valor_item is None:
            return None
        total += valor_item
    return total

def oportunidade_dentro_faixa_valor(licitacao, itens=None, valor_minimo=None, valor_maximo=None):
    if valor_minimo is None and valor_maximo is None:
        return True
    valor = obter_valor_oportunidade(licitacao, itens)
    if valor is None:
        return True
    return dentro_da_faixa_valor(valor, valor_minimo, valor_maximo)

def oportunidade_atende_quantidade_itens(itens, quantidade_minima=None, quantidade_maxima=None):
    quantidade = len(itens or [])
    if quantidade_minima is not None and quantidade < quantidade_minima:
        return False
    if quantidade_maxima is not None and quantidade > quantidade_maxima:
        return False
    return True

def _converter_data_filtro(valor):
    if valor is None or str(valor).strip() == "":
        return None
    if isinstance(valor, datetime):
        return valor
    texto = str(valor).strip()
    if texto.endswith("Z"):
        texto = texto[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(texto)
    except (ValueError, TypeError):
        pass
    formatos = ("%Y-%m-%d", "%Y%m%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S")
    for formato in formatos:
        try:
            return datetime.strptime(texto, formato)
        except (ValueError, TypeError):
            continue
    return None

def obter_data_publicacao(licitacao):
    if not isinstance(licitacao, dict):
        return None
    for chave in ("dataPublicacaoPncp", "dataPublicacaoPNCP", "dataPublicacao"):
        data = _converter_data_filtro(licitacao.get(chave))
        if data is not None:
            return data
    return None

def obter_data_final_propostas(licitacao):
    if not isinstance(licitacao, dict):
        return None
    for chave in ("dataEncerramentoProposta", "dataFimRecebimentoProposta", "dataFinalProposta"):
        data = _converter_data_filtro(licitacao.get(chave))
        if data is not None:
            return data
    return None

def filtrar_datas_contratacao(licitacao, pub_inicio=None, pub_fim=None, prop_inicio=None, prop_fim=None):
    d_pub_ini = _converter_data_filtro(pub_inicio)
    d_pub_fim = _converter_data_filtro(pub_fim)
    
    if d_pub_ini is not None or d_pub_fim is not None:
        data_publicacao = obter_data_publicacao(licitacao)
        if data_publicacao is None:
            return False
        if d_pub_ini is not None and data_publicacao.date() < d_pub_ini.date():
            return False
        if d_pub_fim is not None and data_publicacao.date() > d_pub_fim.date():
            return False

    d_prop_ini = _converter_data_filtro(prop_inicio)
    d_prop_fim = _converter_data_filtro(prop_fim)
    
    if d_prop_ini is not None or d_prop_fim is not None:
        data_final_propostas = obter_data_final_propostas(licitacao)
        if data_final_propostas is None:
            return False
        if d_prop_ini is not None and data_final_propostas.date() < d_prop_ini.date():
            return False
        if d_prop_fim is not None and data_final_propostas.date() > d_prop_fim.date():
            return False

    return True

def oportunidade_aberta(data_encerramento):
    if not data_encerramento:
        return None
    try:
        encerramento = datetime.fromisoformat(str(data_encerramento).replace("Z", "+00:00"))
        agora = datetime.now(encerramento.tzinfo) if encerramento.tzinfo else datetime.now()
        return encerramento >= agora
    except (ValueError, TypeError):
        return None

def filtrar_numero_pncp(licitacao, numero_pncp):
    if not numero_pncp:
        return True
    n_pncp = normalizar_texto(licitacao.get("numeroControlePNCP"))
    return normalizar_texto(numero_pncp) in n_pncp

def filtrar_esferas(licitacao, esferas):
    if not esferas:
        return True
    if isinstance(esferas, str):
        esferas = [esferas]
    orgao = licitacao.get("orgaoEntidade") or {}
    codigo_esfera = normalizar_texto(orgao.get("esferaId"))
    nomes_esferas = {"f": "federal", "e": "estadual", "m": "municipal", "d": "distrital"}
    esfera_licitacao = nomes_esferas.get(codigo_esfera, codigo_esfera)
    
    for esfera in esferas:
        if normalizar_texto(esfera) in (esfera_licitacao, codigo_esfera):
            return True
    return False

def filtrar_municipios(licitacao, municipios):
    if not municipios:
        return True
    if isinstance(municipios, (str, dict)):
        municipios = [municipios]
        
    unidade = licitacao.get("unidadeOrgao") or {}
    municipio_licitacao = normalizar_texto(unidade.get("municipioNome"))
    uf_licitacao = normalizar_texto(unidade.get("ufSigla") or unidade.get("ufNome") or unidade.get("uf"))
    
    for municipio in municipios:
        uf_pesquisa = ""
        if isinstance(municipio, dict):
            nome_pesquisa = normalizar_texto(municipio.get("nome"))
            uf_pesquisa = normalizar_texto(municipio.get("uf"))
        else:
            nome_pesquisa = normalizar_texto(municipio)
            
        if not nome_pesquisa:
            continue
            
        nome_confere = (nome_pesquisa == municipio_licitacao)
        uf_confere = (not uf_pesquisa or not uf_licitacao or uf_pesquisa == uf_licitacao)
        
        if nome_confere and uf_confere:
            return True
    return False

def filtrar_modalidade(licitacao, modalidades):
    return True 

def filtrar_tipos(licitacao, tipos):
    if not tipos:
        return True
    
    objeto = normalizar_texto(licitacao.get("objetoCompra") or licitacao.get("objeto") or "")
    tipos_norm = [normalizar_texto(t) for t in tipos]
    
    bens = "bens" in tipos_norm or "materiais" in tipos_norm or "material" in tipos_norm
    servicos = "servicos" in tipos_norm or "servico" in tipos_norm
    
    categoria = normalizar_texto(licitacao.get("categoriaNome") or licitacao.get("tipoObjetoNome") or "")
    if categoria and "nao se aplica" not in categoria:
        if bens and ("material" in categoria or "bens" in categoria or "bem" in categoria): 
            return True
        if servicos and ("servi" in categoria or "obra" in categoria or "engenharia" in categoria): 
            return True
        return False
    
    if bens and any(p in objeto for p in ["aquisicao", "fornecimento", "material", "equipamento", "veiculo", "compra", "medicamento", "insumo"]):
        return True
    if servicos and any(p in objeto for p in ["prestacao", "servico", "locacao", "manutencao", "limpeza", "transporte", "consultoria", "capacitacao", "obra", "construcao", "reforma", "pavimentacao", "engenharia", "ampliacao"]):
        return True

    return False

def aplicar_filtros_estruturais(
    contratacoes,
    municipios=None,
    esferas=None,
    tipos=None,
    status="todos",
    dataPublicacaoInicio=None,
    dataPublicacaoFim=None,
    dataPropostasInicio=None,
    dataPropostasFim=None,
    numero_pncp=None
):
    resultados = []
    for licitacao in contratacoes:
        if not filtrar_numero_pncp(licitacao, numero_pncp):
            continue
        if not filtrar_datas_contratacao(
            licitacao, 
            pub_inicio=dataPublicacaoInicio, pub_fim=dataPublicacaoFim,
            prop_inicio=dataPropostasInicio, prop_fim=dataPropostasFim
        ):
            continue
        if not filtrar_municipios(licitacao, municipios):
            continue
        if not filtrar_esferas(licitacao, esferas):
            continue
        if not filtrar_tipos(licitacao, tipos):
            continue
        encerramento = obter_data_final_propostas(licitacao)
        situacao_prazo = oportunidade_aberta(encerramento)
        if status == "recebendo" and situacao_prazo is not True:
            continue
        elif status == "propostas_encerradas" and situacao_prazo is not False:
            continue
        elif status == "encerradas":
            situacao_compra = normalizar_texto(licitacao.get("situacaoCompraNome"))
            if "encerr" not in situacao_compra:
                continue
        resultados.append(licitacao)
    return resultados

def item_contem_palavra(item, palavra):
    if not palavra:
        return True
    descricao = normalizar_texto(item.get("descricao"))
    return normalizar_texto(palavra) in descricao

def item_contem_exclusao(item, exclusoes):
    descricao = normalizar_texto(item.get("descricao"))
    return contem_exclusao(descricao, exclusoes)

def filtrar_itens(
    itens,
    palavra=None,
    exclusoes=None,
    valor_minimo=None,
    valor_maximo=None,
    orcamento_sigiloso="incluir",
    tipo_filtro_valor="item_total"
):
    resultados = []
    for item in itens:
        if not item_contem_palavra(item, palavra):
            continue
        if item_contem_exclusao(item, exclusoes):
            continue
        if not item_atende_orcamento(item, orcamento_sigiloso):
            continue

        modo_valor = tipo_filtro_valor
        if modo_valor == "item":
            modo_valor = "item_total"

        if modo_valor == "item_unitario":
            if not item_dentro_faixa_valor_unitario(item, valor_minimo, valor_maximo, orcamento_sigiloso):
                continue
        elif modo_valor == "item_total":
            if not item_dentro_faixa_valor(item, valor_minimo, valor_maximo, orcamento_sigiloso):
                continue
        resultados.append(item)
    return resultados