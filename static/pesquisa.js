// ==========================================================
// CONECTA LICITAÇÕES - SCRIPT DE PESQUISA COM PERSISTÊNCIA E NOVO LAYOUT
// ==========================================================

const modalidadesDisponiveis = [
    { id: 1, nome: "Leilão - Eletrônico" }, { id: 2, nome: "Diálogo Competitivo" }, { id: 3, nome: "Concurso" },
    { id: 4, nome: "Concorrência - Eletrônica" }, { id: 5, nome: "Concorrência - Presencial" }, { id: 6, nome: "Pregão - Eletrônico" },
    { id: 7, nome: "Pregão - Presencial" }, { id: 8, nome: "Dispensa de Licitação" }, { id: 9, nome: "Inexigibilidade" },
    { id: 10, nome: "Manifestação de Interesse" }, { id: 11, nome: "Pré-qualificação" }, { id: 12, nome: "Credenciamento" }, { id: 13, nome: "Leilão - Presencial" }
];

const estadosBrasil = [
    { uf: "AC", nome: "Acre" }, { uf: "AL", nome: "Alagoas" }, { uf: "AP", nome: "Amapá" }, { uf: "AM", nome: "Amazonas" },
    { uf: "BA", nome: "Bahia" }, { uf: "CE", nome: "Ceará" }, { uf: "DF", nome: "Distrito Federal" }, { uf: "ES", nome: "Espírito Santo" },
    { uf: "GO", nome: "Goiás" }, { uf: "MA", nome: "Maranhão" }, { uf: "MT", nome: "Mato Grosso" }, { uf: "MS", nome: "Mato Grosso do Sul" },
    { uf: "MG", nome: "Minas Gerais" }, { uf: "PA", nome: "Pará" }, { uf: "PB", nome: "Paraíba" }, { uf: "PR", nome: "Paraná" },
    { uf: "PE", nome: "Pernambuco" }, { uf: "PI", nome: "Piauí" }, { uf: "RJ", nome: "Rio de Janeiro" }, { uf: "RN", nome: "Rio Grande do Norte" },
    { uf: "RS", nome: "Rio Grande do Sul" }, { uf: "RO", nome: "Rondônia" }, { uf: "RR", nome: "Roraima" }, { uf: "SC", nome: "Santa Catarina" },
    { uf: "SP", nome: "São Paulo" }, { uf: "SE", nome: "Sergipe" }, { uf: "TO", nome: "Tocantins" }
];

const esferasDisponiveis = [ { id: "F", nome: "Federal" }, { id: "E", nome: "Estadual" }, { id: "M", nome: "Municipal" }, { id: "D", nome: "Distrital" } ];

// REGRA APLICADA: SOMENTE 2 OPÇÕES NO FRONTEND
const tiposDisponiveis = [ { id: "Bens", nome: "Bens / Materiais" }, { id: "Servicos", nome: "Serviços e Obras" } ];

let modalidadesSelecionadas = [];
let ufsSelecionadas = [];
let municipiosDisponiveis = [];
let municipiosSelecionados = [];
let esferasSelecionadas = [];
let tiposSelecionados = [];
const cacheMunicipios = {};

// Variáveis de Paginação e Ordenação
let dadosReais = [];
let dadosFiltradosOrdenados = [];
let ultimosResultadosBusca = []; // Usado para salvar no CRM
let currentPage = 1;
let itemsPerPage = 10;
let currentSort = 'recente';

const campoStatus = document.getElementById("status");
const opcoesStatus = document.querySelectorAll('input[name="status-visual"]');
const valorMinimo = document.getElementById("valor-minimo");
const valorMaximo = document.getElementById("valor-maximo");
const rangeValorMinimo = document.getElementById("range-valor-minimo");
const rangeValorMaximo = document.getElementById("range-valor-maximo");
const faixaValoresSelecionada = document.getElementById("faixa-valores-selecionada");
const quantidadeItensMinima = document.getElementById("quantidade-itens-minima");
const quantidadeItensMaxima = document.getElementById("quantidade-itens-maxima");
const botaoLimpar = document.getElementById("botao-limpar");
const botaoBuscar = document.getElementById("botao-buscar");

