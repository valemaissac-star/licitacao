// ==========================================================
// CONECTA LICITAÇÕES - MOTOR DE CÁLCULO, CRM E PERSISTÊNCIA
// ==========================================================

// Controles Visuais Principais
const radiosModo = document.querySelectorAll('input[name="calc-modo"]');
const radiosTipo = document.querySelectorAll('input[name="calc-tipo"]');
const radiosRegime = document.querySelectorAll('input[name="calc-regime"]');
const inputQuantidade = document.getElementById('calc-quantidade');

// Blocos de UI
const btnAbrirSeletor = document.getElementById('btn-abrir-seletor-crm');
const boxItemSelecionado = document.getElementById('box-item-selecionado');
const btnSalvarCrm = document.getElementById('btn-salvar-crm');

const blocoBens = document.getElementById('bloco-custos-bens');
const blocoServicos = document.getElementById('bloco-custos-servicos');

const blocoSimples = document.querySelectorAll('.bloco-simples');
const blocoLucro = document.querySelectorAll('.bloco-lucro');
const blocoLucroBens = document.querySelectorAll('.bloco-lucro-bens');
const blocoLucroServ = document.querySelectorAll('.bloco-lucro-serv');

// Inputs Genéricos
const inputsMoeda = document.querySelectorAll('.input-moeda');
const inputsPercentual = document.querySelectorAll('.input-percentual');
const selectsTipoEntrada = document.querySelectorAll('.tipo-entrada-custo');

const inputMargemAlvo = document.getElementById('margem-alvo');
const inputMargemPiso = document.getElementById('margem-piso');
const inputTaxaPlataforma = document.getElementById('taxa-plataforma');

// Outputs
const alertaMarkup = document.getElementById('alerta-markup');
const alertaOrcamento = document.getElementById('alerta-orcamento');
const indicadorStatus = document.getElementById('indicador-status');

// Variáveis de Estado
let cotacaoAtual = null; 
let itemEmPrecificacao = null; 
let itensDaLicitacaoAtual = []; 

// ==========================================================
// PERSISTÊNCIA (AUTO-SAVE)
// ==========================================================
function salvarEstado() {
    const estado = {
        modo: document.querySelector('input[name="calc-modo"]:checked').value,
        tipo: document.querySelector('input[name="calc-tipo"]:checked').value,
        regime: document.querySelector('input[name="calc-regime"]:checked').value,
        quantidade: inputQuantidade.value,
        itemCrm: itemEmPrecificacao,
        inputs: {}
    };

    document.querySelectorAll('.input-moeda, .input-percentual').forEach(input => {
        if(input.id) estado.inputs[input.id] = input.value;
    });
    
    document.querySelectorAll('.tipo-entrada-custo').forEach(select => {
        if(select.dataset.id) estado.inputs['sel_' + select.dataset.id] = select.value;
    });

    localStorage.setItem('conecta_calc_estado', JSON.stringify(estado));
    
    indicadorStatus.style.display = 'inline';
    setTimeout(() => indicadorStatus.style.display = 'none', 2000);
}

function carregarEstado() {
    const estadoStr = localStorage.getItem('conecta_calc_estado');
    if (estadoStr) {
        const estado = JSON.parse(estadoStr);
        
        document.querySelector(`input[name="calc-modo"][value="${estado.modo}"]`).checked = true;
        document.querySelector(`input[name="calc-tipo"][value="${estado.tipo}"]`).checked = true;
        document.querySelector(`input[name="calc-regime"][value="${estado.regime}"]`).checked = true;
        inputQuantidade.value = estado.quantidade || 1;
        itemEmPrecificacao = estado.itemCrm || null;

        for (const [key, value] of Object.entries(estado.inputs)) {
            if (key.startsWith('sel_')) {
                const select = document.querySelector(`select[data-id="${key.replace('sel_', '')}"]`);
                if (select) select.value = value;
            } else {
                const input = document.getElementById(key);
                if (input) input.value = value;
            }
        }
    }
    atualizarContexto();
}

