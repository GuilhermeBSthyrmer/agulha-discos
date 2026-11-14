/* Capas generativas: cada disco ganha uma capa única a partir do id,
 * do estilo e das três cores do catálogo. Saída: string SVG.
 */
window.AGULHA = window.AGULHA || {};

(() => {
  'use strict';

  function semente(texto) {
    let h = 2166136261;
    for (const c of texto) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function aleatorio(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const F = 'Bricolage Grotesque, system-ui, sans-serif';

  const ESTILOS = {
    ondas(r, [a, b, c]) {
      let s = `<rect width="300" height="300" fill="${a}"/>`;
      const n = 7 + Math.floor(r() * 4);
      const amp = 10 + r() * 18;
      const freq = 1.5 + r() * 2;
      for (let i = 0; i < n; i++) {
        const y0 = 40 + i * (230 / n);
        let d = `M -10 ${y0.toFixed(1)}`;
        for (let x = -10; x <= 310; x += 10) {
          const y = y0 + Math.sin((x / 300) * Math.PI * 2 * freq + i * .7) * amp;
          d += ` L ${x} ${y.toFixed(1)}`;
        }
        s += `<path d="${d}" fill="none" stroke="${i % 2 ? c : b}" stroke-width="${(7 + r() * 6).toFixed(1)}" stroke-linecap="round"/>`;
      }
      return s;
    },
    faixas(r, [a, b, c]) {
      let s = `<rect width="300" height="300" fill="${a}"/><g transform="rotate(${(-20 - r() * 30).toFixed(1)} 150 150)">`;
      for (let i = -6; i < 12; i++) {
        if (i % 2) s += `<rect x="-100" y="${i * 34}" width="500" height="${16 + r() * 12}" fill="${b}"/>`;
      }
      s += '</g>';
      const cx = 80 + r() * 140; const cy = 80 + r() * 140;
      s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(46 + r() * 30).toFixed(0)}" fill="${c}"/>`;
      return s;
    },
    sol(r, [a, b, c]) {
      let s = `<rect width="300" height="300" fill="${a}"/>`;
      const raios = 14 + Math.floor(r() * 10);
      const cy = 210 + r() * 40;
      for (let i = 0; i < raios; i++) {
        if (i % 2) continue;
        const a1 = Math.PI + (i / raios) * Math.PI;
        const a2 = Math.PI + ((i + 1) / raios) * Math.PI;
        s += `<path d="M150 ${cy} L ${(150 + Math.cos(a1) * 400).toFixed(0)} ${(cy + Math.sin(a1) * 400).toFixed(0)} L ${(150 + Math.cos(a2) * 400).toFixed(0)} ${(cy + Math.sin(a2) * 400).toFixed(0)} Z" fill="${b}"/>`;
      }
      s += `<circle cx="150" cy="${cy.toFixed(0)}" r="${(58 + r() * 20).toFixed(0)}" fill="${c}"/>`;
      s += `<rect y="${(cy + 1).toFixed(0)}" width="300" height="300" fill="${a}"/>`;
      return s;
    },
    grade(r, [a, b, c]) {
      let s = `<rect width="300" height="300" fill="${a}"/>`;
      const n = 4; const t = 300 / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = i * t; const y = j * t; const cor = r() > .5 ? b : c; const tipo = Math.floor(r() * 4); const rot = Math.floor(r() * 4) * 90;
          const g = `transform="rotate(${rot} ${x + t / 2} ${y + t / 2})"`;
          if (tipo === 0) s += `<circle cx="${x + t / 2}" cy="${y + t / 2}" r="${t * .38}" fill="${cor}"/>`;
          if (tipo === 1) s += `<path ${g} d="M${x} ${y} L${x + t} ${y} A${t} ${t} 0 0 1 ${x} ${y + t} Z" fill="${cor}"/>`;
          if (tipo === 2) s += `<path ${g} d="M${x} ${y + t} L${x + t} ${y + t} L${x} ${y} Z" fill="${cor}"/>`;
          if (tipo === 3) s += `<rect x="${x + t * .2}" y="${y + t * .2}" width="${t * .6}" height="${t * .6}" fill="${cor}"/>`;
        }
      }
      return s;
    },
    circulos(r, [a, b, c]) {
      let s = `<rect width="300" height="300" fill="${a}"/>`;
      const cx = 110 + r() * 80; const cy = 110 + r() * 80;
      for (let k = 9; k > 0; k--) {
        s += `<circle cx="${(cx + (r() - .5) * 14).toFixed(0)}" cy="${(cy + (r() - .5) * 14).toFixed(0)}" r="${k * 19}" fill="${k % 2 ? b : c}"/>`;
      }
      s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="10" fill="${a}"/>`;
      return s;
    },
    tipo(r, [a, b, c], d) {
      const letra = esc(d.titulo[0].toUpperCase());
      return `<rect width="300" height="300" fill="${a}"/>`
        + `<rect x="0" y="${(190 + r() * 30).toFixed(0)}" width="300" height="22" fill="${c}"/>`
        + `<text x="${(10 + r() * 30).toFixed(0)}" y="250" font-family="${F}" font-weight="800" font-size="300" fill="${b}" letter-spacing="-10">${letra}</text>`;
    },
  };

  /** Monta o SVG da capa. */
  AGULHA.capa = function capa(d, { comTexto = true } = {}) {
    const r = aleatorio(semente(d.id));
    const corpo = (ESTILOS[d.estilo] || ESTILOS.circulos)(r, d.cores, d);
    const claro = d.estilo === 'tipo' ? d.cores[1] : d.cores[2];
    const fundoTxt = d.estilo === 'tipo' ? d.cores[0] : d.cores[0];
    const texto = comTexto
      ? `<g font-family="${F}"><rect x="14" y="14" width="${Math.min(272, 22 + Math.max(d.artista.length, d.titulo.length) * 9.2).toFixed(0)}" height="50" fill="${fundoTxt}" opacity=".88"/>`
        + `<text x="22" y="35" font-size="15" font-weight="800" fill="${claro}">${esc(d.artista)}</text>`
        + `<text x="22" y="54" font-size="14" font-weight="500" fill="${claro}">${esc(d.titulo)}</text></g>`
      : '';
    return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Capa de ${esc(d.titulo)}, de ${esc(d.artista)}" preserveAspectRatio="xMidYMid slice">${corpo}${texto}</svg>`;
  };
})();
