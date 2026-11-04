const $ = (id) => document.getElementById(id);
const ACCEPTED = /\.(wav|mp3|ogg|opus|aac|m4a|flac|webm|mp4|mpeg|mpga)$/i;
const TARGET_RATE = 16000;

const input = $("audioFiles");
const dropZone = $("dropZone");
const overlay = $("dropOverlay");
const fileList = $("fileList");
const startBtn = $("startBtn");
const clearBtn = $("clearBtn");
const statusBox = $("status");
const progressBar = $("progressBar");

let queue = [];
let busy = false;
let worker = null;
let nextId = 1;
let activeRequests = new Map();
let modelReady = false;

function prettySize(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function setStatus(title, message = "", progress = null, tone = "normal") {
  statusBox.classList.add("show");
  $("statusTitle").textContent = title;
  $("statusTitle").style.color = tone === "error" ? "var(--red)" : "var(--text)";
  $("statusMessage").textContent = message;
  $("statusPercent").textContent = Number.isFinite(progress) ? Math.round(progress) + "%" : "";
  progressBar.classList.toggle("indeterminate", progress === null);
  progressBar.style.width = progress === null ? "35%" : Math.max(0, Math.min(100, progress)) + "%";
}
function hideStatus() {
  statusBox.classList.remove("show");
  progressBar.classList.remove("indeterminate");
  progressBar.style.width = "0%";
  $("statusPercent").textContent = "";
}
function countWords(text) {
  return (String(text || "").trim().match(/\S+/g) || []).length;
}
function renderQueue() {
  const pending = queue.filter((item) => item.status === "queued" || item.status === "error").length;
  $("queueCount").textContent = queue.length
    ? queue.length + " audio(s) · " + pending + " pendiente(s)"
    : "Todavía no has agregado audios.";
  startBtn.disabled = busy || pending === 0;
  clearBtn.disabled = busy || queue.length === 0;

  if (!queue.length) {
    fileList.innerHTML = '<div class="empty">Tus grabaciones aparecerán aquí.</div>';
    return;
  }
  fileList.innerHTML = queue.map((item) => {
    const stateClass = item.status === "done" ? "done" : item.status === "error" ? "error" : item.status === "running" ? "running" : "";
    const label = item.status === "done" ? "Transcrito" : item.status === "error" ? "Error" : item.status === "running" ? item.label || "Procesando…" : "En espera";
    return '<div class="file-row"><div class="file-main"><div class="file-name">' + escapeHtml(item.file.name) +
      '</div><div class="file-meta">' + prettySize(item.file.size) + (item.duration ? " · " + formatDuration(item.duration) : "") +
      '</div></div><div class="file-actions"><span class="file-state ' + stateClass + '">' + escapeHtml(label) +
      '</span><button class="quiet small" data-remove="' + item.id + '" ' + (busy ? "disabled" : "") + '>Quitar</button></div></div>';
  }).join("");
}
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
    : [m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
function addFiles(fileArray) {
  if (busy) {
    setStatus("Espera a que termine la cola", "Después podrás agregar más grabaciones.", null, "error");
    return;
  }
  let added = 0;
  let rejected = 0;
  for (const file of fileArray) {
    const looksAudio = file.type.startsWith("audio/") || ACCEPTED.test(file.name);
    if (!looksAudio) { rejected++; continue; }
    const duplicate = queue.some((item) =>
      item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified
    );
    if (duplicate) continue;
    queue.push({ id: nextId++, file, status: "queued", label: "En espera", transcript: "", chunks: [], duration: 0, error: "" });
    added++;
  }
  renderQueue();
  if (added) {
    setStatus("Audio detectado y agregado", added + " grabación(es) lista(s) para transcribir." +
      (rejected ? " Se ignoraron " + rejected + " archivo(s) que no parecen ser audio." : ""), 100);
  } else if (rejected) {
    setStatus("No se reconoció un archivo de audio", "Prueba con MP3, WAV, OGG/OPUS, M4A, AAC, FLAC o WEBM.", 0, "error");
  } else if (fileArray.length) {
    setStatus("No se agregaron archivos nuevos", "Es posible que ya estén en la lista.", 100);
  }
}
input.addEventListener("change", (event) => {
  addFiles(Array.from(event.target.files || []));
  input.value = "";
});
fileList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button || busy) return;
  queue = queue.filter((item) => item.id !== Number(button.dataset.remove));
  renderQueue();
  renderResults();
  if (!queue.length) hideStatus();
});
clearBtn.addEventListener("click", () => {
  if (busy) return;
  queue = [];
  $("results").innerHTML = "";
  renderQueue();
  hideStatus();
});
dropZone.addEventListener("click", (event) => {
  if (!event.target.closest("label")) input.click();
});
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    input.click();
  }
});

