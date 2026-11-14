/* Agulha Discos — a radiola
 * Dial de sintonia (arrastar, rodinha, botão giratório e teclado), olho mágico,
 * chiado entre estações (Web Audio), estante da estação, toca-discos com braço,
 * ficha do disco, sacola e frete pelo CEP.
 */
(() => {
  'use strict';

  const { DISCOS, ESTACOES, carrinho, capa, brl } = AGULHA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const porId = new Map(DISCOS.map((d) => [d.id, d]));
  const sem = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const precoCurto = (n) => `R$ ${n.toLocaleString('pt-BR')}`;
  const N = ESTACOES.length;
  const estacaoDe = (genero) => Math.max(0, ESTACOES.findIndex((e) => e.genero === genero));

  const estado = { sintonia: 0, estacao: 0, filtroEstado: '', ordem: 'chegada', busca: '', disco: null, qtd: 1 };

  /* ================================================================== */
  /* Chiado entre as estações                                           */
  /* ================================================================== */
  const chiado = (() => {
    let ctx = null; let ganho = null; let filtro = null; let ligado = true;
    function iniciar() {
      if (ctx || !ligado) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < .002 ? 1 : .5);
      const fonte = ctx.createBufferSource();
      fonte.buffer = buf; fonte.loop = true;
      filtro = ctx.createBiquadFilter(); filtro.type = 'bandpass'; filtro.Q.value = .7; filtro.frequency.value = 1800;
      ganho = ctx.createGain(); ganho.gain.value = 0;
      fonte.connect(filtro); filtro.connect(ganho); ganho.connect(ctx.destination);
      fonte.start();
    }
    return {
      iniciar,
      volume(v, s) {
        if (!ctx) return;
        ganho.gain.setTargetAtTime(ligado ? v * .16 : 0, ctx.currentTime, .04);
        filtro.frequency.setTargetAtTime(900 + (s / (N - 1)) * 2600, ctx.currentTime, .05);
      },
      alternar() { ligado = !ligado; if (!ligado && ganho) ganho.gain.setTargetAtTime(0, ctx.currentTime, .03); if (ligado) iniciar(); return ligado; },
    };
  })();

  /* ================================================================== */
  /* Dial                                                               */
  /* ================================================================== */
  const dial = $('[data-dial]');
  const vidro = $('.dial__vidro', dial);
  const escala = $('[data-escala]');
  const ponteiro = $('[data-ponteiro]');
  const olho = $('[data-olho] span');
  const botao = $('[data-botao]');
  const rotEstacao = $('[data-estacao-rot]');
  const geo = { V: 0, pad: 56, passo: 100, largura: 0, rolante: false };

  ESTACOES.forEach((e, i) => {
    const el = document.createElement('div');
    el.className = 'estacao';
    el.style.setProperty('--cor', e.cor);
    el.innerHTML = '<span class="estacao__khz"></span><span class="estacao__faixa"></span><button type="button" class="estacao__nome" tabindex="-1"></button>';
    $('.estacao__khz', el).textContent = e.khz;
    const b = $('.estacao__nome', el);
    b.textContent = e.nome;
    b.setAttribute('aria-label', `Sintonizar ${e.nome}`);
    b.addEventListener('click', (ev) => { if (arrasto.moveu) { ev.preventDefault(); return; } chiado.iniciar(); irPara(i); });
    escala.append(el);
  });
  const elsEstacao = $$('.estacao', escala);

  function medir() {
    geo.V = vidro.clientWidth;
    geo.pad = geo.V < 520 ? 48 : 64;
    const minimo = geo.V < 520 ? 92 : 100;
    geo.largura = Math.max(geo.V, geo.pad * 2 + (N - 1) * minimo);
    geo.passo = (geo.largura - geo.pad * 2) / (N - 1);
    geo.rolante = geo.largura > geo.V + 1;
    escala.style.width = `${geo.largura}px`;
    elsEstacao.forEach((el, i) => {
      el.style.left = `${geo.pad + i * geo.passo}px`;
      el.style.setProperty('--larg', `${Math.round(geo.passo * .62)}px`);
    });
    desenhar();
  }

  function desenhar() {
    const s = estado.sintonia;
    const x = geo.pad + s * geo.passo;
    const xTela = geo.rolante ? geo.V / 2 : x;
    escala.style.transform = `translateX(${geo.rolante ? geo.V / 2 - x : 0}px)`;
    ponteiro.style.transform = `translateX(${xTela}px)`;
    vidro.style.setProperty('--brilho-x', `${(xTela / Math.max(1, geo.V)) * 100}%`);
    const perto = Math.round(s);
    const desvio = Math.abs(s - perto);
    olho.style.setProperty('--abre', `${(6 + Math.min(1, desvio / .45) * 96).toFixed(1)}deg`);
    botao.style.setProperty('--giro', `${s * 38}deg`);
    elsEstacao.forEach((el, i) => el.classList.toggle('is-sintonizada', i === perto && desvio < .09));
    chiado.volume(desvio < .09 ? 0 : Math.min(1, desvio / .3), s);
  }

  function definir(s) {
    estado.sintonia = Math.max(0, Math.min(N - 1, s));
    desenhar();
  }

  let animacao = 0;
  function irPara(alvo, { instantaneo = false, aoFim } = {}) {
    cancelAnimationFrame(animacao);
    const de = estado.sintonia;
    const dist = Math.abs(alvo - de);
    if (instantaneo || reduz || dist < .001) { definir(alvo); sintonizar(alvo); if (aoFim) aoFim(); return; }
    const dur = 260 + dist * 150;
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - (1 - p) ** 3;
      // um tremor de mão no meio do caminho, como sintonia de verdade
      const tremor = p < 1 ? Math.sin(p * Math.PI * 6) * .06 * (1 - p) : 0;
      definir(de + (alvo - de) * e + tremor);
      if (p < 1) animacao = requestAnimationFrame(passo);
      else { definir(alvo); sintonizar(alvo); if (aoFim) aoFim(); }
    };
    animacao = requestAnimationFrame(passo);
  }

  function assentar() { irPara(Math.round(estado.sintonia)); }

  /* arrastar no dial */
  const arrasto = { ativo: false, moveu: false, x0: 0, s0: 0 };
  dial.addEventListener('pointerdown', (e) => {
    chiado.iniciar();
    cancelAnimationFrame(animacao);
    Object.assign(arrasto, { ativo: true, moveu: false, x0: e.clientX, s0: estado.sintonia });
  });
  dial.addEventListener('pointermove', (e) => {
    if (!arrasto.ativo) return;
    const dx = e.clientX - arrasto.x0;
    if (!arrasto.moveu && Math.abs(dx) < 5) return;
    if (!arrasto.moveu) { arrasto.moveu = true; dial.setPointerCapture(e.pointerId); }
    if (geo.rolante) definir(arrasto.s0 - dx / geo.passo);
    else {
      const r = vidro.getBoundingClientRect();
      definir((e.clientX - r.left - geo.pad) / geo.passo);
    }
  });
  const soltar = (e) => {
    if (!arrasto.ativo) return;
    arrasto.ativo = false;
    if (arrasto.moveu) { assentar(); setTimeout(() => { arrasto.moveu = false; }, 0); return; }
    // clique no vidro (fora dos nomes): vai para a estação mais perto do clique
    if (!e.target.closest('.estacao__nome') && !geo.rolante) {
      const r = vidro.getBoundingClientRect();
      irPara(Math.max(0, Math.min(N - 1, Math.round((e.clientX - r.left - geo.pad) / geo.passo))));
    }
  };
  dial.addEventListener('pointerup', soltar);
  dial.addEventListener('pointercancel', () => { arrasto.ativo = false; arrasto.moveu = false; assentar(); });

  /* rodinha do mouse no dial e no botão */
  let timerRoda;
  const roda = (e) => {
    e.preventDefault();
    chiado.iniciar();
    cancelAnimationFrame(animacao);
    definir(estado.sintonia + Math.sign(e.deltaY || e.deltaX) * .18);
    clearTimeout(timerRoda);
    timerRoda = setTimeout(assentar, 220);
  };
  dial.addEventListener('wheel', roda, { passive: false });
  botao.addEventListener('wheel', roda, { passive: false });

  /* girar o botão de sintonia */
  const giro = { ativo: false, ang: 0 };
  const angulo = (e) => { const r = botao.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  botao.addEventListener('pointerdown', (e) => { chiado.iniciar(); cancelAnimationFrame(animacao); giro.ativo = true; giro.ang = angulo(e); botao.setPointerCapture(e.pointerId); });
  botao.addEventListener('pointermove', (e) => {
    if (!giro.ativo) return;
    const a = angulo(e);
    let d = a - giro.ang;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    giro.ang = a;
    definir(estado.sintonia + (d * 180 / Math.PI) / 38);
  });
  const soltarBotao = () => { if (giro.ativo) { giro.ativo = false; assentar(); } };
  botao.addEventListener('pointerup', soltarBotao);
  botao.addEventListener('pointercancel', soltarBotao);

  /* teclado: o dial é um slider */
  dial.addEventListener('keydown', (e) => {
    const atual = Math.round(estado.sintonia);
    const mapa = { ArrowRight: atual + 1, ArrowUp: atual + 1, ArrowLeft: atual - 1, ArrowDown: atual - 1, Home: 0, End: N - 1, PageUp: atual + 3, PageDown: atual - 3 };
    if (!(e.key in mapa)) return;
    e.preventDefault();
    chiado.iniciar();
    irPara(Math.max(0, Math.min(N - 1, mapa[e.key])));
  });

  $('[data-som]').addEventListener('click', (e) => {
    const ligado = chiado.alternar();
    e.currentTarget.setAttribute('aria-pressed', String(ligado));
    $('b', e.currentTarget).textContent = ligado ? 'ligado' : 'desligado';
  });

  /* ================================================================== */
  /* Estação sintonizada → estante                                      */
  /* ================================================================== */
  function sintonizar(i) {
    const mudou = i !== estado.estacao;
    estado.estacao = i;
    const e = ESTACOES[i];
    dial.setAttribute('aria-valuenow', i);
    dial.setAttribute('aria-valuetext', `${e.nome}, ${e.khz} quilohertz`);
    rotEstacao.textContent = `Sintonizado: ${e.nome}`;
    document.documentElement.style.setProperty('--cor-estacao', e.cor);
    if (mudou || !$('[data-capas]').children.length) renderEstante(true);
  }

  const capas = $('[data-capas]');
  function filtrados() {
    const e = ESTACOES[estado.estacao];
    const q = sem(estado.busca);
    const lista = DISCOS.filter((d) => (q ? true : (!e.genero || d.genero === e.genero))
      && (!estado.filtroEstado || d.estado === estado.filtroEstado)
      && (!q || sem(`${d.titulo} ${d.artista} ${d.genero} ${d.faixas.join(' ')}`).includes(q)));
    const ord = { chegada: (a, b) => a.chegou - b.chegou, menor: (a, b) => a.preco - b.preco, maior: (a, b) => b.preco - a.preco, antigo: (a, b) => a.ano - b.ano }[estado.ordem];
    return lista.sort(ord);
  }

  function renderEstante(animar) {
    const e = ESTACOES[estado.estacao];
    const lista = filtrados();
    $('[data-estante-titulo]').textContent = estado.busca ? `Procura: “${estado.busca}”` : e.nome;
    $('[data-estante-info]').textContent = `${lista.length} ${lista.length === 1 ? 'disco' : 'discos'}${estado.busca ? ' em todas as estações' : ` · ${e.khz} kHz`}`;
    capas.replaceChildren(...lista.map((d, i) => {
      const li = document.createElement('li');
      li.className = `capa${estado.disco && estado.disco.id === d.id ? ' is-escolhida' : ''}`;
      li.dataset.id = d.id;
      li.innerHTML = `<button type="button" class="capa__btn"><span class="capa__arte">${capa(d)}<span class="capa__preco"></span>${d.nota.includes('raro') ? '<span class="capa__raro">raro</span>' : ''}</span><span class="capa__titulo"></span><span class="capa__artista"></span></button>`;
      const b = $('button', li);
      if (animar && !reduz) b.style.setProperty('--i', i); else b.style.animation = 'none';
      $('.capa__preco', li).textContent = precoCurto(d.preco);
      $('.capa__titulo', li).textContent = d.titulo;
      $('.capa__artista', li).textContent = `${d.artista} · ${d.ano}`;
      b.setAttribute('aria-label', `${d.titulo}, ${d.artista}, ${d.ano}, ${d.estado === 'Novo' ? 'novo' : `usado ${d.nota}`}, ${precoCurto(d.preco)}. Pôr no prato.`);
      if (estado.disco && estado.disco.id === d.id) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', () => escolher(d.id, { rolar: true }));
      return li;
    }));
    const vazio = $('[data-vazio]');
    vazio.hidden = lista.length > 0;
    if (!lista.length) {
      vazio.textContent = estado.busca ? `Nenhum disco com “${estado.busca}”.` : 'Nenhum disco nesta estação com esse filtro.';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tecla tecla--pequena'; b.textContent = 'Limpar';
      b.addEventListener('click', () => { estado.busca = ''; $('#busca').value = ''; definirEstado(''); renderEstante(true); });
      vazio.append(b);
    }
    capas.scrollLeft = 0;
  }

  // setas entre as capas
  capas.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const bs = $$('.capa__btn', capas);
    const i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    bs[Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))].focus();
  });

  function definirEstado(v) {
    estado.filtroEstado = v;
    $$('[data-estado] [role="radio"]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.valor === v)));
  }
  $$('[data-estado] [role="radio"]').forEach((b) => b.addEventListener('click', () => { definirEstado(b.dataset.valor); renderEstante(true); }));
  $('[data-ordem]').addEventListener('change', (e) => { estado.ordem = e.target.value; renderEstante(true); });

  const busca = $('#busca');
  let atrasoBusca;
  busca.addEventListener('input', () => { clearTimeout(atrasoBusca); atrasoBusca = setTimeout(() => { estado.busca = busca.value.trim(); renderEstante(true); }, 180); });
  $('[data-busca]').addEventListener('submit', (e) => { e.preventDefault(); estado.busca = busca.value.trim(); renderEstante(true); capas.querySelector('.capa__btn')?.focus(); });

  /* ================================================================== */
  /* Toca-discos e ficha                                                */
  /* ================================================================== */
  const vinil = $('[data-vinil]');
  const braco = $('[data-braco]');
  const btnOuvir = $('[data-ouvir]');
  const falante = $('.falante');
  let timerAgulha;

  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return .2126 * r + .7152 * g + .0722 * b; };

  function escolher(id, { rolar = false, silencioso = false } = {}) {
    const d = porId.get(id);
    if (!d) return;
    if (estado.disco && estado.disco.id !== id) pararSom();
    estado.disco = d;
    estado.qtd = 1;
    history.replaceState(null, '', `#disco/${d.id}`);

    // disco no prato
    vinil.style.setProperty('--selo', d.cores[1]);
    vinil.style.setProperty('--selo-2', d.cores[2]);
    vinil.style.setProperty('--selo-txt', lum(d.cores[1]) > .45 ? '#111' : '#F6EBD3');
    $('[data-selo-txt]').textContent = `${d.artista} · ${d.titulo}`;
    const encostada = $('[data-capa-encostada]');
    encostada.innerHTML = capa(d);
    if (!silencioso && !reduz) {
      vinil.classList.remove('is-caindo'); encostada.classList.remove('is-entrando');
      void vinil.offsetWidth;
      vinil.classList.add('is-caindo'); encostada.classList.add('is-entrando');
    }

    // ficha
    const ficha = $('[data-ficha]');
    ficha.style.setProperty('--cor-estacao', ESTACOES[estacaoDe(d.genero)].cor);
    $('[data-meta]').textContent = `${d.genero} · ${d.ano} · selo ${d.selo} · ${d.id.toUpperCase()}`;
    $('[data-titulo]').textContent = d.titulo;
    $('[data-artista]').textContent = d.artista;
    $('[data-estado-txt]').textContent = d.estado === 'Novo' ? `Novo, lacrado. ${d.nota}.` : `Usado, ${d.nota}. Lavado e ouvido inteiro antes de entrar na radiola.`;
    $('[data-preco]').textContent = brl(d.preco);
    $('[data-faixas]').replaceChildren(...d.faixas.map((f, i) => {
      const li = document.createElement('li');
      const meio = d.faixas.length / 2;
      li.innerHTML = '<span class="faixa__n"></span><span></span>';
      li.firstChild.textContent = i < meio ? `A${i + 1}` : `B${i + 1 - meio}`;
      li.lastChild.textContent = f;
      return li;
    }));
    atualizarFicha();

    $$('.capa', capas).forEach((li) => {
      const sel = li.dataset.id === id;
      li.classList.toggle('is-escolhida', sel);
      const b = $('button', li);
      if (sel) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    if (rolar && matchMedia('(max-width: 980px)').matches) $('.toca').scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' });
  }

  function atualizarFicha() {
    const d = estado.disco;
    if (!d) return;
    const noCarrinho = carrinho.qtdDe(d.id);
    const resta = d.estoque - noCarrinho;
    estado.qtd = Math.max(1, Math.min(estado.qtd, Math.max(1, resta)));
    $('[data-qtd-valor]').textContent = estado.qtd;
    $('[data-menos]').disabled = estado.qtd <= 1;
    $('[data-mais]').disabled = estado.qtd >= resta;
    const levar = $('[data-levar]');
    levar.disabled = resta <= 0;
    levar.textContent = resta <= 0 ? 'Todas as cópias na sacola' : 'Pôr na sacola';
    $('[data-estoque]').textContent = d.estoque === 1
      ? (noCarrinho ? 'Cópia única, já está na sua sacola.' : 'Cópia única.')
      : `${d.estoque} cópias${noCarrinho ? `, ${noCarrinho} na sua sacola` : ''}.`;
  }
  $('[data-menos]').addEventListener('click', () => { estado.qtd--; atualizarFicha(); });
  $('[data-mais]').addEventListener('click', () => { estado.qtd++; atualizarFicha(); });

  /* O ângulo em que a agulha cai depende do tamanho do prato na tela.
   * Mede o braço em 0°, e procura o giro que põe a cabeça a ~70% do raio do disco. */
  function calibrarBraco() {
    const tocando = braco.classList.contains('is-no-disco');
    braco.style.transition = 'none';
    braco.style.transform = 'rotate(0deg)';
    const rb = braco.getBoundingClientRect();
    const rc = $('.braco__cabeca', braco).getBoundingClientRect();
    const rv = vinil.getBoundingClientRect();
    braco.style.transform = '';
    void braco.offsetWidth;
    braco.style.transition = '';
    const px = rb.left + rb.width / 2; const py = rb.top + rb.height / 2;
    const vx = rc.left + rc.width / 2 - px; const vy = rc.top + rc.height / 2 - py;
    const cx = rv.left + rv.width / 2; const cy = rv.top + rv.height / 2;
    const alvo = (rv.width / 2) * 0.7;
    let melhor = -4; let erro = Infinity;
    for (let g = -40; g <= 45; g += 0.5) {
      const a = (g * Math.PI) / 180;
      const hx = px + vx * Math.cos(a) - vy * Math.sin(a);
      const hy = py + vx * Math.sin(a) + vy * Math.cos(a);
      const e = Math.abs(Math.hypot(hx - cx, hy - cy) - alvo);
      if (e < erro) { erro = e; melhor = g; }
    }
    braco.style.setProperty('--no-disco', `${melhor}deg`);
    if (tocando) braco.classList.add('is-no-disco');
  }
  let largToca = 0;
  new ResizeObserver(() => { const w = $('.toca').clientWidth; if (Math.abs(w - largToca) > 2) { largToca = w; calibrarBraco(); } }).observe($('.toca'));

  /* som: o braço desce, a agulha encosta e o trecho começa */
  function pararSom() {
    clearTimeout(timerAgulha);
    AGULHA.parar();
    voltarBraco();
  }
  function voltarBraco() {
    braco.classList.remove('is-no-disco');
    vinil.classList.remove('is-tocando');
    falante.classList.remove('is-tocando');
    btnOuvir.classList.remove('is-tocando');
    $('[data-ouvir-rot]').textContent = 'Ouvir trecho';
  }
  btnOuvir.addEventListener('click', () => {
    const d = estado.disco;
    if (!d) return;
    if (btnOuvir.classList.contains('is-tocando')) { pararSom(); return; }
    btnOuvir.classList.add('is-tocando');
    $('[data-ouvir-rot]').textContent = 'Parar';
    vinil.classList.remove('is-caindo');
    vinil.classList.add('is-tocando');
    braco.classList.add('is-no-disco');
    timerAgulha = setTimeout(() => {
      const ok = AGULHA.tocar(d, voltarBraco);
      if (!ok) { voltarBraco(); $('[data-ouvir-rot]').textContent = 'Seu navegador não toca o trecho'; return; }
      falante.classList.add('is-tocando');
    }, reduz ? 0 : 750);
  });

  /* ================================================================== */
  /* Sacola                                                             */
  /* ================================================================== */
  const gaveta = $('[data-carrinho]');
  const aviso = $('[data-aviso]');
  const btnSacola = $('.sacola-btn');
  let ultimoFrete = null;

  $('[data-levar]').addEventListener('click', () => {
    const d = estado.disco;
    const entrou = carrinho.adicionar(d.id, estado.qtd);
    mostrarAviso(entrou > 0 ? `${d.titulo}${entrou > 1 ? ` (${entrou})` : ''} foi para a sacola.` : `Não há mais cópias de ${d.titulo}.`);
    if (entrou > 0 && !reduz) { btnSacola.classList.remove('is-pulo'); void btnSacola.offsetWidth; btnSacola.classList.add('is-pulo'); }
  });

  let timerAviso;
  function mostrarAviso(txt) {
    $('[data-aviso-texto]').textContent = txt;
    aviso.hidden = false;
    aviso.classList.remove('is-saindo');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { aviso.classList.add('is-saindo'); setTimeout(() => { aviso.hidden = true; }, 300); }, 3800);
  }

  function renderCarrinho() {
    const itens = carrinho.itens();
    const n = carrinho.quantidade();
    $('[data-contador]').textContent = n;
    btnSacola.setAttribute('aria-label', n ? `Abrir sacola, ${n} ${n === 1 ? 'disco' : 'discos'}` : 'Abrir sacola, vazia');
    $('[data-carrinho-vazio]').hidden = itens.length > 0;
    $('[data-carrinho-rodape]').hidden = itens.length === 0;
    $('[data-itens]').replaceChildren(...itens.map(({ disco: d, qtd }) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `<div class="item__capa">${capa(d, { comTexto: false })}</div>
        <div class="item__info"><b></b><span></span><div class="qtd qtd--mini"><button type="button" data-a="menos">−</button><output></output><button type="button" data-a="mais">+</button></div></div>
        <div class="item__fim"><span class="item__preco"></span><button type="button" class="item__remover" data-a="remover">Remover</button></div>`;
      $('b', li).textContent = d.titulo;
      $('.item__info span', li).textContent = d.artista;
      $('output', li).textContent = qtd;
      const menos = $('[data-a="menos"]', li); const mais = $('[data-a="mais"]', li);
      menos.setAttribute('aria-label', `Diminuir ${d.titulo}`);
      mais.setAttribute('aria-label', `Aumentar ${d.titulo}`);
      mais.disabled = qtd >= d.estoque;
      $('.item__preco', li).textContent = brl(d.preco * qtd);
      $('[data-a="remover"]', li).setAttribute('aria-label', `Remover ${d.titulo}`);
      menos.addEventListener('click', () => carrinho.alterar(d.id, qtd - 1));
      mais.addEventListener('click', () => carrinho.alterar(d.id, qtd + 1));
      $('[data-a="remover"]', li).addEventListener('click', () => carrinho.remover(d.id));
      return li;
    }));
    const sub = carrinho.subtotal();
    $('[data-subtotal]').textContent = brl(sub);
    const falta = AGULHA.FRETE_GRATIS - sub;
    $('[data-dica-frete]').textContent = falta > 0 ? `Faltam ${brl(falta)} para o PAC grátis.` : 'PAC grátis para este pedido.';
    if (ultimoFrete) mostrarFrete(ultimoFrete);
  }

  function abrirCarrinho() { aviso.hidden = true; renderCarrinho(); gaveta.showModal(); }
  $$('[data-abrir-carrinho]').forEach((b) => b.addEventListener('click', abrirCarrinho));
  $$('[data-fechar]', gaveta).forEach((b) => b.addEventListener('click', () => gaveta.close()));
  gaveta.addEventListener('click', (e) => { if (e.target === gaveta) gaveta.close(); });

  const cepInput = $('#cep-gaveta');
  const msgFrete = $('[data-frete-msg]');
  cepInput.addEventListener('input', () => { cepInput.value = AGULHA.mascaraCep(cepInput.value); });
  function mostrarFrete(local) {
    const opcoes = AGULHA.opcoesDeFrete(local.uf, carrinho.quantidade(), carrinho.subtotal());
    msgFrete.textContent = `${[local.bairro, local.cidade].filter(Boolean).join(', ')} · ${local.uf}`;
    $('[data-frete-opcoes]').replaceChildren(...opcoes.map((o) => {
      const li = document.createElement('li');
      li.innerHTML = '<span><b></b> <small></small></span><span class="frete__preco"></span>';
      $('b', li).textContent = o.nome;
      $('small', li).textContent = o.prazo;
      $('.frete__preco', li).textContent = o.preco === 0 ? 'Grátis' : brl(o.preco);
      return li;
    }));
  }
  $('[data-frete]').addEventListener('submit', async (e) => {
    e.preventDefault();
    msgFrete.textContent = 'Consultando o CEP…';
    msgFrete.classList.remove('is-erro');
    $('[data-frete-opcoes]').replaceChildren();
    try {
      ultimoFrete = await AGULHA.buscarCep(cepInput.value);
      try { sessionStorage.setItem('agulha:cep', JSON.stringify(ultimoFrete)); } catch { /* sem armazenamento */ }
      mostrarFrete(ultimoFrete);
    } catch (err) {
      ultimoFrete = null;
      msgFrete.textContent = err.message;
      msgFrete.classList.add('is-erro');
    }
  });

  window.addEventListener('carrinho:mudou', () => { renderCarrinho(); atualizarFicha(); });

  /* ================================================================== */
  /* Início: varredura do dial até a estação do disco da vez            */
  /* ================================================================== */
  function abrirPeloLink() {
    const m = location.hash.match(/^#disco\/(agl-\d{3})$/);
    return m && porId.has(m[1]) ? m[1] : null;
  }
  window.addEventListener('hashchange', () => {
    const id = abrirPeloLink();
    if (!id || (estado.disco && estado.disco.id === id)) return;
    irPara(estacaoDe(porId.get(id).genero), { aoFim: () => escolher(id) });
  });

  let largAnterior = 0;
  new ResizeObserver(() => { if (Math.abs(vidro.clientWidth - largAnterior) > 2) { largAnterior = vidro.clientWidth; medir(); } }).observe(vidro);

  const idInicial = abrirPeloLink() || 'agl-008';
  const alvo = estacaoDe(porId.get(idInicial).genero);
  medir();
  definir(0);
  escolher(idInicial, { silencioso: true });
  renderCarrinho();
  if (reduz) irPara(alvo, { instantaneo: true });
  else { sintonizar(0); setTimeout(() => irPara(alvo), 450); }
})();
