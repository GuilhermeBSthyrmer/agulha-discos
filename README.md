# Agulha Discos · record store

A complete front-end for a fictional vinyl record shop: catalog, filters, product pages, cart, shipping quote by postcode and checkout. In Portuguese.

**Live:** `https://cururupernatorta.github.io/agulha-discos/` (after GitHub Pages is enabled)

## Design

The shop is a used-record crate: deep turntable-felt green, genre divider tabs, hand-written orange price stickers, and records that slide out of their sleeves. Every cover is **generated in code** from the record's id, style and palette, so the catalog has 16 unique covers with no image files.

## Features

- **Catalog** with genre dividers (ARIA tabs, arrow/Home/End keys), new/used filter, sort (newest, price, year, artist), debounced search across title, artist, genre and track names, and an empty state that explains which filters matched nothing.
- **Product page** in a `<dialog>` with its own URL (`#disco/agl-005`), so a record can be linked and the back button closes it. Turntable with tonearm, track list by side, condition grading and stock-aware quantity.
- **"Ouvir trecho" (play a sample)**: each record plays a short loop **synthesized with the Web Audio API**: chords, bass, melody and drums from the record's tempo, scale and key, plus needle crackle. No audio files.
- **Cart** in a slide-in drawer: quantity steppers limited by stock, persistence in `localStorage`, sync between tabs via the `storage` event. Prices are always recomputed from the catalog, so a tampered value in storage can't change a price.
- **Shipping quote by CEP** using the public [ViaCEP](https://viacep.com.br/) API, with regional example rates and free shipping above a threshold.
- **Checkout** (`checkout.html`): contact and address form with masks and inline validation, address autofill from ViaCEP, shipping options as radio cards, order summary, and a demo Pix screen with a generated QR-like pattern. No payment is processed.

## Technical notes

- Plain HTML, CSS and JavaScript, split into small modules (`dados`, `capa`, `carrinho`, `som`, `loja`, `checkout`). No build step, no dependencies.
- Strict Content Security Policy; the only allowed network origin is `viacep.com.br`.
- Generated covers use a seeded PRNG (mulberry32 over an FNV-1a hash), so each record always gets the same art.

## Run locally

```bash
npx serve .
```

Open `index.html` directly works too, except the CEP lookup, which needs `http(s)`.

## Structure

```
index.html          catalog
checkout.html       checkout
css/style.css
css/checkout.css
js/dados.js         catalog data
js/capa.js          generative SVG covers
js/carrinho.js      cart, shipping rules, ViaCEP client
js/som.js           Web Audio sample player
js/loja.js          catalog page
js/checkout.js      checkout page
```

Artists, records and covers are invented. Shipping prices are examples.

## License

MIT
