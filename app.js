'use strict';
// App da PGM – controle de prazos e tarefas do Procurador (mesma lógica do app de gestão da FCE:
// login Google -> sessão no n8n -> ações por um único webhook, dados no Postgres, esquema pgm).
const API = 'https://emerim.app.n8n.cloud/webhook/pgm-app-api';
const CLIENT_ID = '407324250092-bdlt0qv9gu6uhlu5uo2nondcv3qktunu.apps.googleusercontent.com';

// ---------- utilidades ----------
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, pad) { try { const v = localStorage.getItem('pgm_' + k); return v === null ? pad : JSON.parse(v); } catch (e) { return pad; } },
  set(k, v) { try { localStorage.setItem('pgm_' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('pgm_' + k); } catch (e) {} }
};

const IC = {
  casa: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  prazo: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/>',
  tarefa: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  memo: '<path d="M4 4h16v16H4z"/><path d="M4 7l8 6 8-6"/>',
  mais: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  mais2: '<path d="M12 5v14M5 12h14"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  atual: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  alerta: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  hoje: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  semana: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h8"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  ed: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  lixo: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
};
const ic = (n, c) => '<svg class="i' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24">' + (IC[n] || '') + '</svg>';

const TRIB = { TJRS1: 'TJRS 1º grau', TJRS2: 'TJRS 2º grau', TRF41: 'TRF4 1º grau', TRF42: 'TRF4 2º grau' };
const TRIB_CURTO = { TJRS1: 'TJRS 1º', TJRS2: 'TJRS 2º', TRF41: 'TRF4 1º', TRF42: 'TRF4 2º' };
const STATUS = { PENDENTE: 'A fazer', EM_ELABORACAO: 'Em elaboração', PROTOCOLADO: 'Protocolado', CIENCIA: 'Ciência dada', ARQUIVADO: 'Arquivado' };
const MEMO = { NAO: 'Sem memorando', A_ENVIAR: 'A enviar', ENVIADO: 'Enviado – aguardando', RESPONDIDO: 'Respondido' };
const SECRETARIAS = ['Fazenda', 'Administração', 'Saúde', 'Educação', 'Obras e Serviços Urbanos', 'Desenvolvimento Urbano e Habitação', 'Meio Ambiente', 'Desenvolvimento Social', 'Segurança', 'Mobilidade Urbana', 'Cultura', 'Esporte e Lazer', 'Gabinete do Prefeito', 'PROCON', 'COMUSA', 'Previdência (IPASEM)'];
const ABERTOS = ['PENDENTE', 'EM_ELABORACAO'];

// ---------- estado ----------
const S = {
  token: LS.get('token', ''), eu: LS.get('eu', null),
  dados: LS.get('dados', null), carregadoEm: 0,
  f: Object.assign({ sit: 'abertos', trib: '', marca: '', q: '' }, LS.get('filtros', {})),
  ft: 'abertas'
};

async function api(acao, dados) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-pgm-token': S.token || '' }, body: JSON.stringify(Object.assign({ acao, token: S.token }, dados || {})) });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (r.status === 401 || (j && j.erro === 'sessao')) { sair(true); throw new Error('Sua sessão expirou. Entre de novo.'); }
  if (!r.ok || !j || j.ok === false) throw new Error((j && j.erro) || 'Não foi possível falar com o servidor.');
  return j.dados;
}
function toast(msg, erro) {
  $$('.toast').forEach((t) => t.remove());
  const t = document.createElement('div'); t.className = 'toast' + (erro ? ' erro' : '');
  t.innerHTML = ic(erro ? 'alerta' : 'check', 's') + '<span>' + esc(msg) + '</span>';
  document.body.appendChild(t); setTimeout(() => t.remove(), erro ? 5200 : 2800);
}
function modal({ titulo, corpo, botoes, largo }) {
  return new Promise((res) => {
    const v = document.createElement('div'); v.className = 'veu';
    v.innerHTML = '<div class="modal"' + (largo ? '' : ' style="max-width:520px"') + '><div class="mh"><h3>' + esc(titulo) + '</h3><button class="btn fant ico sm x" data-f>' + ic('x') + '</button></div><div class="mb">' + corpo + '</div>' +
      (botoes && botoes.length ? '<div class="mf">' + botoes.map((b, i) => '<button class="btn ' + (b.cls || '') + '" data-b="' + i + '">' + (b.ic ? ic(b.ic, 's') : '') + esc(b.txt) + '</button>').join('') + '</div>' : '') + '</div>';
    const fechar = (val) => { v.remove(); document.removeEventListener('keydown', tecla); res(val); };
    const tecla = (e) => { if (e.key === 'Escape') fechar(null); };
    document.addEventListener('keydown', tecla);
    v.addEventListener('click', async (e) => {
      if (e.target === v || e.target.closest('[data-f]')) return fechar(null);
      const b = e.target.closest('[data-b]'); if (!b) return;
      const bt = botoes[+b.dataset.b];
      if (bt.acao) { b.disabled = true; try { const r = await bt.acao(v); if (r === false) { b.disabled = false; return; } fechar(r === undefined ? bt.valor : r); } catch (err) { b.disabled = false; toast(err.message, true); } }
      else fechar(bt.valor);
    });
    document.body.appendChild(v);
    const primeiro = $('input,select,textarea', v); if (primeiro && window.innerWidth > 760) setTimeout(() => primeiro.focus(), 60);
  });
}
const confirmar = (titulo, texto, sim, perigo) => modal({ titulo, corpo: '<p class="mut" style="margin:4px 0 8px">' + esc(texto) + '</p>', botoes: [{ txt: 'Cancelar', valor: false }, { txt: sim || 'Confirmar', cls: perigo ? 'pri perigo' : 'pri', valor: true }] });

