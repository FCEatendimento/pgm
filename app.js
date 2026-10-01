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
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  externo: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  enviar: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  som: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  fila: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h5"/><circle cx="16.5" cy="15" r="2.2"/>',
  junta: '<path d="M12 3v17M8 20h8"/><path d="M4 7h16"/><path d="M6 7l-3 6a3 3 0 0 0 6 0z"/><path d="M18 7l-3 6a3 3 0 0 0 6 0z"/>',
  tabela: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'
};
const LINKS = [
  { t: 'Caixa de memorandos', d: 'memo.novohamburgo.rs.gov.br', url: 'https://memo.novohamburgo.rs.gov.br', ic: 'doc' },
  { t: 'E-mail institucional', d: 'expresso.novohamburgo.rs.gov.br', url: 'https://expresso.novohamburgo.rs.gov.br', ic: 'email' }
];
const ic = (n, c) => '<svg class="i' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24">' + (IC[n] || '') + '</svg>';

const TRIB = { TJRS1: 'TJRS 1º grau', TJRS2: 'TJRS 2º grau', TRF41: 'TRF4 1º grau', TRF42: 'TRF4 2º grau', STJ: 'STJ', STF: 'STF' };
const TRIB_CURTO = { TJRS1: 'TJRS 1º', TJRS2: 'TJRS 2º', TRF41: 'TRF4 1º', TRF42: 'TRF4 2º', STJ: 'STJ', STF: 'STF' };
const LOGO_T = { TJRS: 'data:image/png;base64,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', TRF4: 'data:image/png;base64,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', STJ: 'data:image/png;base64,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', STF: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAGDklEQVR42u2YX4xdVRXGf2vvc879M3Odse0ULKCQRh7sgyQSg5qIPBhifFBRLqCiQRMaiX/a8CBG4zCJDyaYoIYYSKBEMTG9k5oKpJBWM5iAJVimVunY2gTTQijWTmemM3PvPfecvZYPZ5hSSueeeayZlZy3s/b+1rfX+vZaG9Zszdbs0jahZX5VHreiiNiq/ZoSMBPGcf9nDO6a2YZ30vdPRRmsRMwuPEN2+hTDV3+dXhoQFS5KioI4I64JC6/tQAevZrjxadpZhivBZJ5phPcPEidgtvLPIYdaBWbOLGLxC1QrP0MVZIXYDBCDJIbgnsX0kwzWHiAN4KM+1AmIJ6Kz2KazUOkLEHLiOAIXyFzG2bOBzoJCXyaUvOfIRYhoM5cGFudykKgvQCSLgAjnfF+AZoZ4jwWjiiDOIyKI9AFoAs6hZqh5xHvEGSK+L0A1c6vI1iINLEpJc1ecHyWCEtAAIt1iFVtFiZiWB2gIIQexeRJXXmJMHKo9Ou0uUM7PzBAHzs9GqwjHkWeKySksijFbuUAK1g3vhchPU+udRSwqkesFHd4LyuslGTTDeSGERRL5N7kmJY8YogSMk3ztukWcxOWO2MDH4OSIK3m8RpxASN/kiyNvEiVFUfVlQ5QogbR9rFgnlGPQxBAgXTxQEqAaUQV8dX8hbMGX28iKohD5S4HXlasQ5xxB21j+YjmAIoIGyLOnC2ULUpR13zxydBYWUf/sEmAtEZRSqYKGKXocdCWON5BUhdA7xtyJiQKw77+RqlJrCM7v4Y6Nx5ao0b5apmrEVUF1nLuu6bpSx1sZEEJ4mK3Xn16Wgf7sGRoytPvLIi0AU+mzl5JUHd32G8xnj2O20i0goJpTb0R0FyeZOfEwoxNRKUXXkNNYF5H3HqN5xfP84milpFoE6g1B8x/zzU3/ZRznVtwkqUbADHn7G2y9vs2Wkf6Ma+jRWB+zOD/J/PwPGDXH+3rWV5gtZAxfFtOe+w3NjY9h5mjKu9wkpormgXojwkWzdOZv5/arDtFqedgSLip4qgENytCGhDybJE1v4a5rZgGY6dpFganlAAW4+RavHN7KqDkEA8whaAEqhKKC6o6h9R7vn6d7+kbuuGIvLfM0m+GdkQCh8AMGGp6BIUev81tOnvoMX910nFFzjImed7OYKWYBsxxxQmMoolLLWJj9CX/fdydjN3W5H3srbyPEV6nWwXvIUnDxy3TTHYS9j/LlZq8AJ+eDc8GR1B1R7PAeup0cDROIe4gvDD8JcAG4QoAjqjVHnlWIEsjTOfLeHvLwc5ojL2Em3G+CyDLjEeg/CelJSF4iTZ9jbvpFtm6ew8wxOhHRlPzC5jXu0l04hvNTaNiP2gQ7736Z8fHAxETEc5/S88BdO19sGMks7YWjGAfI0hdYbP+ZOzdNAfDIgRghX674Zfvh0x/ghu21iybw6ERU9HRvswf+NsB3nrgSPhK/u8+o49bWhZ3L6JMbuOfxy7mYyt84Gr3TT9j2h/9gmeLcNLjX8dERLBykkx6iwlEebHYAaLU848B4M/Ct332cgffsJut0EZnGxcdxTJHZQcLCP3joK0fOTYEtz4dGhLGbcu7Z+V0a635EZ+4szk/j/Ks49wpZb5JMp/jVl44vBwgwNqYRobcRBxiXI7IFs5vBQRK1cfFBvrfrKc688SjN5vRydD4WQjZStFzuKuA6TD6HB6R+hu27/wrsZPLzTzDezLn7kYJpLxGWj2C6AYk2I3wUA5xArXKCbb/fj/Frxm555lyPVx2EZACi6tIgI8WX1OtUBj7B0GU/ZdO1/+Lep74NryVLA1RCtbHkVwFxhY/zkNTXMTB8M4Prd/CxfYe4d/dnmfmjLmlkjUoD4prg43PjjE8grryfxobbaKzbw31797F914eLqgr599/Wkhb4FAg9I2RKZw7ieoKF9bx34zDQIc1fJc/uw3LFRJbHJjWw1Oj0lNATKkN1lM1ceUMC4x2c/ImsoyAZqu48v6xrpB3FVKgMDmP+gyCHLoWnj1a5OeGtAjnnV65VO3zYGBvT5QmvhSsWW/l9ZfmJZc3WbM0ucfsfSKrjlRMjhvEAAAAASUVORK5CYII=' };
const FOTO_FABIO = 'data:image/jpeg;base64,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';
const fotoEu = (eu) => eu.foto || (['atendimento@fceadvogados.com.br', 'emerim@icloud.com'].includes(String(eu.email || '').toLowerCase()) ? FOTO_FABIO : '');
const logoT = (k) => { const u = LOGO_T[String(k || '').replace(/[12]$/, '')]; return u ? '<img class="lg-t" src="' + u + '" alt="">' : ''; };
const STATUS = { PENDENTE: 'A fazer', EM_ELABORACAO: 'Em elaboração', PROTOCOLADO: 'Protocolado', CIENCIA: 'Ciência dada', ARQUIVADO: 'Arquivado' };
const MEMO = { NAO: 'Sem memorando', A_ENVIAR: 'A enviar', ENVIADO: 'Enviado – aguardando', RESPONDIDO: 'Respondido' };
const SECRETARIAS = ['Fazenda', 'Administração', 'Saúde', 'Educação', 'Obras e Serviços Urbanos', 'Desenvolvimento Urbano e Habitação', 'Meio Ambiente', 'Desenvolvimento Social', 'Segurança', 'Mobilidade Urbana', 'Cultura', 'Esporte e Lazer', 'Gabinete do Prefeito', 'PROCON', 'COMUSA', 'Previdência (IPASEM)'];
const ABERTOS = ['PENDENTE', 'EM_ELABORACAO'];

// ---------- estado ----------
const S = {
  token: LS.get('token', ''), eu: LS.get('eu', null),
  dados: LS.get('dados', null), carregadoEm: 0,
  f: Object.assign({ sit: 'abertos', trib: '', marca: '', q: '' }, LS.get('filtros', {})),
  ft: 'abertas',
  vis: LS.get('vis', 'lista'), ord: LS.get('ord', { c: 'fim', d: 1 }),
  jt: LS.get('jt', 'relatoria'), jf: 'abertos', jq: '', jb: { q: '', tributo: '', resultado: '', ano: '' }, jr: null
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
  $('#app').innerHTML = '<div class="login"><div class="caixa"><div class="logo"><img src="brasao.png" alt="Brasão de Novo Hamburgo"></div><h1>Prazos e Tarefas</h1><p>Procuradoria-Geral do Município de Novo Hamburgo</p><div class="gbtn" id="gbtn"><div class="spin"></div></div>' +
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
  const [d, j, o] = await Promise.all([api('listar', { filtro: 'todos' }), api('jrf_listar').catch(() => null), apiAg('ordens').catch(() => null)]);
  d.jrf = j || (S.dados && S.dados.jrf) || { processos: [], sessoes: [], juris_total: 0 };
  d.ordens = o || (S.dados && S.dados.ordens) || [];
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
  { k: 'memorandos', t: 'Memorandos', tc: 'Memos', ic: 'memo' },
  { k: 'junta', t: 'Junta de Recursos', tc: 'Junta', ic: 'junta' },
  { k: 'ordens', t: 'Fila do agente', ic: 'fila', lat: true }
];
function iniciarApp() {
  const eu = S.eu || {};
  const av = fotoEu(eu) ? '<img src="' + esc(fotoEu(eu)) + '" alt="" referrerpolicy="no-referrer">' : esc((eu.nome || '?').slice(0, 1));
  $('#app').innerHTML = '<aside class="side"><div class="marca"><div class="logo"><img src="brasao.png" alt="Brasão de Novo Hamburgo"></div><div><b>Prazos e Tarefas</b><span>PGM · Novo Hamburgo</span></div></div>' +
    '<nav class="nav">' + ROTAS.map((r) => '<a href="#/' + r.k + '" data-r="' + r.k + '">' + ic(r.ic) + '<span>' + r.t + '</span><span class="bdg-slot"></span></a>').join('') + '</nav>' +
    '<div class="nav-tit">Acesso rápido</div><nav class="nav">' + LINKS.map((l) => '<a href="' + l.url + '" target="_blank" rel="noopener" title="' + esc(l.d) + '">' + ic(l.ic) + '<span>' + esc(l.t) + '</span>' + ic('externo', 's ext') + '</a>').join('') + '</nav>' +
    '<div class="rodape"><div class="av">' + av + '</div><div style="min-width:0"><div class="n">' + esc(eu.nome || '') + '</div><div class="e">' + esc(eu.email || '') + '</div></div><button title="Sair" id="bsair">' + ic('sair') + '</button></div></aside>' +
    '<main class="main"><header class="topo"><h1 id="titulo"></h1><div class="acoes"><button class="btn fant ico" id="btema" title="Alternar tema claro/escuro"></button><button class="btn fant ico" id="batual" title="Atualizar">' + ic('atual') + '</button><button class="btn pri sm" id="bnovo">' + ic('mais2', 's') + '<span>Novo prazo</span></button></div></header><div class="conteudo" id="conteudo"></div></main>' +
    '<nav class="tabbar">' + ROTAS.filter((r) => !r.lat).map((r) => '<a href="#/' + r.k + '" data-r="' + r.k + '">' + ic(r.ic) + '<span>' + (r.tc || r.t) + '</span><span class="bdg-slot"></span></a>').join('') + '<a href="#/mais" data-r="mais">' + ic('mais') + '<span>Mais</span></a></nav>' +
    '<button class="fab" id="bvoz" title="Falar com o assistente" aria-label="Falar com o assistente">' + ic('mic') + '</button>';
  $('#bsair').onclick = () => sair(false);
  $('#bvoz').onclick = () => abrirAssistente(true);
  $('#batual').onclick = () => rota(true);
  $('#btema').onclick = () => { aplicarTema(temaEfetivo() === 'escuro' ? 'claro' : 'escuro'); if (location.hash.startsWith('#/mais')) VIEWS.mais(); };
  iconeTema();
  $('#bnovo').onclick = () => (location.hash.startsWith('#/tarefas') ? editarTarefa() : location.hash.startsWith('#/junta') ? novoJunta() : location.hash.startsWith('#/ordens') ? editarOrdem({ tipo: 'OUTRO' }) : editarPrazo());
  if (!location.hash || location.hash === '#/') location.hash = '#/inicio';
  rota();
}
function badges() {
  const h = hoje();
  const urg = prazos().filter((p) => aberto(p) && p.fim && p.fim <= h).length;
  const tar = tarefas().filter((t) => t.status === 'ABERTA' && t.vencimento && t.vencimento <= h).length;
  const mem = prazos().filter((p) => aberto(p) && p.memo_status === 'A_ENVIAR').length;
  const set = (k, n, r) => $$('a[data-r="' + k + '"] .bdg-slot').forEach((e) => { e.innerHTML = n ? '<span class="bdg' + (r ? ' r' : '') + '">' + n + '</span>' : ''; });
  const jv = ((S.dados && S.dados.jrf && S.dados.jrf.processos) || []).filter((p) => !['JULGADO', 'ARQUIVADO'].includes(p.status) && p.prazo_voto && p.prazo_voto <= addDias(h, 3)).length;
  set('prazos', urg, true); set('tarefas', tar, true); set('memorandos', mem, false); set('junta', jv, true);
  set('ordens', ((S.dados && S.dados.ordens) || []).filter((o) => ['AGUARDANDO_CONFIRMACAO', 'ERRO'].includes(o.status)).length, true);
}
let rodando = 0;
async function rota(forcar) {
  const [k, arg] = (location.hash.replace(/^#\//, '') || 'inicio').split('/');
  const v = VIEWS[k] ? k : 'inicio';
  $$('a[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === v));
  $('#bnovo span').textContent = v === 'tarefas' ? 'Nova tarefa' : v === 'junta' ? rotuloNovoJunta() : v === 'ordens' ? 'Nova ordem' : 'Novo prazo';
  $('#conteudo').classList.remove('largo');
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
  const tags = ['<span class="chip nav">' + logoT(p.tribunal) + esc(TRIB_CURTO[p.tribunal] || p.tribunal) + '</span>'];
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
    '<div class="sec-tit">Junta de Recursos Fiscais <a class="btn fant sm" href="#/junta" style="margin-left:auto">Abrir</a></div>' + cardProxSessao() +
    (() => { const l = jProc().filter(jrfAberto).slice(0, 5); return l.length ? '<div class="card" style="margin-top:12px"><div class="lista">' + l.map(itemJrf).join('') + '</div></div>' : ''; })() +
    (() => { const l = ordensLista().filter(ordemAberta); return l.length ? '<div class="sec-tit">Fila do agente <span class="bdg">' + l.length + '</span><a class="btn fant sm" href="#/ordens" style="margin-left:auto">Abrir</a></div><div class="card"><div class="lista">' + l.slice(0, 4).map(itemOrdem).join('') + '</div></div>' : ''; })() +
    '<div class="rodape-app">TJRS 1º e 2º graus · TRF4 1º e 2º graus · Junta de Recursos Fiscais</div>';
  $$('[data-go]').forEach((e) => { e.onclick = () => { const g = e.dataset.go; if (g === 'memo') { location.hash = '#/memorandos'; return; } Object.assign(S.f, { sit: 'abertos', trib: '', marca: g, q: '' }); LS.set('filtros', S.f); location.hash = '#/prazos'; }; });
  ligarListas($('#conteudo')); ligarJunta($('#conteudo'));
  $$('[data-o]').forEach((e) => { e.onclick = () => verOrdem(ordensLista().find((o) => o.id === e.dataset.o)); });
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
  const vis = S.vis === 'tabela' ? 'tabela' : 'lista';
  $('#conteudo').classList.toggle('largo', vis === 'tabela');
  $('#conteudo').innerHTML = '<div class="barra"><label class="busca">' + ic('busca', 's') + '<input id="q" placeholder="Buscar processo, parte, peça, secretaria…" value="' + esc(f.q) + '"></label>' +
    '<div class="seg" role="group" aria-label="Formato">' + [['lista', 'Lista', 'lista'], ['tabela', 'Tabela', 'tabela']].map((o) => '<button data-vis="' + o[0] + '" class="' + (vis === o[0] ? 'on' : '') + '" title="Ver em ' + o[1].toLowerCase() + '">' + ic(o[2], 's') + '<span>' + o[1] + '</span></button>').join('') + '</div></div>' +
    '<div class="filtros">' + bt('sit', 'abertos', 'Abertos', prazos().filter(aberto).length) + bt('sit', 'concluidos', 'Concluídos') + bt('sit', 'arquivados', 'Arquivados') + bt('sit', 'todos', 'Todos') +
    '<span class="sep"></span>' + bt('trib', '', 'Todos os tribunais') + Object.keys(TRIB).map((k) => bt('trib', k, logoT(k) + TRIB_CURTO[k], cnt((p) => p.tribunal === k))).join('') + '</div>' +
    '<div class="filtros" style="margin-top:-4px">' + bt('marca', '', 'Sem filtro') + Object.keys(MARCAS).map((k) => bt('marca', k, MARCAS[k][0], cnt(MARCAS[k][1]))).join('') + '</div>' +
    (!lista.length ? '<div class="card">' + vazio(prazos().length ? 'Nenhum prazo com esses filtros.' : 'Nenhum prazo cadastrado ainda.', 'prazo') + '</div>'
      : vis === 'tabela' ? tabelaPrazos(lista) : '<div class="card"><div class="lista">' + lista.map(itemPrazo).join('') + '</div></div>') +
    '<p class="pp mut" style="margin:10px 2px">' + lista.length + ' prazo(s)</p>';
  $$('[data-vis]').forEach((b) => { b.onclick = () => { S.vis = b.dataset.vis; LS.set('vis', S.vis); VIEWS.prazos(); }; });
  $$('th[data-oc]').forEach((th) => { th.onclick = () => { const c = th.dataset.oc; S.ord = { c, d: S.ord.c === c ? -S.ord.d : 1 }; LS.set('ord', S.ord); VIEWS.prazos(); }; });
  $$('[data-sit],[data-trib],[data-marca]').forEach((b) => { b.onclick = () => { const g = b.dataset.sit !== undefined ? 'sit' : b.dataset.trib !== undefined ? 'trib' : 'marca'; S.f[g] = b.dataset[g]; LS.set('filtros', S.f); VIEWS.prazos(); }; });
  const qi = $('#q'); let tm;
  qi.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { S.f.q = qi.value; LS.set('filtros', S.f); const pos = qi.selectionStart; VIEWS.prazos(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); }, 250); };
  ligarListas($('#conteudo'));
};
const COLS = [
  { c: 'fim', t: 'Prazo', v: (p) => p.fim || '9999' },
  { c: 'tribunal', t: 'Tribunal', v: (p) => p.tribunal },
  { c: 'processo', t: 'Processo', v: (p) => p.processo },
  { c: 'parte', t: 'Parte', v: (p) => (p.parte || '').toLowerCase() },
  { c: 'classe', t: 'Classe', v: (p) => (p.classe || '').toLowerCase() },
  { c: 'providencia', t: 'Providência', v: (p) => (p.providencia || '').toLowerCase() },
  { c: 'status', t: 'Situação', v: (p) => Object.keys(STATUS).indexOf(p.status) },
  { c: 'ed', t: 'Embargos', v: (p) => p.ed_cabivel ? (p.ed_prazo || '0') : '~' },
  { c: 'memo', t: 'Memorando', v: (p) => ({ A_ENVIAR: 0, ENVIADO: 1, RESPONDIDO: 2 }[p.memo_status] ?? 3) },
  { c: 'retorno', t: 'Retorno memo', v: (p) => p.memo_status && p.memo_status !== 'NAO' ? (p.memo_retorno || (p.fim ? addDias(p.fim, -7) : '9999')) : '~' }
];
function tabelaPrazos(lista) {
  const col = COLS.find((x) => x.c === S.ord.c) || COLS[0], d = S.ord.d || 1;
  const l = lista.slice().sort((a, b) => { const x = col.v(a), y = col.v(b); return (x < y ? -1 : x > y ? 1 : 0) * d || String(a.fim || '9').localeCompare(String(b.fim || '9')); });
  const th = COLS.map((x) => '<th data-oc="' + x.c + '" class="' + (x.c === col.c ? 'ord' : '') + '">' + x.t + (x.c === col.c ? '<span class="seta">' + (d > 0 ? '▲' : '▼') + '</span>' : '') + '</th>').join('');
  const linhas = l.map((p) => {
    const n = dias(p.fim), u = aberto(p) ? urg(n) : 'ok';
    const ret = p.memo_retorno || (p.fim ? addDias(p.fim, -7) : null);
    const temMemo = p.memo_status && p.memo_status !== 'NAO';
    return '<tr data-p="' + esc(p.id) + '" class="u-' + (u || 'n') + '">' +
      '<td class="nw"><span class="dot ' + u + '"></span><b>' + fdata(p.fim) + '</b>' + (p.fim && aberto(p) ? '<div class="pp ' + (u ? 'c-' + u : 'mut') + '">' + rel(n) + '</div>' : '') + '</td>' +
      '<td class="nw"><span class="chip nav">' + logoT(p.tribunal) + esc(TRIB_CURTO[p.tribunal] || p.tribunal) + '</span></td>' +
      '<td class="nw num">' + esc(p.processo) + '</td>' +
      '<td class="lg">' + esc(p.parte || '—') + '</td>' +
      '<td class="md">' + esc(p.classe || '—') + '</td>' +
      '<td class="xl">' + esc(p.providencia || p.intimacao || '—') + '</td>' +
      '<td class="nw"><span class="chip ' + (p.status === 'EM_ELABORACAO' ? 'info' : aberto(p) ? '' : 'ok') + '">' + esc(STATUS[p.status] || p.status) + '</span></td>' +
      '<td class="nw">' + (p.ed_cabivel ? '<span class="chip ouro">Sim' + (p.ed_prazo ? ' · até ' + fdata(p.ed_prazo) : '') + '</span>' : '<span class="mut">Não</span>') + '</td>' +
      '<td class="md">' + (temMemo ? '<span class="chip ' + (p.memo_status === 'RESPONDIDO' ? 'ok' : p.memo_status === 'A_ENVIAR' ? 'warn' : 'info') + '">' + esc(MEMO[p.memo_status].split(' –')[0]) + '</span>' + (p.memo_secretaria ? '<div class="pp mut">' + esc(p.memo_secretaria) + '</div>' : '') : '<span class="mut">Não</span>') + '</td>' +
      '<td class="nw">' + (temMemo ? fdata(ret) : '<span class="mut">—</span>') + '</td></tr>';
  }).join('');
  return '<div class="card tab-wrap"><table class="tab"><thead><tr>' + th + '</tr></thead><tbody>' + linhas + '</tbody></table></div>';
}
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
    '<div class="d">' + esc(p.parte || '') + (p.parte && p.providencia ? ' – ' : '') + esc(p.providencia || '') + '</div><div class="tags"><span class="chip nav">' + logoT(p.tribunal) + esc(TRIB_CURTO[p.tribunal]) + '</span><span class="chip">prazo ' + fdata(p.fim) + '</span></div></div>' +
    '<div class="dir"><span class="pp mut">retorno até</span><span class="data">' + fdata(ret) + '</span>' + (prox ? '<button class="btn sm" data-ms="' + prox[0] + '" data-id="' + esc(p.id) + '">' + prox[1] + '</button>' : '') + '</div></div>';
}
VIEWS.mais = function () {
  titulo('Mais');
  const eu = S.eu || {};
  const tema = document.documentElement.dataset.tema || 'auto';
  $('#conteudo').innerHTML = '<div class="card" style="margin-top:14px"><div class="lista"><div class="item"><div class="av">' + (fotoEu(eu) ? '<img src="' + esc(fotoEu(eu)) + '" alt="" referrerpolicy="no-referrer">' : '') + '</div><div class="mid"><div class="t">' + esc(eu.nome || '') + '</div><div class="d">' + esc(eu.email || '') + '</div></div></div>' +
    '<div class="item">' + ic(temaEfetivo() === 'escuro' ? 'lua' : 'sol') + '<div class="mid"><div class="t">Tema</div><div class="seg" style="margin-top:8px">' + [['claro', 'Claro'], ['escuro', 'Escuro'], ['auto', 'Automático']].map((o) => '<button data-tema="' + o[0] + '" class="' + (tema === o[0] ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div></div></div>' +
    '<a class="item clic" href="#/ordens">' + ic('fila') + '<div class="mid"><div class="t">Fila do agente</div><div class="d">Memorandos, minutas e documentos pedidos por voz</div></div></a>' +
    '<div class="item clic" id="matual">' + ic('atual') + '<div class="mid"><div class="t">Atualizar dados</div></div></div>' +
    '<div class="item clic" id="msair" style="color:var(--bad)">' + ic('sair') + '<div class="mid"><div class="t">Sair</div></div></div></div></div>' +
    '<div class="sec-tit">Acesso rápido</div><div class="card"><div class="lista">' + LINKS.map((l) => '<a class="item clic" href="' + l.url + '" target="_blank" rel="noopener">' + ic(l.ic) + '<div class="mid"><div class="t">' + esc(l.t) + '</div><div class="d">' + esc(l.d) + '</div></div>' + ic('externo', 's') + '</a>').join('') + '</div></div>';
  $$('button[data-tema]').forEach((b) => { b.onclick = () => { aplicarTema(b.dataset.tema); VIEWS.mais(); }; });
  $('#matual').onclick = () => rota(true);
  $('#msair').onclick = () => sair(false);
};
const escuroSistema = () => !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
function temaEfetivo() { const t = document.documentElement.dataset.tema; return t || (escuroSistema() ? 'escuro' : 'claro'); }
function iconeTema() { const b = $('#btema'); if (!b) return; const e = temaEfetivo() === 'escuro'; b.innerHTML = ic(e ? 'sol' : 'lua'); b.title = e ? 'Usar tema claro' : 'Usar tema escuro'; }
function aplicarTema(t) {
  if (t === 'auto') delete document.documentElement.dataset.tema; else document.documentElement.dataset.tema = t;
  LS.set('tema', t); iconeTema();
  const m = $('meta[name="theme-color"]'); if (m) m.content = temaEfetivo() === 'escuro' ? '#0A111D' : '#0E1A2B';
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.dataset.tema) aplicarTema('auto'); }); } catch (e) {}