// ==========================================================
// LÓGICA DE UI E CÁLCULO
// ==========================================================
function atualizarContexto() {
    const modo = document.querySelector('input[name="calc-modo"]:checked').value;
    const tipo = document.querySelector('input[name="calc-tipo"]:checked').value;
    const regime = document.querySelector('input[name="calc-regime"]:checked').value;

    if (modo === 'crm') {
        btnAbrirSeletor.style.display = itemEmPrecificacao ? 'none' : 'block';
        boxItemSelecionado.style.display = itemEmPrecificacao ? 'block' : 'none';
        btnSalvarCrm.style.display = itemEmPrecificacao ? 'flex' : 'none';
        
        if (itemEmPrecificacao) {
            document.getElementById('lbl-crm-orgao').textContent = itemEmPrecificacao.orgao;
            document.getElementById('lbl-crm-item-nome').textContent = `Item ${itemEmPrecificacao.numero_item} - ${itemEmPrecificacao.descricao}`;
            document.getElementById('lbl-crm-pncp').textContent = itemEmPrecificacao.numero_controle;
            document.getElementById('lbl-crm-orcamento').textContent = `R$ ${formatarDinheiroStr(itemEmPrecificacao.valor_estimado)}`;
            
            if (inputQuantidade.value != itemEmPrecificacao.quantidade) {
                inputQuantidade.value = itemEmPrecificacao.quantidade;
            }
        }
    } else {
        btnAbrirSeletor.style.display = 'none';
        boxItemSelecionado.style.display = 'none';
        btnSalvarCrm.style.display = 'none';
    }

    if (tipo === 'bens') {
        blocoBens.style.display = 'block';
        blocoServicos.style.display = 'none';
        document.getElementById('lbl-resumo-base').textContent = "Custo Base (Produto)";
        document.getElementById('lbl-resumo-frete').textContent = "Frete e Logística";
        document.getElementById('lbl-resumo-garantia').textContent = "Garantia / Embalagem";
    } else {
        blocoBens.style.display = 'none';
        blocoServicos.style.display = 'block';
        document.getElementById('lbl-resumo-base').textContent = "Mão de Obra";
        document.getElementById('lbl-resumo-frete').textContent = "Deslocação / Estadia";
        document.getElementById('lbl-resumo-garantia').textContent = "Materiais Aplicados";
    }

    if (regime === 'mei') {
        blocoSimples.forEach(el => el.style.display = 'none');
        blocoLucro.forEach(el => el.style.display = 'none');
    } else if (regime === 'simples') {
        blocoSimples.forEach(el => el.style.display = 'flex');
        blocoLucro.forEach(el => el.style.display = 'none');
    } else if (regime === 'lucro') {
        blocoSimples.forEach(el => el.style.display = 'none');
        document.getElementById('taxa-pis-cofins').parentElement.parentElement.style.display = 'flex';
        
        if (tipo === 'bens') {
            blocoLucroBens.forEach(el => el.style.display = 'flex');
            blocoLucroServ.forEach(el => el.style.display = 'none');
        } else {
            blocoLucroBens.forEach(el => el.style.display = 'none');
            blocoLucroServ.forEach(el => el.style.display = 'flex');
        }
    }
    
    calcularPreco();
}

radiosModo.forEach(r => r.addEventListener('change', () => { 
    if(r.value === 'simulacao') itemEmPrecificacao = null; 
    atualizarContexto(); 
}));
radiosTipo.forEach(r => r.addEventListener('change', atualizarContexto));
radiosRegime.forEach(r => r.addEventListener('change', atualizarContexto));
inputQuantidade.addEventListener('input', calcularPreco);
selectsTipoEntrada.forEach(s => s.addEventListener('change', calcularPreco));

