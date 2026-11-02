# AudEX — Transcriptor local de llamadas

AudEX convierte grabaciones completas a texto usando Whisper Base mediante faster-whisper. La versión recomendada procesa el audio dentro de tu computadora; no usa una API de transcripción ni sube el audio a un servicio externo.

## Requisitos

- Windows 10/11.
- Python 3.11 o 3.12 instalado desde https://www.python.org/downloads/windows/ (marcar **Add Python to PATH** durante la instalación).
- Conexión a internet para instalar dependencias y descargar Whisper Base la primera vez.
- Recomendado: 8 GB de RAM o más. Se ejecuta en CPU con cuantización INT8.

## Inicio rápido

1. Descarga el ZIP del repositorio y descomprímelo.
2. Si aún no tienes Python 3.11 o 3.12, instálalo.
3. Haz doble clic en `Abrir_AudEX.bat`.
4. La primera ejecución crea un entorno virtual e instala las dependencias. Después descarga Whisper Base.
5. AudEX se abrirá en `http://127.0.0.1:8765`.
6. Selecciona WAV, MP3, OGG, M4A, FLAC o WEBM y pulsa **Transcribir grabación**.
7. Copia la transcripción o descárgala como TXT.

En los siguientes usos, basta con ejecutar `Abrir_AudEX.bat`. El modelo queda guardado en la carpeta `models` y no se vuelve a descargar si ya está disponible.

## Cómo funciona

- Interfaz HTML servida por Flask en loopback (`127.0.0.1`).
- faster-whisper 1.2.1 con modelo multilingüe `base`, idioma español y ejecución CPU INT8.
- El servidor local recibe el archivo, transcribe y devuelve el texto con marcas de tiempo.
- La grabación temporal se elimina al terminar el proceso.
- El modelo se descarga con Python desde Hugging Face. Al ser una conexión de Python, no depende de CORS del navegador.

## Privacidad y uso responsable

El audio se procesa en tu computadora y se envía solo al servidor local `127.0.0.1`. No se envía a OpenAI, Google ni a otro servicio de transcripción. La descarga inicial del modelo sí requiere internet. Antes de procesar grabaciones laborales, confirma que su uso esté permitido por las políticas de UPC. Anonimiza nombres, teléfonos, documentos, códigos de estudiante y otros datos personales antes de compartir transcripciones.

## Solución de problemas

- Si aparece que no se encuentra Python, instala Python 3.11 o 3.12 y marca **Add Python to PATH**.
- Si pip o la descarga del modelo fallan, revisa la conexión y vuelve a ejecutar `Abrir_AudEX.bat`.
- No cierres la ventana **AudEX - Servidor local** mientras transcribes.
- Si el puerto 8765 está ocupado, cierra otro proceso que lo use o cambia `APP_PORT` en `server.py`.
- Para cerrar AudEX, presiona Ctrl+C en la ventana del servidor.

## Licencias

AudEX integra faster-whisper (MIT), CTranslate2 y modelos Whisper publicados por sus respectivos autores. Revisa las licencias de las dependencias y del modelo antes de redistribuir.