// ---------- Junta de Recursos Fiscais ----------
const JST = { EM_ANALISE: 'Em análise', VOTO_PRONTO: 'Voto pronto', PAUTADO: 'Pautado', VISTA: 'Pedido de vista', DILIGENCIA: 'Em diligência', JULGADO: 'Julgado', ARQUIVADO: 'Arquivado' };
const JRES = { PROVIDO: 'Provido', PARCIAL: 'Parcialmente provido', NAO_PROVIDO: 'Não provido', NAO_CONHECIDO: 'Não conhecido', DILIGENCIA: 'Convertido em diligência', OUTRO: 'Outro' };
const TRIBUTOS = ['IPTU', 'ISSQN', 'ITBI', 'Taxa de Coleta de Lixo', 'Taxa de Licença e Fiscalização', 'Contribuição de Melhoria', 'COSIP', 'Multa por infração', 'Outros'];
const jrfAberto = (p) => !['JULGADO', 'ARQUIVADO'].includes(p.status);
const jrf = () => (S.dados && S.dados.jrf) || { processos: [], sessoes: [], juris_total: 0 };
const jProc = () => jrf().processos || [];
const jSess = () => jrf().sessoes || [];
const sessao = (id) => jSess().find((x) => x.id === id);
const resCls = (r) => r === 'PROVIDO' ? 'ok' : r === 'NAO_PROVIDO' ? 'bad' : r === 'PARCIAL' ? 'ouro' : r ? 'info' : '';
const moeda = (v) => v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const marcar = (t) => esc(t).replace(/\[\[/g, '<mark>').replace(/\]\]/g, '</mark>');
function proximaSessao() { const h = hoje(); return jSess().filter((x) => x.data >= h).sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')))[0]; }
function textoSessao(x, curto) { if (!x) return ''; return fdata(x.data, true) + (x.hora ? ' às ' + esc(x.hora) : '') + (curto ? '' : ' · ' + (x.tipo === 'EXTRAORDINARIA' ? 'extraordinária' : 'ordinária')); }
function cardProxSessao() {
  const x = proximaSessao();
  if (!x) return '<div class="card jrf-prox vaz"><div class="ico">' + ic('hoje', 's') + '</div><div><div class="rot">Próxima sessão de julgamento</div><div class="t">Nenhuma sessão futura cadastrada</div></div><button class="btn sm" data-nsess>' + ic('mais2', 's') + 'Cadastrar sessão</button></div>';
  const n = dias(x.data), meus = jProc().filter((p) => p.sessao_id === x.id);
  return '<div class="card jrf-prox clic" data-s="' + esc(x.id) + '"><div class="ico">' + ic('hoje', 's') + '</div><div style="min-width:0"><div class="rot">Próxima sessão de julgamento</div><div class="t">' + textoSessao(x) + '</div>' +
    '<div class="d">' + (x.local ? esc(x.local) + ' · ' : '') + (meus.length ? meus.length + ' processo(s) sob sua relatoria' : 'nenhum processo seu pautado') + '</div></div><span class="chip ' + (urg(n) || 'nav') + '">' + rel(n) + '</span></div>';
}
function itemJrf(p) {
  const aberta = jrfAberto(p), n = dias(p.prazo_voto), u = aberta ? urg(n) : 'ok', x = sessao(p.sessao_id);
  const tags = ['<span class="chip ' + (p.status === 'JULGADO' ? 'ok' : p.status === 'PAUTADO' ? 'info' : p.status === 'VOTO_PRONTO' ? 'ouro' : '') + '">' + esc(JST[p.status] || p.status) + '</span>'];
  if (p.tributo) tags.unshift('<span class="chip nav">' + esc(p.tributo) + '</span>');
  if (x) tags.push('<span class="chip">Sessão ' + fdata(x.data) + '</span>');
  if (p.resultado) tags.push('<span class="chip ' + resCls(p.resultado) + '">' + esc(JRES[p.resultado]) + '</span>');
  if (p.valor) tags.push('<span class="chip">' + moeda(p.valor) + '</span>');
  return '<div class="item clic" data-jp="' + esc(p.id) + '"><span class="dot ' + u + '"></span><div class="mid"><div class="t"><span class="num">' + esc(p.numero) + '</span>' + (p.recorrente ? '<span class="par"><span class="sep-p"> · </span>' + esc(p.recorrente) + '</span>' : '') + '</div>' +
    '<div class="d">' + esc(p.materia || 'Matéria não informada') + '</div><div class="tags">' + tags.join('') + '</div></div>' +
    '<div class="dir">' + (p.prazo_voto ? '<span class="pp mut">voto até</span><span class="data">' + fdata(p.prazo_voto) + '</span>' + (aberta ? '<span class="chip ' + (u || '') + '">' + rel(n) + '</span>' : '') : '<span class="pp mut">sem prazo</span>') + '</div></div>';
}
function itemSessao(x) {
  const meus = jProc().filter((p) => p.sessao_id === x.id), n = dias(x.data), futura = x.data >= hoje();
  const d = dt(x.data);
  return '<div class="item clic" data-s="' + esc(x.id) + '"><div class="dia' + (futura ? '' : ' pass') + '"><b>' + String(d.getUTCDate()).padStart(2, '0') + '</b><span>' + d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '') + '</span></div>' +
    '<div class="mid"><div class="t">' + esc(DS[d.getUTCDay()]) + (x.hora ? ', ' + esc(x.hora) : '') + ' · Sessão ' + (x.tipo === 'EXTRAORDINARIA' ? 'extraordinária' : 'ordinária') + '</div>' +
    '<div class="d">' + esc(x.local || '') + (x.local && x.observacoes ? ' – ' : '') + esc(x.observacoes || '') + '</div>' +
    (meus.length ? '<div class="tags">' + meus.map((p) => '<span class="chip ' + (p.status === 'JULGADO' ? 'ok' : 'info') + '">' + esc(p.numero) + '</span>').join('') + '</div>' : '') + '</div>' +
    '<div class="dir">' + (futura ? '<span class="chip ' + (urg(n) || '') + '">' + rel(n) + '</span>' : '<span class="pp mut">realizada</span>') + '<span class="pp mut">' + meus.length + ' processo(s)</span></div></div>';
}
function ligarJunta(raiz) {
  $$('[data-jp]', raiz).forEach((e) => { e.onclick = () => editarJrf(jProc().find((p) => p.id === e.dataset.jp)); });
  $$('[data-s]', raiz).forEach((e) => { e.onclick = () => editarSessao(sessao(e.dataset.s)); });
  $$('[data-nsess]', raiz).forEach((e) => { e.onclick = (ev) => { ev.stopPropagation(); editarSessao(); }; });
  $$('[data-jj]', raiz).forEach((e) => { e.onclick = () => verJuris(e.dataset.jj); });
}
function novoJunta() { if (S.jt === 'sessoes') editarSessao(); else if (S.jt === 'juris') editarJuris(); else editarJrf(); }
const rotuloNovoJunta = () => S.jt === 'sessoes' ? 'Nova sessão' : S.jt === 'juris' ? 'Nova decisão' : 'Novo processo';
VIEWS.junta = function (arg) {
  if (['relatoria', 'sessoes', 'juris'].includes(arg)) S.jt = arg;
  S.jt = S.jt || 'relatoria'; LS.set('jt', S.jt);
  titulo(window.innerWidth < 600 ? 'Junta (JRF)' : 'Junta de Recursos Fiscais');
  $('#bnovo span').textContent = rotuloNovoJunta();
  const abertos = jProc().filter(jrfAberto);
  const seg = '<div class="seg jrf-abas" role="tablist">' + [['relatoria', window.innerWidth < 600 ? 'Relatoria' : 'Minha relatoria', abertos.length], ['sessoes', 'Sessões', jSess().filter((x) => x.data >= hoje()).length], ['juris', 'Jurisprudência', jrf().juris_total || 0]]
    .map((o) => '<button data-jt="' + o[0] + '" class="' + (S.jt === o[0] ? 'on' : '') + '">' + o[1] + '<span class="n">' + o[2] + '</span></button>').join('') + '</div>';
  let corpo = '';
  if (S.jt === 'relatoria') {
    const f = S.jf || 'abertos', q = (S.jq || '').trim().toLowerCase();
    const lista = jProc().filter((p) => (f === 'todos' || (f === 'abertos' ? jrfAberto(p) : !jrfAberto(p))) &&
      (!q || [p.numero, p.recorrente, p.tributo, p.materia, p.notas, p.acordao].join(' ').toLowerCase().includes(q)));
    const bt = (v, t, n) => '<button data-jf="' + v + '" class="' + (f === v ? 'on' : '') + '">' + t + (n !== undefined ? '<span class="n">' + n + '</span>' : '') + '</button>';
    corpo = cardProxSessao() +
      '<div class="barra"><label class="busca">' + ic('busca', 's') + '<input id="jq" placeholder="Filtrar por número, recorrente, tributo, matéria…" value="' + esc(S.jq || '') + '"></label></div>' +
      '<div class="filtros">' + bt('abertos', 'Em andamento', abertos.length) + bt('julgados', 'Julgados e arquivados', jProc().length - abertos.length) + bt('todos', 'Todos') + '</div>' +
      '<div class="card"><div class="lista">' + (lista.map(itemJrf).join('') || vazio(jProc().length ? 'Nenhum processo com esse filtro.' : 'Nenhum processo sob sua relatoria cadastrado ainda.', 'junta')) + '</div></div>';
  } else if (S.jt === 'sessoes') {
    const h = hoje(), fut = jSess().filter((x) => x.data >= h), pas = jSess().filter((x) => x.data < h).reverse();
    corpo = cardProxSessao() +
      '<div class="sec-tit">Próximas sessões <span class="bdg">' + fut.length + '</span></div><div class="card"><div class="lista">' + (fut.map(itemSessao).join('') || vazio('Nenhuma sessão futura cadastrada.', 'hoje')) + '</div></div>' +
      '<div class="sec-tit">Sessões anteriores</div><div class="card"><div class="lista">' + (pas.slice(0, 30).map(itemSessao).join('') || vazio('Nenhuma sessão anterior.', 'hoje')) + '</div></div>';
  } else {
    const b = S.jb, r = S.jr;
    const opts = (lista, sel, vazioTxt) => '<option value="">' + vazioTxt + '</option>' + lista.map((v) => '<option value="' + esc(v[0]) + '"' + (v[0] === sel ? ' selected' : '') + '>' + esc(v[1]) + '</option>').join('');
    const tribs = Array.from(new Set(TRIBUTOS.concat((r && r.tributos) || []))).sort().map((t) => [t, t]);
    const anos = ((r && r.anos) || []).slice().sort().reverse().map((a) => [a, a]);
    corpo = '<div id="jimp">' + cardImport() + '</div>' +
      '<div class="barra"><label class="busca">' + ic('busca', 's') + '<input id="jbq" placeholder="Pesquisar na jurisprudência: palavras, acórdão, processo, recorrente…" value="' + esc(b.q) + '" enterkeyhint="search"></label></div>' +
      '<div class="barra jrf-fil"><select class="sel" id="jbt">' + opts(tribs, b.tributo, 'Todos os tributos') + '</select><select class="sel" id="jbr">' + opts(Object.entries(JRES), b.resultado, 'Qualquer resultado') + '</select><select class="sel" id="jba">' + opts(anos, b.ano, 'Todos os anos') + '</select></div>' +
      '<p class="pp mut dica">Dica: use aspas para expressão exata ("local da prestação"), OR para alternativas e – para excluir (IPTU -isenção). A busca reconhece variações das palavras (isenção, isento, isentos).</p>' +
      '<div id="jres">' + resultadosJuris() + '</div>';
  }
  $('#conteudo').innerHTML = seg + corpo;
  $$('[data-jt]').forEach((e) => { e.onclick = () => { S.jt = e.dataset.jt; LS.set('jt', S.jt); VIEWS.junta(); if (S.jt === 'juris' && !S.jr) buscarJuris(); }; });
  $$('[data-jf]').forEach((e) => { e.onclick = () => { S.jf = e.dataset.jf; VIEWS.junta(); }; });
  const jq = $('#jq'); if (jq) { let tm; jq.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { S.jq = jq.value; const pos = jq.selectionStart; VIEWS.junta(); const n = $('#jq'); n.focus(); n.setSelectionRange(pos, pos); }, 250); }; }
  const jbq = $('#jbq');
  if (jbq) {
    let tm; jbq.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { S.jb.q = jbq.value; buscarJuris(); }, 450); };
    jbq.onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(tm); S.jb.q = jbq.value; buscarJuris(); } };
    [['#jbt', 'tributo'], ['#jbr', 'resultado'], ['#jba', 'ano']].forEach(([s, k]) => { $(s).onchange = (e) => { S.jb[k] = e.target.value; buscarJuris(); }; });
    if (!S.jr && !S.jbusy) buscarJuris();
    if (!S.jarq || Date.now() - (S.jarqEm || 0) > 60000) carregarImport(); else ligarImport();
  }
  ligarJunta($('#conteudo'));
};
const AST = { OK: ['ok', 'importado'], ERRO: ['bad', 'erro'], IGNORADO: ['warn', 'sem decisão'], REPROCESSAR: ['info', 'na fila'] };
function cardImport() {
  const a = S.jarq, t = (a && a.totais) || {};
  const resumo = !a ? 'Carregando…' : !t.arquivos ? 'Nenhum arquivo lido ainda. Coloque os acórdãos (PDF, Word, Google Docs ou imagem) na pasta e eles aparecem aqui em até 15 minutos.'
    : t.arquivos + ' arquivo(s) lido(s) · ' + t.decisoes + ' decisão(ões) importada(s)' + (t.erro ? ' · <b class="c-bad">' + t.erro + ' com erro</b>' : '') + (t.ultimo ? ' · último em ' + esc(new Date(t.ultimo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : '');
  const lista = a && a.arquivos && a.arquivos.length ? '<details class="imp-det"' + (t.erro ? ' open' : '') + '><summary>Ver arquivos</summary><div class="lista">' + a.arquivos.map((f) => {
    const st = AST[f.status] || ['', f.status];
    return '<div class="item"><div class="mid"><div class="t"><a class="lnk" href="' + esc(f.link || '#') + '" target="_blank" rel="noopener">' + esc(f.nome || f.file_id) + '</a></div>' +
      (f.erro ? '<div class="d">' + esc(f.erro) + '</div>' : '') + '<div class="tags"><span class="chip ' + st[0] + '">' + st[1] + '</span>' + (f.decisoes ? '<span class="chip">' + f.decisoes + ' decisão(ões)</span>' : '') + '</div></div>' +
      '<div class="dir"><span class="pp mut">' + esc(new Date(f.processado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</span>' +
      (f.status !== 'REPROCESSAR' ? '<button class="btn sm fant" data-rep="' + esc(f.file_id) + '">Reprocessar</button>' : '') + '</div></div>';
  }).join('') + '</div></details>' : '';
  return '<div class="card aviso imp"><div class="ico">' + ic('atual', 's') + '</div><div style="flex:1;min-width:0"><b>Importação automática do Google Drive</b>' +
    '<p>Pasta <b>PGM - Jurisprudência JRF</b>, verificada a cada 15 minutos. ' + resumo + '</p>' + lista + '</div></div>';
}
async function carregarImport() {
  try { S.jarq = await api('jrf_arquivos'); S.jarqEm = Date.now(); } catch (e) { S.jarq = S.jarq || { arquivos: [], totais: {} }; }
  const box = $('#jimp'); if (box) { box.innerHTML = cardImport(); ligarImport(); }
}
function ligarImport() {
  $$('[data-rep]').forEach((b) => { b.onclick = async () => { b.disabled = true; try { await api('jrf_arquivo_reprocessar', { file_id: b.dataset.rep }); toast('O arquivo será lido de novo em até 15 minutos.'); carregarImport(); } catch (e) { b.disabled = false; toast(e.message, true); } }; });
}
function resultadosJuris() {
  const r = S.jr;
  if (!r) return '<div class="card"><div class="carregando"><div class="spin"></div></div></div>';
  if (!r.itens.length) return '<div class="card">' + vazio(jrf().juris_total ? 'Nenhuma decisão encontrada para essa pesquisa.' : 'A base de jurisprudência ainda está vazia. Cadastre decisões em "Nova decisão".', 'busca') + '</div>';
  const itens = r.itens.map((j) => '<div class="item clic juris" data-jj="' + esc(j.id) + '"><div class="mid"><div class="t">' + (j.acordao ? 'Acórdão ' + esc(j.acordao) : 'Decisão sem número') + (j.processo ? '<span class="par"><span class="sep-p"> · </span>Proc. ' + esc(j.processo) + '</span>' : '') + '</div>' +
    '<div class="ementa">' + (j.trecho ? marcar(j.trecho) : esc(j.ementa.length > 420 ? j.ementa.slice(0, 420) + '…' : j.ementa)) + '</div>' +
    '<div class="tags">' + (j.tributo ? '<span class="chip nav">' + esc(j.tributo) + '</span>' : '') + (j.resultado ? '<span class="chip ' + resCls(j.resultado) + '">' + esc(JRES[j.resultado]) + '</span>' : '') +
    (j.relator ? '<span class="chip">Rel. ' + esc(j.relator) + '</span>' : '') + (j.tem_inteiro_teor ? '<span class="chip">inteiro teor</span>' : '') + '</div></div>' +
    '<div class="dir">' + (j.data_julgamento ? '<span class="data">' + fdata(j.data_julgamento) + '</span>' : '') + '</div></div>').join('');
  const mais = r.itens.length < r.total ? '<div style="text-align:center;margin:12px 0"><button class="btn sm" id="jmais">Carregar mais</button></div>' : '';
  return '<p class="pp mut" style="margin:4px 2px 8px">' + r.total + ' decisão(ões)' + (S.jb.q ? ' para “' + esc(S.jb.q) + '”' : '') + '</p><div class="card"><div class="lista">' + itens + '</div></div>' + mais;
}
async function buscarJuris(maisPagina) {
  const meu = (S.jbn = (S.jbn || 0) + 1); S.jbusy = true;
  const pagina = maisPagina ? (S.jr ? S.jr.pagina + 1 : 0) : 0;
  try {
    const r = await api('jrf_juris_buscar', { filtros: Object.assign({}, S.jb, { pagina }) });
    if (meu !== S.jbn) return;
    if (maisPagina && S.jr) { r.itens = S.jr.itens.concat(r.itens); }
    S.jr = r;
  } catch (e) { toast(e.message, true); if (!S.jr) S.jr = { itens: [], total: 0, pagina: 0 }; }
  finally { if (meu === S.jbn) S.jbusy = false; }
  const box = $('#jres');
  if (box && location.hash.startsWith('#/junta') && S.jt === 'juris') {
    box.innerHTML = resultadosJuris(); ligarJunta(box);
    const m = $('#jmais'); if (m) m.onclick = () => { m.disabled = true; buscarJuris(true); };
    const t = $('#jbt'); if (t && S.jr.tributos) { /* atualiza lista de tributos conhecidos sem redesenhar a busca */ const atuais = new Set($$('option', t).map((o) => o.value)); S.jr.tributos.forEach((v) => { if (!atuais.has(v)) t.insertAdjacentHTML('beforeend', '<option value="' + esc(v) + '">' + esc(v) + '</option>'); }); }
    const a = $('#jba'); if (a && S.jr.anos) { const atuais = new Set($$('option', a).map((o) => o.value)); S.jr.anos.slice().sort().reverse().forEach((v) => { if (!atuais.has(v)) a.insertAdjacentHTML('beforeend', '<option value="' + esc(v) + '">' + esc(v) + '</option>'); }); }
  }
}
function editarJrf(p) {
  p = Object.assign({ status: 'EM_ANALISE' }, p || {});
  if (p.valor !== null && p.valor !== undefined && p.valor !== '') p.valor = Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const o = (v, sel) => '<option value="' + esc(v[0]) + '"' + (v[0] === (sel || '') ? ' selected' : '') + '>' + esc(v[1]) + '</option>';
  const inp = (n, rot, tipo, cls, extra) => '<label class="' + (cls || '') + '">' + rot + '<input class="inp" name="' + n + '" type="' + (tipo || 'text') + '" value="' + esc(p[n] ?? '') + '"' + (extra || '') + '></label>';
  const sess = jSess().slice().sort((a, b) => b.data.localeCompare(a.data));
  const corpo = '<form class="form" id="fj" autocomplete="off">' +
    inp('numero', 'Processo administrativo nº', 'text', '', ' required') + inp('recorrente', 'Recorrente / contribuinte') +
    '<label>Tributo<input class="inp" name="tributo" list="tribs" value="' + esc(p.tributo || '') + '"><datalist id="tribs">' + TRIBUTOS.map((t) => '<option value="' + esc(t) + '">').join('') + '</datalist></label>' +
    inp('valor', 'Valor em discussão (R$)', 'text', '', ' inputmode="decimal" placeholder="0,00"') +
    inp('materia', 'Matéria / tese', 'text', 'full') +
    inp('distribuido_em', 'Distribuído em', 'date') + inp('prazo_voto', 'Prazo para o voto', 'date') +
    '<label>Situação<select class="sel" name="status">' + Object.entries(JST).map((e) => o(e, p.status)).join('') + '</select></label>' +
    '<label>Sessão de julgamento<select class="sel" name="sessao_id"><option value="">Não pautado</option>' + sess.map((x) => o([x.id, fdata(x.data, true) + (x.hora ? ' ' + x.hora : '') + (x.tipo === 'EXTRAORDINARIA' ? ' (extra)' : '')], p.sessao_id)).join('') + '</select></label>' +
    '<div class="grupo">Julgamento</div>' +
    '<label>Resultado<select class="sel" name="resultado"><option value="">—</option>' + Object.entries(JRES).map((e) => o(e, p.resultado)).join('') + '</select></label>' + inp('acordao', 'Acórdão nº') +
    '<label class="full">Ementa<textarea class="inp" name="ementa" style="min-height:90px">' + esc(p.ementa || '') + '</textarea></label>' +
    '<div class="grupo">Anotações</div>' +
    '<label class="full">Notas do relator<textarea class="inp" name="notas" style="min-height:80px">' + esc(p.notas || '') + '</textarea></label></form>';
  const botoes = [{ txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', ic: 'check', acao: async (v) => {
    const d = Object.fromEntries(new FormData($('#fj', v)).entries()); d.id = p.id || null;
    if (!String(d.numero || '').trim()) { toast('Informe o número do processo.', true); return false; }
    if (d.sessao_id && d.status === 'EM_ANALISE') d.status = 'PAUTADO';
    const r = await api('jrf_processo_salvar', { processo: d }); substituir(S.dados.jrf.processos, r); redesenhar(); toast(p.id ? 'Processo atualizado.' : 'Processo cadastrado.');
    return r;
  } }];
  if (p.id) {
    botoes.unshift({ txt: 'Excluir', ic: 'lixo', cls: 'fant perigo esq', acao: async () => { if (!(await confirmar('Excluir processo', 'Excluir o processo ' + p.numero + ' da sua relatoria?', 'Excluir', true))) return false; await api('jrf_processo_excluir', { id: p.id }); S.dados.jrf.processos = jProc().filter((x) => x.id !== p.id); redesenhar(); toast('Processo excluído.'); } });
    if (p.ementa) botoes.splice(1, 0, { txt: 'Levar à jurisprudência', ic: 'junta', cls: 'fant', valor: 'juris' });
  }
  modal({ titulo: p.id ? 'Processo ' + p.numero : 'Novo processo sob relatoria', corpo, largo: true, botoes }).then((r) => {
    if (r === 'juris') editarJuris({ acordao: p.acordao, processo: p.numero, recorrente: p.recorrente, tributo: p.tributo, resultado: p.resultado, ementa: p.ementa, relator: (S.eu && S.eu.nome) || '', data_julgamento: (sessao(p.sessao_id) || {}).data || '' });
  });
}
function editarSessao(x) {
  x = x || { tipo: 'ORDINARIA' };
  const meus = x.id ? jProc().filter((p) => p.sessao_id === x.id) : [];
  const corpo = '<form class="form" id="fs" autocomplete="off">' +
    '<label>Data<input class="inp" type="date" name="data" value="' + esc(x.data || '') + '" required></label>' +
    '<label>Horário<input class="inp" type="time" name="hora" value="' + esc(x.hora || '') + '"></label>' +
    '<label>Tipo<select class="sel" name="tipo">' + [['ORDINARIA', 'Ordinária'], ['EXTRAORDINARIA', 'Extraordinária']].map((o) => '<option value="' + o[0] + '"' + (x.tipo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
    '<label>Local / link<input class="inp" name="local" value="' + esc(x.local || '') + '"></label>' +
    '<label class="full">Observações / pauta<textarea class="inp" name="observacoes" style="min-height:70px">' + esc(x.observacoes || '') + '</textarea></label></form>' +
    (meus.length ? '<div class="sec-tit" style="margin-top:18px">Seus processos nesta sessão</div><div class="lista borda">' + meus.map(itemJrf).join('') + '</div>' : '');
  const botoes = [{ txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', ic: 'check', acao: async (v) => {
    const d = Object.fromEntries(new FormData($('#fs', v)).entries()); d.id = x.id || null;
    if (!d.data) { toast('Informe a data da sessão.', true); return false; }
    const r = await api('jrf_sessao_salvar', { sessao: d }); substituir(S.dados.jrf.sessoes, r); S.dados.jrf.sessoes.sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || ''))); redesenhar(); toast(x.id ? 'Sessão atualizada.' : 'Sessão cadastrada.');
  } }];
  if (x.id) botoes.unshift({ txt: 'Excluir', ic: 'lixo', cls: 'fant perigo esq', acao: async () => { if (!(await confirmar('Excluir sessão', 'Excluir a sessão de ' + fdata(x.data, true) + '? Os processos pautados nela ficam sem sessão.', 'Excluir', true))) return false; await api('jrf_sessao_excluir', { id: x.id }); S.dados.jrf.sessoes = jSess().filter((s) => s.id !== x.id); jProc().forEach((p) => { if (p.sessao_id === x.id) p.sessao_id = null; }); redesenhar(); toast('Sessão excluída.'); } });
  modal({ titulo: x.id ? 'Sessão de ' + fdata(x.data) : 'Nova sessão de julgamento', corpo, botoes, largo: !!meus.length });
  const v = $$('.veu').pop(); ligarJunta($('.lista', v) || v); $$('[data-s]', v).forEach((e) => { e.onclick = null; });
}
async function verJuris(id) {
  let j; try { j = await api('jrf_juris_ver', { id }); } catch (e) { return toast(e.message, true); }
  if (!j) return toast('Decisão não encontrada.', true);
  const L = (r, v) => v ? '<dt>' + r + '</dt><dd>' + v + '</dd>' : '';
  const link = j.link && /^https?:\/\//i.test(j.link) ? '<a href="' + esc(j.link) + '" target="_blank" rel="noopener" class="lnk">' + esc(j.link) + '</a>' : esc(j.link);
  const corpo = '<div class="tags" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + (j.tributo ? '<span class="chip nav">' + esc(j.tributo) + '</span>' : '') + (j.resultado ? '<span class="chip ' + resCls(j.resultado) + '">' + esc(JRES[j.resultado]) + '</span>' : '') + '</div>' +
    '<div class="ementa-box">' + esc(j.ementa) + '</div>' +
    '<dl class="det" style="margin-top:14px">' + L('Acórdão', esc(j.acordao)) + L('Processo', esc(j.processo)) + L('Julgamento', j.data_julgamento ? fdata(j.data_julgamento, true) : '') + L('Relator', esc(j.relator)) + L('Recorrente', esc(j.recorrente)) + L('Palavras-chave', esc(j.palavras_chave)) + L('Link', link) + '</dl>' +
    (j.inteiro_teor ? '<details class="teor"><summary>Inteiro teor</summary><div>' + esc(j.inteiro_teor) + '</div></details>' : '');
  const r = await modal({ titulo: j.acordao ? 'Acórdão ' + j.acordao : 'Decisão da Junta', corpo, largo: true, botoes: [
    { txt: 'Copiar ementa', ic: 'doc', cls: 'fant esq', acao: async () => { try { await navigator.clipboard.writeText(j.ementa); toast('Ementa copiada.'); } catch (e) { toast('Não foi possível copiar.', true); } return false; } },
    { txt: 'Fechar', valor: null }, { txt: 'Editar', ic: 'editar', cls: 'pri', valor: 'editar' }] });
  if (r === 'editar') editarJuris(j);
}
function editarJuris(j) {
  j = j || {};
  const inp = (n, rot, tipo, cls) => '<label class="' + (cls || '') + '">' + rot + '<input class="inp" name="' + n + '" type="' + (tipo || 'text') + '" value="' + esc(j[n] || '') + '"></label>';
  const corpo = '<form class="form" id="fjj" autocomplete="off">' +
    inp('acordao', 'Acórdão nº') + inp('processo', 'Processo administrativo') +
    inp('data_julgamento', 'Data do julgamento', 'date') + inp('relator', 'Relator(a)') +
    inp('recorrente', 'Recorrente') +
    '<label>Tributo<input class="inp" name="tributo" list="tribs2" value="' + esc(j.tributo || '') + '"><datalist id="tribs2">' + TRIBUTOS.map((t) => '<option value="' + esc(t) + '">').join('') + '</datalist></label>' +
    '<label>Resultado<select class="sel" name="resultado"><option value="">—</option>' + Object.entries(JRES).map((e) => '<option value="' + e[0] + '"' + (e[0] === j.resultado ? ' selected' : '') + '>' + e[1] + '</option>').join('') + '</select></label>' +
    inp('palavras_chave', 'Palavras-chave (separe por ;)') +
    '<label class="full">Ementa<textarea class="inp" name="ementa" style="min-height:120px" required>' + esc(j.ementa || '') + '</textarea></label>' +
    '<label class="full">Inteiro teor (opcional – também entra na busca)<textarea class="inp" name="inteiro_teor" style="min-height:90px">' + esc(j.inteiro_teor || '') + '</textarea></label>' +
    inp('link', 'Link para o documento', 'url', 'full') + '</form>';
  const botoes = [{ txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', ic: 'check', acao: async (v) => {
    const d = Object.fromEntries(new FormData($('#fjj', v)).entries()); d.id = j.id || null;
    if (!String(d.ementa || '').trim()) { toast('Informe a ementa.', true); return false; }
    await api('jrf_juris_salvar', { juris: d });
    if (!j.id && S.dados && S.dados.jrf) S.dados.jrf.juris_total = (S.dados.jrf.juris_total || 0) + 1;
    toast(j.id ? 'Decisão atualizada.' : 'Decisão incluída na jurisprudência.'); S.jr = null; if (location.hash.startsWith('#/junta')) { S.jt = 'juris'; VIEWS.junta(); }
  } }];
  if (j.id) botoes.unshift({ txt: 'Excluir', ic: 'lixo', cls: 'fant perigo esq', acao: async () => { if (!(await confirmar('Excluir decisão', 'Excluir esta decisão da base de jurisprudência?', 'Excluir', true))) return false; await api('jrf_juris_excluir', { id: j.id }); if (S.dados && S.dados.jrf) S.dados.jrf.juris_total = Math.max(0, (S.dados.jrf.juris_total || 1) - 1); S.jr = null; toast('Decisão excluída.'); if (location.hash.startsWith('#/junta')) VIEWS.junta(); } });
  modal({ titulo: j.id ? 'Editar decisão' : 'Nova decisão na jurisprudência', corpo, largo: true, botoes });
}

