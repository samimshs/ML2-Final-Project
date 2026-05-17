const state = {
  model: null,
  faceMesh: null,
  stream: null,
  running: false,
  cnnThreshold: 0.915,
  openEarBaseline: 0.32,
  closedEarThreshold: 0.21,
  smoothedEar: null,
  score: 0,
  history: [],
  alerts: 0,
  sleepyFrames: 0,
  sleepyStartedAt: null,
  lastFrameAt: performance.now(),
  rafId: null,
  alarmAudio: null,
  cropCanvas: document.createElement("canvas"),
};

const els = {
  video: document.querySelector("#video"),
  overlay: document.querySelector("#overlay"),
  emptyState: document.querySelector("#emptyState"),
  alertFrame: document.querySelector("#alertFrame"),
  modelChip: document.querySelector("#modelChip"),
  statusText: document.querySelector("#statusText"),
  scoreText: document.querySelector("#scoreText"),
  scoreFill: document.querySelector("#scoreFill"),
  thresholdText: document.querySelector("#thresholdText"),
  timerText: document.querySelector("#timerText"),
  alertsText: document.querySelector("#alertsText"),
  fpsText: document.querySelector("#fpsText"),
  scoreChart: document.querySelector("#scoreChart"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
  calibrateButton: document.querySelector("#calibrateButton"),
  soundToggle: document.querySelector("#soundToggle"),
  themeButton: document.querySelector("#themeButton"),
};

const IMG_SIZE = 80;
const ALARM_DELAY_MS = 800;
const MIN_SLEEPY_FRAMES = 5;
const EAR_SMOOTHING_ALPHA = 0.35;
const LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EAR_POINTS = [33, 160, 158, 133, 153, 144];
const LEFT_EAR_POINTS = [362, 385, 387, 263, 373, 380];

state.cropCanvas.width = IMG_SIZE;
state.cropCanvas.height = IMG_SIZE;

function setStatus(text) {
  els.statusText.textContent = text;
}

function showStartupDetail(message) {
  console.error(message);
  if (!els.modelChip) return;
  els.modelChip.innerHTML = `<i data-lucide="circle-alert"></i>${message}`;
  if (window.lucide) window.lucide.createIcons();
}

function setModelChip(text) {
  if (!els.modelChip) return;
  els.modelChip.innerHTML = `<i data-lucide="cpu"></i>${text}`;
  if (window.lucide) window.lucide.createIcons();
}

function updateMetrics(score, fps, closedMs = 0) {
  els.scoreText.textContent = score.toFixed(2);
  els.scoreFill.style.width = `${Math.round(score * 100)}%`;
  els.thresholdText.textContent = state.closedEarThreshold.toFixed(3);
  els.timerText.textContent = `${(closedMs / 1000).toFixed(1)}s`;
  els.alertsText.textContent = String(state.alerts);
  els.fpsText.textContent = Number.isFinite(fps) ? fps.toFixed(0) : "--";
}

function drawChart() {
  const canvas = els.scoreChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--panel-strong");
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(152, 165, 172, 0.28)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  const yThreshold = height - 0.5 * height;
  ctx.strokeStyle = "#f2c94c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, yThreshold);
  ctx.lineTo(width, yThreshold);
  ctx.stroke();

  const values = state.history.slice(-120);
  if (values.length < 2) return;

  ctx.strokeStyle = values.at(-1) >= 1 ? "#ff4d4f" : "#42d779";
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - value * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function buildDeepEyesModel() {
  const model = tf.sequential();
  model.add(tf.layers.conv2d({ inputShape: [80, 80, 3], filters: 32, kernelSize: 3, padding: "same", useBias: true }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.conv2d({ filters: 32, kernelSize: 3, padding: "same", useBias: true }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
  model.add(tf.layers.dropout({ rate: 0.25 }));
  model.add(tf.layers.conv2d({ filters: 64, kernelSize: 3, padding: "same", useBias: true }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.conv2d({ filters: 64, kernelSize: 3, padding: "same", useBias: true }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
  model.add(tf.layers.dropout({ rate: 0.25 }));
  model.add(tf.layers.conv2d({ filters: 128, kernelSize: 3, padding: "same", useBias: true }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
  model.add(tf.layers.dropout({ rate: 0.25 }));
  model.add(tf.layers.globalAveragePooling2d({}));
  model.add(tf.layers.dense({ units: 128, useBias: true }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid", useBias: true }));
  model.predict(tf.zeros([1, 80, 80, 3])).dispose();
  return model;
}

async function loadModel() {
  if (!window.tf) throw new Error("TensorFlow.js did not load.");

  const [manifest, weightsBuffer] = await Promise.all([
    fetch("assets/model/weights-manifest.json").then((response) => {
      if (!response.ok) throw new Error("Model manifest not found.");
      return response.json();
    }),
    fetch("assets/model/weights.bin").then((response) => {
      if (!response.ok) throw new Error("Model weights not found.");
      return response.arrayBuffer();
    }),
  ]);

  const model = buildDeepEyesModel();
  const weightArrays = manifest.weights.map((item) => {
    const values = new Float32Array(weightsBuffer, item.offset, item.length);
    return tf.tensor(values, item.shape, "float32");
  });

  model.setWeights(weightArrays);
  weightArrays.forEach((tensor) => tensor.dispose());
  setModelChip("Model loaded");
  return model;
}

async function loadFaceMesh() {
  if (!window.FaceMesh) throw new Error("MediaPipe FaceMesh did not load.");

  const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return faceMesh;
}

async function startCamera() {
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  els.video.srcObject = state.stream;

  await new Promise((resolve) => {
    if (els.video.readyState >= 2) {
      resolve();
      return;
    }
    els.video.onloadedmetadata = () => resolve();
  });

  await els.video.play();
  els.video.style.display = "block";
  els.emptyState.hidden = true;
  els.emptyState.style.display = "none";
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
  els.video.srcObject = null;
  els.video.style.display = "";
  els.emptyState.hidden = false;
  els.emptyState.style.display = "";
}

function getEyeBox(landmarks, indices, videoWidth, videoHeight, padding = 8) {
  const xs = indices.map((index) => landmarks[index].x * videoWidth);
  const ys = indices.map((index) => landmarks[index].y * videoHeight);
  const xMin = Math.max(0, Math.min(...xs) - padding);
  const xMax = Math.min(videoWidth, Math.max(...xs) + padding);
  const yMin = Math.max(0, Math.min(...ys) - padding);
  const yMax = Math.min(videoHeight, Math.max(...ys) + padding);
  return { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin };
}

function landmarkPoint(landmarks, index, videoWidth, videoHeight) {
  return {
    x: landmarks[index].x * videoWidth,
    y: landmarks[index].y * videoHeight,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function computeEar(landmarks, eyePoints, videoWidth, videoHeight) {
  const p1 = landmarkPoint(landmarks, eyePoints[0], videoWidth, videoHeight);
  const p2 = landmarkPoint(landmarks, eyePoints[1], videoWidth, videoHeight);
  const p3 = landmarkPoint(landmarks, eyePoints[2], videoWidth, videoHeight);
  const p4 = landmarkPoint(landmarks, eyePoints[3], videoWidth, videoHeight);
  const p5 = landmarkPoint(landmarks, eyePoints[4], videoWidth, videoHeight);
  const p6 = landmarkPoint(landmarks, eyePoints[5], videoWidth, videoHeight);

  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const horizontal = distance(p1, p4);

  return (vertical1 + vertical2) / (2.0 * horizontal + 1e-6);
}

function earToSleepScore(currentEar) {
  if (currentEar == null) return 0;
  const denominator = Math.max(state.openEarBaseline - state.closedEarThreshold, 1e-6);
  const score = (state.openEarBaseline - currentEar) / denominator;
  return Math.min(1, Math.max(0, score));
}

function cropEyeTensor(box) {
  const ctx = state.cropCanvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, IMG_SIZE, IMG_SIZE);
  ctx.drawImage(els.video, box.x, box.y, box.width, box.height, 0, 0, IMG_SIZE, IMG_SIZE);

  return tf.browser
    .fromPixels(state.cropCanvas)
    .toFloat()
    .div(255)
    .expandDims(0);
}

async function getFaceLandmarks() {
  let latest = null;
  state.faceMesh.onResults((results) => {
    latest = results.multiFaceLandmarks?.[0] ?? null;
  });
  await state.faceMesh.send({ image: els.video });
  return latest;
}

async function predictFromEyes() {
  const landmarks = await getFaceLandmarks();
  if (!landmarks) return { rawScore: null, boxes: [], probs: [], rightEar: null, leftEar: null, currentEar: null };

  const videoWidth = els.video.videoWidth;
  const videoHeight = els.video.videoHeight;
  const rightEar = computeEar(landmarks, RIGHT_EAR_POINTS, videoWidth, videoHeight);
  const leftEar = computeEar(landmarks, LEFT_EAR_POINTS, videoWidth, videoHeight);
  const currentEar = (rightEar + leftEar) / 2.0;

  const boxes = [
    getEyeBox(landmarks, LEFT_EYE, videoWidth, videoHeight),
    getEyeBox(landmarks, RIGHT_EYE, videoWidth, videoHeight),
  ].filter((box) => box.width > 2 && box.height > 2);

  const probs = [];
  if (state.model && boxes.length) {
    for (const box of boxes) {
      const prob = tf.tidy(() => {
        const tensor = cropEyeTensor(box);
        const prediction = state.model.predict(tensor);
        return prediction.dataSync()[0];
      });
      probs.push(prob);
      await tf.nextFrame();
    }
  }

  const rawScore = probs.length
    ? probs.reduce((sum, value) => sum + value, 0) / probs.length
    : 0;
  return { rawScore, boxes, probs, rightEar, leftEar, currentEar };
}

function videoToCanvasRect(box, canvasWidth, canvasHeight, videoWidth, videoHeight) {
  const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const drawnWidth = videoWidth * scale;
  const drawnHeight = videoHeight * scale;
  const offsetX = (canvasWidth - drawnWidth) / 2;
  const offsetY = (canvasHeight - drawnHeight) / 2;

  return {
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    width: box.width * scale,
    height: box.height * scale,
  };
}

function drawOverlay(status, boxes = [], probs = []) {
  const canvas = els.overlay;
  const rect = els.video.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  boxes.forEach((box, index) => {
    const displayBox = videoToCanvasRect(
      box,
      canvas.width,
      canvas.height,
      Math.max(1, els.video.videoWidth),
      Math.max(1, els.video.videoHeight)
    );
    const prob = probs[index] ?? 0;
    const sleepy = state.score >= 1.0;
    ctx.strokeStyle = sleepy ? "#ff4d4f" : "#42d779";
    ctx.lineWidth = 2;
    ctx.strokeRect(displayBox.x, displayBox.y, displayBox.width, displayBox.height);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "14px system-ui";
    ctx.fillText(prob.toFixed(2), displayBox.x, Math.max(16, displayBox.y - 6));
  });

  if (status === "NO FACE") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "18px system-ui";
    ctx.fillText("No face detected", 20, 32);
  }
}

function playAlarm() {
  if (!els.soundToggle.checked) return;
  if (!state.alarmAudio) state.alarmAudio = new Audio("assets/audio/beep.wav");
  state.alarmAudio.currentTime = 0;
  state.alarmAudio.play().catch(() => {});
}

async function unlockAlarmAudio() {
  if (!state.alarmAudio) {
    state.alarmAudio = new Audio("assets/audio/beep.wav");
    state.alarmAudio.preload = "auto";
    state.alarmAudio.loop = false;
    state.alarmAudio.playsInline = true;
  }

  if (!els.soundToggle.checked) return;

  const previousVolume = state.alarmAudio.volume;
  try {
    state.alarmAudio.volume = 0;
    await state.alarmAudio.play();
    state.alarmAudio.pause();
    state.alarmAudio.currentTime = 0;
  } catch (error) {
    console.warn("Audio unlock was blocked until alarm time.", error);
  } finally {
    state.alarmAudio.volume = previousVolume;
  }
}

async function loop(now) {
  if (!state.running) return;

  const fps = 1000 / Math.max(now - state.lastFrameAt, 1);
  state.lastFrameAt = now;

  const result = await predictFromEyes();
  let sleepScore = 0;
  let status = "NO FACE";
  let closedMs = 0;

  if (result.currentEar == null) {
    state.smoothedEar = null;
    state.sleepyFrames = 0;
    state.sleepyStartedAt = null;
    state.score = 0;
  } else {
    if (state.smoothedEar == null) {
      state.smoothedEar = result.currentEar;
    } else {
      state.smoothedEar = (
        EAR_SMOOTHING_ALPHA * result.currentEar
        + (1.0 - EAR_SMOOTHING_ALPHA) * state.smoothedEar
      );
    }

    sleepScore = earToSleepScore(Math.max(result.rightEar, result.leftEar));
    state.score = sleepScore;

    const rightEyeClosed = result.rightEar <= state.closedEarThreshold;
    const leftEyeClosed = result.leftEar <= state.closedEarThreshold;
    const sleepyNow = rightEyeClosed && leftEyeClosed;

    if (sleepyNow) {
      state.sleepyFrames += 1;

      if (state.sleepyFrames >= MIN_SLEEPY_FRAMES) {
        if (state.sleepyStartedAt == null) state.sleepyStartedAt = now;
        closedMs = now - state.sleepyStartedAt;
        status = closedMs >= ALARM_DELAY_MS ? "ALERT" : "Sleepy";
      } else {
        status = "Awake";
      }
    } else {
      state.sleepyFrames = 0;
      state.sleepyStartedAt = null;
      status = "Awake";
    }

    if (status === "ALERT") {
      if (!els.alertFrame.classList.contains("active")) {
        state.alerts += 1;
        playAlarm();
      }
      els.alertFrame.classList.add("active");
    } else {
      els.alertFrame.classList.remove("active");
    }
  }

  state.history.push(sleepScore);
  state.history = state.history.slice(-180);

  setStatus(status);
  updateMetrics(sleepScore, fps, closedMs);
  drawChart();
  drawOverlay(status.toUpperCase(), result.boxes, result.probs);

  state.rafId = requestAnimationFrame(loop);
}

async function start() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Camera Unsupported");
    showStartupDetail("Camera API unavailable");
    return;
  }

  els.startButton.disabled = true;
  setStatus("Opening Camera");
  await unlockAlarmAudio();

  await startCamera();
  els.stopButton.disabled = false;

  try {
    setStatus("Loading Model");
    state.model = state.model || await loadModel();

    setStatus("Loading FaceMesh");
    state.faceMesh = state.faceMesh || await loadFaceMesh();
  } catch (error) {
    const message = error?.message || String(error);
    setStatus("Startup Error");
    showStartupDetail(message);
    stopCamera();
    els.startButton.disabled = false;
    els.stopButton.disabled = true;
    return;
  }

  state.running = true;
  state.score = 0;
  state.history = [];
  state.smoothedEar = null;
  state.openEarBaseline = 0.32;
  state.closedEarThreshold = 0.21;
  state.sleepyFrames = 0;
  state.sleepyStartedAt = null;
  state.lastFrameAt = performance.now();
  setStatus("Awake");

  requestAnimationFrame(loop);
}

function stop() {
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  stopCamera();
  els.alertFrame.classList.remove("active");
  els.startButton.disabled = false;
  els.stopButton.disabled = true;
  setStatus("Standby");
  updateMetrics(0, Number.NaN, 0);
}

els.startButton.addEventListener("click", () => {
  start().catch((error) => {
    const message = error?.message || String(error);
    setStatus("Startup Error");
    showStartupDetail(message);
    stopCamera();
    els.startButton.disabled = false;
    els.stopButton.disabled = true;
  });
});

els.stopButton.addEventListener("click", stop);
els.themeButton.addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
  drawChart();
});

window.addEventListener("beforeunload", stopCamera);

if (window.lucide) window.lucide.createIcons();
drawChart();
updateMetrics(0, Number.NaN, 0);
