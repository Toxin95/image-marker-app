# Image Marker Studio

App React per caricare immagini, aggiungere marker con icone di `react-icons`, gestire una legenda e scaricare il risultato come PNG.

## Funzionalità

- **Upload immagine** (JPG, PNG, WebP) — tutto lato client, nessun server
- **Due metodi per aggiungere marker**:
  1. **Click**: seleziona icona e colore nella palette a sinistra, poi clicca sull'immagine
  2. **Drag & drop**: trascina un'icona dalla palette direttamente sul punto desiderato
- **Riposiziona i marker** trascinandoli con il mouse
- **Legenda** a destra con etichetta + descrizione + colore personalizzabili per ogni marker
- **Numerazione automatica** sincronizzata tra marker sull'immagine e legenda
- **Download**:
  - **PNG** ad alta risoluzione (2x) dell'immagine con i marker sopra
  - **TXT** con la legenda formattata

## Avvio

```bash
npm install
npm run dev
```

Poi apri http://localhost:5173

## Build di produzione

```bash
npm run build
npm run preview
```

## Stack

- React 18 + Vite
- `react-icons` per le icone (set `Fa` = Font Awesome)
- `html-to-image` per l'esportazione PNG
- Zero dipendenze CSS — tutto custom

## Personalizzare le icone

Nel file `src/App.jsx`, cerca `ICON_LIBRARY` e aggiungi le icone che vuoi dal pacchetto `react-icons`. Tutti i set sono supportati (Fa, Md, Bi, Fi, Io, ecc.).

```jsx
import { MdRestaurant } from 'react-icons/md';

const ICON_LIBRARY = {
  // ...
  MdRestaurant: MdRestaurant,
};
```

## Personalizzare i colori

La palette si trova in `COLOR_PALETTE` in `App.jsx`. Basta aggiungere/rimuovere valori hex.
