@echo off
title Conecta Licitacoes

:: Muda dinamicamente para a pasta onde o .bat esta (funciona no D:, E:, C:, etc)
cd /d "%~dp0"

echo ============================================================
echo              CONECTA LICITACOES
echo ============================================================
echo.

:: Verifica se o ambiente virtual existe. Se nao existir, cria sozinho!
if not exist ".venv\Scripts\python.exe" (
    echo [!] Ambiente virtual nao encontrado neste computador.
    echo [!] Criando o motor do sistema automaticamente...
    python -m venv .venv
    
    echo [!] Instalando as bibliotecas necessarias...
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
    
    echo [!] Instalacao concluida!
    echo.
)

echo Iniciando o sistema...
echo.

:: Abre o navegador automaticamente igual a sua versao original
start "" "http://127.0.0.1:5000"

:: Inicia o servidor unificado app.py
".venv\Scripts\python.exe" "app.py"

echo.
echo O servidor foi encerrado.
pause