// ---------- Assistente de voz e fila de ordens ----------
const API_AG = 'https://emerim.app.n8n.cloud/webhook/pgm-agente';
const OTIPO = { MEMORANDO: 'Memorando', MINUTAIA: 'MinutaIA', EPROC_DOCUMENTO: 'eproc', OUTRO: 'Outra' };
const OST = { NOVA: 'Na fila', EM_EXECUCAO: 'Em execução', AGUARDANDO_CONFIRMACAO: 'Aguardando sua confirmação', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada', ERRO: 'Com erro' };
const ordensLista = () => (S.dados && S.dados.ordens) || [];
const ordemAberta = (o) => ['NOVA', 'EM_EXECUCAO', 'AGUARDANDO_CONFIRMACAO', 'ERRO'].includes(o.status);
async function apiAg(acao, dados) {
  const r = await fetch(API_AG, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-pgm-token': S.token || '' }, body: JSON.stringify(Object.assign({ acao, token: S.token }, dados || {})) });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (r.status === 401 || (j && j.erro === 'sessao')) { sair(true); throw new Error('Sua sessão expirou. Entre de novo.'); }
  if (!r.ok || !j || j.ok === false) throw new Error((j && j.erro) || 'Não foi possível falar com o assistente.');
  return j.dados;
}
S.chat = [];
S.falar = LS.get('falar', true);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let reco = null, ouvindo = false;
let audioVoz = null, audioUrl = null, falaSeq = 0;
function calar() {
  falaSeq++;
  try { speechSynthesis.cancel(); } catch (e) {}
  if (audioVoz) { try { audioVoz.pause(); } catch (e) {} audioVoz = null; }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
}
async function falar(txt) {
  if (!S.falar || !txt) return;
  calar(); const seq = falaSeq;
  try {
    const r = await fetch(API_AG, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-pgm-token': S.token || '' }, body: JSON.stringify({ acao: 'falar', token: S.token, texto: txt }) });
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || !/audio/.test(tipo)) throw new Error('sem audio');
    const blob = await r.blob();
    if (seq !== falaSeq || !$('#assist')) return;
    audioUrl = URL.createObjectURL(blob); audioVoz = new Audio(audioUrl);
    await audioVoz.play();
  } catch (e) { if (seq === falaSeq && $('#assist')) falarNavegador(txt); }
}
function falarNavegador(txt) {
  if (!window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'pt-BR'; const v = speechSynthesis.getVoices().find((x) => /pt[-_]BR/i.test(x.lang)); if (v) u.voice = v; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) {}
}
function abrirAssistente(iniciarOuvindo) {
  if ($('#assist')) { if (iniciarOuvindo) ouvir(); return; }
  const p = document.createElement('div'); p.id = 'assist'; p.className = 'veu';
  p.innerHTML = '<div class="modal assist"><div class="mh"><h3>Assistente</h3><label class="som" title="Responder em áudio quando o comando for falado"><input type="checkbox" id="afalar"' + (S.falar ? ' checked' : '') + '>' + ic('som', 's') + '</label><button class="btn fant ico sm x" data-f>' + ic('x') + '</button></div>' +
    '<div class="mb"><div class="chat" id="achat"></div></div>' +
    '<div class="mf acomp"><button class="mic" id="amic" title="Falar">' + ic('mic') + '</button><textarea class="inp" id="atxt" rows="1" placeholder="' + (SR ? 'Toque no microfone e fale, ou digite aqui…' : 'Digite o comando (ou use o ditado do teclado)…') + '"></textarea><button class="btn pri ico" id="aenv" title="Enviar">' + ic('enviar', 's') + '</button></div></div>';
  document.body.appendChild(p);
  const fechar = () => { pararOuvir(); calar(); p.remove(); };
  p.addEventListener('click', (e) => { if (e.target === p || e.target.closest('[data-f]')) fechar(); });
  $('#afalar').onchange = (e) => { S.falar = e.target.checked; LS.set('falar', S.falar); if (!S.falar) calar(); };
  $('#amic').onclick = () => (ouvindo ? pararOuvir() : ouvir());
  const t = $('#atxt');
  t.oninput = () => { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; };
  t.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComando(); } };
  $('#aenv').onclick = () => enviarComando();
  desenharChat();
  if (iniciarOuvindo && SR) ouvir(); else if (window.innerWidth > 760) t.focus();
}
function desenharChat() {
  const c = $('#achat'); if (!c) return;
  if (!S.chat.length) {
    c.innerHTML = '<div class="dicas"><p class="mut pq">Exemplos do que você pode pedir:</p>' + ['O que vence esta semana?', 'No processo 5002388, manda memorando para a Fazenda com cópia da decisão e um resumo do processo.', 'No processo do Brocker, faz no MinutaIA uma impugnação com o prompt: …', 'Cria uma tarefa para revisar as contrarrazões na sexta.', 'Quando é a próxima sessão da Junta e quais processos meus estão pautados?']
      .map((x) => '<button class="chip-dica">' + esc(x) + '</button>').join('') + '<p class="pp mut" style="margin-top:12px">Memorandos, minutas e documentos do eproc entram na fila de ordens e só são enviados depois da sua confirmação.</p></div>';
    $$('.chip-dica', c).forEach((b) => { b.onclick = () => { const t = $('#atxt'); t.value = b.textContent.replace('…', ''); t.focus(); t.oninput(); }; });
    return;
  }
  c.innerHTML = S.chat.map((m) => '<div class="bal ' + (m.role === 'user' ? 'eu' : 'ia') + (m.erro ? ' erro' : '') + '">' + esc(m.content) +
    (m.extras ? '<div class="ext">' + m.extras + '</div>' : '') + '</div>').join('') + (S.pensando ? '<div class="bal ia pens"><span></span><span></span><span></span></div>' : '');
  c.scrollTop = c.scrollHeight; const mb = c.parentElement; mb.scrollTop = mb.scrollHeight;
}
function ouvir() {
  if (!SR) { toast('Este navegador não reconhece voz. Use o microfone do teclado para ditar.', true); $('#atxt') && $('#atxt').focus(); return; }
  calar();
  reco = new SR(); reco.lang = 'pt-BR'; reco.interimResults = true; reco.continuous = false; reco.maxAlternatives = 1;
  const t = $('#atxt'), base = t.value ? t.value.trim() + ' ' : '';
  let final = '';
  reco.onresult = (e) => { let parcial = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) final += r[0].transcript; else parcial += r[0].transcript; } t.value = base + final + parcial; t.oninput(); };
  reco.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Permita o uso do microfone para este site.', true); else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Não consegui ouvir (' + e.error + ').', true); };
  reco.onend = () => { const enviar = ouvindo && !!final.trim(); ouvindo = false; $('#amic') && $('#amic').classList.remove('on'); if (enviar) enviarComando(true); };
  ouvindo = true; $('#amic').classList.add('on');
  try { reco.start(); } catch (e) { ouvindo = false; $('#amic').classList.remove('on'); }
}
function pararOuvir() { if (reco && ouvindo) { ouvindo = false; try { reco.stop(); } catch (e) {} } $('#amic') && $('#amic').classList.remove('on'); }
async function enviarComando(porVoz) {
  const t = $('#atxt'); const texto = (t.value || '').trim(); if (!texto || S.pensando) return;
  t.value = ''; t.oninput();
  const historico = S.chat.filter((m) => !m.erro).slice(-6).map((m) => ({ role: m.role, content: m.content }));
  S.chat.push({ role: 'user', content: texto }); S.pensando = true; desenharChat();
  try {
    const d = await apiAg('comando', { texto, historico });
    const ex = [];
    if (d.tarefas && d.tarefas.length) ex.push('<span class="chip ok">' + d.tarefas.length + ' tarefa(s) criada(s)</span>');
    if (d.ordens && d.ordens.length) ex.push('<a class="chip info" href="#/ordens">' + d.ordens.length + ' ordem(ns) na fila</a>');
    if (d.prazos) ex.push('<span class="chip">' + d.prazos + ' prazo(s) atualizado(s)</span>');
    if (d.junta) ex.push('<span class="chip">' + d.junta + ' processo(s) da Junta atualizado(s)</span>');
    if (d.ignoradas && d.ignoradas.length) ex.push('<span class="chip warn">não feito: ' + esc(d.ignoradas.join(', ')) + '</span>');
    S.chat.push({ role: 'assistant', content: d.resposta, extras: ex.join('') });
    if (porVoz === true) falar(d.fala || d.resposta);
    if (ex.length) { S.carregadoEm = 0; carregar(true).then(() => { rotaSemCarregar(); badges(); }).catch(() => {}); }
  } catch (e) { S.chat.push({ role: 'assistant', content: e.message, erro: true }); }
  S.pensando = false; desenharChat();
  $$('#achat a[href="#/ordens"]').forEach((a) => { a.onclick = () => { const v = $('#assist'); if (v) v.remove(); }; });
}
function itemOrdem(o) {
  const cls = o.status === 'AGUARDANDO_CONFIRMACAO' ? 'warn' : o.status === 'ERRO' ? 'bad' : o.status === 'CONCLUIDA' ? 'ok' : o.status === 'EM_EXECUCAO' ? 'info' : '';
  return '<div class="item clic" data-o="' + esc(o.id) + '"><span class="dot ' + cls + '"></span><div class="mid"><div class="t">' + esc(o.titulo) + '</div>' +
    '<div class="d">' + esc(o.instrucoes || (o.dados && o.dados.prompt_minutaia) || o.comando || '') .slice(0, 400) + '</div>' +
    '<div class="tags"><span class="chip nav">' + esc(OTIPO[o.tipo] || o.tipo) + '</span>' + (o.processo ? '<span class="chip">' + esc(o.processo) + '</span>' : '') + '<span class="chip ' + cls + '">' + esc(OST[o.status] || o.status) + '</span></div></div>' +
    '<div class="dir"><span class="pp mut">' + esc(new Date(o.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</span></div></div>';
}
VIEWS.ordens = function () {
  titulo('Fila do agente');
  const l = ordensLista();
  const bloco = (tit, fn, vaz) => { const x = l.filter(fn); return x.length || vaz ? '<div class="sec-tit">' + tit + ' <span class="bdg">' + x.length + '</span></div><div class="card"><div class="lista">' + (x.map(itemOrdem).join('') || vazio(vaz || '', 'fila')) + '</div></div>' : ''; };
  $('#conteudo').innerHTML = '<div class="card aviso" style="margin-top:14px"><div class="ico">' + ic('fila', 's') + '</div><div><b>Como a fila funciona</b><p>Memorandos, minutas do MinutaIA e documentos do eproc são executados pelo Claude no seu computador, com você presente para os logins. Para executar, abra o Claude no projeto "Procurador PGM" e diga <i>“executar a fila da PGM”</i>. Nada é enviado, peticionado ou protocolado sem a sua confirmação.</p></div></div>' +
    bloco('Aguardando sua confirmação', (o) => o.status === 'AGUARDANDO_CONFIRMACAO') + bloco('Com erro', (o) => o.status === 'ERRO') + bloco('Em execução', (o) => o.status === 'EM_EXECUCAO') +
    bloco('Na fila', (o) => o.status === 'NOVA', 'Nenhuma ordem na fila. Use o microfone para pedir.') + bloco('Concluídas e canceladas (30 dias)', (o) => ['CONCLUIDA', 'CANCELADA'].includes(o.status));
  $$('[data-o]').forEach((e) => { e.onclick = () => verOrdem(ordensLista().find((o) => o.id === e.dataset.o)); });
};
function verOrdem(o) {
  if (!o) return;
  const L = (r, v) => v ? '<dt>' + r + '</dt><dd>' + v + '</dd>' : '';
  const dd = o.dados || {};
  const corpo = '<div class="tags" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><span class="chip nav">' + esc(OTIPO[o.tipo]) + '</span><span class="chip">' + esc(OST[o.status]) + '</span></div>' +
    '<dl class="det">' + L('Processo', esc(o.processo)) + L('Secretaria', esc(dd.secretaria)) + L('Anexar decisão', o.tipo === 'MEMORANDO' ? (dd.anexar_decisao ? 'Sim' : 'Não') : '') +
    L('Instruções', esc(o.instrucoes)) + L('Prompt do MinutaIA', esc(dd.prompt_minutaia)) + L('Comando original', o.comando ? '<i>“' + esc(o.comando) + '”</i>' : '') + L('Resultado', esc(o.resultado)) +
    L('Criada em', esc(new Date(o.criado_em).toLocaleString('pt-BR'))) + '</dl>' +
    (o.rascunho ? '<div class="sec-tit" style="margin-top:16px">Rascunho</div><div class="ementa-box">' + esc(o.rascunho) + '</div>' : '');
  const botoes = [{ txt: 'Fechar', valor: null }];
  if (o.rascunho) botoes.unshift({ txt: 'Copiar rascunho', ic: 'doc', cls: 'fant', acao: async () => { try { await navigator.clipboard.writeText(o.rascunho); toast('Rascunho copiado.'); } catch (e) { toast('Não foi possível copiar.', true); } return false; } });
  if (['NOVA', 'AGUARDANDO_CONFIRMACAO', 'ERRO'].includes(o.status)) botoes.unshift({ txt: 'Cancelar ordem', ic: 'x', cls: 'fant perigo esq', acao: async () => { if (!(await confirmar('Cancelar ordem', 'Cancelar "' + o.titulo + '"?', 'Cancelar ordem', true))) return false; const r = await apiAg('ordem_cancelar', { id: o.id }); if (r) substituir(S.dados.ordens, r); redesenhar(); toast('Ordem cancelada.'); } });
  modal({ titulo: 'Ordem', corpo, largo: true, botoes });
}
function editarOrdem(pre) {
  pre = pre || {}; const dd = pre.dados || {};
  const memo = pre.tipo === 'MEMORANDO', minuta = pre.tipo === 'MINUTAIA';
  const corpo = '<form class="form" id="fo" autocomplete="off">' +
    '<label>Processo<input class="inp" name="processo" value="' + esc(pre.processo || '') + '"></label>' +
    (memo ? '<label>Secretaria<input class="inp" name="secretaria" list="secs2" value="' + esc(dd.secretaria || 'Fazenda') + '"><datalist id="secs2">' + SECRETARIAS.map((s) => '<option value="' + esc(s) + '">').join('') + '</datalist></label>' +
      '<label class="linha full"><input type="checkbox" name="anexar_decisao"' + (dd.anexar_decisao !== false ? ' checked' : '') + '> Anexar cópia da decisão (PDF do eproc)</label>' : '<span></span>') +
    (minuta ? '<label class="full">Prompt para o MinutaIA<textarea class="inp" name="prompt_minutaia" style="min-height:140px" placeholder="Ex.: elabore impugnação à exceção de pré-executividade sustentando…">' + esc(dd.prompt_minutaia || '') + '</textarea></label>' : '') +
    '<label class="full">' + (memo ? 'O que o memorando deve pedir (além do padrão)' : 'Instruções adicionais') + '<textarea class="inp" name="instrucoes" style="min-height:90px">' + esc(pre.instrucoes || '') + '</textarea></label></form>' +
    '<p class="pp mut">A ordem vai para a fila e é executada pelo Claude no seu computador; nada é enviado sem a sua confirmação.</p>';
  modal({ titulo: memo ? 'Pedir memorando' : minuta ? 'Pedir minuta no MinutaIA' : 'Nova ordem', corpo, largo: true, botoes: [{ txt: 'Cancelar', valor: null }, { txt: 'Colocar na fila', cls: 'pri', ic: 'check', acao: async (v) => {
    const f = $('#fo', v), d = Object.fromEntries(new FormData(f).entries());
    if (minuta && !String(d.prompt_minutaia || '').trim()) { toast('Escreva o prompt para o MinutaIA.', true); return false; }
    const ordem = { tipo: pre.tipo || 'OUTRO', processo: d.processo, prazo_id: pre.prazo_id || null, instrucoes: d.instrucoes,
      titulo: (memo ? 'Memorando à ' + (d.secretaria || 'Fazenda') : minuta ? 'Minuta no MinutaIA' : 'Ordem') + (d.processo ? ' – ' + d.processo : ''),
      dados: { secretaria: memo ? d.secretaria : null, anexar_decisao: memo ? !!(f.anexar_decisao && f.anexar_decisao.checked) : false, prompt_minutaia: minuta ? d.prompt_minutaia : null } };
    const r = await apiAg('ordem_criar', { ordem });
    S.dados.ordens = [r].concat(ordensLista());
    if (memo && pre.prazo_id) { const p = prazos().find((x) => x.id === pre.prazo_id); if (p && p.memo_status === 'NAO') { try { const u = await api('prazo_salvar', { prazo: Object.assign({}, p, { memo_status: 'A_ENVIAR', memo_secretaria: d.secretaria || 'Fazenda', memo_retorno: p.memo_retorno || (p.fim ? addDias(p.fim, -7) : null) }) }); substituir(S.dados.prazos, u); } catch (e) {} } }
    redesenhar(); toast('Ordem colocada na fila.');
  } }] });
}

// ---------- ações ----------
function redesenhar() { ordenar(); rotaSemCarregar(); badges(); }
function rotaSemCarregar() { const [k, arg] = (location.hash.replace(/^#\//, '') || 'inicio').split('/'); (VIEWS[k] || VIEWS.inicio)(arg); }
function verPrazo(id) {
  const p = prazos().find((x) => x.id === id); if (!p) return;
  const n = dias(p.fim);
  const L = (r, v) => v ? '<dt>' + r + '</dt><dd>' + v + '</dd>' : '';
  const corpo = '<div class="tags" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><span class="chip nav">' + logoT(p.tribunal) + esc(TRIB[p.tribunal]) + '</span><span class="chip ' + (aberto(p) ? urg(n) : 'ok') + '">' + esc(STATUS[p.status]) + (p.fim && aberto(p) ? ' · ' + rel(n) : '') + '</span>' + (p.origem === 'TRIAGEM' ? '<span class="chip">da triagem</span>' : '') + '</div>' +
    '<dl class="det">' + L('Processo', esc(p.processo)) + L('Classe', esc(p.classe)) + L('Parte contrária', esc(p.parte)) + L('Órgão julgador', esc(p.orgao)) + L('Intimação', esc(p.intimacao)) +
    L('Prazo', (p.inicio ? fdata(p.inicio) + ' a ' : 'até ') + '<b>' + fdata(p.fim, true) + '</b>') + L('Providência / peça', '<b>' + esc(p.providencia) + '</b>') +
    L('Embargos de declaração', p.ed_cabivel ? 'Cabíveis' + (p.ed_prazo ? ' – prazo até <b>' + fdata(p.ed_prazo, true) + '</b>' : '') + (p.ed_obs ? '<br><span class="mut">' + esc(p.ed_obs) + '</span>' : '') : 'Não cabíveis') +
    L('Memorando', p.memo_status && p.memo_status !== 'NAO' ? esc(p.memo_secretaria || 'Secretaria não informada') + ' – ' + esc(MEMO[p.memo_status]) + (p.memo_retorno ? '<br><span class="mut">retorno até ' + fdata(p.memo_retorno, true) + '</span>' : '') : 'Não é necessário') +
    L('Teor', esc(p.teor)) + L('Observações', esc(p.observacoes)) + '</dl>' +
    '<div class="acoesrap">' + (aberto(p)
      ? (p.status === 'PENDENTE' ? '<button class="btn sm" data-st="EM_ELABORACAO">Em elaboração</button>' : '<button class="btn sm" data-st="PENDENTE">Voltar para "a fazer"</button>') + '<button class="btn sm" data-st="PROTOCOLADO">' + ic('check', 's') + 'Protocolado</button><button class="btn sm" data-st="CIENCIA">Ciência dada</button><button class="btn sm fant" data-st="ARQUIVADO">Arquivar</button>'
      : '<button class="btn sm" data-st="PENDENTE">Reabrir prazo</button>') +
    '<button class="btn sm fant" data-nt>' + ic('tarefa', 's') + 'Criar tarefa</button><button class="btn sm fant" data-om>' + ic('memo', 's') + 'Pedir memorando</button><button class="btn sm fant" data-omi>' + ic('ed', 's') + 'Pedir minuta (MinutaIA)</button></div>' +
    '<p class="pp mut" style="margin:10px 0 0">Atualizado em ' + esc(new Date(p.atualizado_em).toLocaleString('pt-BR')) + (p.atualizado_por ? ' por ' + esc(p.atualizado_por) : '') + '</p>';
  const pr = modal({ titulo: p.processo, corpo, largo: true, botoes: [
    { txt: 'Excluir', ic: 'lixo', cls: 'fant perigo esq', acao: async () => { if (!(await confirmar('Excluir prazo', 'Excluir definitivamente o prazo do processo ' + p.processo + '? Para apenas tirar da lista, use Arquivar.', 'Excluir', true))) return false; await api('prazo_excluir', { id: p.id }); S.dados.prazos = S.dados.prazos.filter((x) => x.id !== p.id); redesenhar(); toast('Prazo excluído.'); } },
    { txt: 'Fechar', valor: null },
    { txt: 'Editar', ic: 'editar', cls: 'pri', valor: 'editar' }
  ] });
  const v = $$('.veu').pop();
  $$('[data-st]', v).forEach((b) => { b.onclick = async () => { b.disabled = true; try { const r = await api('prazo_status', { id: p.id, status: b.dataset.st }); substituir(S.dados.prazos, r); redesenhar(); v.remove(); toast('Situação: ' + STATUS[r.status] + '.'); } catch (e) { b.disabled = false; toast(e.message, true); } }; });
  $('[data-nt]', v).onclick = () => { v.remove(); editarTarefa({ processo: p.processo, prazo_id: p.id, vencimento: p.fim ? addDias(p.fim, -2) : '' }); };
  $('[data-om]', v).onclick = () => { v.remove(); editarOrdem({ tipo: 'MEMORANDO', processo: p.processo, prazo_id: p.id, dados: { secretaria: p.memo_secretaria || 'Fazenda', anexar_decisao: true } }); };
  $('[data-omi]', v).onclick = () => { v.remove(); editarOrdem({ tipo: 'MINUTAIA', processo: p.processo, prazo_id: p.id, instrucoes: p.providencia ? 'Peça: ' + p.providencia : '' }); };
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
