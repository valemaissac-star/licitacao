"""Motor de pesquisa do Conecta Licitações (versão com banco SQLite).

A pesquisa agora lê do banco local (dados/conecta.db). Só vai ao PNCP para:
  * baixar os itens de licitações que ainda não têm itens completos
    (no máximo MAX_BUSCA_ITENS por pesquisa; o sync.py fará isso em segundo plano);
  * achar uma licitação pelo Nº PNCP quando ela ainda não está no banco.

O formato da resposta é o mesmo da versão anterior, então o front não muda.
"""
import concurrent.futures
import re
import time
from datetime import datetime

import requests

from db import (conectar, iniciar_banco, normalizar, upsert_contratacao,
                gravar_itens)
from filtros import (
    _converter_data_filtro,
    filtrar_itens,
    filtrar_tipos,
    oportunidade_atende_quantidade_itens,
    oportunidade_dentro_faixa_valor,
)
import json

URL_COMPRAS = "https://pncp.gov.br/api/pncp/v1/orgaos"
URL_CONSULTA = "https://pncp.gov.br/api/consulta/v1/orgaos"
TAMANHO_PAGINA_ITENS = 500
MAX_BUSCA_ITENS = 300      # itens baixados "na hora" por pesquisa
LIMITE_RESULTADOS = 2000   # teto de licitações devolvidas ao navegador
MAX_WORKERS = 10

_session = requests.Session()
_session.headers.update({
    "Accept": "application/json",
    "User-Agent": "Conecta-Licitacoes/3.0",
})


# ==========================================================================
# PNCP (só o necessário)
# ==========================================================================
def _get_com_retry(url, params=None, tentativas=3):
    """Devolve (resposta|None, status). 404 volta como (None, 404)."""
    for tentativa in range(1, tentativas + 1):
        try:
            r = _session.get(url, params=params, timeout=20)
        except requests.RequestException:
            time.sleep(1.5 * tentativa)
            continue
        if r.status_code == 200:
            return r, 200
        if r.status_code == 404:
            return None, 404
        if r.status_code == 429:
            time.sleep(3 * tentativa)
            continue
        if r.status_code >= 500:
            time.sleep(2 * tentativa)
            continue
        return None, r.status_code
    return None, 0


def baixar_itens(cnpj, ano, sequencial):
    """Baixa TODOS os itens de uma contratação (com paginação).

    Retorna (itens, ok). A versão antiga não paginava e a API devolve só
    10 itens por padrão, o que cortava licitações maiores.
    """
    url = f"{URL_COMPRAS}/{cnpj}/compras/{ano}/{sequencial}/itens"
    vistos, todos, pagina = set(), [], 1
    while pagina <= 100:
        resp, status = _get_com_retry(
            url, {"pagina": pagina, "tamanhoPagina": TAMANHO_PAGINA_ITENS})
        if resp is None:
            if status == 404 and pagina == 1:
                return [], True          # contratação sem itens publicados
            if status == 404:
                break                    # acabaram as páginas
            return [], False
        try:
            dados = resp.json()
        except ValueError:
            return [], False
        lote = dados if isinstance(dados, list) else (
            dados.get("data") or dados.get("itens") or [])
        if not isinstance(lote, list):
            return [], False
        novos = [it for it in lote
                 if isinstance(it, dict) and it.get("numeroItem") not in vistos]
        if not novos:
            break                        # página vazia ou repetida
        for it in novos:
            vistos.add(it.get("numeroItem"))
        todos.extend(novos)
        if len(lote) < 10:               # página curta = última
            break
        pagina += 1
    return todos, True


def _buscar_licitacao_na_api(texto):
    """Acha uma licitação pelo Nº PNCP na API pública e grava no banco."""
    limpo = str(texto).strip()
    cnpj = ano = seq = None
    padrao = re.search(r"(\d{14})\D+\d+\D+(\d+)\D+(\d{4})", limpo)
    if padrao:
        cnpj, seq, ano = padrao.group(1), str(int(padrao.group(2))), padrao.group(3)
    else:
        numeros = re.findall(r"\d+", limpo)
        if len(numeros) >= 4:
            ano, seq = numeros[-1], str(int(numeros[-2]))
            cnpj = "".join(numeros[:-2])[:14]
    if not (cnpj and ano and seq):
        return None
    resp, _ = _get_com_retry(f"{URL_CONSULTA}/{cnpj}/compras/{ano}/{seq}")
    if resp is None:
        return None
    try:
        return resp.json()
    except ValueError:
        return None


# ==========================================================================
# Consulta SQL dos filtros "estruturais"
# ==========================================================================
def _data_iso(valor):
    d = _converter_data_filtro(valor)
    return d.date().isoformat() if d is not None else None