function normalizarTexto(texto) { return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

function formatarDataParaExibicao(dataIso) {
    if (!dataIso) return "";
    const partes = dataIso.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataIso;
}

function configurarInputsDeData() {
    const idsDatas = ["data-publicacao-inicio", "data-publicacao-fim", "data-propostas-inicio", "data-propostas-fim"];
    idsDatas.forEach(id => {
        const input = document.getElementById(id);
        if(!input) return;
        
        input.addEventListener("focus", function() {
            this.type = "date";
            if(this.dataset.valiso) {
                this.value = this.dataset.valiso;
            }
        });
        
        input.addEventListener("blur", function() {
            if (this.value) {
                this.dataset.valiso = this.value;
                this.type = "text";
                this.value = formatarDataParaExibicao(this.dataset.valiso);
            } else {
                this.type = "text";
                this.dataset.valiso = "";
            }
            salvarEstadoPesquisa();
        });
    });
}
configurarInputsDeData();

const infoUfs = document.getElementById("info-ufs");
if (infoUfs) infoUfs.style.display = "none";
const tooltipUfs = document.getElementById("tooltip-ufs");
const listaTooltipUfs = document.getElementById("lista-tooltip-ufs");

const infoMunicipios = document.getElementById("info-municipios");
if (infoMunicipios) infoMunicipios.style.display = "none";
const tooltipMunicipios = document.getElementById("tooltip-municipios");
const listaTooltipMunicipios = document.getElementById("lista-tooltip-municipios");

function fecharTodasTooltips() {
    if(tooltipUfs) tooltipUfs.classList.remove("visivel");
    if(tooltipMunicipios) tooltipMunicipios.classList.remove("visivel");
}

if (infoUfs) {
    infoUfs.addEventListener("click", e => {
        e.stopPropagation(); fecharTodosMenus();
        const visivel = tooltipUfs.classList.contains("visivel");
        fecharTodasTooltips();
        if (!visivel) tooltipUfs.classList.add("visivel");
    });
}

if (infoMunicipios) {
    infoMunicipios.addEventListener("click", e => {
        e.stopPropagation(); fecharTodosMenus();
        const visivel = tooltipMunicipios.classList.contains("visivel");
        fecharTodasTooltips();
        if (!visivel) tooltipMunicipios.classList.add("visivel");
    });
}

document.querySelectorAll(".sanfona-cabecalho").forEach(botao => {
    botao.addEventListener("click", () => {
        const sanfona = botao.closest(".sanfona");
        const estaAberta = sanfona.classList.contains("aberta");
        sanfona.classList.toggle("aberta");
        botao.setAttribute("aria-expanded", !estaAberta);
    });
});

function definirStatus(valor) {
    const valoresPermitidos = ["recebendo", "propostas_encerradas", "encerradas", "todos"];
    const valorFinal = valoresPermitidos.includes(valor) ? valor : "recebendo";
    if(campoStatus) campoStatus.value = valorFinal;
    opcoesStatus.forEach(opcao => opcao.checked = (opcao.value === valorFinal));
    salvarEstadoPesquisa();
}

opcoesStatus.forEach(opcao => {
    opcao.addEventListener("change", function() { if (this.checked) definirStatus(this.value); });
});

function configurarMultiselectSimples(config) {
    const { idCampo, listaDisponiveis, getSelecionados, setSelecionados } = config;
    const menu = document.getElementById(`menu-${idCampo}`);
    const botao = document.getElementById(`botao-${idCampo}`);
    const texto = document.getElementById(`texto-${idCampo}`);
    const listaHtml = document.getElementById(`lista-${idCampo}`);
    const contador = document.getElementById(`contador-${idCampo}`);
    const limpar = document.getElementById(`limpar-${idCampo}`);
    const concluir = document.getElementById(`concluir-${idCampo}`);
    if(!menu) return null;
    
    function atualizarCampo() {
        const selecionados = getSelecionados();
        if (selecionados.length === 0) {
            texto.textContent = `Selecione os ${idCampo}`;
            contador.textContent = "0 selecionados";
        } else if (selecionados.length <= 2) {
            const nomes = selecionados.map(id => listaDisponiveis.find(item => item.id === id)?.nome || id);
            texto.textContent = nomes.join(", ");
            contador.textContent = selecionados.length === 1 ? "1 selecionado" : `${selecionados.length} selecionados`;
        } else {
            texto.textContent = `${selecionados.length} selecionados`;
            contador.textContent = `${selecionados.length} selecionados`;
        }
    }

    function renderizarLista() {
        listaHtml.innerHTML = "";
        listaDisponiveis.forEach(item => {
            const selecionado = getSelecionados().includes(item.id);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `opcao-${idCampo.slice(0,-1)} ${selecionado ? 'selecionado' : ''}`;
            btn.innerHTML = `<span class="checkbox-${idCampo.slice(0,-1)}">✓</span><span class="nome-${idCampo.slice(0,-1)}">${item.nome}</span>`;
            btn.addEventListener("click", (e) => {
                e.preventDefault(); e.stopPropagation();
                const atuais = getSelecionados();
                const index = atuais.indexOf(item.id);
                if (index === -1) atuais.push(item.id); else atuais.splice(index, 1);
                setSelecionados(atuais); atualizarCampo(); renderizarLista(); salvarEstadoPesquisa();
            });
            listaHtml.appendChild(btn);
        });
    }

    botao.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation(); 
        const estavaAberto = menu.classList.contains("aberto");
        fecharTodosMenus(); fecharTodasTooltips();
        if (!estavaAberto) { menu.classList.add("aberto"); renderizarLista(); }
    });

    limpar.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); setSelecionados([]); atualizarCampo(); renderizarLista(); salvarEstadoPesquisa(); });
    concluir.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); menu.classList.remove("aberto"); });
    menu.addEventListener("click", e => e.stopPropagation());
    atualizarCampo();
    return { atualizarCampo, renderizarLista, menu, botao };
}

const esferasCtrl = configurarMultiselectSimples({ idCampo: "esferas", listaDisponiveis: esferasDisponiveis, getSelecionados: () => esferasSelecionadas, setSelecionados: (val) => { esferasSelecionadas = val; } });
const tiposCtrl = configurarMultiselectSimples({ idCampo: "tipos", listaDisponiveis: tiposDisponiveis, getSelecionados: () => tiposSelecionados, setSelecionados: (val) => { tiposSelecionados = val; } });

const menuModalidades = document.getElementById("menu-modalidades");
const botaoModalidades = document.getElementById("botao-modalidades");
const pesquisaModalidades = document.getElementById("pesquisa-modalidades");

function atualizarCampoModalidades() {
    const texto = document.getElementById("texto-modalidades");
    const contador = document.getElementById("contador-modalidades");
    if(!texto) return;
    if (modalidadesSelecionadas.length === 0) {
        texto.textContent = "Selecione as modalidades"; if(contador) contador.textContent = "0 selecionadas";
    } else if (modalidadesSelecionadas.length === 1) {
        texto.textContent = modalidadesDisponiveis.find(m => m.id === modalidadesSelecionadas[0])?.nome || "1 selecionada"; if(contador) contador.textContent = "1 selecionada";
    } else {
        texto.textContent = `${modalidadesSelecionadas.length} modalidades selecionadas`; if(contador) contador.textContent = `${modalidadesSelecionadas.length} selecionadas`;
    }
}

function renderizarModalidades(termo = "") {
    const lista = document.getElementById("lista-modalidades"); if(!lista) return; lista.innerHTML = "";
    const filtrados = modalidadesDisponiveis.filter(m => normalizarTexto(m.nome).includes(normalizarTexto(termo)));
    filtrados.forEach(m => {
        const sel = modalidadesSelecionadas.includes(m.id);
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = `opcao-modalidade ${sel ? 'selecionado' : ''}`;
        btn.innerHTML = `<span class="checkbox-modalidade">✓</span><span class="nome-modalidade">${m.nome}</span>`;
        btn.addEventListener("click", e => {
            e.stopPropagation(); const idx = modalidadesSelecionadas.indexOf(m.id);
            if (idx === -1) modalidadesSelecionadas.push(m.id); else modalidadesSelecionadas.splice(idx, 1);
            atualizarCampoModalidades(); renderizarModalidades(pesquisaModalidades.value); salvarEstadoPesquisa();
        });
        lista.appendChild(btn);
    });
}

