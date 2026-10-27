// ==========================================================
// CONECTA LICITAÇÕES - SCRIPT CRM (KANBAN COMPLETO E CARD ATUALIZADO)
// ==========================================================

const FASES_CRM = [
    { id: "analise", nome: "📥 Em Análise", cor: "#173A70" },
    { id: "precificacao", nome: "💰 Precificação", cor: "#A67C00" },
    { id: "disputa", nome: "🚀 Em Disputa", cor: "#800080" },
    { id: "documentacao", nome: "📁 Documentação", cor: "#005b96" },
    { id: "ganha", nome: "🏆 Ganha", cor: "#218D4E" },
    { id: "perdida", nome: "❌ Perdida", cor: "#8B0000" }
];

let licitacaoAtivaCrm = null;
let oportunidadeParaRemover = null;
let postitParaRemover = null;

function formatarDataHora(dataString) {
    if (!dataString) return "-";
    try {
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dataString; }
}

function escaparHtml(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderizarKanban() {
    const board = document.getElementById("kanban-board");
    if (!board) return;

    const crm = JSON.parse(localStorage.getItem('conecta_crm') || '[]');
    board.innerHTML = "";

    FASES_CRM.forEach(fase => {
        const col = document.createElement("div");
        col.className = "kanban-col";
        col.innerHTML = `
            <div class="kanban-col-header" style="border-top: 3px solid ${fase.cor};">
                <span>${fase.nome}</span>
                <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 10px;">
                    ${crm.filter(i => i.fase === fase.id).length}
                </span>
            </div>
            <div class="kanban-col-body" data-fase="${fase.id}" ondragover="permitirDrop(event)" ondrop="soltarCard(event)">
            </div>
        `;
        board.appendChild(col);
    });

    crm.forEach(item => {
        const colBody = document.querySelector(`.kanban-col-body[data-fase="${item.fase}"]`);
        if (colBody) {
            const lic = item.dados_originais.licitacao || {};
            const unid = lic.unidadeOrgao || {};
            
            const objNome = lic.objetoCompra || "Sem Objeto";
            const modalidade = lic.modalidadeNome || "Licitação";
            const local = (unid.municipioNome && unid.ufSigla) ? `${unid.municipioNome} - ${unid.ufSigla}` : 'Local não informado';
            
            // Prioridade MÁXIMA para Encerramento/Fim
            const dataLimite = formatarDataHora(lic.dataFimRecebimentoProposta || lic.dataEncerramentoProposta || lic.dataEncerramento || lic.dataAberturaProposta || lic.dataFimVigenciaAta);
            
            const valorEst = lic.valorTotalEstimado;
            
            const valorStr = (valorEst !== null && valorEst !== undefined && valorEst !== 0) 
                ? `R$ ${Number(valorEst).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                : `<span style="color: #F5B700; font-size: 10px;">Sigiloso</span>`;

            const card = document.createElement("div");
            card.className = "crm-card";
            card.draggable = true;
            card.id = `card-${item.numero_controle}`;
            card.setAttribute("ondragstart", `iniciarDrag(event, '${item.numero_controle}')`);
            card.setAttribute("onclick", `abrirModalCrm('${item.numero_controle}')`);
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <span style="background: #112B5A; color: #6699FF; padding: 4px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase;">${escaparHtml(modalidade)}</span>
                    <button class="btn-remover-card" onclick="solicitarRemocaoCrm(event, '${item.numero_controle}')" title="Remover Oportunidade">🗑️</button>
                </div>
                <h4>${escaparHtml(objNome)}</h4>
                
                <div style="font-size: 10px; color: #A0B0C0; margin-bottom: 12px; line-height: 1.5;">
                    <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 3px;">
                        <span>📍</span> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escaparHtml(local)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span>⏰</span> <span>${dataLimite}</span>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #1C2C4A; padding-top: 8px;">
                    <span style="font-size: 10px; color: #7A8B9E;">Nº ${item.numero_controle.split('-')[2] || item.numero_controle}</span>
                    <span style="color: #218D4E; font-weight: bold; font-size: 12px;">${valorStr}</span>
                </div>
            `;
            colBody.appendChild(card);
        }
    });
}

// === LÓGICA DO MODAL DE CONFIRMAÇÃO ===
window.solicitarRemocaoCrm = function(ev, numeroControle) {
    ev.stopPropagation(); 
    oportunidadeParaRemover = numeroControle;
    postitParaRemover = null;
    document.getElementById("modal-confirmacao-titulo").textContent = "Remover Oportunidade";
    document.getElementById("modal-confirmacao-mensagem").textContent = "Tem certeza que deseja remover esta oportunidade do seu CRM? Esta ação não pode ser desfeita.";
    document.getElementById("modal-confirmacao").style.display = "flex";
};

window.solicitarRemocaoPostit = function(idPostit) {
    oportunidadeParaRemover = null;
    postitParaRemover = idPostit;
    document.getElementById("modal-confirmacao-titulo").textContent = "Apagar Anotação";
    document.getElementById("modal-confirmacao-mensagem").textContent = "Tem certeza que deseja apagar este Post-it? Esta ação não pode ser desfeita.";
    document.getElementById("modal-confirmacao").style.display = "flex";
};

window.fecharModalConfirmacao = function() {
    document.getElementById("modal-confirmacao").style.display = "none";
    oportunidadeParaRemover = null;
    postitParaRemover = null;
};

document.getElementById("btn-confirmar-remocao")?.addEventListener("click", function() {
    if(oportunidadeParaRemover) {
        let crm = JSON.parse(localStorage.getItem('conecta_crm') || '[]');
        crm = crm.filter(i => i.numero_controle !== oportunidadeParaRemover);
        localStorage.setItem('conecta_crm', JSON.stringify(crm));
        renderizarKanban();
        fecharModalConfirmacao();
    } else if (postitParaRemover) {
        if(!licitacaoAtivaCrm) return;
        let notas = Array.isArray(licitacaoAtivaCrm.anotacoes) ? licitacaoAtivaCrm.anotacoes : [];
        notas = notas.filter(n => n.id !== postitParaRemover);
        
        atualizarLicitacaoCrm(licitacaoAtivaCrm.numero_controle, (item) => { 
            item.anotacoes = notas; 
            licitacaoAtivaCrm.anotacoes = notas;
        });
        
        renderizarAnotacoes();
        fecharModalConfirmacao();
    }
});

// === LÓGICA DO MODAL DE SUCESSO ===
window.mostrarModalSucesso = function(titulo, mensagem) {
    document.getElementById("modal-sucesso-titulo").textContent = titulo;
    document.getElementById("modal-sucesso-mensagem").textContent = mensagem;
    document.getElementById("modal-sucesso").style.display = "flex";
};

window.fecharModalSucesso = function() {
    document.getElementById("modal-sucesso").style.display = "none";
};
// =====================================

window.iniciarDrag = function(ev, numeroControle) { ev.dataTransfer.setData("numero_controle", numeroControle); };
window.permitirDrop = function(ev) { ev.preventDefault(); };

window.soltarCard = function(ev) {
    ev.preventDefault();
    const numeroControle = ev.dataTransfer.getData("numero_controle");
    let dropTarget = ev.target;
    while (!dropTarget.classList.contains('kanban-col-body') && dropTarget !== document.body) { dropTarget = dropTarget.parentElement; }
    
    if (dropTarget.classList.contains('kanban-col-body')) {
        const novaFase = dropTarget.getAttribute("data-fase");
        let crm = JSON.parse(localStorage.getItem('conecta_crm') || '[]');
        const itemIndex = crm.findIndex(i => i.numero_controle === numeroControle);
        
        if (itemIndex > -1) {
            crm[itemIndex].fase = novaFase;
            localStorage.setItem('conecta_crm', JSON.stringify(crm));
            renderizarKanban();
        }
    }
};

window.abrirModalCrm = function(numeroControle) {
    const crm = JSON.parse(localStorage.getItem('conecta_crm') || '[]');
    licitacaoAtivaCrm = crm.find(i => i.numero_controle === numeroControle);
    if(!licitacaoAtivaCrm) return;

    if(!licitacaoAtivaCrm.precificacao) licitacaoAtivaCrm.precificacao = {};

    const lic = licitacaoAtivaCrm.dados_originais.licitacao || {};
    const unid = lic.unidadeOrgao || {};
    const faseObj = FASES_CRM.find(f => f.id === licitacaoAtivaCrm.fase);

    document.getElementById("crm-modal-fase").textContent = faseObj.nome.toUpperCase();
    document.getElementById("crm-modal-fase").style.background = faseObj.cor;
    document.getElementById("crm-modal-objeto").textContent = lic.objetoCompra || "Objeto não informado";
    document.getElementById("crm-modal-orgao").textContent = lic.orgaoEntidade?.razaoSocial || "Órgão não informado";
    
    // Aba Visão Geral (Campos Novos e Antigos)
    document.getElementById("crm-detalhe-pncp").textContent = numeroControle;
    document.getElementById("crm-detalhe-modalidade").textContent = lic.modalidadeNome || "Não informada";
    document.getElementById("crm-detalhe-local").textContent = (unid.municipioNome && unid.ufSigla) ? `${unid.municipioNome} - ${unid.ufSigla}` : 'Não informado';
    document.getElementById("crm-detalhe-situacao").textContent = lic.situacaoCompraNome || "Não informada";
    document.getElementById("crm-detalhe-publicacao").textContent = formatarDataHora(lic.dataPublicacaoPncp);
    
    // Prioridade MÁXIMA para Encerramento/Fim
    document.getElementById("crm-detalhe-data").textContent = formatarDataHora(lic.dataFimRecebimentoProposta || lic.dataEncerramentoProposta || lic.dataEncerramento || lic.dataAberturaProposta || lic.dataFimVigenciaAta);
    
    const valorEst = lic.valorTotalEstimado;
    document.getElementById("crm-detalhe-valor").textContent = (valorEst !== null && valorEst !== undefined && valorEst !== 0) 
        ? `R$ ${Number(valorEst).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
        : "Sigiloso";
        
    const org = lic.orgaoEntidade || {};
    const cnpjLimpo = String(org.cnpj || lic.orgaoEntidadeCnpj || "").replace(/\D/g, "");
    const anoLic = lic.anoCompra || lic.ano;
    const seqLic = lic.sequencialCompra || lic.sequencial;
    
    const linkBtn = document.getElementById("crm-detalhe-link");
    if(cnpjLimpo && anoLic && seqLic) {
        linkBtn.href = `https://pncp.gov.br/app/editais/${cnpjLimpo}/${anoLic}/${seqLic}`;
        linkBtn.style.display = "inline-flex";
    } else {
        linkBtn.style.display = "none";
    }

    renderizarItensEDisputa();
    renderizarAnotacoes();
    mudarAbaCrm('visao-geral');
    document.getElementById("modal-gestao-crm").style.display = "flex";
};