def _montar_where(ufs, modalidades, municipios, esferas, status,
                  pub_ini, pub_fim, prop_ini, prop_fim):
    w, p = [], []

    if ufs:
        w.append("uf IN (%s)" % ",".join("?" * len(ufs)))
        p += [u.upper() for u in ufs]
    if modalidades:
        w.append("modalidade_id IN (%s)" % ",".join("?" * len(modalidades)))
        p += list(modalidades)

    for coluna, ini, fim in (
        ("data_publicacao", _data_iso(pub_ini), _data_iso(pub_fim)),
        ("data_encerramento_prop", _data_iso(prop_ini), _data_iso(prop_fim)),
    ):
        if ini:
            w.append(f"substr({coluna},1,10) >= ?")
            p.append(ini)
        if fim:
            w.append(f"substr({coluna},1,10) <= ?")
            p.append(fim)

    if municipios:
        grupos = []
        for m in municipios:
            if isinstance(m, dict):
                nome, uf = normalizar(m.get("nome")), normalizar(m.get("uf"))
            else:
                nome, uf = normalizar(m), ""
            if not nome:
                continue
            if uf:
                grupos.append("(municipio_norm = ? AND "
                              "(uf IS NULL OR uf = '' OR lower(uf) = ?))")
                p += [nome, uf]
            else:
                grupos.append("municipio_norm = ?")
                p.append(nome)
        w.append("(" + " OR ".join(grupos) + ")" if grupos else "0")

    if esferas:
        w.append("upper(esfera) IN (%s)" % ",".join("?" * len(esferas)))
        p += [str(e).upper() for e in esferas]

    agora = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    if status == "recebendo":
        w.append("data_encerramento_prop IS NOT NULL AND data_encerramento_prop >= ?")
        p.append(agora)
    elif status == "propostas_encerradas":
        w.append("data_encerramento_prop IS NOT NULL AND data_encerramento_prop < ?")
        p.append(agora)
    elif status == "encerradas":
        w.append("lower(situacao_nome) LIKE '%encerr%'")

    return (" AND ".join(w) or "1"), p


def consultar_candidatos(con, *, ufs=None, modalidades=None, municipios=None,
                         esferas=None, tipos=None, status="todos",
                         pub_ini=None, pub_fim=None, prop_ini=None, prop_fim=None,
                         numero_pncp=None, limite=LIMITE_RESULTADOS):
    """Devolve (linhas, limite_atingido). Cada linha tem id, json, itens_sincronizados."""
    if numero_pncp and str(numero_pncp).strip():
        # busca exata: ignora os demais filtros (igual à versão anterior)
        linhas = con.execute(
            "SELECT id, cnpj, ano, sequencial, json, itens_sincronizados "
            "FROM contratacoes WHERE lower(numero_pncp) LIKE ? "
            "ORDER BY data_publicacao DESC LIMIT ?",
            ("%" + normalizar(numero_pncp) + "%", limite)).fetchall()
        if not linhas:
            lic = _buscar_licitacao_na_api(numero_pncp)
            if lic and upsert_contratacao(con, lic):
                con.commit()
                return consultar_candidatos(con, numero_pncp=numero_pncp, limite=limite)
        return linhas, False

    where, params = _montar_where(ufs, modalidades, municipios, esferas, status,
                                  pub_ini, pub_fim, prop_ini, prop_fim)
    sql = ("SELECT id, cnpj, ano, sequencial, json, itens_sincronizados "
           f"FROM contratacoes WHERE {where} ORDER BY data_publicacao DESC")

    if tipos:
        # o filtro de tipo usa heurísticas em Python (filtrar_tipos); aplica no JSON
        linhas = []
        for r in con.execute(sql, params):
            if filtrar_tipos(json.loads(r["json"]), tipos):
                linhas.append(r)
                if len(linhas) > limite:
                    break
    else:
        linhas = con.execute(sql + " LIMIT ?", params + [limite + 1]).fetchall()

    atingiu = len(linhas) > limite
    return linhas[:limite], atingiu


# ==========================================================================
# Itens
# ==========================================================================
def _carregar_itens(con, ids):
    """{contratacao_id: [item_dict, ...]} em ordem de numeroItem."""
    resultado = {i: [] for i in ids}
    ids = list(ids)
    for k in range(0, len(ids), 800):
        lote = ids[k:k + 800]
        q = ("SELECT contratacao_id, json FROM itens WHERE contratacao_id IN (%s) "
             "ORDER BY contratacao_id, numero_item" % ",".join("?" * len(lote)))
        for r in con.execute(q, lote):
            resultado[r["contratacao_id"]].append(json.loads(r["json"]))
    return resultado


