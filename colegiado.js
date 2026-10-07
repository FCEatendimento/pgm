/* Junta de Recursos Fiscais – ambiente virtual de julgamento (colegiado de 6 conselheiros e a Secretária).
   Usa as funções gerais do app.js (api, modal, toast, esc, ic, fdata, S, LS…), carregadas na mesma página. */
const API_ARQ = 'https://emerim.app.n8n.cloud/webhook/pgm-junta-arq';
const MEMBRO = () => !!(S.eu && S.eu.dono === false);
const JCST = { ELABORACAO: ['Em elaboração', ''], PRONTO: ['Liberado para votação', 'info'], VISTA: ['Pedido de vista', 'warn'], JULGADO: ['Julgado', 'ok'], RETIRADO: ['Retirado', ''] };
const VOTO = { CONCORDO: ['Acompanha o relator', 'ok'], DIVERGE: ['Diverge', 'bad'], VISTA: ['Pediu vista', 'warn'], IMPEDIDO: ['Impedido(a)', ''] };
const PAPEL = { PRESIDENTE: 'Presidente', CONSELHEIRO: 'Conselheiro(a)', SECRETARIA: 'Secretária' };
const QF = [['recorrente', 'Recorrente'], ['cpf_cnpj', 'CPF/CNPJ'], ['endereco', 'Endereço', 'full'], ['representante_legal', 'Representante legal'], ['procurador', 'Procurador(a)'], ['oab_procurador', 'OAB do procurador'],
  ['recorrido', 'Recorrido'], ['inscricao_municipal', 'Inscrição municipal'], ['imovel_ou_cadastro', 'Imóvel / cadastro'], ['tributo', 'Tributo'], ['exercicios', 'Exercícios'], ['lancamento_ou_auto', 'Lançamento / auto de infração'],
  ['valor_em_discussao', 'Valor em discussão', 'full'], ['decisao_recorrida', 'Decisão recorrida', 'full'], ['data_ciencia', 'Ciência da decisão'], ['data_recurso', 'Protocolo do recurso'], ['tempestividade', 'Tempestividade', 'full']];
const ALISTAS = [['fatos', 'Fatos'], ['preliminares', 'Preliminares'], ['argumentos_recorrente', 'Argumentos do recorrente'], ['fundamentos_fisco', 'Fundamentos do Fisco / da decisão recorrida'], ['questoes', 'Questões a decidir'], ['pedidos', 'Pedidos'], ['pontos_atencao', 'Pontos de atenção']];
const CONF = { ALTA: ['Confiança alta', 'ok'], MEDIA: ['Confiança média', 'ouro'], BAIXA: ['Confiança baixa', 'warn'] };

