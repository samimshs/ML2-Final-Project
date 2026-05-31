const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, ".next");
const publishHoldingPage = process.env.PUBLIC_HOLDING_PAGE === "1";

const localReviewTargets = [
  "index.html",
  "machine-learning.html",
  "education.html",
  "softwares.html",
  "data.html",
  "others.html",
  "ocustate.html",
  "daftarcha",
  "datahub",
  "styles.css",
  "app.js",
  "assets",
  "DESKTOP_APP_INSTALL_README.md",
  "README.md",
  "netlify.toml",
];

const holdingPageTargets = [
  "coming-soon.html",
  "styles.css",
  "assets",
  "netlify.toml",
];

const copyTargets = publishHoldingPage ? holdingPageTargets : localReviewTargets;

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

if (publishHoldingPage) {
  fs.copyFileSync(path.join(outDir, "coming-soon.html"), path.join(outDir, "index.html"));
  fs.rmSync(path.join(outDir, "coming-soon.html"), { force: true });
}

console.log(`Static site copied to .next (${publishHoldingPage ? "holding page" : "local review site"})`);