let dragDepth = 0;
function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}
document.addEventListener("dragenter", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth++;
  overlay.classList.add("show");
  dropZone.classList.add("drag");
});
document.addEventListener("dragover", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  overlay.classList.add("show");
});
document.addEventListener("dragleave", (event) => {
  if (!isFileDrag(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    overlay.classList.remove("show");
    dropZone.classList.remove("drag");
  }
});
document.addEventListener("drop", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth = 0;
  overlay.classList.remove("show");
  dropZone.classList.remove("drag");
  addFiles(Array.from(event.dataTransfer?.files || []));
});

function createWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./transcriber.worker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", handleWorkerMessage);
  worker.addEventListener("error", (event) => {
    const message = event.message || "No se pudo iniciar el motor de transcripción.";
    for (const request of activeRequests.values()) request.reject(new Error(message));
    activeRequests.clear();
  });
  return worker;
}
function workerRequest(type, payload = {}, transfer = [], onProgress = null) {
  createWorker();
  const taskId = "task-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  return new Promise((resolve, reject) => {
    activeRequests.set(taskId, { resolve, reject, onProgress });
    worker.postMessage({ type, taskId, ...payload }, transfer);
  });
}
function handleWorkerMessage(event) {
  const message = event.data || {};
  const request = activeRequests.get(message.taskId);
  if (!request) return;
  if (message.type === "model-progress" || message.type === "backend-note") {
    request.onProgress?.(message);
    return;
  }
  if (message.type === "model-ready" || message.type === "transcription-result") {
    activeRequests.delete(message.taskId);
    request.resolve(message);
    return;
  }
  if (message.type === "task-error") {
    activeRequests.delete(message.taskId);
    request.reject(new Error(message.error || "Error desconocido del motor."));
  }
}

async function decodeAndResample(file) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Este navegador no ofrece decodificación de audio. Prueba con una versión reciente de Chrome o Edge.");
  const context = new AudioContextClass();
  try {
    const encoded = await file.arrayBuffer();
    let decoded;
    try {
      decoded = await context.decodeAudioData(encoded);
    } catch {
      throw new Error("El navegador no pudo leer este formato de audio. Prueba con MP3, WAV, OGG/OPUS, M4A o WEBM.");
    }
    const inputRate = decoded.sampleRate;
    const outputLength = Math.ceil(decoded.length * TARGET_RATE / inputRate);
    if (!outputLength) throw new Error("La grabación está vacía o no contiene audio legible.");
    const channels = [];
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) channels.push(decoded.getChannelData(channel));
    const output = new Float32Array(outputLength);
    const ratio = inputRate / TARGET_RATE;
    for (let i = 0; i < outputLength; i++) {
      const sourcePosition = i * ratio;
      const index = Math.min(Math.floor(sourcePosition), decoded.length - 1);
      const nextIndex = Math.min(index + 1, decoded.length - 1);
      const fraction = sourcePosition - index;
      let sample = 0;
      for (const channel of channels) {
        sample += channel[index] + (channel[nextIndex] - channel[index]) * fraction;
      }
      output[i] = sample / channels.length;
      if (i > 0 && i % 800000 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { audio: output, duration: decoded.duration };
  } finally {
    await context.close().catch(() => {});
  }
}
function updateModelProgress(message) {
  const info = message.info || {};
  if (info.status === "progress_total" && Number.isFinite(info.progress)) {
    setStatus("Descargando Whisper Base", "Primera ejecución: se guardará en la caché de este navegador.", info.progress);
  } else if (info.status === "download") {
    setStatus("Descargando Whisper Base", info.file || "Preparando archivos del modelo…", null);
  } else if (info.status === "progress") {
    setStatus("Descargando Whisper Base", info.file || "Descargando archivos del modelo…", info.progress);
  } else if (message.note) {
    setStatus("Preparando motor de transcripción", message.note, null);
  }
}
async function transcribeQueue() {
  if (busy) return;
  const pending = queue.filter((item) => item.status === "queued" || item.status === "error");
  if (!pending.length) return;
  busy = true;
  renderQueue();
  startBtn.disabled = true;
  clearBtn.disabled = true;
  input.disabled = true;
  let completed = queue.filter((item) => item.status === "done").length;
  const total = pending.length;
  try {
    if (!modelReady) {
      setStatus("Preparando Whisper Base", "La primera ejecución descarga el modelo. No cierres esta pestaña.", null);
      const ready = await workerRequest("init", {}, [], updateModelProgress);
      modelReady = true;
      setStatus("Motor listo", "Whisper Base está preparado. Comenzando las grabaciones…", 100);
      window.setTimeout(hideStatus, 900);
      worker.backend = ready.device;
    }
    for (let index = 0; index < pending.length; index++) {
      const item = pending[index];
      item.status = "running";
      item.label = "Leyendo audio…";
      renderQueue();
      setStatus("Preparando audio " + (index + 1) + " de " + total, item.file.name, null);
      try {
        const prepared = await decodeAndResample(item.file);
        item.duration = prepared.duration;
        item.label = "Transcribiendo…";
        renderQueue();
        setStatus("Transcribiendo " + (index + 1) + " de " + total, item.file.name + " · " + formatDuration(prepared.duration), null);
        const result = await workerRequest("transcribe", { audio: prepared.audio.buffer }, [prepared.audio.buffer]);
        item.transcript = String(result.output?.text || "").trim();
        item.chunks = Array.isArray(result.output?.chunks) ? result.output.chunks : [];
        if (!item.transcript) throw new Error("No se detectó voz. Comprueba que la grabación tenga sonido audible.");
        item.status = "done";
        item.label = "Transcrito";
        completed++;
      } catch (error) {
        item.status = "error";
        item.label = "No se pudo transcribir";
        item.error = error.message || String(error);
      }
      renderQueue();
      renderResults();
    }
  } catch (error) {
    setStatus("No se pudo iniciar el motor", error.message || String(error), 0, "error");
  } finally {
    busy = false;
    input.disabled = false;
    clearBtn.disabled = queue.length === 0;
    const failed = queue.filter((item) => item.status === "error").length;
    startBtn.textContent = failed ? "Reintentar pendientes" : "Transcribir audios";
    startBtn.disabled = !queue.some((item) => item.status === "queued" || item.status === "error");
    if (completed || failed) {
      setStatus(failed ? "Proceso terminado con algunos errores" : "Transcripción completada",
        completed + " grabación(es) transcrita(s) · " + failed + " con error. Puedes editar, copiar o descargar los resultados.",
        100, failed ? "error" : "normal");
    }
    renderQueue();
  }
}
startBtn.addEventListener("click", transcribeQueue);