// ---------- datas ----------
const hoje = () => (S.dados && S.dados.hoje) || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dt = (s) => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const dias = (s) => s ? Math.round((dt(s) - dt(hoje())) / 864e5) : null;
const DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function fdata(s, comDia) { if (!s) return '—'; const d = dt(s); const t = String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + String(d.getUTCFullYear()).slice(2); return comDia ? DS[d.getUTCDay()] + ', ' + t : t; }
function rel(n) { if (n === null) return ''; if (n < -1) return 'venceu há ' + (-n) + ' dias'; if (n === -1) return 'venceu ontem'; if (n === 0) return 'vence hoje'; if (n === 1) return 'amanhã'; return 'em ' + n + ' dias'; }
function urg(n) { if (n === null) return ''; if (n <= 0) return 'bad'; if (n <= 3) return 'warn'; if (n <= 7) return 'ouro'; return ''; }
function addDias(s, n) { const d = dt(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// ---------- login ----------
function telaLogin(erro) {
  document.title = 'Entrar · PGM';
  $('#app').innerHTML = '<div class="login"><div class="caixa"><div class="logo">PGM</div><h1>Prazos e Tarefas</h1><p>Procuradoria-Geral do Município de Novo Hamburgo</p><div class="gbtn" id="gbtn"><div class="spin"></div></div>' +
    (erro ? '<div class="erro">' + esc(erro) + '</div>' : '') + '<div class="obs">Acesso restrito. Entre com a conta Google autorizada.</div></div></div>';
  const iniciar = () => {
    if (!window.google || !google.accounts || !google.accounts.id) return setTimeout(iniciar, 200);
    google.accounts.id.initialize({ client_id: CLIENT_ID, callback: aoLogar, auto_select: true, ux_mode: 'popup' });
    $('#gbtn').innerHTML = '';
    google.accounts.id.renderButton($('#gbtn'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pt-BR', width: 280 });
    google.accounts.id.prompt();
  };
  iniciar();
}
async function aoLogar(resp) {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'login', credential: resp.credential }) });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) return telaLogin((j && j.erro) || 'Não foi possível entrar.');
    S.token = j.dados.token; S.eu = { nome: j.dados.nome, email: j.dados.email, foto: j.dados.foto };
    LS.set('token', S.token); LS.set('eu', S.eu);
    iniciarApp();
  } catch (e) { telaLogin('Não foi possível entrar. Verifique a conexão.'); }
}
async function sair(expirou) {
  const tk = S.token;
  S.token = ''; S.eu = null; S.dados = null;
  ['token', 'eu', 'dados'].forEach(LS.del);
  if (!expirou && tk) { try { await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-pgm-token': tk }, body: JSON.stringify({ acao: 'sair', token: tk }) }); } catch (e) {} }
  try { google.accounts.id.disableAutoSelect(); } catch (e) {}
  telaLogin(expirou ? 'Sua sessão expirou. Entre de novo.' : '');
}

// ---------- dados ----------
async function carregar(forcar) {
  if (!forcar && S.dados && Date.now() - S.carregadoEm < 45000) return S.dados;
  const d = await api('listar', { filtro: 'todos' });
  S.dados = d; S.carregadoEm = Date.now(); LS.set('dados', d);
  return d;
}
const prazos = () => (S.dados && S.dados.prazos) || [];
const tarefas = () => (S.dados && S.dados.tarefas) || [];
const aberto = (p) => ABERTOS.includes(p.status);
function substituir(lista, obj) { const i = lista.findIndex((x) => x.id === obj.id); if (i >= 0) lista[i] = obj; else lista.push(obj); }
function ordenar() {
  if (!S.dados) return;
  S.dados.prazos.sort((a, b) => String(a.fim || '9999').localeCompare(String(b.fim || '9999')) || String(a.processo).localeCompare(String(b.processo)));
  S.dados.tarefas.sort((a, b) => (a.status === 'FEITA') - (b.status === 'FEITA') || String(a.vencimento || '9999').localeCompare(String(b.vencimento || '9999')));
  LS.set('dados', S.dados);
}

// ---------- layout ----------
const ROTAS = [
  { k: 'inicio', t: 'Início', ic: 'casa' },
  { k: 'prazos', t: 'Prazos', ic: 'prazo' },
  { k: 'tarefas', t: 'Tarefas', ic: 'tarefa' },
  { k: 'memorandos', t: 'Memorandos', ic: 'memo' }
];
function iniciarApp() {
  const eu = S.eu || {};
  const av = eu.foto ? '<img src="' + esc(eu.foto) + '" alt="" referrerpolicy="no-referrer">' : esc((eu.nome || '?').slice(0, 1));
  $('#app').innerHTML = '<aside class="side"><div class="marca"><div class="logo">PGM</div><div><b>Prazos e Tarefas</b><span>PGM · Novo Hamburgo</span></div></div>' +
    '<nav class="nav">' + ROTAS.map((r) => '<a href="#/' + r.k + '" data-r="' + r.k + '">' + ic(r.ic) + '<span>' + r.t + '</span><span class="bdg-slot"></span></a>').join('') + '</nav>' +
    '<div class="rodape"><div class="av">' + av + '</div><div style="min-width:0"><div class="n">' + esc(eu.nome || '') + '</div><div class="e">' + esc(eu.email || '') + '</div></div><button title="Sair" id="bsair">' + ic('sair') + '</button></div></aside>' +
    '<main class="main"><header class="topo"><h1 id="titulo"></h1><div class="acoes"><button class="btn fant ico" id="batual" title="Atualizar">' + ic('atual') + '</button><button class="btn pri sm" id="bnovo">' + ic('mais2', 's') + '<span>Novo prazo</span></button></div></header><div class="conteudo" id="conteudo"></div></main>' +
    '<nav class="tabbar">' + ROTAS.map((r) => '<a href="#/' + r.k + '" data-r="' + r.k + '">' + ic(r.ic) + '<span>' + r.t + '</span><span class="bdg-slot"></span></a>').join('') + '<a href="#/mais" data-r="mais">' + ic('mais') + '<span>Mais</span></a></nav>';
  $('#bsair').onclick = () => sair(false);
  $('#batual').onclick = () => rota(true);
  $('#bnovo').onclick = () => (location.hash.startsWith('#/tarefas') ? editarTarefa() : editarPrazo());
  if (!location.hash || location.hash === '#/') location.hash = '#/inicio';
  rota();
}
function badges() {
  const h = hoje();
  const urg = prazos().filter((p) => aberto(p) && p.fim && p.fim <= h).length;
  const tar = tarefas().filter((t) => t.status === 'ABERTA' && t.vencimento && t.vencimento <= h).length;
  const mem = prazos().filter((p) => aberto(p) && p.memo_status === 'A_ENVIAR').length;
  const set = (k, n, r) => $$('a[data-r="' + k + '"] .bdg-slot').forEach((e) => { e.innerHTML = n ? '<span class="bdg' + (r ? ' r' : '') + '">' + n + '</span>' : ''; });
  set('prazos', urg, true); set('tarefas', tar, true); set('memorandos', mem, false);
}
let rodando = 0;
async function rota(forcar) {
  const [k, arg] = (location.hash.replace(/^#\//, '') || 'inicio').split('/');
  const v = VIEWS[k] ? k : 'inicio';
  $$('a[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === v));
  $('#bnovo span').textContent = v === 'tarefas' ? 'Nova tarefa' : 'Novo prazo';
  const meu = ++rodando;
  if (!S.dados) $('#conteudo').innerHTML = '<div class="carregando"><div class="spin"></div></div>';
  else VIEWS[v](arg);
  try {
    await carregar(forcar);
    if (meu !== rodando) return;
    VIEWS[v](arg); badges();
  } catch (e) {
    if (!S.dados) $('#conteudo').innerHTML = '<div class="vazio">' + ic('alerta') + esc(e.message) + '<br><br><button class="btn sm" onclick="rota(true)">Tentar de novo</button></div>';
    else toast(e.message, true);
  }
}
window.addEventListener('hashchange', () => { if (S.token) rota(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token && !$('.veu')) rota(true); });
const titulo = (t) => { $('#titulo').textContent = t; document.title = t + ' · PGM'; };

// ---------- componentes ----------
function itemPrazo(p) {
  const n = dias(p.fim), u = aberto(p) ? urg(n) : 'ok';
  const tags = ['<span class="chip nav">' + esc(TRIB_CURTO[p.tribunal] || p.tribunal) + '</span>'];
  if (p.status === 'EM_ELABORACAO') tags.push('<span class="chip info">Em elaboração</span>');
  if (!aberto(p)) tags.push('<span class="chip ok">' + esc(STATUS[p.status]) + '</span>');
  if (p.ed_cabivel) { const ne = dias(p.ed_prazo); tags.push('<span class="chip ' + (p.ed_prazo && aberto(p) ? (urg(ne) || 'ouro') : 'ouro') + '">ED' + (p.ed_prazo ? ' até ' + fdata(p.ed_prazo) : ' cabíveis') + '</span>'); }
  if (p.memo_status && p.memo_status !== 'NAO') tags.push('<span class="chip ' + (p.memo_status === 'RESPONDIDO' ? 'ok' : p.memo_status === 'A_ENVIAR' ? 'warn' : 'info') + '">Memo' + (p.memo_secretaria ? ' ' + esc(p.memo_secretaria) : '') + ' · ' + esc(MEMO[p.memo_status].split(' –')[0].toLowerCase()) + '</span>');
  return '<div class="item clic" data-p="' + esc(p.id) + '"><span class="dot ' + u + '"></span><div class="mid"><div class="t"><span class="num">' + esc(p.processo) + '</span>' + (p.parte ? '<span class="par"><span class="sep-p"> · </span>' + esc(p.parte) + '</span>' : '') + '</div>' +
    '<div class="d">' + esc(p.providencia || p.intimacao || p.classe || 'Sem providência definida') + '</div><div class="tags">' + tags.join('') + '</div></div>' +
    '<div class="dir"><span class="data">' + fdata(p.fim) + '</span>' + (p.fim && aberto(p) ? '<span class="chip ' + (u || '') + '">' + rel(n) + '</span>' : '') + '</div></div>';
}
function itemTarefa(t) {
  const n = dias(t.vencimento), feita = t.status === 'FEITA';
  const tags = [];
  if (t.processo) tags.push('<span class="chip">' + esc(t.processo) + '</span>');
  if (t.prioridade === 'ALTA') tags.push('<span class="chip bad">Prioridade alta</span>');
  return '<div class="item' + (feita ? ' feita' : '') + '"><span class="check' + (feita ? ' on' : '') + '" data-tc="' + esc(t.id) + '">' + (feita ? ic('check', 's') : '') + '</span>' +
    '<div class="mid clic" data-t="' + esc(t.id) + '" style="cursor:pointer"><div class="t">' + esc(t.titulo) + '</div>' + (t.notas ? '<div class="d">' + esc(t.notas.slice(0, 160)) + '</div>' : '') + (tags.length ? '<div class="tags">' + tags.join('') + '</div>' : '') + '</div>' +
    '<div class="dir">' + (t.vencimento ? '<span class="data">' + fdata(t.vencimento) + '</span>' + (!feita ? '<span class="chip ' + urg(n) + '">' + rel(n).replace('vence hoje', 'hoje').replace('venceu', 'atrasada,') + '</span>' : '') : '<span class="pp mut">sem data</span>') + '</div></div>';
}
function ligarListas(raiz) {
  $$('[data-p]', raiz).forEach((e) => { e.onclick = () => verPrazo(e.dataset.p); });
  $$('[data-t]', raiz).forEach((e) => { e.onclick = () => editarTarefa(tarefas().find((t) => t.id === e.dataset.t)); });
  $$('[data-tc]', raiz).forEach((e) => { e.onclick = (ev) => { ev.stopPropagation(); alternarTarefa(e.dataset.tc); }; });
}
const vazio = (txt, i) => '<div class="vazio">' + ic(i || 'check') + esc(txt) + '</div>';

// ---------- telas ----------
const VIEWS = {};
VIEWS.inicio = function () {
  titulo('Início');
  const h = hoje(), ab = prazos().filter(aberto);
  const atras = ab.filter((p) => p.fim && p.fim < h), hj = ab.filter((p) => p.fim === h);
  const sem7 = ab.filter((p) => p.fim && p.fim > h && p.fim <= addDias(h, 7));
  const ed = ab.filter((p) => p.ed_cabivel && (!p.ed_prazo || p.ed_prazo >= h));
  const memA = ab.filter((p) => p.memo_status === 'A_ENVIAR'), memE = ab.filter((p) => p.memo_status === 'ENVIADO');
  const tab = tarefas().filter((t) => t.status === 'ABERTA');
  const nome = ((S.eu && S.eu.nome) || '').split(' ')[0];
  const hr = new Date().getHours();
  const kpi = (rot, val, sub, i, cls, go) => '<div class="card kpi ' + (cls || '') + '" data-go="' + go + '"><div class="rot">' + rot + '</div><div class="val">' + val + '</div><div class="sub">' + sub + '</div><div class="ico">' + ic(i, 's') + '</div></div>';
  $('#conteudo').innerHTML = '<div class="ola"><h2>' + (hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite') + (nome ? ', ' + esc(nome) : '') + '</h2><p>' + esc(new Date(dt(h).getTime() + 12 * 36e5).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })) + '</p></div>' +
    '<div class="kpis">' +
    kpi('Vencidos', atras.length, 'prazos em atraso', 'alerta', atras.length ? 'bad' : '', 'atrasados') +
    kpi('Vencem hoje', hj.length, fdata(h, true), 'hoje', hj.length ? 'bad' : '', 'hoje') +
    kpi('Próximos 7 dias', sem7.length, 'até ' + fdata(addDias(h, 7)), 'semana', 'warn', '7dias') +
    kpi('Prazos abertos', ab.length, 'a fazer ou em elaboração', 'lista', '', '') +
    kpi('Embargos de declaração', ed.length, 'cabíveis e no prazo', 'ed', 'info', 'ed') +
    kpi('Memorandos', memA.length + memE.length, memA.length + ' a enviar · ' + memE.length + ' aguardando', 'memo', '', 'memo') +
    '</div>' +
    '<div class="grid g2" style="margin-top:16px"><div class="card"><div class="cab"><h2>Próximos vencimentos</h2><div class="dir"><a class="btn fant sm" href="#/prazos">Ver todos</a></div></div><div class="lista" id="l1">' +
    (ab.slice(0, 8).map(itemPrazo).join('') || vazio('Nenhum prazo aberto.')) + '</div></div>' +
    '<div class="card"><div class="cab"><h2>Tarefas</h2><div class="dir"><a class="btn fant sm" href="#/tarefas">Ver todas</a></div></div><div class="lista" id="l2">' +
    (tab.slice(0, 7).map(itemTarefa).join('') || vazio('Nenhuma tarefa aberta.')) + '</div></div></div>' +
    '<div class="rodape-app">TJRS 1º e 2º graus · TRF4 1º e 2º graus</div>';
  $$('[data-go]').forEach((e) => { e.onclick = () => { const g = e.dataset.go; if (g === 'memo') { location.hash = '#/memorandos'; return; } Object.assign(S.f, { sit: 'abertos', trib: '', marca: g, q: '' }); LS.set('filtros', S.f); location.hash = '#/prazos'; }; });
  ligarListas($('#conteudo'));
};
VIEWS.prazos = function () {
  titulo('Prazos');
  const h = hoje(), f = S.f;
  const porSit = (p) => f.sit === 'abertos' ? aberto(p) : f.sit === 'concluidos' ? ['PROTOCOLADO', 'CIENCIA'].includes(p.status) : f.sit === 'arquivados' ? p.status === 'ARQUIVADO' : true;
  const base = prazos().filter(porSit);
  const MARCAS = {
    atrasados: ['Vencidos', (p) => p.fim && p.fim < h], hoje: ['Hoje', (p) => p.fim === h], '7dias': ['7 dias', (p) => p.fim && p.fim >= h && p.fim <= addDias(h, 7)],
    ed: ['Com ED', (p) => p.ed_cabivel], memo: ['Com memorando', (p) => p.memo_status && p.memo_status !== 'NAO']
  };
  const q = f.q.trim().toLowerCase();
  const lista = base.filter((p) => (!f.trib || p.tribunal === f.trib) && (!f.marca || !MARCAS[f.marca] || MARCAS[f.marca][1](p)) &&
    (!q || [p.processo, p.parte, p.classe, p.providencia, p.intimacao, p.orgao, p.memo_secretaria, p.observacoes].join(' ').toLowerCase().includes(q)));
  const cnt = (fn) => base.filter(fn).length;
  const bt = (grp, val, txt, n) => '<button data-' + grp + '="' + val + '" class="' + (f[grp] === val ? 'on' : '') + '">' + txt + (n !== undefined ? '<span class="n">' + n + '</span>' : '') + '</button>';
  $('#conteudo').innerHTML = '<div class="barra"><label class="busca">' + ic('busca', 's') + '<input id="q" placeholder="Buscar processo, parte, peça, secretaria…" value="' + esc(f.q) + '"></label></div>' +
    '<div class="filtros">' + bt('sit', 'abertos', 'Abertos', prazos().filter(aberto).length) + bt('sit', 'concluidos', 'Concluídos') + bt('sit', 'arquivados', 'Arquivados') + bt('sit', 'todos', 'Todos') +
    '<span class="sep"></span>' + bt('trib', '', 'Todos os tribunais') + Object.keys(TRIB).map((k) => bt('trib', k, TRIB_CURTO[k], cnt((p) => p.tribunal === k))).join('') + '</div>' +
    '<div class="filtros" style="margin-top:-4px">' + bt('marca', '', 'Sem filtro') + Object.keys(MARCAS).map((k) => bt('marca', k, MARCAS[k][0], cnt(MARCAS[k][1]))).join('') + '</div>' +
    '<div class="card"><div class="lista">' + (lista.map(itemPrazo).join('') || vazio(prazos().length ? 'Nenhum prazo com esses filtros.' : 'Nenhum prazo cadastrado ainda.', 'prazo')) + '</div></div>' +
    '<p class="pp mut" style="margin:10px 2px">' + lista.length + ' prazo(s)</p>';
  $$('[data-sit],[data-trib],[data-marca]').forEach((b) => { b.onclick = () => { const g = b.dataset.sit !== undefined ? 'sit' : b.dataset.trib !== undefined ? 'trib' : 'marca'; S.f[g] = b.dataset[g]; LS.set('filtros', S.f); VIEWS.prazos(); }; });
  const qi = $('#q'); let tm;
  qi.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { S.f.q = qi.value; LS.set('filtros', S.f); const pos = qi.selectionStart; VIEWS.prazos(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); }, 250); };
  ligarListas($('#conteudo'));
};
VIEWS.tarefas = function () {
  titulo('Tarefas');
  const lista = tarefas().filter((t) => S.ft === 'todas' || (S.ft === 'abertas' ? t.status === 'ABERTA' : t.status === 'FEITA'));
  const bt = (v, t, n) => '<button data-ft="' + v + '" class="' + (S.ft === v ? 'on' : '') + '">' + t + (n !== undefined ? '<span class="n">' + n + '</span>' : '') + '</button>';
  $('#conteudo').innerHTML = '<div class="barra"><label class="busca">' + ic('mais2', 's') + '<input id="rapida" placeholder="Nova tarefa rápida – digite e tecle Enter"></label></div>' +
    '<div class="filtros">' + bt('abertas', 'Abertas', tarefas().filter((t) => t.status === 'ABERTA').length) + bt('feitas', 'Feitas (30 dias)') + bt('todas', 'Todas') + '</div>' +
    '<div class="card"><div class="lista">' + (lista.map(itemTarefa).join('') || vazio(S.ft === 'abertas' ? 'Nenhuma tarefa aberta.' : 'Nada por aqui.', 'tarefa')) + '</div></div>';
  $$('[data-ft]').forEach((b) => { b.onclick = () => { S.ft = b.dataset.ft; VIEWS.tarefas(); }; });
  $('#rapida').onkeydown = async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const titulo = e.target.value.trim(); e.target.disabled = true;
    try { const t = await api('tarefa_salvar', { tarefa: { titulo } }); substituir(S.dados.tarefas, t); ordenar(); VIEWS.tarefas(); badges(); toast('Tarefa criada.'); $('#rapida').focus(); }
    catch (err) { toast(err.message, true); e.target.disabled = false; }
  };
  ligarListas($('#conteudo'));
};
VIEWS.memorandos = function () {
  titulo('Memorandos');
  const ab = prazos().filter((p) => aberto(p) && p.memo_status && p.memo_status !== 'NAO');
  const bloco = (tit, st, txtVazio) => {
    const l = ab.filter((p) => p.memo_status === st).sort((a, b) => String(a.memo_retorno || a.fim || '9').localeCompare(String(b.memo_retorno || b.fim || '9')));
    return '<div class="sec-tit">' + tit + ' <span class="bdg' + (st === 'A_ENVIAR' && l.length ? ' r' : '') + '">' + l.length + '</span></div><div class="card"><div class="lista">' +
      (l.map((p) => itemMemo(p)).join('') || vazio(txtVazio, 'memo')) + '</div></div>';
  };
  $('#conteudo').innerHTML = '<p class="mut pq" style="margin:14px 2px 0">Pedidos de informações e documentos às secretarias municipais, vinculados aos prazos abertos. O retorno deve chegar uma semana antes do prazo fatal.</p>' +
    bloco('A enviar', 'A_ENVIAR', 'Nenhum memorando a enviar.') + bloco('Enviados – aguardando retorno', 'ENVIADO', 'Nenhum memorando aguardando retorno.') + bloco('Respondidos', 'RESPONDIDO', 'Nenhum memorando respondido em prazos abertos.');
  $$('[data-ms]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); mudarMemo(b.dataset.id, b.dataset.ms); }; });
  ligarListas($('#conteudo'));
};
function itemMemo(p) {
  const ret = p.memo_retorno || (p.fim ? addDias(p.fim, -7) : null), n = dias(ret);
  const prox = p.memo_status === 'A_ENVIAR' ? ['ENVIADO', 'Marcar enviado'] : p.memo_status === 'ENVIADO' ? ['RESPONDIDO', 'Marcar respondido'] : null;
  return '<div class="item clic" data-p="' + esc(p.id) + '"><span class="dot ' + (p.memo_status === 'RESPONDIDO' ? 'ok' : urg(n)) + '"></span><div class="mid"><div class="t">' + esc(p.memo_secretaria || 'Secretaria não informada') + ' · ' + esc(p.processo) + '</div>' +
    '<div class="d">' + esc(p.parte || '') + (p.parte && p.providencia ? ' – ' : '') + esc(p.providencia || '') + '</div><div class="tags"><span class="chip nav">' + esc(TRIB_CURTO[p.tribunal]) + '</span><span class="chip">prazo ' + fdata(p.fim) + '</span></div></div>' +
    '<div class="dir"><span class="pp mut">retorno até</span><span class="data">' + fdata(ret) + '</span>' + (prox ? '<button class="btn sm" data-ms="' + prox[0] + '" data-id="' + esc(p.id) + '">' + prox[1] + '</button>' : '') + '</div></div>';
}
VIEWS.mais = function () {
  titulo('Mais');
  const eu = S.eu || {};
  const tema = document.documentElement.dataset.tema || 'auto';
  $('#conteudo').innerHTML = '<div class="card" style="margin-top:14px"><div class="lista"><div class="item"><div class="av">' + (eu.foto ? '<img src="' + esc(eu.foto) + '" alt="" referrerpolicy="no-referrer">' : '') + '</div><div class="mid"><div class="t">' + esc(eu.nome || '') + '</div><div class="d">' + esc(eu.email || '') + '</div></div></div>' +
    '<div class="item clic" id="mtema">' + ic('lua') + '<div class="mid"><div class="t">Tema</div><div class="d">' + ({ auto: 'Automático', claro: 'Claro', escuro: 'Escuro' }[tema]) + '</div></div></div>' +
    '<div class="item clic" id="matual">' + ic('atual') + '<div class="mid"><div class="t">Atualizar dados</div></div></div>' +
    '<div class="item clic" id="msair" style="color:var(--bad)">' + ic('sair') + '<div class="mid"><div class="t">Sair</div></div></div></div></div>';
  $('#mtema').onclick = () => { const n = { auto: 'claro', claro: 'escuro', escuro: 'auto' }[tema]; aplicarTema(n); VIEWS.mais(); };
  $('#matual').onclick = () => rota(true);
  $('#msair').onclick = () => sair(false);
};
function aplicarTema(t) { if (t === 'auto') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t; LS.set('tema', t); }

// ---------- ações ----------
function redesenhar() { ordenar(); rotaSemCarregar(); badges(); }
function rotaSemCarregar() { const [k, arg] = (location.hash.replace(/^#\//, '') || 'inicio').split('/'); (VIEWS[k] || VIEWS.inicio)(arg); }
function verPrazo(id) {
  const p = prazos().find((x) => x.id === id); if (!p) return;
  const n = dias(p.fim);
  const L = (r, v) => v ? '<dt>' + r + '</dt><dd>' + v + '</dd>' : '';
  const corpo = '<div class="tags" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><span class="chip nav">' + esc(TRIB[p.tribunal]) + '</span><span class="chip ' + (aberto(p) ? urg(n) : 'ok') + '">' + esc(STATUS[p.status]) + (p.fim && aberto(p) ? ' · ' + rel(n) : '') + '</span>' + (p.origem === 'TRIAGEM' ? '<span class="chip">da triagem</span>' : '') + '</div>' +
    '<dl class="det">' + L('Processo', esc(p.processo)) + L('Classe', esc(p.classe)) + L('Parte contrária', esc(p.parte)) + L('Órgão julgador', esc(p.orgao)) + L('Intimação', esc(p.intimacao)) +
    L('Prazo', (p.inicio ? fdata(p.inicio) + ' a ' : 'até ') + '<b>' + fdata(p.fim, true) + '</b>') + L('Providência / peça', '<b>' + esc(p.providencia) + '</b>') +
    L('Embargos de declaração', p.ed_cabivel ? 'Cabíveis' + (p.ed_prazo ? ' – prazo até <b>' + fdata(p.ed_prazo, true) + '</b>' : '') + (p.ed_obs ? '<br><span class="mut">' + esc(p.ed_obs) + '</span>' : '') : 'Não cabíveis') +
    L('Memorando', p.memo_status && p.memo_status !== 'NAO' ? esc(p.memo_secretaria || 'Secretaria não informada') + ' – ' + esc(MEMO[p.memo_status]) + (p.memo_retorno ? '<br><span class="mut">retorno até ' + fdata(p.memo_retorno, true) + '</span>' : '') : 'Não é necessário') +
    L('Teor', esc(p.teor)) + L('Observações', esc(p.observacoes)) + '</dl>' +
    '<div class="acoesrap">' + (aberto(p)
      ? (p.status === 'PENDENTE' ? '<button class="btn sm" data-st="EM_ELABORACAO">Em elaboração</button>' : '<button class="btn sm" data-st="PENDENTE">Voltar para "a fazer"</button>') + '<button class="btn sm" data-st="PROTOCOLADO">' + ic('check', 's') + 'Protocolado</button><button class="btn sm" data-st="CIENCIA">Ciência dada</button><button class="btn sm fant" data-st="ARQUIVADO">Arquivar</button>'
      : '<button class="btn sm" data-st="PENDENTE">Reabrir prazo</button>') +
    '<button class="btn sm fant" data-nt>' + ic('tarefa', 's') + 'Criar tarefa</button></div>' +
    '<p class="pp mut" style="margin:10px 0 0">Atualizado em ' + esc(new Date(p.atualizado_em).toLocaleString('pt-BR')) + (p.atualizado_por ? ' por ' + esc(p.atualizado_por) : '') + '</p>';
  const pr = modal({ titulo: p.processo, corpo, largo: true, botoes: [
    { txt: 'Excluir', ic: 'lixo', cls: 'fant perigo esq', acao: async () => { if (!(await confirmar('Excluir prazo', 'Excluir definitivamente o prazo do processo ' + p.processo + '? Para apenas tirar da lista, use Arquivar.', 'Excluir', true))) return false; await api('prazo_excluir', { id: p.id }); S.dados.prazos = S.dados.prazos.filter((x) => x.id !== p.id); redesenhar(); toast('Prazo excluído.'); } },
    { txt: 'Fechar', valor: null },
    { txt: 'Editar', ic: 'editar', cls: 'pri', valor: 'editar' }
  ] });
  const v = $$('.veu').pop();
  $$('[data-st]', v).forEach((b) => { b.onclick = async () => { b.disabled = true; try { const r = await api('prazo_status', { id: p.id, status: b.dataset.st }); substituir(S.dados.prazos, r); redesenhar(); v.remove(); toast('Situação: ' + STATUS[r.status] + '.'); } catch (e) { b.disabled = false; toast(e.message, true); } }; });
  $('[data-nt]', v).onclick = () => { v.remove(); editarTarefa({ processo: p.processo, prazo_id: p.id, vencimento: p.fim ? addDias(p.fim, -2) : '' }); };
  pr.then((r) => { if (r === 'editar') editarPrazo(p); });
}
function editarPrazo(p) {
  p = p || { tribunal: 'TJRS1', status: 'PENDENTE', memo_status: 'NAO' };
  const o = (v, sel) => '<option value="' + esc(v[0]) + '"' + (v[0] === sel ? ' selected' : '') + '>' + esc(v[1]) + '</option>';
  const inp = (n, rot, tipo, cls, extra) => '<label class="' + (cls || '') + '">' + rot + '<input class="inp" name="' + n + '" type="' + (tipo || 'text') + '" value="' + esc(p[n] || '') + '"' + (extra || '') + '></label>';
  const corpo = '<form class="form" id="fp" autocomplete="off">' +
    '<label>Tribunal / grau<select class="sel" name="tribunal">' + Object.entries(TRIB).map((e) => o(e, p.tribunal)).join('') + '</select></label>' +
    inp('processo', 'Processo', 'text', '', ' required placeholder="0000000-00.0000.0.00.0000"') +
    inp('classe', 'Classe') + inp('parte', 'Parte contrária') +
    inp('orgao', 'Órgão julgador') + inp('intimacao', 'Intimação / evento') +
    inp('inicio', 'Início do prazo', 'date') + inp('fim', 'Fim do prazo', 'date') +
    inp('providencia', 'Providência / peça a elaborar', 'text', 'full') +
    '<label>Situação<select class="sel" name="status">' + Object.entries(STATUS).map((e) => o(e, p.status)).join('') + '</select></label><span></span>' +
    '<div class="grupo">Embargos de declaração</div>' +
    '<label class="linha"><input type="checkbox" name="ed_cabivel"' + (p.ed_cabivel ? ' checked' : '') + '> Cabíveis</label>' + inp('ed_prazo', 'Prazo dos ED', 'date') +
    inp('ed_obs', 'Omissão / contradição a apontar', 'text', 'full') +
    '<div class="grupo">Memorando a secretaria municipal</div>' +
    '<label>Situação<select class="sel" name="memo_status">' + Object.entries(MEMO).map((e) => o(e, p.memo_status || 'NAO')).join('') + '</select></label>' +
    '<label>Secretaria<input class="inp" name="memo_secretaria" list="secs" value="' + esc(p.memo_secretaria || '') + '"><datalist id="secs">' + SECRETARIAS.map((s) => '<option value="' + esc(s) + '">').join('') + '</datalist></label>' +
    inp('memo_retorno', 'Retorno até (uma semana antes do prazo)', 'date') + '<span></span>' +
    '<div class="grupo">Anotações</div>' +
    '<label class="full">Teor da decisão / intimação<textarea class="inp" name="teor">' + esc(p.teor || '') + '</textarea></label>' +
    '<label class="full">Observações<textarea class="inp" name="observacoes" style="min-height:60px">' + esc(p.observacoes || '') + '</textarea></label></form>';
  modal({ titulo: p.id ? 'Editar prazo' : 'Novo prazo', corpo, largo: true, botoes: [{ txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', ic: 'check', acao: async (v) => {
    const f = $('#fp', v), d = Object.fromEntries(new FormData(f).entries());
    d.ed_cabivel = !!f.ed_cabivel.checked; d.id = p.id || null;
    if (!String(d.processo || '').trim()) { toast('Informe o número do processo.', true); return false; }
    if (d.memo_status !== 'NAO' && !d.memo_retorno && d.fim) d.memo_retorno = addDias(d.fim, -7);
    const r = await api('prazo_salvar', { prazo: d });
    substituir(S.dados.prazos, r); redesenhar(); toast(p.id ? 'Prazo atualizado.' : 'Prazo cadastrado.');
  } }] });
  const v = $$('.veu').pop(), f = $('#fp', v);
  f.fim.onchange = () => { if (f.memo_status.value !== 'NAO' && !f.memo_retorno.value && f.fim.value) f.memo_retorno.value = addDias(f.fim.value, -7); };
  f.memo_status.onchange = f.fim.onchange;
}
async function mudarMemo(id, ms) {
  try { const r = await api('prazo_memo', { id, memo_status: ms }); substituir(S.dados.prazos, r); redesenhar(); toast('Memorando: ' + MEMO[ms].toLowerCase() + '.'); }
  catch (e) { toast(e.message, true); }
}
function editarTarefa(t) {
  t = t || {};
  const corpo = '<form class="form" id="ft" autocomplete="off">' +
    '<label class="full">Tarefa<input class="inp" name="titulo" value="' + esc(t.titulo || '') + '" required></label>' +
    '<label>Processo (opcional)<input class="inp" name="processo" value="' + esc(t.processo || '') + '"></label>' +
    '<label>Até<input class="inp" type="date" name="vencimento" value="' + esc(t.vencimento || '') + '"></label>' +
    '<label>Prioridade<select class="sel" name="prioridade">' + [['NORMAL', 'Normal'], ['ALTA', 'Alta'], ['BAIXA', 'Baixa']].map((x) => '<option value="' + x[0] + '"' + ((t.prioridade || 'NORMAL') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></label><span></span>' +
    '<label class="full">Notas<textarea class="inp" name="notas" style="min-height:70px">' + esc(t.notas || '') + '</textarea></label></form>';
  const botoes = [{ txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', ic: 'check', acao: async (v) => {
    const d = Object.fromEntries(new FormData($('#ft', v)).entries()); d.id = t.id || null; d.prazo_id = t.prazo_id || null;
    if (!String(d.titulo || '').trim()) { toast('Descreva a tarefa.', true); return false; }
    const r = await api('tarefa_salvar', { tarefa: d }); substituir(S.dados.tarefas, r); redesenhar(); toast(t.id ? 'Tarefa atualizada.' : 'Tarefa criada.');
  } }];
  if (t.id) botoes.unshift({ txt: 'Excluir', ic: 'lixo', cls: 'fant perigo esq', acao: async () => { if (!(await confirmar('Excluir tarefa', 'Excluir a tarefa "' + t.titulo + '"?', 'Excluir', true))) return false; await api('tarefa_excluir', { id: t.id }); S.dados.tarefas = S.dados.tarefas.filter((x) => x.id !== t.id); redesenhar(); toast('Tarefa excluída.'); } });
  modal({ titulo: t.id ? 'Editar tarefa' : 'Nova tarefa', corpo, botoes });
}
async function alternarTarefa(id) {
  const t = tarefas().find((x) => x.id === id); if (!t) return;
  const novo = t.status === 'FEITA' ? 'ABERTA' : 'FEITA';
  t.status = novo; rotaSemCarregar();
  try { const r = await api('tarefa_status', { id, status: novo }); substituir(S.dados.tarefas, r); redesenhar(); if (novo === 'FEITA') toast('Tarefa concluída.'); }
  catch (e) { t.status = novo === 'FEITA' ? 'ABERTA' : 'FEITA'; rotaSemCarregar(); toast(e.message, true); }
}

// ---------- início ----------
aplicarTema(LS.get('tema', 'auto'));
if (S.token) iniciarApp(); else telaLogin('');
