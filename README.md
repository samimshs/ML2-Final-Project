# Samim Portfolio Site

This folder contains the Netlify-ready portfolio website. `index.html` is a single-page site (dark theme) whose Products section lists every product inline, grouped into brand lines — **KabulAI**, **KabulLearn**, **KabulApps**, **DataHub**, and **KabulLabs** — each linking directly to the live product or download. There are no category landing pages.

## Local preview

Open `index.html` directly in a browser, or run a simple local server from this folder:

```bash
python3 -m http.server 8888
```

Then visit:

```text
http://localhost:8888
```

## Current pages

- `index.html`: main single-page site (hero, products, about, contact)
- `ocustate.html`: OcuState Computer Vision detector — reachable from the KabulAI line
- `daftarcha/`: built web copy of the Daftarcha business app (KabulApps)
- `datahub/`: built web copy of the DataHub data explorer
- `coming-soon.html`: holding page (published when `PUBLIC_HOLDING_PAGE=1`)

OcuState Computer Vision is a browser-based drowsiness detector. It uses MediaPipe FaceMesh for facial landmarks and TensorFlow.js for the browser model workflow.

Daftarcha is an offline-first business management app for small Afghan shops, wholesalers, pharmacies, and traders. DataHub is a global data explorer connected to public World Bank, FAO, and WHO data sources.

## OcuState model assets

The website expects the custom browser weight export here:

```text
assets/model/weights-manifest.json
assets/model/weights.bin
```

The alarm sound should be here:

```text
assets/audio/beep.wav
```

The model conversion/copy step is handled separately.

## Runtime behavior

The deployed app mirrors the notebook Step 6 parameters: MediaPipe FaceMesh finds the eyes, EAR is smoothed with alpha 0.35, open-eye calibration runs for 3 seconds, the closed threshold is open_EAR * 0.72, the sleepy frame streak is 5, and the alarm delay is 0.8 seconds. The CNN still loads and labels eye crops, but the alert decision follows the Step 6 EAR logic.