function secondsToSrt(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const h = Math.floor(value / 3600000);
  const m = Math.floor((value % 3600000) / 60000);
  const s = Math.floor((value % 60000) / 1000);
  const ms = value % 1000;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":") + "," + String(ms).padStart(3, "0");
}
function buildSrt(chunks) {
  return chunks.filter((chunk) => chunk && Array.isArray(chunk.timestamp) && chunk.timestamp.length === 2 && chunk.timestamp.every(Number.isFinite) && chunk.text?.trim())
    .map((chunk, index) => (index + 1) + "\n" + secondsToSrt(chunk.timestamp[0]) + " --> " + secondsToSrt(chunk.timestamp[1]) + "\n" + chunk.text.trim())
    .join("\n\n");
}
function downloadText(content, filename, mime = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function renderResults() {
  const done = queue.filter((item) => item.status === "done");
  $("results").innerHTML = done.map((item) => {
    const srt = buildSrt(item.chunks);
    return '<article class="result-card"><div class="result-head"><div><h2>' + escapeHtml(item.file.name) +
      '</h2><span class="result-meta">' + countWords(item.transcript).toLocaleString("es-PE") + ' palabras · ' +
      formatDuration(item.duration) + '</span></div><span class="file-state done">Listo</span></div><textarea data-transcript="' +
      item.id + '" spellcheck="false">' + escapeHtml(item.transcript) + '</textarea><div class="result-actions"><button class="primary small" data-copy="' +
      item.id + '">Copiar texto</button><button class="secondary small" data-txt="' + item.id +
      '">Descargar TXT</button><button class="secondary small" data-srt="' + item.id + '" ' +
      (srt ? "" : "disabled") + '>Descargar SRT</button></div></article>';
  }).join("");
}
$("results").addEventListener("input", (event) => {
  const textarea = event.target.closest("[data-transcript]");
  if (!textarea) return;
  const item = queue.find((entry) => entry.id === Number(textarea.dataset.transcript));
  if (item) item.transcript = textarea.value;
});
$("results").addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy]");
  const txtButton = event.target.closest("[data-txt]");
  const srtButton = event.target.closest("[data-srt]");
  if (copyButton) {
    const item = queue.find((entry) => entry.id === Number(copyButton.dataset.copy));
    const textarea = $("results").querySelector('[data-transcript="' + item.id + '"]');
    try {
      await navigator.clipboard.writeText(textarea.value);
      setStatus("Texto copiado", "La transcripción está en el portapapeles.", 100);
    } catch {
      textarea.select();
      document.execCommand("copy");
      setStatus("Texto copiado", "La transcripción está en el portapapeles.", 100);
    }
  }
  if (txtButton) {
    const item = queue.find((entry) => entry.id === Number(txtButton.dataset.txt));
    const textarea = $("results").querySelector('[data-transcript="' + item.id + '"]');
    downloadText(textarea.value, item.file.name.replace(/\.[^.]+$/, "") + "_transcripcion.txt");
  }
  if (srtButton) {
    const item = queue.find((entry) => entry.id === Number(srtButton.dataset.srt));
    const srt = buildSrt(item.chunks);
    if (srt) downloadText(srt, item.file.name.replace(/\.[^.]+$/, "") + "_subtitulos.srt");
  }
});

if (!("AudioContext" in window || "webkitAudioContext" in window)) {
  setStatus("Navegador no compatible", "Abre AudEX en una versión reciente de Chrome o Edge para decodificar audios.", 0, "error");
}
