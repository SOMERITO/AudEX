# AudEX — Transcripción de audio desde el navegador

AudEX transcribe directamente desde su página publicada. No necesitas descargar un ZIP, instalar Python, ejecutar un servidor local ni configurar una API.

## Uso

1. Abre la página de AudEX en GitHub Pages.
2. Arrastra uno o varios audios a cualquier parte de la página, o pulsa **Seleccionar audios**.
3. Pulsa **Transcribir audios**.
4. La primera ejecución descarga el modelo Whisper Base y los componentes de reconocimiento. El navegador puede conservarlos en caché para los siguientes usos.
5. Edita la transcripción si es necesario, copia el texto o descarga TXT/SRT.

## Procesamiento y privacidad

- El reconocimiento se ejecuta en el navegador mediante Transformers.js y ONNX Runtime.
- El modelo `onnx-community/whisper-base` se descarga desde Hugging Face; la biblioteca se carga desde jsDelivr.
- El audio seleccionado se decodifica y procesa en memoria en tu equipo. No se envía a un servidor de AudEX ni a una API de transcripción.
- Se utiliza WebGPU cuando está disponible; si no puede iniciarse, la aplicación usa WASM/CPU.
- El navegador conserva los archivos del modelo en caché cuando lo permite. Borrar los datos del sitio puede obligar a descargarlos de nuevo.

## Formatos

La página acepta WAV, MP3, OGG/OPUS, AAC, M4A, FLAC y WEBM. La lectura final depende de los códecs que admita el navegador; Chrome o Edge actuales ofrecen la compatibilidad más amplia.

## Tecnología

- [Transformers.js](https://github.com/huggingface/transformers.js) v4.3.2.
- [ONNX Whisper Base](https://huggingface.co/onnx-community/whisper-base), cuantización Q8.
- Web Audio API para decodificar y remuestrear audio a 16 kHz.
- Procesamiento de audios en cola, sin servidor propio.

Los archivos `server.py`, `Abrir_AudEX.bat` y `requirements-local.txt` pertenecen al modo local anterior y ya no son necesarios para utilizar la página de GitHub Pages.
