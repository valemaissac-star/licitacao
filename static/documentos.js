// ==========================================================
// CONECTA LICITAÇÕES - GESTÃO DE DOCUMENTOS
// ==========================================================

const modalDoc = document.getElementById("modal-documento");
const btnNovoDoc = document.getElementById("btn-novo-doc");
const btnCancelarDoc = document.getElementById("btn-cancelar-doc");
const formDoc = document.getElementById("form-documento");
const inputArquivo = document.getElementById("doc-arquivo");
const textoArquivo = document.getElementById("texto-arquivo");
const listaDocumentos = document.getElementById("lista-documentos");
const estadoVazio = document.getElementById("estado-vazio-docs");

let arquivoBase64 = null;
let nomeArquivoOriginal = "";

// Abre o modal
if(btnNovoDoc) {
    btnNovoDoc.addEventListener("click", () => {
        formDoc.reset();
        arquivoBase64 = null;
        textoArquivo.textContent = "Nenhum escolhido";
        modalDoc.style.display = "flex";
    });
}

// Fecha o modal
if(btnCancelarDoc) {
    btnCancelarDoc.addEventListener("click", () => {
        modalDoc.style.display = "none";
    });
}

// Lida com a seleção do arquivo e converte para Base64 (para salvar no navegador)
if(inputArquivo) {
    inputArquivo.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (file) {
            textoArquivo.textContent = file.name;
            nomeArquivoOriginal = file.name;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                arquivoBase64 = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            textoArquivo.textContent = "Nenhum escolhido";
            arquivoBase64 = null;
        }
    });
}

// Salva o documento
if(formDoc) {
    formDoc.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const nome = document.getElementById("doc-nome").value.trim();
        const link = document.getElementById("doc-link").value.trim();
        const dataValidade = document.getElementById("doc-data").value; // Formato YYYY-MM-DD
        
        if (!arquivoBase64) {
            alert("Por favor, anexe um ficheiro válido.");
            return;
        }

        const novoDoc = {
            id: Date.now().toString(),
            nome: nome,
            link: link,
            validade: dataValidade,
            arquivo: arquivoBase64,
            nomeArquivo: nomeArquivoOriginal,
            dataAdicao: new Date().toISOString()
        };

        const documentos = JSON.parse(localStorage.getItem("conecta_documentos") || "[]");
        documentos.push(novoDoc);
        localStorage.setItem("conecta_documentos", JSON.stringify(documentos));
        
        modalDoc.style.display = "none";
        renderizarDocumentos();
    });
}

// Verifica o status com base na data (Semáforo)
function analisarStatus(dataValidadeIso) {
    if (!dataValidadeIso) {
        return { classe: 'status-permanente', texto: '⚪ Permanente', dias: null };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // As datas do input vem como YYYY-MM-DD, ao criar um Date com isso ele considera UTC.
    // Vamos garantir que a comparação seja justa criando a data com hora local zerada:
    const partesData = dataValidadeIso.split('-');
    const dataValidade = new Date(partesData[0], partesData[1] - 1, partesData[2]);
    dataValidade.setHours(0, 0, 0, 0);

    const diffTempo = dataValidade.getTime() - hoje.getTime();
    const diffDias = Math.ceil(diffTempo / (1000 * 3600 * 24));

    if (diffDias < 0) {
        return { classe: 'status-vencido', texto: '🔴 Vencido', dias: diffDias };
    } else if (diffDias <= 15) {
        return { classe: 'status-avencer', texto: `🟡 A Vencer (${diffDias} dias)`, dias: diffDias };
    } else {
        return { classe: 'status-valido', texto: '🟢 Válido', dias: diffDias };
    }
}

function formatarDataBr(dataIso) {
    if (!dataIso) return "-";
    const partes = dataIso.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

window.excluirDocumento = function(id) {
    if(confirm("Tem certeza que deseja excluir este documento?")) {
        let documentos = JSON.parse(localStorage.getItem("conecta_documentos") || "[]");
        documentos = documentos.filter(doc => doc.id !== id);
        localStorage.setItem("conecta_documentos", JSON.stringify(documentos));
        renderizarDocumentos();
    }
}

window.abrirAnexo = function(base64Data) {
    // Abre o Base64 numa nova aba (funciona para PDFs e Imagens na maioria dos navegadores)
    const win = window.open();
    win.document.write(`<iframe src="${base64Data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
}

function renderizarDocumentos() {
    if(!listaDocumentos) return;
    
    const documentos = JSON.parse(localStorage.getItem("conecta_documentos") || "[]");
    
    // Ordena: Vencidos primeiro, depois os que estão a vencer, depois os válidos, e permanentes no fim.
    documentos.sort((a, b) => {
        const statusA = analisarStatus(a.validade).dias;
        const statusB = analisarStatus(b.validade).dias;
        
        if (statusA === null && statusB !== null) return 1;
        if (statusA !== null && statusB === null) return -1;
        if (statusA === null && statusB === null) return 0;
        
        return statusA - statusB; 
    });

    if (documentos.length === 0) {
        listaDocumentos.innerHTML = "";
        estadoVazio.style.display = "block";
        return;
    }

    estadoVazio.style.display = "none";
    let html = "";

    documentos.forEach(doc => {
        const status = analisarStatus(doc.validade);
        
        let acoesHtml = `
            <button onclick="window.abrirAnexo('${doc.arquivo}')" title="Ver Anexo">👁️ Ver</button>
        `;
        if (doc.link) {
            acoesHtml += `<a href="${doc.link}" target="_blank" title="Acessar Portal">🔗 Link</a>`;
        }
        acoesHtml += `<button class="btn-excluir" onclick="window.excluirDocumento('${doc.id}')" title="Excluir">🗑️</button>`;

        html += `
            <tr>
                <td>
                    <strong style="color: #FFF; font-size: 14px;">${doc.nome}</strong><br>
                    <span style="color: #7A8B9E; font-size: 11px;">Anexo: ${doc.nomeArquivo}</span>
                </td>
                <td style="color: #DDE3EA; font-weight: 500;">
                    ${formatarDataBr(doc.validade)}
                </td>
                <td>
                    <span class="badge-status ${status.classe}">${status.texto}</span>
                </td>
                <td class="acoes-doc">
                    ${acoesHtml}
                </td>
            </tr>
        `;
    });

    listaDocumentos.innerHTML = html;
}

// Inicializa
document.addEventListener("DOMContentLoaded", renderizarDocumentos);