if(botaoModalidades) {
    botaoModalidades.addEventListener("click", e => { 
        e.stopPropagation(); const estavaAberto = menuModalidades.classList.contains("aberto");
        fecharTodosMenus(); fecharTodasTooltips(); 
        if (!estavaAberto) { menuModalidades.classList.add("aberto"); renderizarModalidades(); }
    });
    document.getElementById("limpar-modalidades").addEventListener("click", e => { e.stopPropagation(); modalidadesSelecionadas = []; atualizarCampoModalidades(); renderizarModalidades(); salvarEstadoPesquisa(); });
    document.getElementById("concluir-modalidades").addEventListener("click", e => { e.stopPropagation(); menuModalidades.classList.remove("aberto"); });
    pesquisaModalidades.addEventListener("input", e => renderizarModalidades(e.target.value));
    menuModalidades.addEventListener("click", e => e.stopPropagation());
}

const menuUfs = document.getElementById("menu-ufs");
const botaoUfs = document.getElementById("botao-ufs");
const pesquisaUfs = document.getElementById("pesquisa-ufs");

function atualizarCampoUfs() {
    const texto = document.getElementById("texto-ufs");
    if(!texto) return;
    if (ufsSelecionadas.length === 0) {
        texto.textContent = "Selecione os estados"; if (infoUfs) infoUfs.style.display = "none";
    } else if (ufsSelecionadas.length === 1) {
        texto.textContent = ufsSelecionadas[0]; if (infoUfs) infoUfs.style.display = "none";
    } else {
        texto.textContent = `${ufsSelecionadas.length} estados selecionados`; if (infoUfs) infoUfs.style.display = "flex";
        if(listaTooltipUfs) {
            listaTooltipUfs.innerHTML = ufsSelecionadas.map(uf => {
                const estado = estadosBrasil.find(e => e.uf === uf);
                return `<div class="tooltip-municipio-item"><span class="tooltip-municipio-nome">${estado ? estado.nome : uf}</span><span class="tooltip-municipio-uf">${uf}</span></div>`;
            }).join("");
        }
    }
}

function renderizarUfs(termo = "") {
    const lista = document.getElementById("lista-ufs"); if(!lista) return; lista.innerHTML = "";
    const filtrados = estadosBrasil.filter(e => normalizarTexto(e.nome).includes(normalizarTexto(termo)) || normalizarTexto(e.uf).includes(normalizarTexto(termo)));
    filtrados.forEach(e => {
        const sel = ufsSelecionadas.includes(e.uf);
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = `opcao-uf ${sel ? 'selecionado' : ''}`;
        btn.innerHTML = `<span class="checkbox-uf">✓</span><span class="sigla-uf">${e.uf}</span><span class="nome-uf">${e.nome}</span>`;
        btn.addEventListener("click", ev => {
            ev.stopPropagation(); const idx = ufsSelecionadas.indexOf(e.uf);
            if (idx === -1) ufsSelecionadas.push(e.uf); else ufsSelecionadas.splice(idx, 1);
            atualizarCampoUfs(); renderizarUfs(pesquisaUfs.value); atualizarMunicipiosPorUfs(); salvarEstadoPesquisa();
        });
        lista.appendChild(btn);
    });
}

if(botaoUfs) {
    botaoUfs.addEventListener("click", e => { 
        e.stopPropagation(); const estavaAberto = menuUfs.classList.contains("aberto");
        fecharTodosMenus(); fecharTodasTooltips(); 
        if (!estavaAberto) { menuUfs.classList.add("aberto"); renderizarUfs(); }
    });
    document.getElementById("limpar-ufs").addEventListener("click", e => { e.stopPropagation(); ufsSelecionadas = []; atualizarCampoUfs(); renderizarUfs(); atualizarMunicipiosPorUfs(); fecharTodasTooltips(); salvarEstadoPesquisa(); });
    document.getElementById("concluir-ufs").addEventListener("click", e => { e.stopPropagation(); menuUfs.classList.remove("aberto"); });
    pesquisaUfs.addEventListener("input", e => renderizarUfs(e.target.value));
    menuUfs.addEventListener("click", e => e.stopPropagation());
}

const menuMunicipios = document.getElementById("menu-municipios");
const botaoMunicipios = document.getElementById("botao-municipios");
const pesquisaMunicipios = document.getElementById("pesquisa-municipios");

function atualizarCampoMunicipios() {
    const texto = document.getElementById("texto-municipios");
    if(!botaoMunicipios || !texto) return;
    botaoMunicipios.disabled = ufsSelecionadas.length === 0;
    if (ufsSelecionadas.length === 0) {
        texto.textContent = "Selecione primeiro os estados"; if (infoMunicipios) infoMunicipios.style.display = "none";
    } else if (municipiosSelecionados.length === 0) {
        texto.textContent = "Selecione os municípios"; if (infoMunicipios) infoMunicipios.style.display = "none";
    } else if (municipiosSelecionados.length === 1) {
        texto.textContent = municipiosSelecionados[0].nome; if (infoMunicipios) infoMunicipios.style.display = "none";
    } else {
        texto.textContent = `${municipiosSelecionados.length} municípios selecionados`; if (infoMunicipios) infoMunicipios.style.display = "flex";
        if(listaTooltipMunicipios) {
            listaTooltipMunicipios.innerHTML = municipiosSelecionados.map(m => `<div class="tooltip-municipio-item"><span class="tooltip-municipio-nome">${m.nome}</span><span class="tooltip-municipio-uf">${m.uf}</span></div>`).join("");
        }
    }
}

async function atualizarMunicipiosPorUfs() {
    municipiosSelecionados = municipiosSelecionados.filter(m => ufsSelecionadas.includes(m.uf));
    if (ufsSelecionadas.length === 0) { municipiosDisponiveis = []; atualizarCampoMunicipios(); return; }
    try {
        const consultas = ufsSelecionadas.map(async uf => {
            if (cacheMunicipios[uf]) return cacheMunicipios[uf];
            const res = await fetch(`/api/municipios/${encodeURIComponent(uf)}`);
            const dados = await res.json(); cacheMunicipios[uf] = dados; return dados;
        });
        const resultados = await Promise.all(consultas);
        municipiosDisponiveis = resultados.flat();
        atualizarCampoMunicipios(); renderizarMunicipios();
    } catch (e) { console.error("Erro municípios:", e); }
}