window.fecharModalCrm = function() {
    document.getElementById("modal-gestao-crm").style.display = "none";
    licitacaoAtivaCrm = null;
};

// Fecha o modal ao clicar fora dele
window.fecharModalCrmOverlay = function(ev) {
    if(ev.target.id === 'modal-gestao-crm') fecharModalCrm();
    if(ev.target.id === 'modal-confirmacao') fecharModalConfirmacao();
    if(ev.target.id === 'modal-sucesso') fecharModalSucesso();
};

window.mudarAbaCrm = function(abaId) {
    document.querySelectorAll(".crm-tab-btn").forEach(btn => btn.classList.remove("ativo"));
    document.querySelectorAll(".crm-tab-content").forEach(tab => tab.classList.remove("ativo"));
    const botaoAba = Array.from(document.querySelectorAll(".crm-tab-btn")).find(b => b.getAttribute("onclick").includes(abaId));
    if(botaoAba) botaoAba.classList.add("ativo");
    const abaConteudo = document.getElementById(`aba-${abaId}`);
    if(abaConteudo) abaConteudo.classList.add("ativo");
};

// === NOVA GESTÃO DE ANOTAÇÕES (POST-ITS) ===
function renderizarAnotacoes() {
    const container = document.getElementById("container-postits");
    container.innerHTML = "";
    
    // Migração de anotações antigas (string) para o novo formato de array
    let notas = licitacaoAtivaCrm.anotacoes;
    if (typeof notas === 'string') {
        if (notas.trim() !== "") {
            notas = [{ id: Date.now(), texto: notas, data: new Date().toISOString() }];
        } else {
            notas = [];
        }
        licitacaoAtivaCrm.anotacoes = notas; // atualiza em memória
    }
    if (!Array.isArray(notas)) notas = [];

    if (notas.length === 0) {
        container.innerHTML = `<p style="color: #A0B0C0; font-size: 12px; grid-column: 1 / -1; text-align: center; padding: 20px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px;">Nenhum lembrete criado. Use o campo acima para adicionar o seu primeiro post-it.</p>`;
        return;
    }

    notas.sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(nota => {
        const dataFormatada = formatarDataHora(nota.data);
        const div = document.createElement("div");
        div.className = "post-it";
        div.innerHTML = `
            <div class="post-it-data">${dataFormatada}</div>
            <div class="post-it-texto">${escaparHtml(nota.texto)}</div>
            <button class="btn-apagar-postit" onclick="solicitarRemocaoPostit(${nota.id})" title="Apagar Anotação">🗑️</button>
        `;
        container.appendChild(div);
    });
}

