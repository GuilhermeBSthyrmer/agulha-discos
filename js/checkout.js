/* Agulha Discos — checkout
 * Contato, endereço pelo ViaCEP, escolha do frete e Pix de demonstração.
 */
(() => {
  'use strict';

  const { carrinho, brl, capa } = AGULHA;
  const $ = (s, r = document) => r.querySelector(s);

  const form = $('[data-form]');
  const campos = {
    nome: $('#nome'), email: $('#email'), fone: $('#fone'), cep: $('#cep'), rua: $('#rua'),
    numero: $('#numero'), complemento: $('#complemento'), bairro: $('#bairro'), cidade: $('#cidade'), uf: $('#uf'),
  };
  let local = null;      // resultado do ViaCEP
  let freteEscolhido = null;

  /* ---------------- carrinho vazio ---------------- */
  if (carrinho.quantidade() === 0) {
    $('[data-checkout]').hidden = true;
    $('[data-vazio]').hidden = false;
    return;
  }

  /* ---------------- resumo ---------------- */
  function renderResumo() {
    const lista = $('[data-resumo-itens]');
    lista.replaceChildren(...carrinho.itens().map(({ disco: d, qtd }) => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="resumo__capa">${capa(d, { comTexto: false })}</div><div><b></b><span></span></div><span class="resumo__preco"></span>`;
      $('b', li).textContent = d.titulo;
      $('div > span', li).textContent = `${d.artista}${qtd > 1 ? ` · ${qtd} cópias` : ''}`;
      $('.resumo__preco', li).textContent = brl(d.preco * qtd);
      return li;
    }));
    const sub = carrinho.subtotal();
    $('[data-r-subtotal]').textContent = brl(sub);
    $('[data-r-frete]').textContent = freteEscolhido ? (freteEscolhido.preco ? brl(freteEscolhido.preco) : 'Grátis') : 'a calcular';
    $('[data-r-total]').textContent = brl(sub + (freteEscolhido ? freteEscolhido.preco : 0));
  }

  /* ---------------- máscaras ---------------- */
  campos.fone.addEventListener('input', () => {
    const d = campos.fone.value.replace(/\D/g, '').slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    campos.fone.value = v;
  });

  /* ---------------- erros ---------------- */
  function erro(nome, msg) {
    const input = campos[nome];
    const p = $(`#erro-${nome}`);
    if (p) p.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg && p) input.setAttribute('aria-describedby', p.id); else input.removeAttribute('aria-describedby');
    return !msg;
  }

  /* ---------------- CEP ---------------- */
  const status = $('[data-cep-status]');
  let consultaAtual = 0;
  async function consultarCep() {
    const n = campos.cep.value.replace(/\D/g, '');
    if (n.length !== 8) return;
    const minha = ++consultaAtual;
    status.textContent = 'Consultando…';
    status.className = 'cep__status is-carregando';
    try {
      const r = await AGULHA.buscarCep(n);
      if (minha !== consultaAtual) return;
      local = r;
      campos.rua.value = r.rua; campos.bairro.value = r.bairro; campos.cidade.value = r.cidade; campos.uf.value = r.uf;
      status.textContent = `${r.cidade} · ${r.uf}`;
      status.className = 'cep__status is-ok';
      erro('cep', '');
      ['rua', 'bairro'].forEach((c) => { if (campos[c].value) erro(c, ''); });
      try { sessionStorage.setItem('agulha:cep', JSON.stringify(r)); } catch { /* sem armazenamento */ }
      renderFretes();
      (r.rua ? campos.numero : campos.rua).focus();
    } catch (e) {
      if (minha !== consultaAtual) return;
      local = null;
      status.textContent = '';
      status.className = 'cep__status';
      erro('cep', e.message);
      renderFretes();
    }
  }
  campos.cep.addEventListener('input', () => {
    campos.cep.value = AGULHA.mascaraCep(campos.cep.value);
    if (campos.cep.value.replace(/\D/g, '').length === 8) consultarCep();
    else if (local) { local = null; freteEscolhido = null; renderFretes(); renderResumo(); }
  });

  /* ---------------- fretes ---------------- */
  function renderFretes() {
    const caixa = $('[data-fretes]');
    if (!local) {
      freteEscolhido = null;
      caixa.innerHTML = '<p class="fretes__dica">Informe o CEP para ver as opções de entrega.</p>';
      renderResumo();
      return;
    }
    const opcoes = AGULHA.opcoesDeFrete(local.uf, carrinho.quantidade(), carrinho.subtotal());
    if (!freteEscolhido || !opcoes.some((o) => o.id === freteEscolhido.id)) freteEscolhido = opcoes[0];
    else freteEscolhido = opcoes.find((o) => o.id === freteEscolhido.id);
    const grupo = document.createElement('div');
    grupo.className = 'fretes__grupo';
    grupo.setAttribute('role', 'radiogroup');
    grupo.setAttribute('aria-label', 'Forma de entrega');
    opcoes.forEach((o) => {
      const label = document.createElement('label');
      label.className = 'frete-op';
      label.innerHTML = '<input type="radio" name="frete"><span class="frete-op__nome"></span><span class="frete-op__prazo"></span><span class="frete-op__preco"></span>';
      const r = $('input', label);
      r.value = o.id;
      r.checked = o.id === freteEscolhido.id;
      r.addEventListener('change', () => { freteEscolhido = o; renderResumo(); });
      $('.frete-op__nome', label).textContent = o.nome;
      $('.frete-op__prazo', label).textContent = o.prazo;
      $('.frete-op__preco', label).textContent = o.preco ? brl(o.preco) : 'Grátis';
      grupo.append(label);
    });
    const nota = document.createElement('p');
    nota.className = 'fretes__dica';
    nota.textContent = 'Valores de frete de exemplo.';
    caixa.replaceChildren(grupo, nota);
    renderResumo();
  }

  /* ---------------- validação e envio ---------------- */
  function validar() {
    const v = Object.fromEntries(Object.entries(campos).map(([k, el]) => [k, el.value.trim()]));
    const ok = [
      erro('nome', v.nome.split(/\s+/).filter(Boolean).length < 2 ? 'Escreva nome e sobrenome.' : ''),
      erro('email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email) ? 'Confira o e-mail: falta o @ ou o domínio.' : ''),
      erro('fone', !/^\d{10,11}$/.test(v.fone.replace(/\D/g, '')) ? 'Informe o celular com DDD.' : ''),
      erro('cep', !local ? (v.cep ? 'Confira o CEP para calcularmos a entrega.' : 'Informe o CEP.') : ''),
      erro('rua', !v.rua ? 'Informe a rua.' : ''),
      erro('numero', !v.numero ? 'Informe o número. Sem número, escreva s/n.' : ''),
      erro('bairro', !v.bairro ? 'Informe o bairro.' : ''),
    ];
    return ok.every(Boolean);
  }
  Object.entries(campos).forEach(([k, el]) => el.addEventListener('blur', () => {
    if (el.getAttribute('aria-invalid') === 'true') validar();
  }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const geral = $('[data-erro-geral]');
    if (!validar() || !freteEscolhido) {
      geral.textContent = 'Faltam alguns dados. Os campos marcados explicam o quê.';
      const primeiro = $('[aria-invalid="true"]', form);
      if (primeiro) primeiro.focus();
      return;
    }
    geral.textContent = '';
    concluir();
  });

  function concluir() {
    const total = carrinho.subtotal() + freteEscolhido.preco;
    const d = new Date();
    const numero = `AGL-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const primeiro = campos.nome.value.trim().split(/\s+/)[0];
    $('[data-feito-titulo]').textContent = `Obrigado, ${primeiro}. Seu pedido é o ${numero}.`;
    const entrega = freteEscolhido.id === 'retirada'
      ? 'Você retira na loja em São Paulo'
      : `Entrega por ${freteEscolhido.nome} em ${freteEscolhido.prazo}, para ${campos.rua.value.trim()}, ${campos.numero.value.trim()}, ${campos.cidade.value}`;
    $('[data-feito-texto]').textContent = `Total de ${brl(total)}. ${entrega}. Assim que o Pix cair, os discos são embalados.`;
    $('[data-copia]').value = `DEMONSTRACAO-AGULHA-DISCOS-${numero}-SEM-VALOR-${total.toFixed(2)}`;
    $('[data-qr]').innerHTML = qrFalso(numero);
    carrinho.limpar();
    $('[data-checkout]').hidden = true;
    const feito = $('[data-feito]');
    feito.hidden = false;
    window.scrollTo({ top: 0 });
    feito.focus();
  }

  /** Desenha um padrão com cara de QR Code, só para a demonstração. */
  function qrFalso(semente) {
    let s = [...semente].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 9);
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const n = 25;
    let rects = '';
    const olho = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#0B1F18"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#FFFDF8"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#0B1F18"/>`;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const noOlho = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
        if (!noOlho && r() < .48) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="#0B1F18"/>`;
      }
    }
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#FFFDF8"/>${rects}${olho(0, 0)}${olho(n - 7, 0)}${olho(0, n - 7)}<rect x="9" y="9" width="7" height="7" fill="#FF7A1A"/><text x="12.5" y="13.6" text-anchor="middle" font-size="2.4" font-weight="800" fill="#0B1F18" font-family="system-ui">DEMO</text></svg>`;
  }

  $('[data-copiar]').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText($('[data-copia]').value); b.textContent = 'Copiado'; } catch { $('[data-copia]').select(); b.textContent = 'Selecionado, use Ctrl+C'; }
    setTimeout(() => { b.textContent = 'Copiar código'; }, 2000);
  });

  /* ---------------- início ---------------- */
  renderResumo();
  try {
    const salvo = JSON.parse(sessionStorage.getItem('agulha:cep') || 'null');
    if (salvo && salvo.cep) { campos.cep.value = AGULHA.mascaraCep(salvo.cep); consultarCep(); }
  } catch { /* nada salvo */ }
})();
