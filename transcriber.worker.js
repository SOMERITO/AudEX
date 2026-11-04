// AUDEX VERSION 1 | 2026-11-04 | Motor de reconocimiento en navegador.
const AUDEX_WORKER_VERSION = 1;
const MODEL_ID = "onnx-community/whisper-base";

const LIBRARY_SOURCES = [
  {
    name: "jsDelivr",
    url: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2",
      },
  {
    name: "unpkg",
    url: "https://unpkg.com/@huggingface/transformers@4.3.2?module",
    wasmPaths: "https://unpkg.com/@huggingface/transformers@4.3.2/dist/",
  },
  {
    name: "esm.sh",
    url: "https://esm.sh/@huggingface/transformers@4.3.2?bundle",
    wasmPaths: null,
  },
];

let pipeline = null;
let env = null;
let loadedSource = "";
let transcriber = null;
let loadingPromise = null;
let selectedDevice = "WASM/CPU";

function report(taskId, info) {
  self.postMessage({ type: "model-progress", taskId, info });
}

function errorText(error) {
  return error?.message || String(error || "Error desconocido");
}

async function loadLibrary(taskId) {
  if (pipeline && env) return;
  const failures = [];

  for (const source of LIBRARY_SOURCES) {
    self.postMessage({
      type: "backend-note",
      taskId,
      note: "Conectando con la biblioteca de reconocimiento (" + source.name + ")…",
    });

    try {
      const library = await import(source.url);
      if (typeof library.pipeline !== "function" || !library.env) {
        throw new Error("El CDN respondió, pero no entregó la API esperada de Transformers.js.");
      }

      pipeline = library.pipeline;
      env = library.env;
      loadedSource = source.name;

      env.useBrowserCache = true;
      env.useWasmCache = true;
      env.allowRemoteModels = true;
      env.allowLocalModels = false;
      env.logLevel = 30;

      // Let Transformers.js select the matching ONNX Runtime/WASM files.
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.wasmPaths = undefined;
      }

      // Preserve the exact URL when a model/config/tokenizer fetch fails.
      const nativeFetch = env.fetch || globalThis.fetch.bind(globalThis);
      env.fetch = async (resource, init) => {
        const requestedUrl = typeof resource === "string" ? resource :
          (resource && resource.url ? resource.url : String(resource));
        try {
          return await nativeFetch(resource, init);
        } catch (error) {
          throw new Error("No se pudo descargar: " + requestedUrl + ". " + errorText(error));
        }
      };

      self.postMessage({
        type: "backend-note",
        taskId,
        note: "Biblioteca cargada desde " + source.name + ". Comprobando acceso al modelo…",
      });

      try {
        const modelProbe = await env.fetch(
          "https://huggingface.co/onnx-community/whisper-base/resolve/main/config.json",
          { method: "GET", cache: "no-store" }
        );
        if (!modelProbe.ok) {
          throw new Error("Hugging Face respondió HTTP " + modelProbe.status + " al consultar config.json.");
        }
      } catch (error) {
        throw new Error(
          "No se puede acceder al modelo en Hugging Face desde este navegador. " +
          "Comprueba que tu conexión o extensiones no bloqueen huggingface.co. " + errorText(error)
        );
      }
      return;
    } catch (error) {
      failures.push(source.name + ": " + errorText(error));
    }
  }

  throw new Error(
    "No se pudo descargar Transformers.js desde ninguno de los servidores disponibles. " +
    "Comprueba tu conexión y que no estén bloqueados cdn.jsdelivr.net, unpkg.com o esm.sh. " +
    "Detalle: " + failures.join(" | ")
  );
}

async function createPipeline(taskId, device) {
  await loadLibrary(taskId);
  const progress_callback = (info) => report(taskId, info);
  const options = { dtype: "q8", progress_callback };
  if (device) options.device = device;
  return pipeline("automatic-speech-recognition", MODEL_ID, options);
}

async function loadModel(taskId) {
  if (transcriber) return transcriber;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      self.postMessage({
        type: "backend-note",
        taskId,
        note: "Preparando biblioteca y archivos del modelo Whisper Base…",
      });

      if (self.navigator?.gpu) {
        try {
          const adapter = await self.navigator.gpu.requestAdapter();
          if (adapter) {
            self.postMessage({
              type: "backend-note",
              taskId,
              note: "Probando aceleración WebGPU…",
            });
            transcriber = await createPipeline(taskId, "webgpu");
            selectedDevice = "WebGPU";
            return transcriber;
          }
        } catch (error) {
          transcriber = null;
          self.postMessage({
            type: "backend-note",
            taskId,
            note: "WebGPU no se pudo iniciar (" + errorText(error) + "). Se intentará con WASM/CPU.",
          });
        }
      }

      self.postMessage({
        type: "backend-note",
        taskId,
        note: "Cargando Whisper Base para procesar con WASM/CPU…",
      });
      transcriber = await createPipeline(taskId, undefined);
      selectedDevice = "WASM/CPU";
      return transcriber;
    } catch (error) {
      transcriber = null;
      const message = errorText(error);
      if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
        throw new Error(
          "El navegador no pudo descargar un archivo necesario para Whisper Base. " +
          "Verifica que tu red permita acceder a huggingface.co y a los CDN de la biblioteca. " +
          "El audio no se ha enviado. Detalle técnico: " + message
        );
      }
      throw error;
    }
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
      self.postMessage({ type: "model-ready", taskId, device: selectedDevice, source: loadedSource, version: AUDEX_WORKER_VERSION });
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
      error: errorText(error),
    });
  }
});
