# AudEX — Transcriptor local de llamadas

AudEX convierte grabaciones a texto usando Whisper Base mediante faster-whisper. El audio se procesa dentro de tu computadora; no usa una API de transcripción ni sube grabaciones a servicios externos.

## Novedades

- Selección múltiple de audios y procesamiento en cola secuencial.
- Estado individual por archivo; los trabajos fallidos se pueden reintentar sin repetir los terminados.
- Una transcripción editable por grabación.
- Copia al portapapeles y descarga individual en TXT o subtítulos SRT con marcas de tiempo.
- Mantiene el motor faster-whisper, el modelo Whisper Base y el flujo local existente.

## Requisitos

- Windows 10/11.
- Python 3.11 o 3.12 (marcar **Add Python to PATH**).
- Conexión a internet para instalar dependencias y descargar Whisper Base la primera vez.
- Recomendado: 8 GB de RAM o más. Se ejecuta en CPU con cuantización INT8.

## Inicio rápido

1. Descarga el ZIP del repositorio y descomprímelo.
2. Instala Python 3.11 o 3.12 si aún no lo tienes.
3. Ejecuta `Abrir_AudEX.bat`.
4. La primera ejecución crea el entorno virtual e instala dependencias; después descarga Whisper Base.
5. AudEX se abre en `http://127.0.0.1:8765`.
6. Selecciona varios audios (o arrástralos juntos) y pulsa **Transcribir todos**.

En los siguientes usos basta con ejecutar `Abrir_AudEX.bat`. El entorno y el modelo permanecen guardados en la carpeta del proyecto.

## Formatos

WAV, MP3, OGG, M4A, FLAC, WEBM, MP4, MPEG y MPGA (según los códecs disponibles en el sistema).

## Cómo funciona

- Interfaz HTML servida por Flask en loopback (`127.0.0.1`).
- faster-whisper 1.2.1, modelo multilingüe `base`, idioma español y CPU INT8.
- Los audios se transcriben uno por uno para evitar cargar simultáneamente varios modelos o archivos grandes en memoria.
- Cada transcripción conserva marcas de tiempo por segmento y se genera en formato SRT.
- El archivo temporal se elimina al finalizar cada trabajo, incluso si se produce un error.

## Privacidad y uso responsable

El audio se procesa en tu computadora y se envía únicamente al servidor local `127.0.0.1`. No se envía a OpenAI, Google ni a otro servicio de transcripción. La descarga inicial del modelo sí requiere internet. Antes de procesar grabaciones laborales, confirma que su uso esté permitido por las políticas de tu organización. Anonimiza nombres, teléfonos, documentos, códigos de estudiante y otros datos personales antes de compartir transcripciones.

## Solución de problemas

- Si Python no se encuentra, instala Python 3.11 o 3.12 y marca **Add Python to PATH**.
- Si pip o la descarga del modelo fallan, revisa la conexión y vuelve a ejecutar `Abrir_AudEX.bat`.
- No cierres la ventana **AudEX - Servidor local** mientras transcribes.
- Para cerrar AudEX, presiona Ctrl+C en la ventana del servidor.

## Licencias

AudEX integra faster-whisper (MIT), CTranslate2 y modelos Whisper publicados por sus respectivos autores. Revisa las licencias de las dependencias y del modelo antes de redistribuir.
