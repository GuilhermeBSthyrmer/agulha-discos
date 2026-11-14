# Agulha Discos · a record store that works like a 1960s radiogram

[![CI](https://github.com/GuilhermeBSthyrmer/agulha-discos/actions/workflows/ci.yml/badge.svg)](https://github.com/GuilhermeBSthyrmer/agulha-discos/actions/workflows/ci.yml) [![CodeQL](https://github.com/GuilhermeBSthyrmer/agulha-discos/actions/workflows/codeql.yml/badge.svg)](https://github.com/GuilhermeBSthyrmer/agulha-discos/actions/workflows/codeql.yml)

A complete front-end for a fictional vinyl shop where **the whole store is a radiogram cabinet** (a Brazilian *radiola*). You tune the genre on the radio dial, the station's records appear on the shelf, the chosen record drops onto the turntable, the tonearm swings over and a short sample plays. Then it goes into the shopping bag, with a shipping quote by postcode and a checkout. In Portuguese.

**Live:** https://guilhermebsthyrmer.github.io/agulha-discos/

## The radiogram

- **Tuning dial** with eight genre "stations" (plus *Tudo*, everything) on a backlit glass scale with frequencies in kHz. Drag the needle, use the mouse wheel, turn the bakelite **tuning knob**, or use the keyboard: the dial is an ARIA `slider` (arrows, Home/End, PageUp/PageDown). Releasing between stations snaps to the nearest one.
- **Static between stations**, generated with the Web Audio API (band-passed noise whose pitch follows the needle). It only plays while you tune, and there is a switch to turn it off.
- **Magic eye**: the green tuning tube closes its shadow wedge as you approach a station, drawn with a `conic-gradient` driven by a registered `@property`.
- **Shelf** of the tuned station, with sort and new/used filters, and a search that looks across all stations, artists and track names.
- **Turntable** that stays in view: the record drops onto the platter with the label in the record's colours, the sleeve leans against the deck, and **"Ouvir trecho"** swings the tonearm onto the record and plays a loop **synthesized in the browser** from the record's tempo, scale and key (chords, bass, melody, drums and needle crackle). The tonearm's landing angle is calibrated at runtime for whatever size the platter is on screen.
- **Record card** printed like a back cover: genre, year, label, catalogue number, condition grade, stock-aware quantity and track list by side.
- Each record has its own URL (`#disco/agl-005`): opening it tunes the dial to its station.

## Shop features

- **Bag** in a slide-in drawer: quantity limited by stock, persistence in `localStorage`, sync between tabs. Prices are always recomputed from the catalogue, so a tampered value in storage can't change a price.
- **Shipping quote by CEP** using the public [ViaCEP](https://viacep.com.br/) API, with regional example rates and free shipping above a threshold.
- **Checkout** (`checkout.html`): contact and address form with masks and inline validation, address autofill from ViaCEP, shipping options, order summary and a demo Pix screen. No payment is processed.
- **24 records with generated covers**: every cover is drawn in SVG from the record's id, style and palette with a seeded PRNG, so there are no image files.

## Technical notes

- Plain HTML, CSS and JavaScript split into small modules. No build step, no dependencies.
- Strict Content Security Policy: no inline scripts or styles; the only network origin allowed is `viacep.com.br`. Dynamic values go through the CSSOM.
- Wood grain and speaker cloth are CSS gradients plus an inline SVG `feTurbulence` texture.
- Respects `prefers-reduced-motion` (no dial sweep, no spinning) and works with keyboard only.

## Tests

End-to-end tests with [Playwright](https://playwright.dev/), each scenario run on a desktop and a mobile viewport (Chromium). 8 scenarios with ViaCEP mocked: tuning the dial by keyboard, filters and search across stations, record to platter to bag with a shipping quote, deep links tuning to the right station, stock limits, and both the empty and the complete checkout.

Every push runs the suite on GitHub Actions, together with Lighthouse (accessibility and best practices must score 90 or more) and CodeQL security analysis. Dependabot keeps the dependencies up to date.

```bash
npm install
npx playwright install chromium
npm test
```

## Run locally

```bash
npm start   # http://localhost:4180
```

## Structure

```
index.html          the radiogram
checkout.html       checkout
css/style.css
css/checkout.css
js/dados.js         catalogue and dial stations
js/capa.js          generative SVG covers
js/carrinho.js      bag, shipping rules, ViaCEP client
js/som.js           Web Audio sample player
js/loja.js          dial, static, shelf, turntable, bag
js/checkout.js      checkout page
```

Artists, records and covers are invented. Shipping prices are examples.

## License

MIT
