/* "Ouvir trecho": cada disco toca um trecho gerado na hora com Web Audio,
 * a partir do andamento, da escala e do tom do catálogo. Nenhum arquivo de
 * áudio é baixado. Inclui o chiado de agulha no sulco.
 */
window.AGULHA = window.AGULHA || {};

(() => {
  'use strict';

  const ESCALAS = {
    maior: [0, 2, 4, 5, 7, 9, 11],
    menor: [0, 2, 3, 5, 7, 8, 10],
    dorico: [0, 2, 3, 5, 7, 9, 10],
    mixolidio: [0, 2, 4, 5, 7, 9, 10],
    maior7: [0, 2, 4, 5, 7, 9, 11],
  };
  const PROGRESSOES = [[0, 5, 3, 4], [0, 3, 4, 3], [0, 6, 5, 4], [1, 4, 0, 0], [0, 4, 5, 3]];
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);

  function prng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const hash = (t) => [...t].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

  let atual = null; // { ctx, fim, id, aoParar }

  function nota(ctx, destino, { t, f, dur, tipo = 'triangle', vol = .2, ataque = .01, corte = 0 }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let saida = g;
    if (corte) {
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = corte;
      g.connect(filtro);
      saida = filtro;
    }
    o.connect(g);
    saida.connect(destino);
    o.start(t);
    o.stop(t + dur + .05);
  }

  function ruido(ctx, segundos) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * segundos), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function bumbo(ctx, destino, t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + .14);
    g.gain.setValueAtTime(.55, t);
    g.gain.exponentialRampToValueAtTime(.001, t + .22);
    o.connect(g); g.connect(destino);
    o.start(t); o.stop(t + .25);
  }

  function chimbal(ctx, destino, buf, t, vol = .06) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + .05);
    s.connect(f); f.connect(g); g.connect(destino);
    s.start(t, Math.random() * .5, .06);
  }

  function chiado(ctx, destino, dur) {
    // Estalos esparsos + sopro baixo, como agulha no sulco.
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * .012;
      if (Math.random() < .00035) d[i] += (Math.random() * 2 - 1) * .6;
    }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = .6;
    s.connect(f); f.connect(destino);
    s.start();
  }

  /** Toca o trecho do disco. aoParar é chamado quando termina ou é interrompido. */
  AGULHA.tocar = function tocar(disco, aoParar) {
    AGULHA.parar();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    const mestre = ctx.createGain();
    mestre.gain.value = .0001;
    const comp = ctx.createDynamicsCompressor();
    mestre.connect(comp); comp.connect(ctx.destination);

    const { bpm, escala, tom } = disco.audio;
    const r = prng(hash(disco.id));
    const esc = ESCALAS[escala] || ESCALAS.maior;
    const prog = PROGRESSOES[Math.floor(r() * PROGRESSOES.length)];
    const batida = 60 / bpm;
    const compassos = 4;
    const t0 = ctx.currentTime + .15;
    const fim = t0 + compassos * 4 * batida;
    const grau = (g, oit = 0) => tom + esc[((g % 7) + 7) % 7] + 12 * (Math.floor(g / 7) + oit);
    const sujo = ruido(ctx, 1);
    const eletronico = disco.genero === 'Eletrônica';
    const sambado = ['Samba', 'Forró'].includes(disco.genero);

    mestre.gain.setValueAtTime(.0001, ctx.currentTime);
    mestre.gain.linearRampToValueAtTime(.32, t0 + .4);
    mestre.gain.setValueAtTime(.32, fim - .6);
    mestre.gain.exponentialRampToValueAtTime(.0001, fim + .2);

    for (let c = 0; c < compassos; c++) {
      const tc = t0 + c * 4 * batida;
      const raiz = prog[c % prog.length];
      // acorde
      [0, 2, 4, 6].forEach((i, k) => {
        if (k === 3 && escala !== 'maior7' && escala !== 'dorico') return;
        nota(ctx, mestre, { t: tc, f: hz(grau(raiz + i)), dur: 4 * batida, tipo: eletronico ? 'sawtooth' : 'triangle', vol: .045, ataque: .08, corte: eletronico ? 1400 : 2600 });
      });
      // baixo
      for (let b = 0; b < 4; b++) {
        if (b % 2 && !sambado && r() < .5) continue;
        nota(ctx, mestre, { t: tc + b * batida, f: hz(grau(raiz, -2)), dur: batida * .9, tipo: 'sine', vol: .22 });
      }
      // melodia em colcheias
      let g = raiz + 7;
      for (let n = 0; n < 8; n++) {
        if (r() < .3) continue;
        g += Math.floor(r() * 5) - 2;
        nota(ctx, mestre, { t: tc + n * batida / 2, f: hz(grau(g)), dur: batida * (r() < .3 ? 1 : .45), tipo: eletronico ? 'square' : 'triangle', vol: .07, corte: 3200 });
      }
      // bateria
      for (let b = 0; b < 4; b++) {
        if (b % 2 === 0 || eletronico) bumbo(ctx, mestre, tc + b * batida);
        for (let h = 0; h < (sambado ? 4 : 2); h++) chimbal(ctx, mestre, sujo, tc + b * batida + h * batida / (sambado ? 4 : 2), h ? .035 : .06);
      }
    }
    chiado(ctx, mestre, fim - t0 + .4);

    const timer = setTimeout(() => AGULHA.parar(), (fim - ctx.currentTime + .4) * 1000);
    atual = { ctx, timer, id: disco.id, aoParar };
    return true;
  };

  AGULHA.parar = function parar() {
    if (!atual) return;
    const { ctx, timer, aoParar } = atual;
    atual = null;
    clearTimeout(timer);
    ctx.close().catch(() => {});
    if (aoParar) aoParar();
  };

  AGULHA.tocandoId = () => (atual ? atual.id : null);
})();