function limparValorStr(str) {
    if (!str) return 0;
    const limpo = str.replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(limpo);
    return isNaN(valor) ? 0 : valor;
}
function formatarDinheiroStr(num) {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const handleInput = function(e) {
    let valor = e.target.value.replace(/\D/g, "");
    if (!valor) { e.target.value = ""; calcularPreco(); return; }
    valor = (parseInt(valor, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    e.target.value = valor;
    calcularPreco();
};

inputsMoeda.forEach(input => input.addEventListener('input', handleInput));
inputsPercentual.forEach(input => input.addEventListener('input', handleInput));

function calcularPreco() {
    const tipo = document.querySelector('input[name="calc-tipo"]:checked').value;
    const regime = document.querySelector('input[name="calc-regime"]:checked').value;
    const qtd = parseInt(inputQuantidade.value) || 1;
    document.getElementById('res-qtd-titulo').textContent = qtd;

    let custoUnitario = 0;
    let resumo = { base: 0, frete: 0, garantia: 0, outros: 0 };
    
    const prefixo = tipo === 'bens' ? 'bens' : 'serv';
    
    ['base', 'frete', 'garantia', 'outros'].forEach(cat => {
        const select = document.querySelector(`select[data-id="${prefixo}-${cat}"]`);
        const input = document.getElementById(`custo-${prefixo}-${cat}`);
        if (select && input) {
            let val = limparValorStr(input.value);
            if (val > 0) {
                let valorParaUnitario = select.value === 'total' ? (val / qtd) : val;
                custoUnitario += valorParaUnitario;
                resumo[cat] = valorParaUnitario * qtd;
            }
        }
    });

    const custoGlobal = custoUnitario * qtd;

    document.getElementById('res-detalhe-base').textContent = `R$ ${formatarDinheiroStr(resumo.base)}`;
    document.getElementById('res-detalhe-frete').textContent = `R$ ${formatarDinheiroStr(resumo.frete)}`;
    document.getElementById('res-detalhe-garantia').textContent = `R$ ${formatarDinheiroStr(resumo.garantia)}`;
    document.getElementById('res-detalhe-outros').textContent = `R$ ${formatarDinheiroStr(resumo.outros)}`;

    let totalImpostos = 0;
    if (regime === 'simples') { totalImpostos += limparValorStr(document.getElementById('taxa-das').value); } 
    else if (regime === 'lucro') {
        totalImpostos += limparValorStr(document.getElementById('taxa-pis-cofins').value);
        if (tipo === 'bens') {
            totalImpostos += limparValorStr(document.getElementById('taxa-icms').value);
            totalImpostos += limparValorStr(document.getElementById('taxa-ipi').value);
        } else {
            totalImpostos += limparValorStr(document.getElementById('taxa-iss').value);
        }
    }
    
    const taxaPlataforma = limparValorStr(inputTaxaPlataforma.value);
    const cargaFixaBase = totalImpostos + taxaPlataforma;

    const margemAlvo = limparValorStr(inputMargemAlvo.value);
    const margemPiso = limparValorStr(inputMargemPiso.value);
    
    document.getElementById('badge-alvo-margem').textContent = `${margemAlvo}% M.L.`;
    document.getElementById('badge-piso-margem').textContent = `${margemPiso}% M.L.`;

    const somaPercentuaisAlvo = (cargaFixaBase + margemAlvo) / 100;
    const somaPercentuaisPiso = (cargaFixaBase + margemPiso) / 100;

    if (somaPercentuaisAlvo >= 0.99 || somaPercentuaisPiso >= 0.99) {
        alertaMarkup.style.display = 'block';
        alertaOrcamento.style.display = 'none';
        document.getElementById('res-preco-alvo-unit').textContent = 'ERRO'; 
        document.getElementById('res-preco-piso-unit').textContent = 'ERRO';
        cotacaoAtual = null;
        salvarEstado();
        return;
    } else {
        alertaMarkup.style.display = 'none';
    }

    const precoAlvoUnit = custoUnitario > 0 ? (custoUnitario / (1 - somaPercentuaisAlvo)) : 0;
    const precoPisoUnit = custoUnitario > 0 ? (custoUnitario / (1 - somaPercentuaisPiso)) : 0;

    const precoAlvoTotal = precoAlvoUnit * qtd;
    const precoPisoTotal = precoPisoUnit * qtd;

    if (itemEmPrecificacao && itemEmPrecificacao.valor_estimado > 0) {
        if (precoAlvoUnit > itemEmPrecificacao.valor_estimado) {
            alertaOrcamento.style.display = 'block';
        } else {
            alertaOrcamento.style.display = 'none';
        }
    } else {
        alertaOrcamento.style.display = 'none';
    }

    document.getElementById('res-custo-total').textContent = `R$ ${formatarDinheiroStr(custoGlobal)}`;
    document.getElementById('res-carga-taxas').textContent = `${formatarDinheiroStr(cargaFixaBase)}%`;

    document.getElementById('res-preco-alvo-unit').textContent = `R$ ${formatarDinheiroStr(precoAlvoUnit)}`;
    document.getElementById('res-preco-alvo-total').textContent = `R$ ${formatarDinheiroStr(precoAlvoTotal)}`;
    document.getElementById('res-lucro-alvo-total').textContent = `R$ ${formatarDinheiroStr(precoAlvoTotal * (margemAlvo / 100))}`;

    document.getElementById('res-preco-piso-unit').textContent = `R$ ${formatarDinheiroStr(precoPisoUnit)}`;
    document.getElementById('res-preco-piso-total').textContent = `R$ ${formatarDinheiroStr(precoPisoTotal)}`;
    document.getElementById('res-lucro-piso-total').textContent = `R$ ${formatarDinheiroStr(precoPisoTotal * (margemPiso / 100))}`;

    cotacaoAtual = {
        id_cotacao: Date.now().toString(), data: new Date().toISOString(),
        tipo, regime, quantidade: qtd, custoUnitario, cargaTaxas: cargaFixaBase,
        margemAlvo, precoAlvoUnitario: precoAlvoUnit, precoAlvoTotal,
        margemPiso, precoPisoUnitario: precoPisoUnit, precoPisoTotal
    };
    
    salvarEstado(); 
}

window.limparCalculadora = function() {
    if(confirm("Pretende limpar todos os campos e perder o rascunho atual?")) {
        localStorage.removeItem('conecta_calc_estado');
        location.reload(); 
    }
}

// ==========================================================
// INTEGRAÇÃO CRM: SELEÇÃO CRUZADA (MEMÓRIA x PNCP)
// ==========================================================
const modalCrm = document.getElementById('modal-selecionar-item');
const listaCrmHTML = document.getElementById('lista-licitacoes-crm');
const listaItensCrmHTML = document.getElementById('lista-itens-crm');
const inputPesquisaCrm = document.getElementById('pesquisa-crm-input');

window.abrirModalSelecaoCrm = function() {
    inputPesquisaCrm.value = "";
    document.getElementById('passo-1-licitacao').style.display = 'block';
    document.getElementById('passo-2-item').style.display = 'none';
    carregarLicitacoesCrm();
    modalCrm.style.display = "flex";
}

window.fecharModalSelecaoCrm = function() {
    modalCrm.style.display = "none";
}

function carregarLicitacoesCrm(filtro = "") {
    const crmData = JSON.parse(localStorage.getItem('conecta_crm') || "[]");
    listaCrmHTML.innerHTML = "";
    
    if (crmData.length === 0) {
        listaCrmHTML.innerHTML = `<div style="text-align:center; padding: 20px; color: #7A8B9E;">Nenhuma licitação salva no CRM.</div>`;
        return;
    }

    const filtrados = crmData.filter(item => {
        const obj = item.dados_originais?.licitacao?.objetoCompra || "";
        return obj.toLowerCase().includes(filtro.toLowerCase()) || item.numero_controle.includes(filtro);
    });

    filtrados.forEach(item => {
        const obj = item.dados_originais?.licitacao?.objetoCompra || "Objeto não informado";
        const div = document.createElement('div');
        div.className = 'item-crm';
        div.innerHTML = `<strong>${obj}</strong><span>Nº PNCP: ${item.numero_controle}</span>`;
        div.onclick = () => verItensLicitacao(item.numero_controle);
        listaCrmHTML.appendChild(div);
    });
}

window.filtrarListaCrm = function() { carregarLicitacoesCrm(inputPesquisaCrm.value); }

window.verItensLicitacao = async function(numeroControle) {
    document.getElementById('passo-1-licitacao').style.display = 'none';
    document.getElementById('passo-2-item').style.display = 'block';
    
    // 1. Identificar quais itens o utilizador já marcou no CRM (em disputa ou com cotação)
    const crmData = JSON.parse(localStorage.getItem('conecta_crm') || "[]");
    const lic = crmData.find(i => i.numero_controle === numeroControle);
    
    let numerosInteresse = [];
    if (lic && lic.itens_disputa) {
        lic.itens_disputa.forEach(i => {
            const o = i.item || i;
            const num = o.numeroItem || o.numero_item || o.id;
            if(num) numerosInteresse.push(parseInt(num, 10));
        });
    }
    if (lic && lic.cotacoes_salvas) {
        lic.cotacoes_salvas.forEach(c => {
            if(c.numero_item) numerosInteresse.push(parseInt(c.numero_item, 10));
        });
    }

    listaItensCrmHTML.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #6699FF;">
            <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
            <strong>Sincronizando itens oficiais...</strong><br>
            <span style="font-size: 11px; color: #7A8B9E;">Validando dados ao vivo com o PNCP</span>
        </div>
    `;

    try {
        const partes = numeroControle.split('/');
        const ano = partes[1];
        const subPartes = partes[0].split('-');
        const cnpj = subPartes[0];
        const sequencial = parseInt(subPartes[subPartes.length - 1], 10);
        
        const urlAPI = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=500`;
        
        const resposta = await fetch(urlAPI);
        if (!resposta.ok) throw new Error("Falha na API do PNCP");
        
        const dados = await resposta.json();
        
        let itensRetornados = [];
        if (Array.isArray(dados)) itensRetornados = dados;
        else if (dados.data && Array.isArray(dados.data)) itensRetornados = dados.data;
        else if (dados.items && Array.isArray(dados.items)) itensRetornados = dados.items;
        else if (dados.itens && Array.isArray(dados.itens)) itensRetornados = dados.itens;

        if (itensRetornados.length === 0) throw new Error("Edital sem itens na API");
        
        // 2. Filtra os itens: Tenta achar os que o usuário marcou. 
        // Usamos parseInt para garantir que "01" bata com "1".
        let itensFiltrados = [];
        if (numerosInteresse.length > 0) {
            itensFiltrados = itensRetornados.filter(itemBruto => {
                const o = itemBruto.item || itemBruto;
                const num = parseInt(o.numeroItem || o.numero_item || o.id, 10);
                return numerosInteresse.includes(num);
            });
        }

        // 3. FALLBACK INTELIGENTE: Se o filtro não achou nada (ou se o usuário não escolheu itens no CRM), exibe TODOS!
        let filtroAplicado = false;
        if (itensFiltrados.length > 0) {
            itensDaLicitacaoAtual = itensFiltrados;
            filtroAplicado = true;
        } else {
            itensDaLicitacaoAtual = itensRetornados;
        }

        renderizarItensNoModal(numeroControle, filtroAplicado);

    } catch (e) {
        console.error("Erro na busca direta:", e);
        // Fallback para os dados que já estavam guardados offline no CRM
        if (lic && lic.dados_originais && lic.dados_originais.itens) {
            itensDaLicitacaoAtual = lic.dados_originais.itens;
        } else {
            itensDaLicitacaoAtual = [];
        }
        
        if (itensDaLicitacaoAtual.length === 0) {
            listaItensCrmHTML.innerHTML = `<div style="color: #FF6B6B; text-align: center; padding: 20px;">Falha ao carregar itens da API e nenhum dado salvo localmente.</div>`;
        } else {
            renderizarItensNoModal(numeroControle, false);
        }
    }
}

function renderizarItensNoModal(numeroControle, filtroAplicado) {
    let html = "";

    if (filtroAplicado) {
        html += `
            <div style="background: rgba(33, 141, 78, 0.1); border-left: 3px solid #4ADE80; padding: 10px; margin-bottom: 15px; font-size: 11px; color: #A0B0C0; border-radius: 4px;">
                🎯 Exibindo <strong>apenas</strong> os itens que você selecionou no CRM para disputa.
            </div>
        `;
    } else {
        html += `
            <div style="background: rgba(102, 153, 255, 0.1); border-left: 3px solid #6699FF; padding: 10px; margin-bottom: 15px; font-size: 11px; color: #A0B0C0; border-radius: 4px;">
                ℹ️ Como ainda não selecionou itens específicos no CRM, estou a exibir <strong>todos os itens</strong> do edital.
            </div>
        `;
    }

    itensDaLicitacaoAtual.forEach((itemBruto, index) => {
        const item = itemBruto.item || itemBruto; 

        const numItem = item.numeroItem || item.numero_item || item.id || (index + 1);
        
        let desc = "Item sem descrição";
        if(item.descricao) desc = item.descricao;
        else if(item.materialOuServicoNome) desc = item.materialOuServicoNome;
        else if(item.materialOuServico && item.materialOuServico.nome) desc = item.materialOuServico.nome;
        else if(item.titulo) desc = item.titulo;

        const valorEst = item.valorUnitarioEstimado || item.valorEstimado || 0;
        const qtd = item.quantidade || item.quantidade_item || item.quantidadeItem || 1;
        
        html += `
            <div class="item-crm" onclick="selecionarItemCrm(${index}, '${numeroControle}')">
                <div style="display:flex; justify-content:space-between;">
                    <strong>Item ${numItem}</strong>
                    <span style="color:#4ADE80; font-weight:bold;">Orçado: R$ ${formatarDinheiroStr(valorEst)}</span>
                </div>
                <span>${desc} (Qtd: ${qtd})</span>
            </div>
        `;
    });
    listaItensCrmHTML.innerHTML = html;
}

window.voltarPasso1Crm = function() {
    document.getElementById('passo-1-licitacao').style.display = 'block';
    document.getElementById('passo-2-item').style.display = 'none';
}

window.selecionarItemCrm = function(indexItem, numeroControle) {
    const itemBruto = itensDaLicitacaoAtual[indexItem];
    const item = itemBruto.item || itemBruto; 
    const crmData = JSON.parse(localStorage.getItem('conecta_crm') || "[]");
    const lic = crmData.find(i => i.numero_controle === numeroControle);

    const numItem = item.numeroItem || item.numero_item || item.id || (indexItem + 1);
    
    let desc = "Item sem descrição";
    if(item.descricao) desc = item.descricao;
    else if(item.materialOuServicoNome) desc = item.materialOuServicoNome;
    else if(item.materialOuServico && item.materialOuServico.nome) desc = item.materialOuServico.nome;
    else if(item.titulo) desc = item.titulo;

    const valorEst = item.valorUnitarioEstimado || item.valorEstimado || 0;
    const qtd = item.quantidade || item.quantidade_item || item.quantidadeItem || 1;

    itemEmPrecificacao = {
        numero_controle: numeroControle,
        numero_item: numItem,
        descricao: desc,
        quantidade: qtd,
        valor_estimado: valorEst,
        orgao: lic?.dados_originais?.licitacao?.orgaoEntidade?.razaoSocial || "Órgão Não Informado"
    };

    inputQuantidade.value = itemEmPrecificacao.quantidade;
    
    fecharModalSelecaoCrm();
    atualizarContexto(); 
}

window.efetivarSalvamentoCrm = function() {
    if (!itemEmPrecificacao || !cotacaoAtual || cotacaoAtual.precoAlvoTotal === 0) return;

    let crmData = JSON.parse(localStorage.getItem('conecta_crm') || "[]");
    const index = crmData.findIndex(i => i.numero_controle === itemEmPrecificacao.numero_controle);
    
    if(index > -1) {
        if (!crmData[index].cotacoes_salvas) crmData[index].cotacoes_salvas = [];
        
        cotacaoAtual.numero_item = itemEmPrecificacao.numero_item;
        cotacaoAtual.descricao_item = itemEmPrecificacao.descricao;
        
        crmData[index].cotacoes_salvas = crmData[index].cotacoes_salvas.filter(c => c.numero_item !== itemEmPrecificacao.numero_item);
        crmData[index].cotacoes_salvas.push(cotacaoAtual);
        
        localStorage.setItem('conecta_crm', JSON.stringify(crmData));
        alert(`✅ Cotação salva no Item ${itemEmPrecificacao.numero_item} com sucesso!`);
    } else {
        alert("Erro: A licitação original não foi encontrada no CRM.");
    }
}

// Inicializar carregando estado guardado
document.addEventListener("DOMContentLoaded", carregarEstado);