window.adicionarAnotacaoCrm = function() {
    if(!licitacaoAtivaCrm) return;
    const textarea = document.getElementById("nova-anotacao-texto");
    const texto = textarea.value.trim();
    
    if(texto === "") {
        alert("Por favor, escreva algo antes de guardar.");
        return;
    }

    let notas = Array.isArray(licitacaoAtivaCrm.anotacoes) ? licitacaoAtivaCrm.anotacoes : [];
    const novaNota = { id: Date.now(), texto: texto, data: new Date().toISOString() };
    notas.push(novaNota);

    atualizarLicitacaoCrm(licitacaoAtivaCrm.numero_controle, (item) => { 
        item.anotacoes = notas; 
        licitacaoAtivaCrm.anotacoes = notas;
    });
    
    textarea.value = "";
    renderizarAnotacoes();
    mostrarModalSucesso("Anotação Salva", "O seu post-it foi adicionado ao mural com sucesso.");
};
// ===========================================

function renderizarItensEDisputa() {
    const itensGeral = licitacaoAtivaCrm.dados_originais.itens || [];
    const divItens = document.getElementById("crm-lista-itens");
    const divDisputa = document.getElementById("crm-lista-disputa");
    const selecionados = licitacaoAtivaCrm.itens_disputa || [];
    const prec = licitacaoAtivaCrm.precificacao || {};
    
    divItens.innerHTML = ""; divDisputa.innerHTML = "";

    if (itensGeral.length === 0) {
        divItens.innerHTML = `<p style="color: #A0B0C0; font-size: 12px;">Nenhum item detalhado encontrado nesta licitação.</p>`;
        divDisputa.innerHTML = `<p style="color: #A0B0C0; font-size: 12px;">Nenhum item selecionado para disputa.</p>`;
        return;
    }

    itensGeral.forEach(item => {
        const itemId = String(item.numeroItem || item.id);
        const vUni = Number(item.valorUnitarioEstimado || item.valorUnitario || 0);
        const q = Number(item.quantidade || 0);
        const isChecked = selecionados.includes(itemId);
        const valStr = item.orcamentoSigiloso ? '<span style="color:#F5B700">Sigiloso</span>' : `R$ ${vUni.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

        // HTML para a aba "Itens do Edital"
        divItens.innerHTML += `
            <label class="item-edital-linha" style="cursor: pointer; display: flex;">
                <input type="checkbox" onchange="toggleItemDisputa('${itemId}')" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #218D4E;">
                <div style="flex: 1; line-height: 1.4;">
                    <strong style="color: white; font-size: 12px;">Item ${escaparHtml(itemId)}:</strong> <span style="color: #A0B0C0; font-size: 12px;">${escaparHtml(item.descricao)}</span>
                    <div style="font-size: 11px; color: #7A8B9E; margin-top: 4px;">Qtd: ${q} &nbsp;|&nbsp; Ref: ${valStr}</div>
                </div>
            </label>
        `;

        // HTML para a aba "Precificação & Disputa" (apenas os selecionados)
        if(isChecked) {
            const pItem = prec[itemId] || { custo: '', extras: '', min: '', max: '' };
            divDisputa.innerHTML += `
                <div class="item-edital-linha" style="flex-direction: column; align-items: stretch; cursor: default;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <div>
                            <strong style="color: white; font-size: 12px;">Item ${escaparHtml(itemId)}:</strong> 
                            <span style="color: #A0B0C0; font-size: 12px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;" title="${escaparHtml(item.descricao)}">${escaparHtml(item.descricao)}</span>
                        </div>
                        <span style="color: #218D4E; font-size: 11px; font-weight: bold; white-space: nowrap;">Edital: ${valStr}</span>
                    </div>
                    
                    <div class="grid-precificacao">
                        <div class="grupo-input">
                            <label>Preço de Custo (R$)</label>
                            <input type="number" step="0.01" id="custo-${itemId}" value="${pItem.custo}" placeholder="0,00">
                        </div>
                        <div class="grupo-input">
                            <label>Custos Extras (Frete/Imposto)</label>
                            <input type="number" step="0.01" id="extras-${itemId}" value="${pItem.extras}" placeholder="0,00">
                        </div>
                        <div class="grupo-input">
                            <label>Lance Mínimo (R$)</label>
                            <input type="number" step="0.01" id="min-${itemId}" value="${pItem.min}" placeholder="0,00" style="border-color: rgba(255,77,77,0.3);">
                        </div>
                        <div class="grupo-input">
                            <label>Lance Inicial/Máx (R$)</label>
                            <input type="number" step="0.01" id="max-${itemId}" value="${pItem.max}" placeholder="0,00" style="border-color: rgba(33,141,78,0.3);">
                        </div>
                    </div>
                </div>
            `;
        }
    });

    if(divDisputa.innerHTML === "") {
        divDisputa.innerHTML = `<p style="color: #A0B0C0; font-size: 12px; padding: 15px; text-align: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px;">Nenhum item selecionado. Marque os itens na aba "Itens do Edital" primeiro.</p>`;
    }
}

window.toggleItemDisputa = function(itemId) {
    if(!licitacaoAtivaCrm) return;
    itemId = String(itemId);
    
    atualizarLicitacaoCrm(licitacaoAtivaCrm.numero_controle, (item) => {
        let selecionados = item.itens_disputa || [];
        if(selecionados.includes(itemId)) {
            selecionados = selecionados.filter(i => i !== itemId);
        } else {
            selecionados.push(itemId);
        }
        item.itens_disputa = selecionados;
        licitacaoAtivaCrm.itens_disputa = selecionados;
    });
    
    renderizarItensEDisputa();
};

window.salvarPrecificacaoGeral = function() {
    if(!licitacaoAtivaCrm) return;
    const selecionados = licitacaoAtivaCrm.itens_disputa || [];
    const novaPrecificacao = licitacaoAtivaCrm.precificacao || {};

    selecionados.forEach(itemId => {
        novaPrecificacao[itemId] = {
            custo: document.getElementById(`custo-${itemId}`)?.value || "",
            extras: document.getElementById(`extras-${itemId}`)?.value || "",
            min: document.getElementById(`min-${itemId}`)?.value || "",
            max: document.getElementById(`max-${itemId}`)?.value || ""
        };
    });

    atualizarLicitacaoCrm(licitacaoAtivaCrm.numero_controle, (item) => {
        item.precificacao = novaPrecificacao;
        licitacaoAtivaCrm.precificacao = novaPrecificacao;
    });

    mostrarModalSucesso("Precificação Salva", "Os valores de custos e limites de lance foram guardados com sucesso.");
};

function atualizarLicitacaoCrm(numeroControle, alteracaoCallback) {
    let crm = JSON.parse(localStorage.getItem('conecta_crm') || '[]');
    const index = crm.findIndex(i => i.numero_controle === numeroControle);
    if(index > -1) {
        alteracaoCallback(crm[index]);
        localStorage.setItem('conecta_crm', JSON.stringify(crm));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderizarKanban();
});