def _completar_itens_pendentes(con, linhas, estat):
    """Baixa (com limite) os itens das licitações com flag != 2."""
    pendentes = [r for r in linhas if r["itens_sincronizados"] != 2]
    a_baixar, restantes = pendentes[:MAX_BUSCA_ITENS], pendentes[MAX_BUSCA_ITENS:]
    estat["itens_pendentes"] = len(restantes)
    if not a_baixar:
        return

    def tarefa(r):
        itens, ok = baixar_itens(r["cnpj"], r["ano"], r["sequencial"])
        return r, itens, ok

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for k, fut in enumerate(concurrent.futures.as_completed(
                [pool.submit(tarefa, r) for r in a_baixar]), 1):
            r, itens, ok = fut.result()
            estat["novas_consultas_itens"] += 1
            if not ok:
                estat["consultas_itens_falharam"] += 1
                continue
            gravar_itens(con, r["cnpj"], r["ano"], r["sequencial"], itens, completo=True)
            if k % 50 == 0:
                con.commit()
    con.commit()


# ==========================================================================
# Pesquisa principal
# ==========================================================================
def pesquisar_oportunidades(
    data_pub_inicio=None, data_pub_fim=None,
    data_prop_inicio=None, data_prop_fim=None,
    modalidades=None, ufs=None, municipios=None, esferas=None, tipos=None,
    status="todos", palavra=None, exclusoes=None,
    valor_minimo=None, valor_maximo=None,
    orcamento_sigiloso="incluir", tipo_filtro_valor="item_total",
    quantidade_itens_minima=None, quantidade_itens_maxima=None,
    numero_pncp=None,
):
    if tipo_filtro_valor == "item":
        tipo_filtro_valor = "item_total"

    con = conectar()
    try:
        iniciar_banco(con)
        total_base = con.execute("SELECT COUNT(*) FROM contratacoes").fetchone()[0]

        linhas, limite_atingido = consultar_candidatos(
            con, ufs=ufs, modalidades=modalidades, municipios=municipios,
            esferas=esferas, tipos=tipos, status=status,
            pub_ini=data_pub_inicio, pub_fim=data_pub_fim,
            prop_ini=data_prop_inicio, prop_fim=data_prop_fim,
            numero_pncp=numero_pncp)

        estat = {"itens_lidos_cache": sum(1 for r in linhas if r["itens_sincronizados"] == 2),
                 "novas_consultas_itens": 0, "consultas_itens_falharam": 0,
                 "contratacoes_sem_itens": 0, "itens_pendentes": 0}
        _completar_itens_pendentes(con, linhas, estat)

        # recarrega flags e itens depois dos downloads
        itens_por_id = _carregar_itens(con, [r["id"] for r in linhas])

        tem_filtro_item = bool(
            palavra or exclusoes or valor_minimo is not None or valor_maximo is not None
            or orcamento_sigiloso in ("somente_sigiloso", "informado"))
        precisa_itens = (tem_filtro_item or quantidade_itens_minima is not None
                         or quantidade_itens_maxima is not None)

        resultados = []
        for r in linhas:
            licitacao = json.loads(r["json"])
            itens = itens_por_id.get(r["id"], [])

            if not itens:
                estat["contratacoes_sem_itens"] += 1
                if precisa_itens:
                    continue      # sem itens não dá para avaliar o filtro
                resultados.append({"licitacao": licitacao, "itens": [],
                                   "itens_correspondentes": [], "itens_pendentes": True})
                continue

            if not oportunidade_atende_quantidade_itens(
                    itens, quantidade_itens_minima, quantidade_itens_maxima):
                continue
            if tipo_filtro_valor == "oportunidade" and not oportunidade_dentro_faixa_valor(
                    licitacao, itens, valor_minimo, valor_maximo):
                continue

            correspondentes = filtrar_itens(
                itens, palavra=palavra or None, exclusoes=exclusoes or [],
                valor_minimo=valor_minimo, valor_maximo=valor_maximo,
                orcamento_sigiloso=orcamento_sigiloso,
                tipo_filtro_valor=tipo_filtro_valor)
            if tem_filtro_item and not correspondentes:
                continue

            resultados.append({
                "licitacao": licitacao, "itens": itens,
                "itens_correspondentes": correspondentes if tem_filtro_item else [],
            })

        return {
            "resultados": resultados,
            "total_contratacoes": total_base,
            "total_candidatos": len(linhas),
            "total_resultados": len(resultados),
            "itens_lidos_cache": estat["itens_lidos_cache"],
            "novas_consultas_itens": estat["novas_consultas_itens"],
            "consultas_itens_falharam": estat["consultas_itens_falharam"],
            "contratacoes_sem_itens": estat["contratacoes_sem_itens"],
            "itens_pendentes": estat["itens_pendentes"],
            "limite_atingido": limite_atingido,
            "pesquisa_contratacoes_completa": not limite_atingido,
            "pesquisa_itens_completa": (estat["consultas_itens_falharam"] == 0
                                        and estat["itens_pendentes"] == 0),
            "relatorio_consultas": ["Pesquisa feita no banco local."],
        }
    finally:
        con.close()