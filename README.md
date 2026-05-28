# Samim Portfolio Site

This folder contains the Netlify-ready portfolio website. The home page is a clean category launcher with:

- **Machine Learning**: opens a list of machine learning projects.
- **Softwares**: opens a list of software projects.
- **Others**: reserved for future work.

The existing OcuState detector content is preserved on its own page and remains reachable from the Machine Learning section.

## Local preview

Open `index.html` directly in a browser, or run a simple local server from this folder:

```bash
python3 -m http.server 8888
```

Then visit:

```text
http://localhost:8888
```

## Current sections

### Machine Learning

- `machine-learning.html`: project list
- `ocustate.html`: OcuState Computer Vision detector

OcuState Computer Vision is a browser-based drowsiness detector. It uses MediaPipe FaceMesh for facial landmarks and TensorFlow.js for the browser model workflow.

### Softwares

- `softwares.html`: software list

Daftarcha is an offline-first business management app for small Afghan shops, wholesalers, pharmacies, and traders. It currently links to:

```text
https://github.com/samimshs/Daftarcha
```

### Others

- `others.html`: reserved category page for future additions

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
