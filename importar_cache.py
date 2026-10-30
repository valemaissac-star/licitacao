"""Importa o cache JSON antigo (dados/cache e dados/cache_itens) para o SQLite.

Uso:  python importar_cache.py [pasta_dados]
É seguro rodar várias vezes (faz upsert, não duplica).
Aceita os dois formatos de cache de contratações: lista simples
e dicionário {"registros": [...]}.
"""
import glob
import json
import os
import re
import sys

from db import conectar, iniciar_banco, normalizar, CAMINHO_DB


def _num(v):
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _ler_json(caminho):
    """Lê um JSON; se o arquivo estiver corrompido (ex.: duas listas gravadas
    uma após a outra, ou bytes inválidos), aproveita tudo que for legível."""
    try:
        with open(caminho, "rb") as f:
            bruto = f.read()
    except OSError as e:
        print(f"  [!] ignorado {os.path.basename(caminho)}: {e}")
        return None
    texto = bruto.decode("utf-8", errors="replace")
    try:
        return json.loads(texto)
    except ValueError:
        pass
    # Fallback: vários valores JSON concatenados -> junta as listas
    dec, pos, tam, juntos = json.JSONDecoder(), 0, len(texto), []
    while pos < tam:
        while pos < tam and texto[pos].isspace():
            pos += 1
        if pos >= tam:
            break
        try:
            valor, pos = dec.raw_decode(texto, pos)
        except ValueError:
            break  # resto truncado/ilegível
        juntos.extend(_registros(valor))
    if juntos:
        print(f"  [~] {os.path.basename(caminho)} estava corrompido; "
              f"recuperados {len(juntos)} registros")
        return juntos
    print(f"  [!] ignorado {os.path.basename(caminho)}: JSON ilegível")
    return None


def _registros(dados):
    if isinstance(dados, list):
        return dados
    if isinstance(dados, dict):
        return dados.get("registros") or dados.get("data") or []
    return []


def upsert_contratacao(con, lic):
    org = lic.get("orgaoEntidade") or {}
    uni = lic.get("unidadeOrgao") or {}
    cnpj = org.get("cnpj") or lic.get("orgaoEntidadeCnpj")
    ano, seq = lic.get("anoCompra"), lic.get("sequencialCompra")
    if not (cnpj and ano and seq):
        return False
    municipio = uni.get("municipioNome")
    con.execute(
        """
        INSERT INTO contratacoes (numero_pncp, cnpj, ano, sequencial, uf, municipio,
            municipio_norm, esfera, modalidade_id, modalidade_nome, objeto, objeto_norm,
            situacao_nome, valor_estimado, data_publicacao, data_encerramento_prop,
            data_atualizacao, json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT (cnpj, ano, sequencial) DO UPDATE SET
            numero_pncp=excluded.numero_pncp, uf=excluded.uf, municipio=excluded.municipio,
            municipio_norm=excluded.municipio_norm, esfera=excluded.esfera,
            modalidade_id=excluded.modalidade_id, modalidade_nome=excluded.modalidade_nome,
            objeto=excluded.objeto, objeto_norm=excluded.objeto_norm,
            situacao_nome=excluded.situacao_nome, valor_estimado=excluded.valor_estimado,
            data_publicacao=excluded.data_publicacao,
            data_encerramento_prop=excluded.data_encerramento_prop,
            data_atualizacao=excluded.data_atualizacao, json=excluded.json
        WHERE COALESCE(excluded.data_atualizacao,'') >= COALESCE(contratacoes.data_atualizacao,'')
        """,
        (
            lic.get("numeroControlePNCP"), str(cnpj), int(ano), int(seq),
            uni.get("ufSigla"), municipio, normalizar(municipio), org.get("esferaId"),
            lic.get("modalidadeId"), lic.get("modalidadeNome"),
            lic.get("objetoCompra"), normalizar(lic.get("objetoCompra")),
            lic.get("situacaoCompraNome"), _num(lic.get("valorTotalEstimado")),
            lic.get("dataPublicacaoPncp"),
            lic.get("dataEncerramentoProposta") or lic.get("dataFimRecebimentoProposta"),
            lic.get("dataAtualizacaoGlobal") or lic.get("dataAtualizacao"),
            json.dumps(lic, ensure_ascii=False),
        ),
    )
    return True


def gravar_itens(con, cnpj, ano, seq, itens):
    """Troca todos os itens da contratação (retorna False se ela não existe)."""
    row = con.execute(
        "SELECT id FROM contratacoes WHERE cnpj=? AND ano=? AND sequencial=?",
        (cnpj, ano, seq),
    ).fetchone()
    if not row:
        return False
    cid = row["id"]
    con.execute("DELETE FROM itens WHERE contratacao_id=?", (cid,))
    con.executemany(
        """INSERT INTO itens (contratacao_id, numero_item, descricao, quantidade,
               valor_unitario, valor_total, sigiloso, json) VALUES (?,?,?,?,?,?,?,?)""",
        [
            (cid, it.get("numeroItem"), it.get("descricao"), _num(it.get("quantidade")),
             _num(it.get("valorUnitarioEstimado")), _num(it.get("valorTotal")),
             1 if it.get("orcamentoSigiloso") else 0, json.dumps(it, ensure_ascii=False))
            for it in itens
        ],
    )
    con.execute("UPDATE contratacoes SET itens_sincronizados=1 WHERE id=?", (cid,))
    return True


def main():
    pasta = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(CAMINHO_DB))
    con = conectar()
    iniciar_banco(con)

    # 1) contratações (pasta pode se chamar dados/ ou DADOS/)
    arquivos = glob.glob(os.path.join(pasta, "cache", "*.json"))
    total = invalidas = 0
    for i, caminho in enumerate(arquivos, 1):
        for lic in _registros(_ler_json(caminho)):
            if isinstance(lic, dict) and upsert_contratacao(con, lic):
                total += 1
            else:
                invalidas += 1
        if i % 50 == 0:
            con.commit()
            print(f"  contratações: {i}/{len(arquivos)} arquivos")
    con.commit()
    print(f"Contratações processadas: {total} (inválidas: {invalidas})")

    # 2) itens: nome do arquivo = cnpj_ano_sequencial.json
    arquivos = glob.glob(os.path.join(pasta, "cache_itens", "*.json"))
    ok = orfaos = 0
    for i, caminho in enumerate(arquivos, 1):
        m = re.match(r"(\d+)_(\d{4})_(\d+)\.json$", os.path.basename(caminho))
        itens = _ler_json(caminho)
        if not m or not isinstance(itens, list):
            continue
        if gravar_itens(con, m.group(1), int(m.group(2)), int(m.group(3)), itens):
            ok += 1
        else:
            orfaos += 1
        if i % 500 == 0:
            con.commit()
            print(f"  itens: {i}/{len(arquivos)} arquivos")
    con.commit()
    print(f"Arquivos de itens importados: {ok} | sem contratação correspondente: {orfaos}")

    for tabela in ("contratacoes", "itens"):
        n = con.execute(f"SELECT COUNT(*) FROM {tabela}").fetchone()[0]
        print(f"  {tabela}: {n} linhas")
    con.close()


if __name__ == "__main__":
    main()