"""Camada de banco (SQLite + FTS5) do Conecta Licitações."""
import os
import sqlite3
import unicodedata

PASTA_RAIZ = os.path.dirname(os.path.abspath(__file__))
CAMINHO_DB = os.path.join(PASTA_RAIZ, "dados", "conecta.db")


def normalizar(texto):
    """minúsculo + sem acento (mesma regra do filtros.py)."""
    if not texto:
        return ""
    t = str(texto).strip().lower()
    return unicodedata.normalize("NFKD", t).encode("ASCII", "ignore").decode("utf-8")


def conectar(caminho=CAMINHO_DB):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    con = sqlite3.connect(caminho, timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")      # leitura não bloqueia escrita
    con.execute("PRAGMA synchronous=NORMAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


SCHEMA = """
CREATE TABLE IF NOT EXISTS contratacoes (
    id                       INTEGER PRIMARY KEY,
    numero_pncp              TEXT,
    cnpj                     TEXT NOT NULL,
    ano                      INTEGER NOT NULL,
    sequencial               INTEGER NOT NULL,
    uf                       TEXT,
    municipio                TEXT,
    municipio_norm           TEXT,
    esfera                   TEXT,
    modalidade_id            INTEGER,
    modalidade_nome          TEXT,
    objeto                   TEXT,
    objeto_norm              TEXT,
    situacao_nome            TEXT,
    valor_estimado           REAL,
    data_publicacao          TEXT,   -- ISO 8601 (ordena como texto)
    data_encerramento_prop   TEXT,
    data_atualizacao         TEXT,
    itens_sincronizados      INTEGER NOT NULL DEFAULT 0,
    json                     TEXT NOT NULL,
    UNIQUE (cnpj, ano, sequencial)
);
CREATE INDEX IF NOT EXISTS ix_c_uf_pub    ON contratacoes (uf, data_publicacao);
CREATE INDEX IF NOT EXISTS ix_c_munic     ON contratacoes (municipio_norm);
CREATE INDEX IF NOT EXISTS ix_c_modal     ON contratacoes (modalidade_id);
CREATE INDEX IF NOT EXISTS ix_c_encerra   ON contratacoes (data_encerramento_prop);
CREATE INDEX IF NOT EXISTS ix_c_numpncp   ON contratacoes (numero_pncp);

CREATE TABLE IF NOT EXISTS itens (
    id               INTEGER PRIMARY KEY,
    contratacao_id   INTEGER NOT NULL REFERENCES contratacoes(id) ON DELETE CASCADE,
    numero_item      INTEGER,
    descricao        TEXT,
    quantidade       REAL,
    valor_unitario   REAL,
    valor_total      REAL,
    sigiloso         INTEGER NOT NULL DEFAULT 0,
    json             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_i_contr ON itens (contratacao_id);
CREATE INDEX IF NOT EXISTS ix_i_valor ON itens (valor_total);

-- Busca por palavra (ignora acento e maiúscula)
CREATE VIRTUAL TABLE IF NOT EXISTS itens_fts USING fts5(
    descricao, content='itens', content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS itens_ai AFTER INSERT ON itens BEGIN
    INSERT INTO itens_fts(rowid, descricao) VALUES (new.id, new.descricao);
END;
CREATE TRIGGER IF NOT EXISTS itens_ad AFTER DELETE ON itens BEGIN
    INSERT INTO itens_fts(itens_fts, rowid, descricao) VALUES ('delete', old.id, old.descricao);
END;

CREATE TABLE IF NOT EXISTS sync_estado (
    chave TEXT PRIMARY KEY,   -- ex.: 'CE|6' (UF|modalidade)
    ultima_data TEXT,         -- AAAAMMDD já sincronizado
    atualizado_em TEXT
);
"""


def iniciar_banco(con):
    con.executescript(SCHEMA)
    con.commit()