function renderizarMunicipios(termo = "") {
    const lista = document.getElementById("lista-municipios"); if(!lista) return; lista.innerHTML = "";
    if (ufsSelecionadas.length === 0) return;
    const filtrados = municipiosDisponiveis.filter(m => normalizarTexto(m.nome).includes(normalizarTexto(termo)));
    filtrados.slice(0, 100).forEach(m => {
        const sel = municipiosSelecionados.some(sm => sm.id === m.id);
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = `opcao-municipio ${sel ? 'selecionado' : ''}`;
        btn.innerHTML = `<span class="checkbox-municipio">✓</span><span class="nome-municipio">${m.nome}</span><span class="uf-municipio">${m.uf}</span>`;
        btn.addEventListener("click", ev => {
            ev.stopPropagation(); const idx = municipiosSelecionados.findIndex(sm => sm.id === m.id);
            if (idx === -1) municipiosSelecionados.push(m); else municipiosSelecionados.splice(idx, 1);
            atualizarCampoMunicipios(); renderizarMunicipios(pesquisaMunicipios.value); salvarEstadoPesquisa();
        });
        lista.appendChild(btn);
    });
}

if(botaoMunicipios) {
    botaoMunicipios.addEventListener("click", e => { 
        if(botaoMunicipios.disabled) return; e.stopPropagation(); 
        const estavaAberto = menuMunicipios.classList.contains("aberto");
        fecharTodosMenus(); fecharTodasTooltips(); 
        if (!estavaAberto) { menuMunicipios.classList.add("aberto"); renderizarMunicipios(); }
    });
    document.getElementById("limpar-municipios").addEventListener("click", e => { e.stopPropagation(); municipiosSelecionados = []; atualizarCampoMunicipios(); renderizarMunicipios(); fecharTodasTooltips(); salvarEstadoPesquisa(); });
    document.getElementById("concluir-municipios").addEventListener("click", e => { e.stopPropagation(); menuMunicipios.classList.remove("aberto"); });
    pesquisaMunicipios.addEventListener("input", e => renderizarMunicipios(e.target.value));
    menuMunicipios.addEventListener("click", e => e.stopPropagation());
}

function fecharTodosMenus() {
    if (menuModalidades) menuModalidades.classList.remove("aberto");
    if (menuUfs) menuUfs.classList.remove("aberto");
    if (menuMunicipios) menuMunicipios.classList.remove("aberto");
    if (esferasCtrl?.menu) esferasCtrl.menu.classList.remove("aberto");
    if (tiposCtrl?.menu) tiposCtrl.menu.classList.remove("aberto");
}

document.addEventListener("click", () => { fecharTodosMenus(); fecharTodasTooltips(); });

const escalaValores = [0, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 5000000];

