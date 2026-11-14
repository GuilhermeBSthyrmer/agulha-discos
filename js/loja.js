/* Agulha Discos — página da loja
 * Caixote com filtros, busca e ordenação; detalhe do disco com link próprio
 * (#disco/agl-001); carrinho em gaveta; frete pelo CEP.
 */
(() => {
  'use strict';

  const { DISCOS, GENEROS, carrinho, capa, brl } = AGULHA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const porId = new Map(DISCOS.map((d) => [d.id, d]));
  const sem = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const precoCurto = (n) => `R$ ${n.toLocaleString('pt-BR')}`;

  /* ---------------- estado dos filtros ---------------- */
  const filtro = { genero: '', estado: '', ordem: 'chegada', busca: '' };

  /* ---------------- vinil: cor do selo ---------------- */
  function pintarVinil(el, d) {
    el.style.setProperty('--selo', d.cores[1]);
    el.style.setProperty('--selo-2', d.cores[2]);
  }

  /* ---------------- disco da semana ---------------- */
  const destaque = porId.get('agl-008');
  const vinilDestaque = $('[data-vinil-destaque]');
  $('[data-capa-destaque]').innerHTML = capa(destaque);
  pintarVinil(vinilDestaque, destaque);
  $('[data-titulo-destaque]').textContent = destaque.titulo;
  $('[data-artista-destaque]').textContent = `${destaque.artista} · ${destaque.ano} · ${destaque.estado} ${destaque.nota}`;
  $('[data-preco-destaque]').textContent = precoCurto(destaque.preco);
  $('[data-add-destaque]').addEventListener('click', () => adicionar(destaque.id, 1));
  const btnOuvirDestaque = $('[data-ouvir-destaque]');
  btnOuvirDestaque.addEventListener('click', () => alternarSom(destaque, btnOuvirDestaque, [vinilDestaque]));

  /* ---------------- som ---------------- */
  function alternarSom(d, botao, vinis) {
    const rotulo = $('span', botao);
    if (AGULHA.tocandoId() === d.id) { AGULHA.parar(); return; }
    const ok = AGULHA.tocar(d, () => {
      rotulo.textContent = 'Ouvir trecho';
      botao.classList.remove('is-tocando');
      vinis.forEach((v) => v.classList.remove('is-tocando'));
    });
    if (!ok) { rotulo.textContent = 'Seu navegador não toca o trecho'; return; }
    rotulo.textContent = 'Parar';
    botao.classList.add('is-tocando');
    vinis.forEach((v) => v.classList.add('is-tocando'));
  }

  /* ---------------- divisórias de gênero ---------------- */
  const divisorias = $('[data-divisorias]');
  const contaGenero = (g) => DISCOS.filter((d) => !g || d.genero === g).length;
  ['', ...GENEROS].forEach((g, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === 0));
    b.tabIndex = i === 0 ? 0 : -1;
    b.dataset.genero = g;
    b.className = 'divisoria';
    b.innerHTML = `<span class="divisoria__nome"></span><span class="divisoria__n"></span>`;
    $('.divisoria__nome', b).textContent = g || 'Tudo';
    $('.divisoria__n', b).textContent = contaGenero(g);
    b.addEventListener('click', () => escolherGenero(b));
    divisorias.append(b);
  });
  function escolherGenero(b) {
    $$('.divisoria', divisorias).forEach((x) => { const s = x === b; x.setAttribute('aria-selected', String(s)); x.tabIndex = s ? 0 : -1; });
    filtro.genero = b.dataset.genero;
    render();
  }
  divisorias.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const todas = $$('.divisoria', divisorias);
    const i = todas.indexOf(document.activeElement);
    let j = e.key === 'Home' ? 0 : e.key === 'End' ? todas.length - 1 : i + (e.key === 'ArrowRight' ? 1 : -1);
    j = (j + todas.length) % todas.length;
    todas[j].focus();
    escolherGenero(todas[j]);
  });

  /* ---------------- estado e ordem ---------------- */
  const grupoEstado = $('[data-estado]');
  $$('[role="radio"]', grupoEstado).forEach((b) => b.addEventListener('click', () => {
    $$('[role="radio"]', grupoEstado).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    filtro.estado = b.dataset.valor;
    render();
  }));
  $('[data-ordem]').addEventListener('change', (e) => { filtro.ordem = e.target.value; render(); });

  /* ---------------- busca ---------------- */
  const busca = $('#busca');
  let atraso;
  busca.addEventListener('input', () => {
    clearTimeout(atraso);
    atraso = setTimeout(() => { filtro.busca = busca.value.trim(); render(); }, 160);
  });
  $('[data-busca]').addEventListener('submit', (e) => {
    e.preventDefault();
    filtro.busca = busca.value.trim();
    render();
    $('#caixote').scrollIntoView({ behavior: 'smooth' });
  });

  $('[data-limpar-filtros]').addEventListener('click', () => {
    filtro.genero = ''; filtro.estado = ''; filtro.busca = ''; busca.value = '';
    escolherGenero($('.divisoria', divisorias));
    $$('[role="radio"]', grupoEstado).forEach((x, i) => x.setAttribute('aria-checked', String(i === 0)));
  });

  /* ---------------- grade ---------------- */
  const grade = $('[data-grade]');
  const vazio = $('[data-vazio]');

  function filtrados() {
    const q = sem(filtro.busca);
    const lista = DISCOS.filter((d) => (!filtro.genero || d.genero === filtro.genero)
      && (!filtro.estado || d.estado === filtro.estado)
      && (!q || sem(`${d.titulo} ${d.artista} ${d.genero} ${d.faixas.join(' ')}`).includes(q)));
    const ord = {
      chegada: (a, b) => a.chegou - b.chegou,
      menor: (a, b) => a.preco - b.preco,
      maior: (a, b) => b.preco - a.preco,
      antigo: (a, b) => a.ano - b.ano,
      az: (a, b) => a.artista.localeCompare(b.artista, 'pt-BR'),
    }[filtro.ordem];
    return lista.sort(ord);
  }

  function cartao(d) {
    const li = document.createElement('li');
    li.className = 'disco';
    li.innerHTML = `
      <a class="disco__link" href="#disco/${d.id}">
        <div class="disco__palco">
          <div class="vinil" aria-hidden="true"><span class="vinil__selo"></span></div>
          <div class="disco__capa">${capa(d)}</div>
          <span class="etiqueta"></span>
          ${d.nota.includes('raro') ? '<span class="carimbo-raro">raro</span>' : ''}
        </div>
        <h3 class="disco__titulo"></h3>
        <p class="disco__artista"></p>
        <p class="disco__meta"></p>
      </a>
      <button type="button" class="disco__add" aria-label="">Adicionar</button>`;
    pintarVinil($('.vinil', li), d);
    $('.etiqueta', li).textContent = precoCurto(d.preco);
    $('.disco__titulo', li).textContent = d.titulo;
    $('.disco__artista', li).textContent = d.artista;
    $('.disco__meta', li).textContent = `${d.ano} · ${d.estado === 'Novo' ? 'Novo' : `Usado ${d.nota.replace(', raro', '')}`}`;
    const add = $('.disco__add', li);
    add.setAttribute('aria-label', `Adicionar ${d.titulo} ao carrinho`);
    add.addEventListener('click', () => adicionar(d.id, 1));
    atualizarBotaoAdd(add, d);
    li.dataset.id = d.id;
    return li;
  }

  function atualizarBotaoAdd(btn, d) {
    const esgotou = carrinho.qtdDe(d.id) >= d.estoque;
    btn.disabled = esgotou;
    btn.textContent = esgotou ? 'Tudo no carrinho' : 'Adicionar';
  }

  function render() {
    const lista = filtrados();
    grade.replaceChildren(...lista.map(cartao));
    vazio.hidden = lista.length > 0;
    const partes = [];
    if (filtro.busca) partes.push(`“${filtro.busca}”`);
    if (filtro.genero) partes.push(filtro.genero);
    if (filtro.estado) partes.push(filtro.estado === 'Novo' ? 'novos' : 'usados');
    $('[data-vazio-texto]').textContent = `Nenhum disco ${partes.length ? 'para ' + partes.join(', ') : 'por aqui'}.`;
    $('[data-contagem]').textContent = `${lista.length} ${lista.length === 1 ? 'disco' : 'discos'}`;
  }

  /* ---------------- detalhe ---------------- */
  const dlg = $('[data-detalhe]');
  const vinilDetalhe = $('[data-vinil-detalhe]');
  const btnOuvirDetalhe = $('[data-ouvir-detalhe]');
  let discoAberto = null;
  let qtdEscolhida = 1;
  let abertoPorClique = false;

  function abrirDetalhe(id) {
    const d = porId.get(id);
    if (!d) return;
    if (discoAberto && discoAberto.id !== d.id) AGULHA.parar();
    discoAberto = d;
    qtdEscolhida = 1;
    $('[data-capa-detalhe]').innerHTML = capa(d);
    pintarVinil(vinilDetalhe, d);
    $('[data-meta-detalhe]').textContent = `${d.genero} · ${d.ano} · selo ${d.selo} · ${d.id.toUpperCase()}`;
    $('[data-titulo-detalhe]').textContent = d.titulo;
    $('[data-artista-detalhe]').textContent = d.artista;
    $('[data-estado-detalhe]').textContent = d.estado === 'Novo' ? `Novo, lacrado. ${d.nota}.` : `Usado, ${d.nota}. Lavado e ouvido inteiro antes de entrar no caixote.`;
    $('[data-preco-detalhe]').textContent = precoCurto(d.preco);
    const faixas = $('[data-faixas]');
    faixas.replaceChildren(...d.faixas.map((f, i) => {
      const li = document.createElement('li');
      const lado = i < d.faixas.length / 2 ? 'A' : 'B';
      const n = lado === 'A' ? i + 1 : i + 1 - d.faixas.length / 2;
      li.innerHTML = '<span class="faixa__n"></span><span class="faixa__nome"></span>';
      $('.faixa__n', li).textContent = `${lado}${n}`;
      $('.faixa__nome', li).textContent = f;
      return li;
    }));
    atualizarDetalhe();
    if (!dlg.open) dlg.showModal();
  }

  function atualizarDetalhe() {
    if (!discoAberto) return;
    const d = discoAberto;
    const noCarrinho = carrinho.qtdDe(d.id);
    const resta = d.estoque - noCarrinho;
    qtdEscolhida = Math.max(1, Math.min(qtdEscolhida, Math.max(1, resta)));
    $('[data-qtd-valor]').textContent = qtdEscolhida;
    $('[data-menos]').disabled = qtdEscolhida <= 1;
    $('[data-mais]').disabled = qtdEscolhida >= resta;
    const add = $('[data-add-detalhe]');
    add.disabled = resta <= 0;
    add.textContent = resta <= 0 ? 'Todas as cópias estão no carrinho' : 'Adicionar ao carrinho';
    $('[data-estoque-detalhe]').textContent = d.estoque === 1
      ? (noCarrinho ? 'Cópia única, já está no seu carrinho.' : 'Cópia única.')
      : `${d.estoque} cópias${noCarrinho ? `, ${noCarrinho} no seu carrinho` : ''}.`;
    const tocando = AGULHA.tocandoId() === d.id;
    $('span', btnOuvirDetalhe).textContent = tocando ? 'Parar' : 'Ouvir trecho';
  }

  $('[data-menos]').addEventListener('click', () => { qtdEscolhida--; atualizarDetalhe(); });
  $('[data-mais]').addEventListener('click', () => { qtdEscolhida++; atualizarDetalhe(); });
  $('[data-add-detalhe]').addEventListener('click', () => { adicionar(discoAberto.id, qtdEscolhida); });
  btnOuvirDetalhe.addEventListener('click', () => alternarSom(discoAberto, btnOuvirDetalhe, [vinilDetalhe]));

  $('[data-fechar]', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    if (AGULHA.tocandoId() === discoAberto?.id) AGULHA.parar();
    if (location.hash.startsWith('#disco/')) {
      if (abertoPorClique) history.back();
      else history.replaceState(null, '', location.pathname + location.search);
    }
    abertoPorClique = false;
  });

  grade.addEventListener('click', (e) => {
    if (e.target.closest('.disco__link')) abertoPorClique = true;
  });

  function rotear() {
    const m = location.hash.match(/^#disco\/(agl-\d{3})$/);
    if (m && porId.has(m[1])) abrirDetalhe(m[1]);
    else if (dlg.open) { abertoPorClique = false; dlg.close(); }
  }
  window.addEventListener('hashchange', rotear);

  /* ---------------- carrinho (gaveta) ---------------- */
  const gaveta = $('[data-carrinho]');
  const listaItens = $('[data-itens]');
  const aviso = $('[data-aviso]');
  let ultimoFrete = null;

  function adicionar(id, qtd) {
    const d = porId.get(id);
    const entrou = carrinho.adicionar(id, qtd);
    const txt = entrou > 0
      ? `${d.titulo} ${entrou > 1 ? `(${entrou})` : ''} foi para o carrinho.`
      : `Não há mais cópias de ${d.titulo} para adicionar.`;
    mostrarAviso(txt.replace(/\s+/g, ' '));
  }

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
    $$('[data-contador]').forEach((c) => { c.textContent = n; c.hidden = n === 0; });
    $('[data-abrir-carrinho]').setAttribute('aria-label', n ? `Abrir carrinho, ${n} ${n === 1 ? 'disco' : 'discos'}` : 'Abrir carrinho, vazio');
    $('[data-carrinho-vazio]').hidden = itens.length > 0;
    $('[data-carrinho-rodape]').hidden = itens.length === 0;
    listaItens.replaceChildren(...itens.map(({ disco: d, qtd }) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `
        <div class="item__capa">${capa(d, { comTexto: false })}</div>
        <div class="item__info"><b></b><span></span>
          <div class="qtd qtd--mini">
            <button type="button" data-a="menos"></button><output></output><button type="button" data-a="mais"></button>
          </div>
        </div>
        <div class="item__fim"><span class="item__preco"></span><button type="button" class="item__remover" data-a="remover">Remover</button></div>`;
      $('b', li).textContent = d.titulo;
      $('.item__info span', li).textContent = d.artista;
      $('output', li).textContent = qtd;
      const menos = $('[data-a="menos"]', li);
      const mais = $('[data-a="mais"]', li);
      menos.textContent = '−'; mais.textContent = '+';
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

  function abrirCarrinho() {
    aviso.hidden = true;
    if (dlg.open) dlg.close();
    renderCarrinho();
    gaveta.showModal();
  }
  $$('[data-abrir-carrinho]').forEach((b) => b.addEventListener('click', abrirCarrinho));
  $$('[data-fechar]', gaveta).forEach((b) => b.addEventListener('click', () => gaveta.close()));
  gaveta.addEventListener('click', (e) => { if (e.target === gaveta) gaveta.close(); });

  /* frete na gaveta */
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

  window.addEventListener('carrinho:mudou', () => {
    renderCarrinho();
    $$('.disco', grade).forEach((li) => atualizarBotaoAdd($('.disco__add', li), porId.get(li.dataset.id)));
    atualizarDetalhe();
  });

  /* ---------------- início ---------------- */
  render();
  renderCarrinho();
  rotear();
})();
