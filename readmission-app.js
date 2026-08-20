const API_URL = "https://diabetes-qtg6.onrender.com";
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 58; // r=58, matches the SVG circle in readmission-risk.html

const els = {
  form: document.querySelector("#riskForm"),
  submitButton: document.querySelector("#submitButton"),
  randomizeButton: document.querySelector("#randomizeButton"),
  resultPlaceholder: document.querySelector("#resultPlaceholder"),
  resultContent: document.querySelector("#resultContent"),
  resultBody: document.querySelector("#resultBody"),
  gaugeArc: document.querySelector("#gaugeArc"),
  resultProb: document.querySelector("#resultProb"),
  resultLabel: document.querySelector("#resultLabel"),
  resultNote: document.querySelector("#resultNote"),
  themeButton: document.querySelector("#themeButton"),
  driftDot: document.querySelector("#driftDot"),
  driftStatusText: document.querySelector("#driftStatusText"),
  driftDetail: document.querySelector("#driftDetail"),
  driftCols: document.querySelector("#driftCols"),
};

// Reads the deployed model's REAL, live drift verdict -- this reflects actual traffic that has
// hit the API (including anyone else using the demo right now), not a simulation. See
// src/serve_api.py's GET /drift in the main project for the exact response shape.
async function fetchDriftStatus() {
  try {
    const res = await fetch(`${API_URL}/drift`);
    const body = await res.json();

    if (!body.enabled) {
      els.driftDot.style.background = "var(--muted)";
      els.driftStatusText.textContent = "Monitoring disabled";
      els.driftDetail.textContent = body.reason || "No drift reference configured on this deployment.";
      els.driftCols.textContent = "";
      return;
    }

    if (body.status === "warming up") {
      els.driftDot.style.background = "var(--muted)";
      els.driftStatusText.textContent = "Warming up";
      els.driftDetail.textContent =
        `Needs ${body.rows_needed} more scored requests before the first verdict. This reflects real ` +
        `traffic to the live API, not a simulation.`;
      els.driftCols.textContent = "";
      return;
    }

    const drifted = body.status === "drift detected";
    els.driftDot.style.background = drifted ? "var(--red)" : "var(--green)";
    els.driftStatusText.textContent = drifted ? "Drift detected" : "No drift detected";
    els.driftDetail.textContent =
      `${body.n_drifted}/${body.n_columns} columns drifted (${(body.drift_share * 100).toFixed(1)}%) ` +
      `across the last ${body.window_rows} scored requests.`;
    els.driftCols.textContent = drifted && body.drifted_columns?.length
      ? `Drifted: ${body.drifted_columns.join(", ")}`
      : "";
  } catch (err) {
    console.error(err);
    els.driftDot.style.background = "var(--muted)";
    els.driftStatusText.textContent = "Unavailable";
    els.driftDetail.textContent = "Could not reach the live monitoring endpoint.";
    els.driftCols.textContent = "";
  }
}

function riskBand(p) {
  if (p < 0.3) return { label: "Lower risk", varName: "--green" };
  if (p < 0.5) return { label: "Moderate risk", varName: "--yellow" };
  return { label: "Higher risk", varName: "--red" };
}

function setSubmitting(isSubmitting) {
  els.submitButton.disabled = isSubmitting;
  els.submitButton.innerHTML = isSubmitting
    ? '<i data-lucide="loader-2" class="rr-spin"></i> Scoring...'
    : '<i data-lucide="zap"></i> Classify';
  if (window.lucide) window.lucide.createIcons();
}

function showResult() {
  els.resultPlaceholder.hidden = true;
  els.resultContent.hidden = false;
  els.resultContent.style.display = "contents";
  els.resultBody.hidden = false;
}

function renderResult(prob) {
  const band = riskBand(prob);
  const color = getComputedStyle(document.documentElement).getPropertyValue(band.varName).trim();
  const offset = GAUGE_CIRCUMFERENCE * (1 - Math.min(Math.max(prob, 0), 1));

  showResult();
  els.gaugeArc.style.stroke = color;
  els.gaugeArc.style.strokeDashoffset = String(offset);
  els.resultProb.textContent = `${(prob * 100).toFixed(1)}%`;
  els.resultProb.style.color = color;
  els.resultLabel.textContent = band.label;
  els.resultLabel.style.color = color;
  els.resultNote.textContent =
    "Estimated probability of readmission within 30 days, from a model trained on 1999-2008 hospital data (~0.66 AUC-ROC). Educational demo only.";
}