function formatarDinheiro(campo) { 
    let num = campo.value.replace(/\D/g, ""); 
    if (!num) { campo.value = ""; return; } 
    campo.value = (parseInt(num, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

function atualizarFaixaVisual() {
    if(!rangeValorMinimo || !rangeValorMaximo) return;
    let min = Number(rangeValorMinimo.value), max = Number(rangeValorMaximo.value);
    if (min > max) { min = max; rangeValorMinimo.value = min; }
    const total = Number(rangeValorMaximo.max) - Number(rangeValorMinimo.min);
    if (faixaValoresSelecionada) { 
        faixaValoresSelecionada.style.left = `${(min / total) * 100}%`; 
        faixaValoresSelecionada.style.right = `${100 - ((max / total) * 100)}%`; 
    }
}

if(rangeValorMinimo && rangeValorMaximo) {
    rangeValorMinimo.addEventListener("input", function() { if (Number(this.value) > Number(rangeValorMaximo.value)) this.value = rangeValorMaximo.value; valorMinimo.value = this.value == 0 ? "" : escalaValores[this.value].toLocaleString("pt-BR", { minimumFractionDigits: 2 }); atualizarFaixaVisual(); salvarEstadoPesquisa(); });
    rangeValorMaximo.addEventListener("input", function() { if (Number(this.value) < Number(rangeValorMinimo.value)) this.value = rangeValorMinimo.value; valorMaximo.value = this.value == escalaValores.length - 1 ? "" : escalaValores[this.value].toLocaleString("pt-BR", { minimumFractionDigits: 2 }); atualizarFaixaVisual(); salvarEstadoPesquisa(); });
    valorMinimo.addEventListener("input", function() { formatarDinheiro(this); salvarEstadoPesquisa(); });
    valorMaximo.addEventListener("input", function() { formatarDinheiro(this); salvarEstadoPesquisa(); });
}

function obterFiltrosAtuais() {
    return {
        status: campoStatus ? campoStatus.value : "recebendo", 
        numeroPncp: document.getElementById("numero-pncp")?.value || "",
        palavra: document.getElementById("palavra-chave")?.value || "", 
        exclusoes: document.getElementById("exclusoes")?.value || "",
        modalidades: [...modalidadesSelecionadas], 
        ufs: [...ufsSelecionadas], 
        municipios: municipiosSelecionados.map(m => ({ id: m.id, nome: m.nome, uf: m.uf })),
        esferas: [...esferasSelecionadas], 
        tipos: [...tiposSelecionados],
        dataPublicacaoInicio: document.getElementById("data-publicacao-inicio")?.dataset.valiso || "", 
        dataPublicacaoFim: document.getElementById("data-publicacao-fim")?.dataset.valiso || "",
        dataPropostasInicio: document.getElementById("data-propostas-inicio")?.dataset.valiso || "", 
        dataPropostasFim: document.getElementById("data-propostas-fim")?.dataset.valiso || "",
        valorMinimo: valorMinimo?.value || "", 
        valorMaximo: valorMaximo?.value || "", 
        tipoFiltroValor: document.querySelector('input[name="tipo-filtro-valor"]:checked')?.value || "item_unitario",
        quantidadeItensMinima: quantidadeItensMinima?.value || "", 
        quantidadeItensMaxima: quantidadeItensMaxima?.value || "", 
        orcamentoSigiloso: document.querySelector('input[name="orcamento-sigiloso"]:checked')?.value || "incluir"
    };
}

function salvarEstadoPesquisa() {
    const filtros = obterFiltrosAtuais();
    localStorage.setItem("conecta_estado_pesquisa", JSON.stringify(filtros));
}

function carregarEstadoPesquisa() {
    const salvo = localStorage.getItem("conecta_estado_pesquisa");
    if (!salvo) return;
    try {
        const f = JSON.parse(salvo);
        aplicarFiltros(f);
    } catch(e) { console.error("Erro ao carregar estado da pesquisa", e); }
}

document.querySelectorAll('input, select').forEach(el => {
    if (el.type !== 'date' && !el.id.includes("data-")) {
        el.addEventListener('input', salvarEstadoPesquisa);
        el.addEventListener('change', salvarEstadoPesquisa);
    }
});

const selectFiltrosSalvos = document.getElementById("filtros-salvos");
const modalFiltro = document.getElementById("modal-salvar-filtro");
const inputNomeFiltro = document.getElementById("nome-novo-filtro");
const btnAbrirModalFiltro = document.getElementById("abrir-modal-filtro");
const btnModalSalvar = document.getElementById("modal-salvar");
const btnModalCancelar = document.getElementById("modal-cancelar");
const btnExcluirFiltro = document.getElementById("excluir-filtro");

if(selectFiltrosSalvos && modalFiltro) {
    function carregarFiltrosSalvos() {
        const salvos = JSON.parse(localStorage.getItem("conecta_filtros_presets") || "{}");
        selectFiltrosSalvos.innerHTML = '<option value="">Selecione um filtro salvo</option>';
        for (let nome in salvos) {
            const opt = document.createElement("option"); opt.value = nome; opt.textContent = nome; selectFiltrosSalvos.appendChild(opt);
        }
    }
    btnAbrirModalFiltro.addEventListener("click", () => { inputNomeFiltro.value = ""; modalFiltro.style.display = "flex"; });
    btnModalCancelar.addEventListener("click", () => { modalFiltro.style.display = "none"; });
    btnModalSalvar.addEventListener("click", () => {
        const nome = inputNomeFiltro.value.trim(); if (!nome) { alert("Insira um nome para o filtro."); return; }
        const salvos = JSON.parse(localStorage.getItem("conecta_filtros_presets") || "{}");
        salvos[nome] = obterFiltrosAtuais();
        localStorage.setItem("conecta_filtros_presets", JSON.stringify(salvos));
        carregarFiltrosSalvos(); selectFiltrosSalvos.value = nome; modalFiltro.style.display = "none";
    });
    btnExcluirFiltro.addEventListener("click", () => {
        const nome = selectFiltrosSalvos.value; if (!nome) return;
        const salvos = JSON.parse(localStorage.getItem("conecta_filtros_presets") || "{}");
        delete salvos[nome]; localStorage.setItem("conecta_filtros_presets", JSON.stringify(salvos)); carregarFiltrosSalvos();
    });
    selectFiltrosSalvos.addEventListener("change", (e) => {
        const nome = e.target.value; if (!nome) return;
        const salvos = JSON.parse(localStorage.getItem("conecta_filtros_presets") || "{}");
        if (salvos[nome]) { aplicarFiltros(salvos[nome]); salvarEstadoPesquisa(); }
    });
    carregarFiltrosSalvos();
}

function aplicarFiltros(f) {
    definirStatus(f.status || "recebendo");
    if(document.getElementById("numero-pncp")) document.getElementById("numero-pncp").value = f.numeroPncp || "";
    if(document.getElementById("palavra-chave")) document.getElementById("palavra-chave").value = f.palavra || "";
    if(document.getElementById("exclusoes")) document.getElementById("exclusoes").value = f.exclusoes || "";
    modalidadesSelecionadas = f.modalidades || []; atualizarCampoModalidades();
    ufsSelecionadas = f.ufs || []; atualizarCampoUfs();
    if (ufsSelecionadas.length > 0) {
        atualizarMunicipiosPorUfs().then(() => { municipiosSelecionados = (f.municipios || []).map(m => m); atualizarCampoMunicipios(); });
    } else { municipiosSelecionados = []; atualizarCampoMunicipios(); }
    esferasSelecionadas = f.esferas || []; if(esferasCtrl) esferasCtrl.atualizarCampo();
    tiposSelecionados = f.tipos || []; if(tiposCtrl) tiposCtrl.atualizarCampo();
    
    const idsDatas = ["data-publicacao-inicio", "data-publicacao-fim", "data-propostas-inicio", "data-propostas-fim"];
    idsDatas.forEach(id => {
        const input = document.getElementById(id);
        if(!input) return;
        
        const chaveFiltro = id.split('-').map((parte, i) => i === 0 ? parte : parte.charAt(0).toUpperCase() + parte.slice(1)).join('');
        const valorIso = f[chaveFiltro] || "";
        
        input.dataset.valiso = valorIso;
        if(valorIso) {
            input.type = "text";
            input.value = formatarDataParaExibicao(valorIso);
        } else {
            input.type = "text";
            input.value = "";
        }
    });

    if(valorMinimo) valorMinimo.value = f.valorMinimo || "";
    if(valorMaximo) valorMaximo.value = f.valorMaximo || "";
    if(quantidadeItensMinima) quantidadeItensMinima.value = f.quantidadeItensMinima || "";
    if(quantidadeItensMaxima) quantidadeItensMaxima.value = f.quantidadeItensMaxima || "";
    
    if(f.tipoFiltroValor) {
        const rb = document.querySelector(`input[name="tipo-filtro-valor"][value="${f.tipoFiltroValor}"]`);
        if(rb) rb.checked = true;
    }
    if(f.orcamentoSigiloso) {
        const rbOrc = document.querySelector(`input[name="orcamento-sigiloso"][value="${f.orcamentoSigiloso}"]`);
        if(rbOrc) rbOrc.checked = true;
    }
}

if(botaoLimpar) {
    botaoLimpar.addEventListener("click", () => {
        definirStatus("recebendo");
        ["numero-pncp", "palavra-chave", "exclusoes", "data-publicacao-inicio", "data-publicacao-fim", "data-propostas-inicio", "data-propostas-fim", "valor-minimo", "valor-maximo", "quantidade-itens-minima", "quantidade-itens-maxima"].forEach(id => {
            const el = document.getElementById(id); 
            if(el) {
                el.value = "";
                if(el.dataset) el.dataset.valiso = "";
            }
        });
        modalidadesSelecionadas = []; atualizarCampoModalidades();
        ufsSelecionadas = []; atualizarCampoUfs();
        municipiosSelecionados = []; atualizarCampoMunicipios();
        esferasSelecionadas = []; if(esferasCtrl) esferasCtrl.atualizarCampo();
        tiposSelecionados = []; if(tiposCtrl) tiposCtrl.atualizarCampo();
        localStorage.removeItem("conecta_estado_pesquisa");
        fecharTodosMenus(); fecharTodasTooltips();
    });
}

async function baixarEdital(cnpj, ano, sequencial, botao) {
    const textoOriginal = botao.innerHTML;
    botao.innerHTML = "⏳ Buscando..."; botao.disabled = true;
    try {
        const resposta = await fetch(`/api/arquivos/${cnpj}/${ano}/${sequencial}`);
        const dados = await resposta.json();
        if (dados.sucesso && dados.arquivos && dados.arquivos.length > 0) {
            let linkPrincipal = null;
            dados.arquivos.forEach(arq => { if (arq.titulo && arq.titulo.toUpperCase().includes("EDITAL")) linkPrincipal = arq.url; });
            window.open(linkPrincipal || dados.arquivos[0].url, '_blank');
        } else { alert("Nenhum edital anexado a esta licitação no PNCP ainda."); }
    } catch { alert("Erro ao tentar buscar os arquivos."); }
    finally { botao.innerHTML = textoOriginal; botao.disabled = false; }
}

function formatarDataHora(dataString) {
    if (!dataString) return "-";
    try { return new Date(dataString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return dataString; }
}

function formatarDataCurta(dataString) {
    if (!dataString) return "-";
    try { return new Date(dataString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return dataString; }
}

function escaparHtml(valor) { return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

function verificarSeSalvoCRM(numeroControle) {
    const crm = JSON.parse(localStorage.getItem('conecta_crm') || '[]');
    return crm.some(item => item.numero_controle === numeroControle);
}

window.adicionarAoCRM = function(index) {
    const obj = ultimosResultadosBusca[index];
    const numero = obj.licitacao.numeroControlePNCP;
    let crm = JSON.parse(localStorage.getItem('conecta_crm') || '[]');
    const jaExiste = crm.some(i => i.numero_controle === numero);
    
    const btn = document.querySelector(`.btn-crm-${index}`);
    
    if(jaExiste) {
        crm = crm.filter(i => i.numero_controle !== numero);
        localStorage.setItem('conecta_crm', JSON.stringify(crm));
        if(btn) {
            btn.innerHTML = '⭐ Salvar CRM';
            btn.style.background = 'transparent';
        }
        return;
    }
    
    crm.push({ numero_controle: numero, fase: 'analise', data_salvo: new Date().toISOString(), dados_originais: obj, anotacoes: '', itens_disputa: [] });
    localStorage.setItem('conecta_crm', JSON.stringify(crm));
    if(btn) {
        btn.innerHTML = '🌟 No CRM (Remover)';
        btn.style.background = '#218D4E';
    }
};

function renderizarResultadosPesquisa(dados) {
    dadosReais = dados?.resultados || [];
    currentPage = 1; // Reseta para a primeira página ao fazer nova busca
    aplicarOrdenacaoEPaginacao();
}

function aplicarOrdenacaoEPaginacao() {
    const filtroSigiloso = document.querySelector('input[name="orcamento-sigiloso"]:checked')?.value || "incluir";
    dadosFiltradosOrdenados = dadosReais.filter(r => {
        const v = r.licitacao?.valorTotalEstimado;
        if (filtroSigiloso === "informado") return v !== null && v !== undefined && v !== 0;
        if (filtroSigiloso === "somente_sigiloso") return v === null || v === undefined || v === 0;
        return true;
    });

    dadosFiltradosOrdenados.sort((a, b) => {
        if(currentSort === 'recente') {
            const dA = new Date(a.licitacao.dataPublicacaoPncp || 0).getTime();
            const dB = new Date(b.licitacao.dataPublicacaoPncp || 0).getTime();
            return dB - dA;
        } else if(currentSort === 'maior_valor') {
            return (b.licitacao.valorTotalEstimado || 0) - (a.licitacao.valorTotalEstimado || 0);
        } else if(currentSort === 'menor_valor') {
            return (a.licitacao.valorTotalEstimado || 0) - (b.licitacao.valorTotalEstimado || 0);
        }
        return 0;
    });

    renderizarPaginaAtual();
}

function renderizarPaginaAtual() {
    const secao = document.querySelector(".resultados"); 
    if(!secao) return;
    
    ultimosResultadosBusca = dadosFiltradosOrdenados; 
    const total = dadosFiltradosOrdenados.length;
    
    if (total === 0) {
        secao.innerHTML = `
            <div class="resultados-cabecalho">
                <span class="resultados-legenda">RESULTADOS</span>
                <h2>Nenhuma oportunidade encontrada.</h2>
                <p>Altere os filtros e tente novamente.</p>
            </div>
        `;
        return;
    }

    // Cabecalho Dinâmico conforme imagens
    let tituloStatus = "Todas as Oportunidades";
    const statusVal = document.getElementById("status")?.value || "recebendo";
    if(statusVal === "recebendo") tituloStatus = "Editais e Avisos de Contratações A Receber/Recebendo Propostas";
    if(statusVal === "propostas_encerradas") tituloStatus = "Editais e Avisos de Contratações Em Julgamento/Propostas Encerradas";
    if(statusVal === "encerradas") tituloStatus = "Editais e Avisos de Contratações Encerradas";

    // Badges de filtros ativos
    const fA = obterFiltrosAtuais();
    let badges = [];
    if(fA.numeroPncp) badges.push(`Nº PNCP: ${fA.numeroPncp}`);
    if(fA.palavra) badges.push(`Palavra: ${fA.palavra}`);
    if(fA.exclusoes) badges.push(`Excluindo: ${fA.exclusoes}`);
    if(fA.esferas.length) badges.push(`Esfera: ${fA.esferas.join(', ')}`);
    if(fA.ufs.length) badges.push(`UF: ${fA.ufs.join(', ')}`);
    if(fA.tipos.length) badges.push(`Tipo: ${fA.tipos.join(', ')}`);

    const inicio = (currentPage - 1) * itemsPerPage;
    const fim = Math.min(inicio + itemsPerPage, total);
    const itensPagina = dadosFiltradosOrdenados.slice(inicio, fim);

    let html = `
        <div class="cabecalho-resultados-avancado">
            <h2>${tituloStatus}</h2>
            ${badges.length > 0 ? `<div class="linha-filtros-ativos"><strong>Filtros ativos:</strong> ${badges.map(b => `<span class="badge-filtro">${escaparHtml(b)}</span>`).join('')}</div>` : ''}
            
            <div class="linha-ordenacao">
                <span style="color: #A0B0C0; font-size: 14px;">Exibindo: ${inicio + 1}-${fim} de ${total} itens</span>
                <div>
                    <label style="color: #A0B0C0; font-size: 13px; margin-right: 8px;">Ordenar por:</label>
                    <select class="select-ordenacao" onchange="window.mudarOrdenacao(this.value)">
                        <option value="recente" ${currentSort==='recente'?'selected':''}>Mais recente</option>
                        <option value="maior_valor" ${currentSort==='maior_valor'?'selected':''}>Maior valor</option>
                        <option value="menor_valor" ${currentSort==='menor_valor'?'selected':''}>Menor valor</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    html += itensPagina.map((r, i) => {
        const index = inicio + i; // Real index array
        const lic = r.licitacao || {}; const org = lic.orgaoEntidade || {}; const unid = lic.unidadeOrgao || {};
        const cnpjLimpo = String(org.cnpj || lic.orgaoEntidadeCnpj || "").replace(/\D/g, "");
        const anoLic = lic.anoCompra || lic.ano; const seqLic = lic.sequencialCompra || lic.sequencial;
        const itensGeral = r.itens || []; 
        const idsCorrespondentes = new Set((r.itens_correspondentes || []).map(item => String(item.numeroItem || item.id)));
        const numeroControle = lic.numeroControlePNCP || "";
        
        const dataFimProp = formatarDataHora(lic.dataFimRecebimentoProposta || lic.dataEncerramentoProposta || lic.dataEncerramento || lic.dataAberturaProposta || lic.dataFimVigenciaAta);
        const linkPncp = (cnpjLimpo && anoLic && seqLic) ? `https://pncp.gov.br/app/editais/${cnpjLimpo}/${anoLic}/${seqLic}` : "#";
        const estaNoCrm = verificarSeSalvoCRM(numeroControle);
        const valorEstimado = lic.valorTotalEstimado;

        return `
            <article class="resultado-card" style="background: #0B1426; border: 1px solid #1C2C4A; border-radius: 8px; padding: 20px; margin-top: 16px; font-family: sans-serif;">
                <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
                    <span style="background: #112B5A; color: #6699FF; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">${escaparHtml(lic.modalidadeNome)}</span>
                    <span style="background: #112B5A; color: #6699FF; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">${escaparHtml(org.esferaId || "Esfera")}</span>
                    <span style="background: #112B5A; color: #6699FF; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">${escaparHtml(lic.situacaoCompraNome)}</span>
                </div>
                <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #FFFFFF; text-transform: uppercase;">${escaparHtml(lic.objetoCompra)}</h3>
                <div style="margin-bottom: 16px; font-size: 12px; color: #A0B0C0; text-transform: uppercase; line-height: 1.4;">
                    <strong style="color: #DDE3EA;">${escaparHtml(org.razaoSocial)}</strong><br>
                    CNPJ: ${escaparHtml(org.cnpj)}
                </div>
                <hr style="border: none; border-top: 1px solid #1C2C4A; margin: 15px 0;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px 20px; font-size: 12px; margin-bottom: 20px;">
                    <div>
                        <span style="color: #7A8B9E; display: block; margin-bottom: 2px;">Unidade Compradora</span>
                        <strong style="color: #FFFFFF; font-size: 12px; display: block;">${escaparHtml(unid.nomeUnidade || org.razaoSocial || "-")}</strong>
                    </div>
                    <div>
                        <span style="color: #7A8B9E; display: block; margin-bottom: 2px;">Local</span>
                        <strong style="color: #FFFFFF; font-size: 12px; display: block;">${escaparHtml(unid.municipioNome || "-")} - ${escaparHtml(unid.ufSigla || "-")}</strong>
                    </div>
                    <div>
                        <span style="color: #7A8B9E; display: block; margin-bottom: 2px;">Valor estimado</span>
                        ${(valorEstimado !== null && valorEstimado !== undefined && valorEstimado !== 0) 
                            ? `<strong style="color: #FFFFFF; font-size: 12px; display: block;">R$ ${Number(valorEstimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>` 
                            : '<span style="background: #3A1F66; color: #B388FF; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">🔒 Sigiloso</span>'}
                    </div>
                    <div>
                        <span style="color: #7A8B9E; display: block; margin-bottom: 2px;">Publicação</span>
                        <strong style="color: #FFFFFF; font-size: 12px; display: block;">${formatarDataCurta(lic.dataPublicacaoPncp)}</strong>
                    </div>
                    <div>
                        <span style="color: #7A8B9E; display: block; margin-bottom: 2px;">Fim das propostas</span>
                        <strong style="color: #FFFFFF; font-size: 12px; display: block;">${dataFimProp}</strong>
                    </div>
                    <div>
                        <span style="color: #7A8B9E; display: block; margin-bottom: 2px;">Nº PNCP</span>
                        <strong style="color: #FFFFFF; font-size: 12px; display: block;">${numeroControle}</strong>
                    </div>
                </div>
                <hr style="border: none; border-top: 1px solid #1C2C4A; margin: 15px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; gap: 20px;">
                        <div style="display: flex; flex-direction: column; align-items: flex-start;">
                            <strong style="font-size: 16px; color: #FFFFFF;">${itensGeral.length}</strong>
                            <span style="color: #7A8B9E; font-size: 11px;">Itens totais</span>
                        </div>
                        ${idsCorrespondentes.size > 0 ? `
                        <div style="border-left: 1px solid #1C2C4A; padding-left: 20px; display: flex; flex-direction: column; align-items: flex-start;">
                            <strong style="font-size: 16px; color: #FFFFFF;">${idsCorrespondentes.size}</strong>
                            <span style="color: #7A8B9E; font-size: 11px;">Item correspondente</span>
                        </div>` : ''}
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="botao btn-crm-${index}" onclick="adicionarAoCRM(${index})" style="height: 34px; padding: 0 16px; font-size: 12px; background: ${estaNoCrm ? '#218D4E' : 'transparent'}; border: 1px solid #218D4E; color: white; border-radius: 6px; cursor: pointer; transition: 0.2s;">${estaNoCrm ? '🌟 No CRM (Remover)' : '⭐ Salvar CRM'}</button>
                        <button class="botao botao-secundario botao-detalhar" type="button" data-index="${index}" style="height: 34px; padding: 0 16px; font-size: 12px; background: transparent; color: var(--branco); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer;">Ver detalhes</button>
                        ${linkPncp !== "#" ? `<a href="${linkPncp}" target="_blank" class="botao" style="height: 34px; padding: 0 16px; font-size: 12px; background: transparent; color: var(--branco); border: 1px solid #6699FF; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center;">Abrir no PNCP ↗</a>` : ""}
                        ${(cnpjLimpo && anoLic && seqLic) ? `<button class="botao botao-secundario b-edital" type="button" data-cnpj="${cnpjLimpo}" data-ano="${anoLic}" data-seq="${seqLic}" style="height: 34px; padding: 0 16px; font-size: 12px; background: transparent; color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer;">Baixar Edital</button>` : ""}
                    </div>
                </div>

                <div id="detalhes-${index}" class="gaveta-detalhes" style="display: none; margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 15px;">
                    <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                        ${itensGeral.map(item => {
                            const itemId = String(item.numeroItem || item.id);
                            const ehCorrespondente = idsCorrespondentes.has(itemId);
                            const corFundo = ehCorrespondente ? "rgba(33,141,78,0.15)" : "transparent";
                            const corBorda = ehCorrespondente ? "rgba(33,141,78,0.6)" : "rgba(255,255,255,0.05)";
                            
                            const vUni = Number(item.valorUnitarioEstimado || item.valorUnitario || 0);
                            const q = Number(item.quantidade || 0); 
                            const vTot = Number(item.valorTotal || (vUni * q) || 0);
                            
                            const valUniStr = `Val. Uni: R$ ${vUni.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                            const qtdStr = `Qtd: ${q}`;
                            const valTotStr = item.orcamentoSigiloso ? 'Total: <span style="color: #F5B700;">Sigiloso</span>' : `Total: R$ ${vTot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

                            return `
                                <div style="background: ${corFundo}; border: 1px solid${corBorda}; border-radius: 6px; padding: 10px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                                    <div>
                                        <strong style="color: white;">Item ${escaparHtml(itemId)}:</strong> <span style="color: var(--cinza-claro);">${escaparHtml(item.descricao)}</span>${ehCorrespondente ? '<span style="background: #218D4E; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 6px; font-weight: bold;">Correspondente</span>' : ''}
                                    </div>
                                    <div style="white-space: nowrap; color: var(--texto-secundario); text-align: right; font-size: 11px;">
                                        ${valUniStr} &nbsp;&#124;&nbsp; ${qtdStr} &nbsp;&#124;&nbsp; <strong style="color: #218D4E;">${valTotStr}</strong>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </div>
            </article>
        `;
    }).join("");

    // Paginacao Botoes
    const totalPages = Math.ceil(total / itemsPerPage);
    if(totalPages > 1) {
        html += `
            <div class="barra-paginacao">
                <button onclick="window.irParaPagina(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>
                ${gerarBotoesPaginacao(currentPage, totalPages)}
                <button onclick="window.irParaPagina(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>
                <select class="select-por-pagina" onchange="window.mudarItensPorPagina(this.value)">
                    <option value="10" ${itemsPerPage===10?'selected':''}>10 por pág.</option>
                    <option value="25" ${itemsPerPage===25?'selected':''}>25 por pág.</option>
                    <option value="50" ${itemsPerPage===50?'selected':''}>50 por pág.</option>
                </select>
            </div>
        `;
    }

    secao.innerHTML = html;

    secao.querySelectorAll(".b-edital").forEach(b => {
        b.addEventListener("click", () => baixarEdital(b.dataset.cnpj, b.dataset.ano, b.dataset.seq, b));
    });
    secao.querySelectorAll(".botao-detalhar").forEach(botao => {
        botao.addEventListener("click", () => {
            const idx = botao.dataset.index;
            const gaveta = document.getElementById(`detalhes-${idx}`);
            if (gaveta) {
                const aberta = gaveta.style.display === "block";
                gaveta.style.display = aberta ? "none" : "block";
                botao.textContent = aberta ? "Ver detalhes" : "Ocultar detalhes";
            }
        });
    });
}

function gerarBotoesPaginacao(atual, total) {
    let botoes = '';
    let min = Math.max(1, atual - 2);
    let max = Math.min(total, atual + 2);
    
    if(min > 1) { botoes += `<button class="btn-pagina" onclick="window.irParaPagina(1)">1</button><span style="margin:0 5px;">...</span>`; }
    for(let i=min; i<=max; i++) {
        botoes += `<button class="btn-pagina ${i === atual ? 'ativa' : ''}" onclick="window.irParaPagina(${i})">${i}</button>`;
    }
    if(max < total) { botoes += `<span style="margin:0 5px;">...</span><button class="btn-pagina" onclick="window.irParaPagina(${total})">${total}</button>`; }
    
    return botoes;
}

window.irParaPagina = function(p) {
    currentPage = p;
    renderizarPaginaAtual();
    document.querySelector('.resultados').scrollIntoView({ behavior: 'smooth' });
}
window.mudarItensPorPagina = function(qtd) {
    itemsPerPage = parseInt(qtd);
    currentPage = 1;
    renderizarPaginaAtual();
}
window.mudarOrdenacao = function(ordem) {
    currentSort = ordem;
    currentPage = 1;
    aplicarOrdenacaoEPaginacao();
}

if(botaoBuscar) {
    botaoBuscar.addEventListener("click", async (e) => {
        e.preventDefault();
        const filtros = obterFiltrosAtuais();
        botaoBuscar.disabled = true; botaoBuscar.innerHTML = `<span>⏳ Buscando...</span>`;
        try {
            const resposta = await fetch("/api/pesquisar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(filtros) });
            const dados = await resposta.json();
            if (dados.sucesso) renderizarResultadosPesquisa(dados);
            else alert("Erro na pesquisa: " + (dados.erro || "Desconhecido"));
        } catch (erro) { console.error(erro); alert("Erro ao realizar a pesquisa."); } 
        finally { botaoBuscar.disabled = false; botaoBuscar.innerHTML = `<span class="icone-busca">⌕</span><span>Buscar</span>`; }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    carregarEstadoPesquisa();
    if(campoStatus) definirStatus(campoStatus.value || "recebendo"); 
    renderizarModalidades(); renderizarUfs(); 
    if(esferasCtrl) esferasCtrl.renderizarLista(); 
    if(tiposCtrl) tiposCtrl.renderizarLista();
});