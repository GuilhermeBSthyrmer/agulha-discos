/* Carrinho compartilhado entre a loja e o checkout.
 * Guarda só { id, qtd } no localStorage e sempre recalcula preço a partir do
 * catálogo, para um valor adulterado no armazenamento não virar preço.
 */
window.AGULHA = window.AGULHA || {};

(() => {
  'use strict';

  const CHAVE = 'agulha:carrinho';
  const porId = new Map(AGULHA.DISCOS.map((d) => [d.id, d]));
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  AGULHA.brl = (n) => brl.format(n);

  function ler() {
    try {
      const bruto = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      if (!Array.isArray(bruto)) return [];
      // Descarta o que não existe mais no catálogo e corrige quantidades.
      return bruto
        .filter((i) => i && porId.has(i.id))
        .map((i) => ({ id: i.id, qtd: Math.max(1, Math.min(porId.get(i.id).estoque, Math.floor(Number(i.qtd)) || 1)) }));
    } catch {
      return [];
    }
  }
  let itens = ler();

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch { /* modo privado: segue só em memória */ }
    window.dispatchEvent(new CustomEvent('carrinho:mudou'));
  }

  AGULHA.carrinho = {
    itens: () => itens.map((i) => ({ ...i, disco: porId.get(i.id) })),
    quantidade: () => itens.reduce((s, i) => s + i.qtd, 0),
    subtotal: () => itens.reduce((s, i) => s + porId.get(i.id).preco * i.qtd, 0),
    qtdDe: (id) => itens.find((i) => i.id === id)?.qtd || 0,
    /** Devolve a quantidade que de fato entrou (limitada pelo estoque). */
    adicionar(id, qtd = 1) {
      const d = porId.get(id);
      if (!d) return 0;
      const atual = itens.find((i) => i.id === id);
      const antes = atual ? atual.qtd : 0;
      const depois = Math.min(d.estoque, antes + qtd);
      if (atual) atual.qtd = depois; else if (depois > 0) itens.push({ id, qtd: depois });
      salvar();
      return depois - antes;
    },
    alterar(id, qtd) {
      const d = porId.get(id);
      const atual = itens.find((i) => i.id === id);
      if (!d || !atual) return;
      if (qtd <= 0) { itens = itens.filter((i) => i.id !== id); } else { atual.qtd = Math.min(d.estoque, qtd); }
      salvar();
    },
    remover(id) { itens = itens.filter((i) => i.id !== id); salvar(); },
    limpar() { itens = []; salvar(); },
  };

  // Outra aba mexeu no carrinho.
  window.addEventListener('storage', (e) => { if (e.key === CHAVE) { itens = ler(); window.dispatchEvent(new CustomEvent('carrinho:mudou')); } });

  /* ---------------- frete (valores de exemplo) ---------------- */
  const REGIAO = {
    SP: 'Sudeste', RJ: 'Sudeste', MG: 'Sudeste', ES: 'Sudeste',
    PR: 'Sul', SC: 'Sul', RS: 'Sul',
    DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
    BA: 'Nordeste', SE: 'Nordeste', AL: 'Nordeste', PE: 'Nordeste', PB: 'Nordeste', RN: 'Nordeste', CE: 'Nordeste', PI: 'Nordeste', MA: 'Nordeste',
    PA: 'Norte', AP: 'Norte', AM: 'Norte', RR: 'Norte', AC: 'Norte', RO: 'Norte', TO: 'Norte',
  };
  const TABELA = {
    Sudeste: { pac: [18, 4], sedex: [32, 2] }, Sul: { pac: [24, 6], sedex: [41, 3] }, 'Centro-Oeste': { pac: [28, 7], sedex: [46, 3] },
    Nordeste: { pac: [32, 9], sedex: [54, 4] }, Norte: { pac: [38, 12], sedex: [62, 5] },
  };
  AGULHA.FRETE_GRATIS = 400;

  AGULHA.opcoesDeFrete = function opcoesDeFrete(uf, qtd, subtotal) {
    const t = TABELA[REGIAO[uf]];
    if (!t) return [];
    const extra = Math.max(0, qtd - 1) * 2;
    const pac = subtotal >= AGULHA.FRETE_GRATIS ? 0 : t.pac[0] + extra;
    return [
      { id: 'pac', nome: 'PAC', preco: pac, prazo: `${t.pac[1]} a ${t.pac[1] + 3} dias úteis` },
      { id: 'sedex', nome: 'SEDEX', preco: t.sedex[0] + extra, prazo: `${t.sedex[1]} a ${t.sedex[1] + 1} dias úteis` },
      ...(uf === 'SP' ? [{ id: 'retirada', nome: 'Retirar na loja', preco: 0, prazo: 'a partir de amanhã, em São Paulo' }] : []),
    ];
  };

  /** Consulta o ViaCEP. Devolve { rua, bairro, cidade, uf } ou lança erro com mensagem para a pessoa. */
  AGULHA.buscarCep = async function buscarCep(cep) {
    const n = String(cep).replace(/\D/g, '');
    if (n.length !== 8) throw new Error('O CEP tem 8 números.');
    let r;
    try {
      r = await fetch(`https://viacep.com.br/ws/${n}/json/`);
    } catch {
      throw new Error('Não deu para consultar o CEP agora. Confira a conexão e tente de novo.');
    }
    if (!r.ok) throw new Error('Não deu para consultar o CEP agora. Tente de novo em instantes.');
    const j = await r.json();
    if (j.erro) throw new Error('Não achamos esse CEP. Confira os números.');
    return { cep: j.cep, rua: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '' };
  };

  AGULHA.mascaraCep = (v) => v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
})();
