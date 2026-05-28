const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, ".next");

const copyTargets = [
  "index.html",
  "machine-learning.html",
  "softwares.html",
  "data.html",
  "others.html",
  "ocustate.html",
  "daftarcha",
  "datahub",
  "styles.css",
  "app.js",
  "assets",
  "README.md",
  "netlify.toml",
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const target of copyTargets) {
  const source = path.join(root, target);
  const destination = path.join(outDir, target);

  if (!fs.existsSync(source)) {
    continue;
  }

  fs.cpSync(source, destination, { recursive: true });
}

console.log("Static site copied to .next");
