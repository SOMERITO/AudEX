import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2";

const MODEL_ID = "onnx-community/whisper-base";
env.useBrowserCache = true;
env.useWasmCache = true;
env.allowRemoteModels = true;
env.allowLocalModels = false;
env.logLevel = 40;

let transcriber = null;
let loadingPromise = null;
let selectedDevice = "WASM/CPU";

function report(taskId, info) {
  self.postMessage({ type: "model-progress", taskId, info });
}
async function loadModel(taskId) {
  if (transcriber) return transcriber;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const progress_callback = (info) => report(taskId, info);
    if (self.navigator?.gpu) {
      try {
        const adapter = await self.navigator.gpu.requestAdapter();
        if (adapter) {
          self.postMessage({ type: "backend-note", taskId, note: "Aceleración gráfica disponible. Preparando WebGPU…" });
          transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
            dtype: "q8",
            device: "webgpu",
            progress_callback,
          });
          selectedDevice = "WebGPU";
          return transcriber;
        }
      } catch (error) {
        self.postMessage({ type: "backend-note", taskId, note: "WebGPU no pudo iniciarse; se utilizará el procesador del equipo." });
        transcriber = null;
      }
    }
    transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
      dtype: "q8",
      progress_callback,
    });
    selectedDevice = "WASM/CPU";
    return transcriber;
  })();
  try {
    return await loadingPromise;
  } catch (error) {
    loadingPromise = null;
    transcriber = null;
    throw error;
  }
}

self.addEventListener("message", async (event) => {
  const message = event.data || {};
  const { taskId, type } = message;
  try {
    if (type === "init") {
      await loadModel(taskId);
      self.postMessage({ type: "model-ready", taskId, device: selectedDevice });
      return;
    }
    if (type === "transcribe") {
      await loadModel(taskId);
      const waveform = new Float32Array(message.audio);
      const output = await transcriber(waveform, {
        language: "spanish",
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });
      self.postMessage({
        type: "transcription-result",
        taskId,
        output: { text: output.text || "", chunks: output.chunks || [] },
      });
      return;
    }
    throw new Error("Solicitud de transcripción no reconocida.");
  } catch (error) {
    self.postMessage({
      type: "task-error",
      taskId,
      error: error?.message || String(error),
    });
  }
});