async function apiArq(acao, dados) {
  const r = await fetch(API_ARQ, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-pgm-token': S.token || '' }, body: JSON.stringify(Object.assign({ acao }, dados || {})) });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (r.status === 401 || (j && j.erro === 'sessao')) { sair(true); throw new Error('Sua sessão expirou. Entre de novo.'); }
  if (!r.ok || !j || j.ok === false) throw new Error((j && j.erro) || 'Não foi possível falar com o servidor.');
  return j.dados;
}

// ---------- dados ----------
async function jcCarregar(forcar) {
  if (!forcar && S.jc && Date.now() - (S.jcEm || 0) < 30000) return S.jc;
  S.jc = await api('jc_listar'); S.jcEm = Date.now();
  return S.jc;
}
const jcEu = () => (S.jc && S.jc.eu) || null;
const jcMembros = () => (S.jc && S.jc.membros) || [];
const jcMembro = (id) => jcMembros().find((m) => m.id === id);
const jcConselheiros = () => jcMembros().filter((m) => m.papel !== 'SECRETARIA');
const jcSess = () => (S.jc && S.jc.sessoes) || [];
const jcSessao = (id) => jcSess().find((x) => x.id === id);
const jcProcs = () => (S.jc && S.jc.processos) || [];
const PART = ['de', 'da', 'do', 'das', 'dos', 'e'];
const nomeBonito = (n) => String(n || '').toLowerCase().split(/\s+/).map((w, i) => (i && PART.includes(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const nomeCurto = (n) => { const p = nomeBonito(n).split(' ').filter((w) => !PART.includes(w)); return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0] || ''; };
const relatorNome = (p) => { const m = jcMembro(p.relator_id); return m ? nomeCurto(m.nome) : '—'; };
const souRelator = (p) => !!(jcEu() && p.relator_id === jcEu().id);
const jcGestor = () => !!(S.jc && S.jc.gestor);
const jcJulgador = () => !!(S.jc && S.jc.julgador);
function contarVotos(p) {
  const vs = p.votos || [];
  const validos = 1 + vs.filter((v) => v.tipo === 'CONCORDO' || v.tipo === 'DIVERGE').length;
  const faltam = jcConselheiros().filter((m) => m.id !== p.relator_id && !vs.some((v) => v.membro_id === m.id));
  return { validos, quorum: (S.jc && S.jc.config && S.jc.config.quorum) || 4, faltam, vista: vs.some((v) => v.tipo === 'VISTA'), diverg: vs.filter((v) => v.tipo === 'DIVERGE').length };
}
const meuVoto = (p) => jcEu() ? (p.votos || []).find((v) => v.membro_id === jcEu().id) : null;
const aguardaMeuVoto = (p) => jcJulgador() && ['PRONTO', 'VISTA'].includes(p.status) && !souRelator(p) && !meuVoto(p);

// ---------- lista ----------
function bolinhas(p) {
  return '<span class="vts" title="Votos">' + jcConselheiros().map((m) => {
    if (m.id === p.relator_id) return '<i class="r" title="' + esc(nomeBonito(m.nome)) + ' (relator)"></i>';
    const v = (p.votos || []).find((x) => x.membro_id === m.id);
    return '<i class="' + (v ? v.tipo.toLowerCase() : '') + '" title="' + esc(nomeBonito(m.nome)) + ': ' + esc(v ? VOTO[v.tipo][0] : 'não votou') + '"></i>';
  }).join('') + '</span>';
}
function itemJc(p) {
  const st = JCST[p.status] || [p.status, ''], x = jcSessao(p.sessao_id), mv = meuVoto(p);
  const tags = [];
  if (p.tributo) tags.push('<span class="chip nav">' + esc(p.tributo) + '</span>');
  tags.push('<span class="chip ' + st[1] + '">' + esc(st[0]) + '</span>');
  tags.push('<span class="chip">Relator: ' + esc(relatorNome(p)) + (souRelator(p) ? ' (você)' : '') + '</span>');
  if (x) tags.push('<span class="chip">Sessão ' + fdata(x.data) + '</span>');
  if (p.resultado) tags.push('<span class="chip ' + resCls(p.resultado) + '">' + esc(JRES[p.resultado] || p.resultado) + '</span>');
  if (aguardaMeuVoto(p)) tags.push('<span class="chip bad">Aguarda seu voto</span>');
  else if (mv) tags.push('<span class="chip ' + VOTO[mv.tipo][1] + '">Seu voto: ' + esc(VOTO[mv.tipo][0].toLowerCase()) + '</span>');
  return '<div class="item clic" data-jc="' + esc(p.id) + '"><span class="dot ' + (aguardaMeuVoto(p) ? 'bad' : p.status === 'JULGADO' ? 'ok' : '') + '"></span><div class="mid"><div class="t"><span class="num">' + esc(p.numero) + '</span>' +
    (p.recorrente ? '<span class="par"><span class="sep-p"> · </span>' + esc(p.recorrente) + '</span>' : '') + '</div><div class="d">' + esc(p.materia || 'Matéria ainda não informada') + '</div><div class="tags">' + tags.join('') + '</div></div>' +
    '<div class="dir">' + (p.status === 'ELABORACAO' ? '<span class="pp mut">' + (p.tem_pdf ? 'PDF anexado' : 'sem PDF') + '</span>' : bolinhas(p)) + (p.valor ? '<span class="pp mut">' + moeda(p.valor) + '</span>' : '') + '</div></div>';
}
function htmlColegiado() {
  if (!S.jc) return '<div class="carregando"><div class="spin"></div></div>';
  const eu = jcEu(), ps = jcProcs(), aba = S.jca || 'votar';
  const votar = ps.filter(aguardaMeuVoto), meus = ps.filter((p) => souRelator(p) && p.status !== 'JULGADO');
  const pauta = ps.filter((p) => ['PRONTO', 'VISTA'].includes(p.status)), julg = ps.filter((p) => p.status === 'JULGADO');
  const elab = ps.filter((p) => p.status === 'ELABORACAO');
  const fut = jcSess().filter((x) => x.data >= hoje());
  const abas = [['votar', 'Para votar', votar.length], ['meus', 'Minha relatoria', meus.length], ['pauta', 'Em pauta', pauta.length], ['elab', 'Em elaboração', elab.length], ['julgados', 'Julgados', julg.length], ['sessoes', 'Sessões e atas', fut.length]];
  if (S.jc.dono || (eu && eu.papel === 'PRESIDENTE')) abas.push(['admin', 'Membros e quórum']);
  const prox = fut[0];
  const quem = eu ? nomeBonito(eu.nome) + ' · ' + (PAPEL[eu.papel] || eu.papel) : 'Administrador';
  let h = '<div class="card jrf-prox"><div class="ico">' + ic('junta', 's') + '</div><div style="min-width:0"><div class="rot">Julgamento virtual · ' + esc(quem) + '</div>' +
    '<div class="t">' + (prox ? 'Próxima sessão: ' + textoSessao(prox) : 'Nenhuma sessão futura cadastrada') + '</div>' +
    '<div class="d">Quórum mínimo: ' + ((S.jc.config && S.jc.config.quorum) || 4) + ' votos (o relator conta). ' + (votar.length ? votar.length + ' processo(s) aguardando o seu voto.' : 'Nenhum voto seu pendente.') + '</div></div>' +
    (prox ? '<span class="chip ' + (urg(dias(prox.data)) || 'nav') + '">' + rel(dias(prox.data)) + '</span>' : '') + '</div>';
  h += '<div class="filtros">' + abas.map((a) => '<button data-jca="' + a[0] + '" class="' + (aba === a[0] ? 'on' : '') + '">' + a[1] + (a[2] !== undefined ? '<span class="n">' + a[2] + '</span>' : '') + '</button>').join('') + '</div>';
  const lista = (arr, txt) => '<div class="card"><div class="lista">' + (arr.map(itemJc).join('') || vazio(txt, 'junta')) + '</div></div>';
  if (aba === 'votar') h += lista(votar, 'Nenhum processo aguardando o seu voto.');
  else if (aba === 'meus') h += lista(meus, 'Nenhum processo sob sua relatoria. Use "Novo processo" para cadastrar.');
  else if (aba === 'pauta') h += lista(pauta, 'Nenhum processo liberado para votação.');
  else if (aba === 'elab') h += '<p class="pp mut dica">Processos que os relatores ainda estão preparando. A minuta só aparece para os demais quando o relator libera para votação.</p>' + lista(elab, 'Nenhum processo em elaboração.');
  else if (aba === 'julgados') h += lista(julg.sort((a, b) => String(b.julgado_em || '').localeCompare(String(a.julgado_em || ''))), 'Nenhum processo julgado ainda.');
  else if (aba === 'sessoes') h += htmlSessoesJc();
  else if (aba === 'admin') h += htmlAdminJc();
  return h;
}
function ligarColegiado(raiz) {
  $$('[data-jca]', raiz).forEach((e) => { e.onclick = () => { S.jca = e.dataset.jca; LS.set('jca', S.jca); VIEWS.junta(); }; });
  $$('[data-jc]', raiz).forEach((e) => { e.onclick = () => verJc(e.dataset.jc); });
  $$('[data-jcs]', raiz).forEach((e) => { e.onclick = () => verSessaoJc(e.dataset.jcs); });
  $$('[data-jcns]', raiz).forEach((e) => { e.onclick = () => editarSessaoJc(); });
  ligarAdminJc(raiz);
}
function jcNovo() { if (S.jca === 'sessoes' && jcGestor()) editarSessaoJc(); else editarJc(); }

// ---------- processo ----------
async function verJc(id) {
  const v = document.createElement('div'); v.className = 'veu';
  v.innerHTML = '<div class="modal jcm"><div class="mh"><h3 id="jct">Processo</h3><button class="btn fant ico sm x" data-f>' + ic('x') + '</button></div><div class="mb" id="jcp"><div class="carregando"><div class="spin"></div></div></div></div>';
  const fechar = () => { v.remove(); clearInterval(S.jcPoll); document.removeEventListener('keydown', tecla); if (S.jcMudou) { S.jcMudou = false; jcCarregar(true).then(() => { if (location.hash.startsWith('#/junta')) VIEWS.junta(); }).catch(() => {}); } };
  const tecla = (e) => { if (e.key === 'Escape' && !$('.veu ~ .veu')) fechar(); };
  document.addEventListener('keydown', tecla);
  v.addEventListener('click', (e) => { if (e.target === v || e.target.closest('[data-f]')) fechar(); });
  document.body.appendChild(v);
  try { desenharJc(await api('jc_ver', { id })); } catch (e) { $('#jcp', v).innerHTML = vazio(e.message, 'alerta'); }
}
async function recarregarJc(id) { S.jcMudou = true; const p = await api('jc_ver', { id }); desenharJc(p); return p; }
function vigiarJc(id) {
  clearInterval(S.jcPoll);
  S.jcPoll = setInterval(async () => {
    if (!$('#jcp')) return clearInterval(S.jcPoll);
    try { const p = await api('jc_ver', { id }); if (p.analise_status !== 'PROCESSANDO' && p.sugestao_status !== 'PROCESSANDO') { clearInterval(S.jcPoll); S.jcMudou = true; desenharJc(p); } } catch (e) {}
  }, 7000);
}
const secao = (tit, corpo, extra) => '<section class="jcs"><div class="jcs-h"><h4>' + tit + '</h4>' + (extra || '') + '</div>' + corpo + '</section>';
const txt = (t) => esc(t || '').replace(/\n/g, '<br>');
function desenharJc(p) {
  const box = $('#jcp'); if (!box) return;
  S.jcp = p;
  const eu = jcEu(), rel = souRelator(p), gest = jcGestor(), aberto = p.status !== 'JULGADO';
  const podeEditar = aberto && (rel || gest), verConteudo = p.pode_ver_minuta || gest;
  const st = JCST[p.status] || [p.status, ''];
  $('#jct').textContent = 'Processo ' + p.numero;
  const x = jcSessao(p.sessao_id);
  const L = (r, v) => v ? '<dt>' + r + '</dt><dd>' + v + '</dd>' : '';
  let h = '<div class="tags jc-topo"><span class="chip ' + st[1] + '">' + esc(st[0]) + '</span>' + (p.tributo ? '<span class="chip nav">' + esc(p.tributo) + '</span>' : '') +
    (p.resultado ? '<span class="chip ' + resCls(p.resultado) + '">' + esc(JRES[p.resultado] || p.resultado) + '</span>' : '') + '</div>';
  h += secao('Identificação', '<dl class="det">' + L('Processo nº', esc(p.numero)) + L('Recorrente', esc(p.recorrente)) + L('CPF/CNPJ', esc(p.recorrente_doc)) + L('Tributo', esc(p.tributo)) +
    L('Valor em discussão', p.valor ? moeda(p.valor) : '') + L('Matéria', esc(p.materia)) + L('Relator(a)', esc(nomeBonito((jcMembro(p.relator_id) || {}).nome)) + (rel ? ' (você)' : '')) +
    L('Sessão', x ? textoSessao(x) : 'Ainda não pautado') + L('Acórdão', esc(p.acordao)) + L('Proclamação', txt(p.proclamacao)) + '</dl>',
    podeEditar ? '<button class="btn sm fant" data-a="editar">' + ic('editar', 's') + 'Editar</button>' : '');
  // PDF
  let pdf = p.pdf_file_id ? '<div class="pdf-l">' + ic('doc') + '<div><b>' + esc(p.pdf_nome || 'processo.pdf') + '</b><span class="pp mut">' + (p.pdf_tamanho ? (p.pdf_tamanho / 1048576).toFixed(1).replace('.', ',') + ' MB · ' : '') + 'enviado em ' + fdata(p.pdf_em) + '</span></div>' +
    (verConteudo || rel ? '<button class="btn sm pri" data-a="abrirpdf">' + ic('externo', 's') + 'Abrir PDF</button>' : '') + '</div>' : '<p class="mut pp">Nenhum PDF anexado ainda.</p>';
  if (podeEditar) pdf += '<div class="up"><label class="btn sm">' + ic('mais2', 's') + (p.pdf_file_id ? 'Substituir PDF' : 'Anexar o processo (PDF)') + '<input type="file" accept="application/pdf,.pdf" data-a="pdf" hidden></label><span class="pp mut">Até 500 MB. O arquivo fica no Drive da Junta; os julgadores abrem com a própria conta Google.</span></div><div class="prog" hidden><i></i><span></span></div>';
  h += secao('Processo administrativo (PDF)', pdf);
  if (!verConteudo) {
    h += secao('Em elaboração', '<p class="mut">O relator ainda está preparando este processo. Resumo, sugestão e minuta ficam disponíveis quando ele liberar para votação.</p>');
    box.innerHTML = h; ligarJcPainel(p); return;
  }
  // Resumo da IA
  const a = p.analise || null, q = Object.assign({}, (a && a.qualificacao) || {}, p.qualificacao || {});
  Object.keys(q).forEach((k) => { q[k] = String(q[k] ?? '').replace(/\s*\((?:fls?\.|p\.)[^)]*\)/gi, '').trim(); });
  let ia = '';
  if (p.analise_status === 'PROCESSANDO') ia += '<div class="ia-st">' + '<div class="spin"></div>Lendo o processo… isso leva de 1 a 5 minutos. Pode fechar esta janela.</div>';
  if (p.analise_status === 'ERRO') ia += '<div class="ia-st bad">' + ic('alerta', 's') + esc(p.analise_erro || 'A leitura falhou.') + '</div>';
  if (a) {
    ia += '<div class="ia-aviso">' + ic('alerta', 's') + 'Gerado automaticamente a partir do PDF' + (a.modo_leitura === 'pdf' ? ' (leitura de imagem)' : '') + '. Confira nos autos antes de usar.</div>';
    ia += '<div class="grupo-t">Qualificação das partes</div><form class="form qual" id="fq">' + QF.map((f) => '<label class="' + (f[2] || '') + '">' + f[1] + '<input class="inp" name="' + f[0] + '" value="' + esc(q[f[0]] || '') + '"' + (podeEditar ? '' : ' readonly') + '></label>').join('') + '</form>' +
      (podeEditar ? '<div class="dir-b"><button class="btn sm" data-a="salvarq">' + ic('check', 's') + 'Salvar qualificação</button></div>' : '');
    ia += '<div class="grupo-t">Resumo</div><div class="ia-txt">' + txt(a.resumo) + '</div>';
    ALISTAS.forEach(([k, t]) => { if (a[k] && a[k].length) ia += '<div class="grupo-t">' + t + '</div><ul class="ia-l">' + a[k].map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul>'; });
    if (a.documentos && a.documentos.length) ia += '<div class="grupo-t">Documentos</div><ul class="ia-l">' + a.documentos.map((d) => '<li>' + esc(d.descricao) + (d.folhas ? ' <span class="mut">(' + esc(d.folhas) + ')</span>' : '') + '</li>').join('') + '</ul>';
  } else if (p.analise_status !== 'PROCESSANDO') ia += '<p class="mut pp">' + (p.pdf_file_id ? 'O sistema lê o PDF e traz os principais pontos e a qualificação das partes.' : 'Anexe o PDF do processo para gerar o resumo.') + '</p>';
  h += secao('Resumo do processo e qualificação das partes', ia, p.pdf_file_id && p.analise_status !== 'PROCESSANDO' && aberto ? '<button class="btn sm fant" data-a="analisar">' + ic('atual', 's') + (a ? 'Ler de novo' : 'Ler o processo') + '</button>' : '');
  // Sugestão
  const sg = p.sugestao || null;
  let su = '';
  if (p.sugestao_status === 'PROCESSANDO') su += '<div class="ia-st"><div class="spin"></div>Pesquisando a jurisprudência da Junta e redigindo a sugestão…</div>';
  if (p.sugestao_status === 'ERRO') su += '<div class="ia-st bad">' + ic('alerta', 's') + esc(p.sugestao_erro || 'A sugestão falhou.') + '</div>';
  if (sg) {
    const cf = CONF[sg.confianca] || ['', ''];
    su += '<div class="ia-aviso">' + ic('alerta', 's') + 'Proposta automática com base em ' + (sg.precedentes_consultados || 0) + ' precedente(s) da base da Junta. A decisão é do colegiado; confira cada citação.</div>' +
      '<div class="tags"><span class="chip ' + resCls(sg.resultado_sugerido) + '">Sugestão: ' + esc(JRES[sg.resultado_sugerido] || sg.resultado_sugerido) + '</span>' + (cf[0] ? '<span class="chip ' + cf[1] + '">' + cf[0] + '</span>' : '') + '</div>' +
      '<div class="ia-txt"><b>' + txt(sg.sintese) + '</b></div>' +
      (sg.conhecimento ? '<div class="grupo-t">Conhecimento</div><div class="ia-txt">' + txt(sg.conhecimento) + '</div>' : '') +
      '<div class="grupo-t">Fundamentação</div><div class="ia-txt">' + txt(sg.fundamentacao) + '</div>' +
      (sg.precedentes && sg.precedentes.length ? '<div class="grupo-t">Precedentes da Junta</div><ul class="ia-l">' + sg.precedentes.map((r) => '<li><b>Acórdão ' + esc(r.acordao) + '</b>' + (r.data ? ' (' + esc(r.data) + ')' : '') + (r.resultado ? ' – ' + esc(r.resultado) : '') + ': ' + esc(r.pertinencia) + '</li>').join('') + '</ul>' : '') +
      (sg.divergencias ? '<div class="grupo-t">Divergências e lacunas</div><div class="ia-txt">' + txt(sg.divergencias) + '</div>' : '') +
      (sg.pontos_a_conferir && sg.pontos_a_conferir.length ? '<div class="grupo-t">Pontos a conferir</div><ul class="ia-l">' + sg.pontos_a_conferir.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '') +
      (sg.minuta ? '<details class="teor"><summary>Minuta sugerida</summary><div>' + esc(sg.minuta) + '</div></details>' : '') +
      (rel && p.status === 'ELABORACAO' && sg.minuta ? '<div class="dir-b"><button class="btn sm" data-a="usarsug">' + ic('doc', 's') + 'Levar a minuta sugerida para a minuta do relator</button></div>' : '');
  } else if (p.sugestao_status !== 'PROCESSANDO') su += '<p class="mut pp">' + (a ? 'Gera uma proposta de decisão com base na jurisprudência administrativa da Junta.' : 'Disponível depois da leitura do processo.') + '</p>';
  h += secao('Sugestão de decisão (jurisprudência da Junta)', su, a && p.sugestao_status !== 'PROCESSANDO' && aberto ? '<button class="btn sm fant" data-a="sugerir">' + ic('junta', 's') + (sg ? 'Gerar de novo' : 'Gerar sugestão') + '</button>' : '');
  // Minuta
  let mi = '';
  if (rel && p.status === 'ELABORACAO') {
    mi = '<textarea class="inp minuta" id="jmin" placeholder="Escreva aqui a minuta do voto/acórdão (ementa, relatório, voto e dispositivo)…">' + esc(p.minuta || '') + '</textarea>' +
      '<div class="dir-b"><span class="pp mut" id="jminst">' + (p.minuta_em ? 'Salva em ' + new Date(p.minuta_em).toLocaleString('pt-BR') : 'Ainda não salva') + '</span>' +
      '<label class="btn sm fant">' + ic('doc', 's') + 'Importar .docx<input type="file" accept=".docx" data-a="docx" hidden></label>' +
      '<button class="btn sm" data-a="salvarmin">' + ic('check', 's') + 'Salvar minuta</button><button class="btn sm pri" data-a="pronto">' + ic('enviar', 's') + 'Liberar para votação</button></div>';
  } else {
    mi = p.minuta ? '<div class="minuta-v">' + txt(p.minuta) + '</div><div class="dir-b"><button class="btn sm fant" data-a="impmin">' + ic('doc', 's') + 'Imprimir / PDF</button>' + (rel && ['PRONTO', 'VISTA'].includes(p.status) ? '<button class="btn sm" data-a="reabrir">' + ic('editar', 's') + 'Reabrir para edição</button>' : '') + '</div>' : '<p class="mut pp">Minuta ainda não escrita.</p>';
  }
  h += secao('Minuta da decisão', mi);
  // Votação
  if (p.status !== 'ELABORACAO') {
    const c = contarVotos(p);
    let vt = '<div class="votos">' + jcConselheiros().map((m) => {
      const v = (p.votos || []).find((x) => x.membro_id === m.id);
      const tag = m.id === p.relator_id ? '<span class="chip info">Relator(a)</span>' : v ? '<span class="chip ' + VOTO[v.tipo][1] + '">' + VOTO[v.tipo][0] + '</span>' : '<span class="chip">Aguardando</span>';
      return '<div class="vt"><div class="vt-n"><b>' + esc(nomeBonito(m.nome)) + '</b>' + (m.papel === 'PRESIDENTE' ? '<span class="pp mut">Presidente</span>' : '') + '</div>' + tag + (v && v.texto ? '<details class="teor"><summary>' + (v.tipo === 'DIVERGE' ? 'Voto divergente' : 'Justificativa') + '</summary><div>' + esc(v.texto) + '</div></details>' : '') + '</div>';
    }).join('') + '</div>';
    vt += '<p class="pp mut">' + c.validos + ' voto(s) válido(s) de ' + c.quorum + ' necessários (o relator conta)' + (c.diverg ? ' · ' + c.diverg + ' divergência(s)' : '') + (c.vista ? ' · há pedido de vista pendente' : '') + '.</p>';
    if (jcJulgador() && !rel && ['PRONTO', 'VISTA'].includes(p.status)) {
      const mv = meuVoto(p);
      vt += '<div class="acoes-voto"><span class="pp mut">' + (mv ? 'Seu voto: ' + VOTO[mv.tipo][0].toLowerCase() + '. Você pode mudar até o julgamento.' : 'Seu voto:') + '</span>' +
        '<button class="btn sm pri" data-v="CONCORDO">' + ic('check', 's') + 'Acompanho o relator</button><button class="btn sm" data-v="DIVERGE">' + ic('editar', 's') + 'Divergir</button>' +
        '<button class="btn sm" data-v="VISTA">' + ic('busca', 's') + 'Pedir vista</button><button class="btn sm fant" data-v="IMPEDIDO">' + ic('x', 's') + 'Declarar impedimento</button></div>';
    }
    h += secao('Votação', vt);
  }
  // Gestão da sessão
  if (gest) {
    let g = '';
    if (aberto) {
      const ss = jcSess().slice().sort((a1, b1) => b1.data.localeCompare(a1.data));
      g += '<div class="linha-g"><label>Pauta<select class="sel" id="jpauta"><option value="">Sem sessão</option>' + ss.map((s1) => '<option value="' + s1.id + '"' + (s1.id === p.sessao_id ? ' selected' : '') + '>' + fdata(s1.data, true) + (s1.hora ? ' ' + esc(s1.hora) : '') + '</option>').join('') + '</select></label><button class="btn sm" data-a="pautar">Salvar pauta</button></div>';
      if (p.status === 'PRONTO') {
        const c = contarVotos(p), sugRes = (p.sugestao && p.sugestao.resultado_sugerido) || '';
        g += '<div class="grupo-t">Proclamar o resultado</div><form class="form" id="fpr"><label>Resultado<select class="sel" name="resultado"><option value="">—</option>' + Object.entries(JRES).map((e) => '<option value="' + e[0] + '"' + (e[0] === sugRes ? ' selected' : '') + '>' + e[1] + '</option>').join('') + '</select></label>' +
          '<label>Acórdão nº<input class="inp" name="acordao" value="' + esc(p.acordao || '') + '"></label>' +
          '<label class="full">Proclamação<textarea class="inp" name="proclamacao" style="min-height:80px">' + esc(p.proclamacao || textoProclamacao(p, sugRes)) + '</textarea></label></form>' +
          '<div class="dir-b"><span class="pp ' + (c.validos >= c.quorum ? 'mut' : 'c-bad') + '">' + c.validos + '/' + c.quorum + ' votos válidos</span><button class="btn sm pri" data-a="proclamar">' + ic('check', 's') + 'Proclamar e registrar julgamento</button></div>';
      } else if (p.status === 'VISTA') g += '<p class="pp mut">Há pedido de vista pendente: o julgamento aguarda o voto de quem pediu vista.</p>';
      else if (p.status === 'ELABORACAO') g += '<p class="pp mut">O relator ainda não liberou este processo para votação.</p>';
    } else g += '<div class="dir-b"><button class="btn sm fant" data-a="desfazer">' + ic('atual', 's') + 'Desfazer julgamento</button></div>';
    h += secao('Sessão e julgamento', g);
  }
  // Histórico
  if (p.eventos && p.eventos.length) h += '<details class="teor hist"><summary>Histórico (' + p.eventos.length + ')</summary><div><ul class="ia-l">' + p.eventos.slice().reverse().map((e) => '<li><span class="mut">' + new Date(e.em).toLocaleString('pt-BR') + '</span> · ' + esc(nomeCurto((jcMembro(e.membro_id) || {}).nome) || 'Sistema') + ' · ' + esc(String(e.tipo).replace(/_/g, ' ').toLowerCase()) + (e.detalhe ? ' – ' + esc(e.detalhe) : '') + '</li>').join('') + '</ul></div></details>';
  if ((rel && p.status === 'ELABORACAO') || S.jc.dono) h += '<div class="dir-b"><button class="btn sm fant perigo" data-a="excluir">' + ic('lixo', 's') + 'Excluir processo</button></div>';
  box.innerHTML = h;
  ligarJcPainel(p);
  if (p.analise_status === 'PROCESSANDO' || p.sugestao_status === 'PROCESSANDO') vigiarJc(p.id);
}
function textoProclamacao(p, res) {
  const c = contarVotos(p), r = { PROVIDO: 'dar provimento ao recurso', PARCIAL: 'dar parcial provimento ao recurso', NAO_PROVIDO: 'negar provimento ao recurso', NAO_CONHECIDO: 'não conhecer do recurso', DILIGENCIA: 'converter o julgamento em diligência' }[res] || '[resultado]';
  const venc = (p.votos || []).filter((v) => v.tipo === 'DIVERGE').map((v) => nomeBonito((jcMembro(v.membro_id) || {}).nome));
  const imp = (p.votos || []).filter((v) => v.tipo === 'IMPEDIDO').map((v) => nomeBonito((jcMembro(v.membro_id) || {}).nome));
  return 'A Junta de Recursos Fiscais, ' + (c.diverg ? 'por maioria' : 'por unanimidade') + ', decidiu ' + r + ', nos termos do voto do(a) relator(a), Conselheiro(a) ' + nomeBonito((jcMembro(p.relator_id) || {}).nome) + '.' +
    (venc.length ? ' Vencido(s): ' + venc.join(', ') + '.' : '') + (imp.length ? ' Impedido(s): ' + imp.join(', ') + '.' : '');
}
function ligarJcPainel(p) {
  const box = $('#jcp'), A = (n) => $('[data-a="' + n + '"]', box);
  const fazer = async (btn, fn) => { if (btn) btn.disabled = true; try { await fn(); } catch (e) { toast(e.message, true); } finally { if (btn && document.body.contains(btn)) btn.disabled = false; } };
  if (A('editar')) A('editar').onclick = () => editarJc(p);
  if (A('abrirpdf')) A('abrirpdf').onclick = (e) => fazer(e.currentTarget, async () => { const w = window.open('', '_blank'); const r = await apiArq('jc_pdf_abrir', { id: p.id }); if (w) w.location = r.link; else location.href = r.link; });
  if (A('pdf')) A('pdf').onchange = (e) => { const f = e.target.files[0]; if (f) enviarPdfJc(p, f); };
  if (A('analisar')) A('analisar').onclick = (e) => fazer(e.currentTarget, async () => { await apiArq('jc_analisar', { id: p.id }); toast('Leitura iniciada. O resumo aparece aqui em alguns minutos.'); await recarregarJc(p.id); });
  if (A('sugerir')) A('sugerir').onclick = (e) => fazer(e.currentTarget, async () => { await apiArq('jc_sugerir', { id: p.id }); toast('Gerando a sugestão de decisão…'); await recarregarJc(p.id); });
  if (A('salvarq')) A('salvarq').onclick = (e) => fazer(e.currentTarget, async () => { const d = Object.fromEntries(new FormData($('#fq', box)).entries()); await api('jc_qualificacao_salvar', { id: p.id, qualificacao: d }); toast('Qualificação salva.'); await recarregarJc(p.id); });
  if (A('usarsug')) A('usarsug').onclick = (e) => fazer(e.currentTarget, async () => {
    if ($('#jmin') && $('#jmin').value.trim() !== String(p.minuta || '').trim()) await api('jc_minuta', { id: p.id, minuta: $('#jmin').value });
    await api('jc_sugestao_para_minuta', { id: p.id }); toast('Minuta sugerida copiada para a sua minuta. Revise antes de liberar.'); await recarregarJc(p.id); $('#jmin') && $('#jmin').scrollIntoView({ behavior: 'smooth' });
  });
  const salvarMin = async () => { const r = await api('jc_minuta', { id: p.id, minuta: $('#jmin').value }); p.minuta = $('#jmin').value; S.jcMudou = true; $('#jminst').textContent = 'Salva em ' + new Date(r.minuta_em || Date.now()).toLocaleString('pt-BR'); };
  if (A('salvarmin')) A('salvarmin').onclick = (e) => fazer(e.currentTarget, async () => { await salvarMin(); toast('Minuta salva.'); });
  if ($('#jmin')) $('#jmin').onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); salvarMin().then(() => toast('Minuta salva.')).catch((er) => toast(er.message, true)); } };
  if (A('docx')) A('docx').onchange = (e) => { const f = e.target.files[0]; if (f) importarDocx(f).then((t) => { const m = $('#jmin'); m.value = (m.value.trim() ? m.value + '\n\n' : '') + t; toast('Texto importado. Revise e salve a minuta.'); }).catch((er) => toast(er.message, true)); };
  if (A('pronto')) A('pronto').onclick = (e) => fazer(e.currentTarget, async () => {
    if ($('#jmin').value.trim().length < 50) throw new Error('Escreva a minuta antes de liberar para votação.');
    if (!(await confirmar('Liberar para votação', 'A minuta e o processo ficam disponíveis para os demais conselheiros votarem, e o processo entra na pauta da próxima sessão. Depois disso, para editar a minuta será preciso reabrir (os votos já dados são desconsiderados).', 'Liberar'))) return;
    await salvarMin(); const r = await api('jc_pronto', { id: p.id });
    toast(r.sessao_id ? 'Liberado e pautado para a sessão de ' + fdata((jcSessao(r.sessao_id) || {}).data) + '.' : 'Liberado para votação. Ainda não há sessão futura cadastrada para pautar.'); await recarregarJc(p.id);
  });
  if (A('reabrir')) A('reabrir').onclick = (e) => fazer(e.currentTarget, async () => { if (!(await confirmar('Reabrir para edição', 'O processo volta para elaboração e os votos já registrados (exceto impedimentos) são desconsiderados. Continuar?', 'Reabrir', true))) return; await api('jc_reabrir', { id: p.id }); toast('Processo reaberto para edição.'); await recarregarJc(p.id); });
  if (A('impmin')) A('impmin').onclick = () => imprimir('Minuta – Processo ' + p.numero, '<h1>Junta de Recursos Fiscais de Novo Hamburgo</h1><h2>Processo nº ' + esc(p.numero) + (p.recorrente ? ' – ' + esc(p.recorrente) : '') + '</h2><p class="mut">Relator(a): ' + esc(nomeBonito((jcMembro(p.relator_id) || {}).nome)) + '</p><div class="t">' + txt(p.minuta) + '</div>');
  $$('[data-v]', box).forEach((b) => { b.onclick = () => votarJc(p, b.dataset.v); });
  if (A('pautar')) A('pautar').onclick = (e) => fazer(e.currentTarget, async () => { await api('jc_pautar', { id: p.id, sessao_id: $('#jpauta').value || null }); toast('Pauta atualizada.'); await recarregarJc(p.id); });
  const fpr = $('#fpr', box);
  if (fpr) fpr.resultado.onchange = () => { fpr.proclamacao.value = textoProclamacao(p, fpr.resultado.value); };
  if (A('proclamar')) A('proclamar').onclick = (e) => fazer(e.currentTarget, async () => {
    const d = Object.fromEntries(new FormData(fpr).entries());
    if (!d.resultado) throw new Error('Escolha o resultado.');
    if (!(await confirmar('Proclamar resultado', 'Registrar o julgamento: ' + JRES[d.resultado] + '?', 'Proclamar'))) return;
    await api('jc_proclamar', Object.assign({ id: p.id }, d)); toast('Julgamento registrado.'); await recarregarJc(p.id);
  });
  if (A('desfazer')) A('desfazer').onclick = (e) => fazer(e.currentTarget, async () => { if (!(await confirmar('Desfazer julgamento', 'O processo volta para "liberado para votação", com os votos mantidos.', 'Desfazer', true))) return; await api('jc_desfazer_julgamento', { id: p.id }); toast('Julgamento desfeito.'); await recarregarJc(p.id); });
  if (A('excluir')) A('excluir').onclick = (e) => fazer(e.currentTarget, async () => {
    if (!(await confirmar('Excluir processo', 'Excluir o processo ' + p.numero + ' do ambiente virtual? O PDF continua no Drive da Junta.', 'Excluir', true))) return;
    await api('jc_excluir', { id: p.id }); toast('Processo excluído.'); S.jcMudou = true; const v = box.closest('.veu'); v && v.querySelector('[data-f]').click();
  });
}
async function votarJc(p, tipo) {
  const rot = { CONCORDO: 'Acompanhar o relator', DIVERGE: 'Voto divergente', VISTA: 'Pedido de vista', IMPEDIDO: 'Declarar impedimento' }[tipo];
  let texto = null;
  if (tipo === 'CONCORDO') { if (!(await confirmar(rot, 'Registrar o seu voto acompanhando o relator no processo ' + p.numero + '?', 'Votar'))) return; }
  else {
    const mv = meuVoto(p);
    const dica = { DIVERGE: 'Escreva o seu voto divergente (fundamentação e conclusão). Ele fica visível para o colegiado e entra na ata.', VISTA: 'Opcional: motivo do pedido de vista. O julgamento fica suspenso até você registrar o seu voto.', IMPEDIDO: 'Opcional: motivo do impedimento ou da suspeição. Você não vota neste processo.' }[tipo];
    const r = await modal({ titulo: rot + ' – ' + p.numero, largo: tipo === 'DIVERGE', corpo: '<p class="mut pp" style="margin-top:0">' + dica + '</p><textarea class="inp" id="jvt" style="width:100%;min-height:' + (tipo === 'DIVERGE' ? 280 : 110) + 'px">' + esc(mv && mv.tipo === tipo ? mv.texto || '' : '') + '</textarea>',
      botoes: [{ txt: 'Cancelar', valor: null }, { txt: 'Registrar', cls: 'pri', ic: 'check', acao: async (v) => { const t = $('#jvt', v).value.trim(); if (tipo === 'DIVERGE' && t.length < 30) { toast('Escreva o voto divergente.', true); return false; } return { t }; } }] });
    if (!r) return; texto = r.t || null;
  }
  try { await api('jc_votar', { id: p.id, tipo, texto }); toast('Voto registrado.'); await recarregarJc(p.id); } catch (e) { toast(e.message, true); }
}
function editarJc(p) {
  p = p || {};
  const gest = jcGestor(), eu = jcEu();
  if (!p.id && !gest && !jcJulgador()) return toast('Só conselheiros e a Secretaria cadastram processos.', true);
  const inp = (n, rot, cls, extra) => '<label class="' + (cls || '') + '">' + rot + '<input class="inp" name="' + n + '" value="' + esc(p[n] ?? '') + '"' + (extra || '') + '></label>';
  const val = p.valor !== null && p.valor !== undefined && p.valor !== '' ? Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  const corpo = '<form class="form" id="fjc" autocomplete="off">' + inp('numero', 'Processo administrativo nº', '', ' required') + inp('recorrente', 'Recorrente') + inp('recorrente_doc', 'CPF/CNPJ') +
    '<label>Tributo<input class="inp" name="tributo" list="tribs3" value="' + esc(p.tributo || '') + '"><datalist id="tribs3">' + TRIBUTOS.map((t) => '<option value="' + esc(t) + '">').join('') + '</datalist></label>' +
    '<label>Valor em discussão (R$)<input class="inp" name="valor" inputmode="decimal" value="' + esc(val) + '"></label>' +
    (gest ? '<label>Relator(a)<select class="sel" name="relator_id">' + jcConselheiros().map((m) => '<option value="' + m.id + '"' + (m.id === (p.relator_id || (eu && eu.id)) ? ' selected' : '') + '>' + esc(nomeBonito(m.nome)) + '</option>').join('') + '</select></label>' : '') +
    inp('materia', 'Matéria', 'full') + '</form>' + (p.id ? '' : '<p class="pp mut">Depois de salvar, anexe o PDF do processo e escreva a minuta.</p>');
  modal({ titulo: p.id ? 'Editar processo ' + p.numero : 'Novo processo no julgamento virtual', corpo, largo: true, botoes: [{ txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', ic: 'check', acao: async (v) => {
    const d = Object.fromEntries(new FormData($('#fjc', v)).entries()); d.id = p.id || null; d.sessao_id = p.sessao_id || null; if (!gest) d.relator_id = p.relator_id || (eu && eu.id);
    if (!String(d.numero || '').trim()) { toast('Informe o número do processo.', true); return false; }
    const r = await api('jc_salvar', { processo: d }); toast(p.id ? 'Processo atualizado.' : 'Processo cadastrado.');
    await jcCarregar(true); if (location.hash.startsWith('#/junta')) VIEWS.junta();
    if (p.id && $('#jcp')) await recarregarJc(p.id); else if (!p.id) setTimeout(() => verJc(r.id), 50);
  } }] });
}
function lerB64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('Não foi possível ler o arquivo.')); fr.readAsDataURL(blob); }); }
async function enviarPdfJc(p, f) {
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') return toast('Envie o processo em PDF.', true);
  if (f.size > 500 * 1048576) return toast('O PDF precisa ter até 500 MB.', true);
  const box = $('#jcp'), pr = $('.prog', box), bar = $('.prog i', box), lbl = $('.prog span', box), up = $('.up', box);
  pr.hidden = false; up.hidden = true;
  const mostrar = (n) => { bar.style.width = Math.round(n * 100) + '%'; lbl.textContent = 'Enviando ' + Math.round(n * 100) + '% de ' + (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB…'; };
  mostrar(0);
  try {
    const ini = await apiArq('jc_pdf_iniciar', { id: p.id, nome: f.name, tamanho: f.size });
    const T = 4 * 1024 * 1024; let inicio = 0, r = null;
    while (true) {
      const fim = Math.min(inicio + T, f.size), dados = await lerB64(f.slice(inicio, fim));
      let erro = null;
      for (let t = 0; t < 3; t++) { try { r = await apiArq('jc_pdf_parte', { upload_id: ini.upload_id, inicio, total: f.size, dados }); erro = null; break; } catch (e) { erro = e; await new Promise((ok) => setTimeout(ok, 1500 * (t + 1))); } }
      if (erro) throw erro;
      if (r.feito) break;
      inicio = r.recebido > inicio ? r.recebido : fim; mostrar(inicio / f.size);
    }
    mostrar(1); toast('PDF anexado. Agora você pode pedir a leitura do processo.');
    await recarregarJc(p.id);
  } catch (e) { toast(e.message, true); pr.hidden = true; up.hidden = false; }
}
let mammothCarregando = null;
async function importarDocx(f) {
  if (!window.mammoth) {
    mammothCarregando = mammothCarregando || new Promise((ok, erro) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js'; s.onload = ok; s.onerror = () => erro(new Error('Não foi possível carregar o leitor de .docx.')); document.head.appendChild(s); });
    await mammothCarregando;
  }
  const r = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
  return String(r.value || '').replace(/\n{3,}/g, '\n\n').trim();
}
function imprimir(titulo, html) {
  const w = window.open('', '_blank'); if (!w) return toast('Permita pop-ups para imprimir.', true);
  w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><style>body{font:12pt/1.6 Georgia,"Times New Roman",serif;color:#111;max-width:17cm;margin:2cm auto;padding:0 1cm}h1{font-size:13pt;text-align:center;text-transform:uppercase;margin:0 0 4px}h2{font-size:12pt;text-align:center;margin:0 0 14px}.mut{color:#555;text-align:center}.t{text-align:justify}@media print{body{margin:0 auto}}</style></head><body>' + html + '<script>setTimeout(function(){print()},300)<\/script></body></html>');
  w.document.close();
}

// ---------- sessões e ata ----------
function htmlSessoesJc() {
  const h = hoje(), fut = jcSess().filter((x) => x.data >= h), pas = jcSess().filter((x) => x.data < h).reverse();
  const it = (x) => {
    const ps = jcProcs().filter((p) => p.sessao_id === x.id), d = dt(x.data);
    return '<div class="item clic" data-jcs="' + x.id + '"><div class="dia' + (x.data >= h ? '' : ' pass') + '"><b>' + String(d.getUTCDate()).padStart(2, '0') + '</b><span>' + d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '') + '</span></div>' +
      '<div class="mid"><div class="t">' + (x.numero ? esc(x.numero) + 'ª sessão · ' : '') + esc(DS[d.getUTCDay()]) + (x.hora ? ', ' + esc(x.hora) : '') + ' · ' + (x.tipo === 'EXTRAORDINARIA' ? 'extraordinária' : 'ordinária') + '</div>' +
      '<div class="d">' + esc(x.local || '') + '</div><div class="tags">' + ps.map((p) => '<span class="chip ' + (p.status === 'JULGADO' ? 'ok' : (JCST[p.status] || ['', ''])[1]) + '">' + esc(p.numero) + '</span>').join('') + (x.ata ? '<span class="chip ok">Ata lavrada</span>' : '') + '</div></div>' +
      '<div class="dir"><span class="pp mut">' + ps.length + ' processo(s)</span></div></div>';
  };
  return (jcGestor() ? '<div class="barra"><button class="btn sm" data-jcns>' + ic('mais2', 's') + 'Nova sessão</button></div>' : '') +
    '<div class="sec-tit">Próximas sessões</div><div class="card"><div class="lista">' + (fut.map(it).join('') || vazio('Nenhuma sessão futura cadastrada.', 'hoje')) + '</div></div>' +
    '<div class="sec-tit">Sessões anteriores</div><div class="card"><div class="lista">' + (pas.slice(0, 40).map(it).join('') || vazio('Nenhuma sessão anterior.', 'hoje')) + '</div></div>';
}
function editarSessaoJc(x) {
  x = x || { tipo: 'ORDINARIA' };
  const corpo = '<form class="form" id="fsj" autocomplete="off"><label>Data<input class="inp" type="date" name="data" value="' + esc(x.data || '') + '" required></label><label>Horário<input class="inp" type="time" name="hora" value="' + esc(x.hora || '') + '"></label>' +
    '<label>Nº da sessão<input class="inp" name="numero" value="' + esc(x.numero || '') + '" placeholder="ex.: 15"></label>' +
    '<label>Tipo<select class="sel" name="tipo">' + [['ORDINARIA', 'Ordinária'], ['EXTRAORDINARIA', 'Extraordinária']].map((o) => '<option value="' + o[0] + '"' + (x.tipo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
    '<label class="full">Local / link<input class="inp" name="local" value="' + esc(x.local || '') + '" placeholder="Sala de reuniões da Fazenda, ou ambiente virtual"></label>' +
    '<label class="full">Observações<textarea class="inp" name="observacoes" style="min-height:70px">' + esc(x.observacoes || '') + '</textarea></label></form>';
  modal({ titulo: x.id ? 'Editar sessão' : 'Nova sessão de julgamento', corpo, botoes: [{ txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', ic: 'check', acao: async (v) => {
    const d = Object.fromEntries(new FormData($('#fsj', v)).entries()); d.id = x.id || null;
    if (!d.data) { toast('Informe a data.', true); return false; }
    await api('jc_sessao_salvar', { sessao: d }); toast('Sessão salva.'); await jcCarregar(true); VIEWS.junta();
  } }] });
}
async function verSessaoJc(id) {
  await jcCarregar(true).catch(() => {});
  const x = jcSessao(id); if (!x) return toast('Sessão não encontrada.', true);
  const gest = jcGestor(), ps = jcProcs().filter((p) => p.sessao_id === x.id);
  const pres = (x.presentes && x.presentes.length) ? x.presentes : jcMembros().map((m) => m.id);
  const corpo = '<dl class="det">' + '<dt>Data</dt><dd>' + textoSessao(x) + '</dd>' + (x.local ? '<dt>Local</dt><dd>' + esc(x.local) + '</dd>' : '') + '</dl>' +
    '<div class="grupo-t">Pauta (' + ps.length + ')</div><div class="lista borda">' + (ps.map(itemJc).join('') || vazio('Nenhum processo pautado.', 'junta')) + '</div>' +
    '<div class="grupo-t">Presenças</div><div class="pres">' + jcMembros().map((m) => '<label class="chk"><input type="checkbox" value="' + m.id + '"' + (pres.includes(m.id) ? ' checked' : '') + (gest ? '' : ' disabled') + '> ' + esc(nomeBonito(m.nome)) + ' <span class="mut pp">' + esc(PAPEL[m.papel]) + '</span></label>').join('') + '</div>' +
    (gest ? '<div class="dir-b"><button class="btn sm" data-x="pres">Salvar presenças</button></div>' : '') +
    '<div class="grupo-t">Ata da sessão</div><textarea class="inp ata" id="jata"' + (gest ? ' placeholder="Clique em “Gerar ata automaticamente” e revise o texto."' : ' readonly placeholder="A ata é elaborada pela Secretaria depois da sessão."') + '>' + esc(x.ata || '') + '</textarea>' +
    '<div class="dir-b">' + (x.ata_em ? '<span class="pp mut">Salva em ' + new Date(x.ata_em).toLocaleString('pt-BR') + '</span>' : '') + (gest ? '<button class="btn sm fant" data-x="gerar">' + ic('atual', 's') + 'Gerar ata automaticamente</button><button class="btn sm" data-x="salvar">' + ic('check', 's') + 'Salvar ata</button>' : '') + '<button class="btn sm fant" data-x="imp">' + ic('doc', 's') + 'Imprimir / PDF</button></div>';
  const botoes = [{ txt: 'Fechar', valor: null }];
  if (gest) botoes.unshift({ txt: 'Editar sessão', ic: 'editar', cls: 'fant esq', valor: 'editar' });
  const pm = modal({ titulo: 'Sessão de ' + fdata(x.data), corpo, largo: true, botoes });
  const v = $$('.veu').pop();
  $$('[data-jc]', v).forEach((e) => { e.onclick = () => verJc(e.dataset.jc); });
  const marcados = () => $$('.pres input:checked', v).map((i) => i.value);
  const B = (n) => $('[data-x="' + n + '"]', v);
  if (B('pres')) B('pres').onclick = async () => { try { await api('jc_presenca', { sessao_id: x.id, presentes: marcados() }); x.presentes = marcados(); toast('Presenças salvas.'); } catch (e) { toast(e.message, true); } };
  if (B('gerar')) B('gerar').onclick = () => { const a = $('#jata', v); if (a.value.trim() && !confirm('Substituir o texto atual da ata pelo gerado automaticamente?')) return; a.value = gerarAta(x, marcados()); };
  if (B('salvar')) B('salvar').onclick = async () => { try { await api('jc_presenca', { sessao_id: x.id, presentes: marcados() }); await api('jc_ata_salvar', { sessao_id: x.id, ata: $('#jata', v).value }); toast('Ata salva.'); jcCarregar(true).catch(() => {}); } catch (e) { toast(e.message, true); } };
  B('imp').onclick = () => imprimir('Ata – sessão de ' + fdata(x.data), '<div class="t">' + txt($('#jata', v).value) + '</div>');
  if ((await pm) === 'editar') editarSessaoJc(x);
}
const UNI = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const ext99 = (n) => n < 20 ? UNI[n] : DEZ[Math.floor(n / 10)] + (n % 10 ? ' e ' + UNI[n % 10] : '');
const MESX = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dataExtenso(s) {
  const d = dt(s), dia = d.getUTCDate(), ano = d.getUTCFullYear();
  return (dia === 1 ? 'Ao primeiro dia' : 'Aos ' + ext99(dia) + ' dias') + ' do mês de ' + MESX[d.getUTCMonth()] + ' de ' + (ano >= 2000 && ano < 2100 ? 'dois mil' + (ano % 100 ? ' e ' + ext99(ano % 100) : '') : ano);
}
function gerarAta(x, presentes) {
  const ms = jcMembros(), pres = ms.filter((m) => presentes.includes(m.id)), aus = ms.filter((m) => !presentes.includes(m.id));
  const presid = ms.find((m) => m.papel === 'PRESIDENTE'), sec = ms.find((m) => m.papel === 'SECRETARIA');
  const N = (m) => m ? nomeBonito(m.nome) : '[nome]';
  const consPres = pres.filter((m) => m.papel === 'CONSELHEIRO');
  const ps = jcProcs().filter((p) => p.sessao_id === x.id);
  const julg = ps.filter((p) => p.status === 'JULGADO'), vista = ps.filter((p) => p.status === 'VISTA'), outros = ps.filter((p) => !['JULGADO', 'VISTA'].includes(p.status));
  const linhaProc = (p, i) => {
    const vs = p.votos || [], div = vs.filter((v) => v.tipo === 'DIVERGE').map((v) => N(jcMembro(v.membro_id))), imp = vs.filter((v) => v.tipo === 'IMPEDIDO').map((v) => N(jcMembro(v.membro_id)));
    return (i + 1) + '. Processo administrativo nº ' + p.numero + (p.recorrente ? ', recorrente ' + p.recorrente : '') + (p.tributo ? ', referente a ' + p.tributo : '') + '. Relator(a): Conselheiro(a) ' + N(jcMembro(p.relator_id)) + '. ' +
      (p.status === 'JULGADO' ? 'Resultado: ' + (JRES[p.resultado] || p.resultado || '[resultado]') + ', ' + (div.length ? 'por maioria, vencido(s) ' + div.join(', ') : 'por unanimidade') + (p.acordao ? '. Acórdão nº ' + p.acordao : '') + '.' : '') +
      (imp.length ? ' Declarou(aram)-se impedido(s): ' + imp.join(', ') + '.' : '');
  };
  const linha = (p, i) => linhaProc(p, i).trim();
  let t = 'ATA DA ' + (x.numero ? x.numero + 'ª ' : '') + 'SESSÃO ' + (x.tipo === 'EXTRAORDINARIA' ? 'EXTRAORDINÁRIA' : 'ORDINÁRIA') + ' DA JUNTA DE RECURSOS FISCAIS DO MUNICÍPIO DE NOVO HAMBURGO\n\n';
  t += dataExtenso(x.data) + (x.hora ? ', às ' + x.hora.replace(':', 'h') : '') + ', ' + (x.local ? 'em ' + x.local : 'em ambiente virtual') + ', reuniu-se a Junta de Recursos Fiscais do Município de Novo Hamburgo, sob a presidência do(a) Conselheiro(a) ' + N(presid) +
    ', presentes os(as) Conselheiros(as) ' + (consPres.map(N).join(', ') || '[nomes]') + ', e a Secretária ' + N(sec) + '.' + (aus.length ? ' Ausente(s): ' + aus.map(N).join(', ') + '.' : '') +
    ' Verificada a existência de quórum, o(a) Presidente declarou aberta a sessão.\n\n';
  if (julg.length) t += 'PROCESSOS JULGADOS\n' + julg.map(linha).join('\n') + '\n\n';
  if (vista.length) t += 'PEDIDOS DE VISTA\n' + vista.map((p, i) => linha(p, i) + ' Pedido de vista formulado por ' + (p.votos || []).filter((v) => v.tipo === 'VISTA').map((v) => N(jcMembro(v.membro_id))).join(', ') + '; o julgamento prosseguirá em sessão futura.').join('\n') + '\n\n';
  if (outros.length) t += 'PROCESSOS NÃO JULGADOS NESTA SESSÃO\n' + outros.map((p, i) => linha(p, i) + ' Adiado.').join('\n') + '\n\n';
  if (!ps.length) t += 'Não houve processos em pauta.\n\n';
  t += 'Nada mais havendo a tratar, o(a) Presidente declarou encerrada a sessão, da qual eu, ' + N(sec) + ', Secretária, lavrei a presente ata, que, lida e aprovada, vai assinada por mim e pelo(a) Presidente.\n\n\n_______________________________\n' + N(presid) + '\nPresidente\n\n\n_______________________________\n' + N(sec) + '\nSecretária';
  return t;
}

// ---------- administração ----------
function htmlAdminJc() {
  const dono = S.jc.dono, q = (S.jc.config && S.jc.config.quorum) || 4;
  return '<div class="card"><div class="cab"><h2>Quórum mínimo</h2></div><div class="corpo"><div class="linha-g"><label>Votos válidos para julgar (o relator conta)<select class="sel" id="jquo">' + [3, 4, 5, 6].map((n) => '<option' + (n === q ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label><button class="btn sm" data-ad="quorum">Salvar</button></div></div></div>' +
    '<div class="sec-tit">Membros e e-mails de acesso</div><p class="pp mut dica">Cada membro entra com a própria conta Google. Informe o e-mail Google de cada um; quem não estiver aqui não acessa o ambiente.' + (dono ? '' : ' Só o administrador altera os e-mails.') + '</p>' +
    '<div class="card"><div class="lista">' + jcMembros().map((m) => '<div class="item"><div class="mid"><div class="t">' + esc(nomeBonito(m.nome)) + '</div><div class="d">' + esc(PAPEL[m.papel]) + (m.eh_dono ? ' · administrador (entra com a conta do escritório)' : '') + '</div></div>' +
      '<div class="dir mem">' + (dono && !m.eh_dono ? '<input class="inp" type="email" data-em="' + m.id + '" value="' + esc(m.email || '') + '" placeholder="e-mail Google"><button class="btn sm" data-ad="email" data-id="' + m.id + '">Salvar</button>' : '<span class="chip ' + (m.tem_email ? 'ok' : 'warn') + '">' + (m.tem_email ? 'com acesso' : 'sem e-mail') + '</span>') + '</div></div>').join('') + '</div></div>';
}
function ligarAdminJc(raiz) {
  $$('[data-ad="quorum"]', raiz).forEach((b) => { b.onclick = async () => { try { await api('jc_config_salvar', { quorum: $('#jquo').value }); toast('Quórum atualizado.'); await jcCarregar(true); VIEWS.junta(); } catch (e) { toast(e.message, true); } }; });
  $$('[data-ad="email"]', raiz).forEach((b) => { b.onclick = async () => { try { await api('jc_membro_salvar', { id: b.dataset.id, email: $('[data-em="' + b.dataset.id + '"]').value.trim() }); toast('E-mail salvo.'); await jcCarregar(true); VIEWS.junta(); } catch (e) { toast(e.message, true); } }; });
}