function renderError(message) {
  showResult();
  els.gaugeArc.style.stroke = "var(--muted)";
  els.gaugeArc.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE);
  els.resultProb.textContent = "--";
  els.resultProb.style.color = "var(--text)";
  els.resultLabel.textContent = "Could not score this patient";
  els.resultLabel.style.color = "var(--red)";
  els.resultNote.textContent = message;
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setSubmitting(true);

  const data = new FormData(els.form);
  const record = {
    time_in_hospital: Number(data.get("time_in_hospital")),
    num_lab_procedures: Number(data.get("num_lab_procedures")),
    num_procedures: Number(data.get("num_procedures")),
    num_medications: Number(data.get("num_medications")),
    number_outpatient: Number(data.get("number_outpatient")),
    number_emergency: Number(data.get("number_emergency")),
    number_inpatient: Number(data.get("number_inpatient")),
    number_diagnoses: Number(data.get("number_diagnoses")),
    admission_type_id: Number(data.get("admission_type_id")),
    discharge_disposition_id: Number(data.get("discharge_disposition_id")),
    admission_source_id: Number(data.get("admission_source_id")),
    diag_1_category: data.get("diag_1_category"),
    medical_specialty_grouped: data.get("medical_specialty_grouped"),
    race_white: Number(data.get("race_white")),
    gender: data.get("gender"),
    age_ordinal: Number(data.get("age_ordinal")),
  };

  try {
    const res = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: [record] }),
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const body = await res.json();
    renderResult(body.probabilities[0]);
    fetchDriftStatus(); // this request just moved the live buffer -- refresh the tile
  } catch (err) {
    console.error(err);
    renderError(
      "The model API may be waking up from sleep (free hosting tier) — this can take up to a minute on the first request. Please try again shortly."
    );
  } finally {
    setSubmitting(false);
  }
});

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

// Ranges/weights loosely reflect the real dataset's distributions (e.g. most encounters have
// zero prior emergency/outpatient visits, the population skews older, most patients are
// Caucasian) so a "random patient" feels representative rather than uniformly implausible.
function randomizeForm() {
  const setValue = (name, value) => {
    const field = els.form.elements[name];
    if (field) field.value = value;
  };

  setValue("time_in_hospital", randInt(1, 14));
  setValue("num_lab_procedures", randInt(1, 120));
  setValue("num_procedures", randInt(0, 6));
  setValue("num_medications", randInt(1, 60));
  setValue("number_outpatient", pick([0, 0, 0, 0, 0, 1, 1, 2, 3]));
  setValue("number_emergency", pick([0, 0, 0, 0, 0, 1, 1, 2, 3]));
  setValue("number_inpatient", pick([0, 0, 0, 1, 1, 2, 2, 3, 4, 5]));
  setValue("number_diagnoses", randInt(1, 16));
  setValue("admission_type_id", pick([1, 1, 1, 2, 3, 6, -1]));
  setValue("discharge_disposition_id", pick([1, 1, 1, 3, 6, 2, 22, -1]));
  setValue("admission_source_id", pick([7, 7, 7, 1, 1, 4, 6, -1]));
  setValue("diag_1_category", pick([
    "Circulatory", "Circulatory", "Circulatory", "Respiratory", "Respiratory",
    "Digestive", "Diabetes", "Injury", "Musculoskeletal", "Genitourinary",
    "Neoplasms", "Other",
  ]));
  setValue("medical_specialty_grouped", pick([
    "Missing", "Missing", "Missing", "InternalMedicine", "InternalMedicine",
    "Family/GeneralPractice", "Emergency/Trauma", "Cardiology", "Surgery-General",
    "Orthopedics", "Orthopedics-Reconstructive", "Radiologist", "Nephrology", "Other",
  ]));
  setValue("race_white", pick([1, 1, 1, 0]));
  setValue("gender", pick(["Female", "Male"]));
  setValue("age_ordinal", pick([2, 3, 4, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9]));
}

els.randomizeButton.addEventListener("click", randomizeForm);

els.themeButton.addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
});

if (window.lucide) window.lucide.createIcons();
fetchDriftStatus();
