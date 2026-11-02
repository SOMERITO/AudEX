# AudEX — Transcriptor de llamadas

Aplicación web estática para transcribir grabaciones en español mediante Whisper Base en el navegador.

## Uso
1. Abre `index.html` con un servidor local o publica el repositorio con GitHub Pages.
2. Selecciona una grabación completa en WAV, MP3, OGG, M4A, FLAC o WEBM.
3. Pulsa **Transcribir grabación**.
4. Copia el texto o descárgalo como TXT para auditar la llamada.

AudEX decodifica el audio con Web Audio API, lo remuestrea a 16 kHz y lo procesa en bloques de 30 segundos con solapamiento. No tienes que dividir manualmente la llamada.

## Requisitos
- Chrome o Edge actualizado.
- Conexión a internet para cargar Transformers.js y el modelo Whisper Base.
- WebGPU cuando esté disponible; WASM/CPU como alternativa.

## Privacidad
La inferencia se realiza localmente en el navegador: el audio no se envía a un servicio de transcripción. La librería y los pesos del modelo se descargan desde jsDelivr y Hugging Face. Antes de compartir el texto, anonimiza nombres, teléfonos, documentos, códigos de estudiante y otros datos personales. Verifica que el tratamiento de grabaciones esté autorizado por las políticas de tu organización.

## Limitaciones
- No separa automáticamente la voz del asesor y del estudiante.
- Whisper puede equivocarse con nombres, cifras, siglas, ruido o voces superpuestas.
- El rendimiento depende del equipo y de WebGPU.
