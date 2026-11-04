from __future__ import annotations

import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename
from faster_whisper import WhisperModel

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "temp_uploads"
MODEL_DIR = BASE_DIR / "models"
UPLOAD_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)

APP_HOST = "127.0.0.1"
APP_PORT = 8765
MODEL_NAME = os.environ.get("AUDEX_MODEL", "base")
MAX_UPLOAD_BYTES = 1024 * 1024 * 1024

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

@app.after_request
def add_local_web_cors(response):
    """Allow the AudEX GitHub Pages UI to call only this local server."""
    origin = request.headers.get("Origin")
    if request.path.startswith("/api/") and origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        requested_headers = request.headers.get("Access-Control-Request-Headers")
        response.headers["Access-Control-Allow-Headers"] = requested_headers or "Content-Type"
        # Chromium may send a Private Network Access preflight when a public
        # HTTPS page contacts the loopback server.
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        response.headers["Access-Control-Max-Age"] = "600"
    return response


ALLOWED_EXTENSIONS = {".wav", ".mp3", ".ogg", ".opus", ".aac", ".m4a", ".flac", ".webm", ".mp4", ".mpeg", ".mpga"}
ALLOWED_ORIGINS = {
    f"http://{APP_HOST}:{APP_PORT}",
    f"http://localhost:{APP_PORT}",
    "https://somerito.github.io",
}
MODEL: WhisperModel | None = None
MODEL_LOCK = threading.Lock()
JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()


def update_job(job_id: str, **fields: Any) -> None:
    with JOBS_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(fields)
            JOBS[job_id]["updated_at"] = time.time()


def get_model() -> WhisperModel:
    global MODEL
    if MODEL is None:
        MODEL = WhisperModel(
            MODEL_NAME,
            device="cpu",
            compute_type="int8",
            cpu_threads=max(2, (os.cpu_count() or 4) - 1),
            download_root=str(MODEL_DIR),
        )
    return MODEL


def format_timestamp(seconds: float) -> str:
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}" if hours else f"{minutes:02d}:{secs:02d}"


def format_srt_timestamp(seconds: float) -> str:
    total_ms = max(0, round(seconds * 1000))
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, milliseconds = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


def run_transcription(job_id: str, file_path: Path) -> None:
    try:
        update_job(job_id, status="running", progress=4, message="Preparando Whisper Base…",
                   detail="La primera vez se descargará el modelo. Puede tardar varios minutos.")
        with MODEL_LOCK:
            model = get_model()
            update_job(job_id, status="running", progress=12, message="Transcribiendo la llamada…",
                       detail="El audio se está procesando localmente. Mantén abierta esta página.")
            segments_iter, info = model.transcribe(
                str(file_path), language="es", task="transcribe", beam_size=5,
                vad_filter=True, condition_on_previous_text=True, word_timestamps=False,
            )
            transcript_parts: list[str] = []
            timed_parts: list[str] = []
            srt_parts: list[str] = []
            count = 0
            for segment in segments_iter:
                text = (segment.text or "").strip()
                if not text:
                    continue
                transcript_parts.append(text)
                timed_parts.append(f"[{format_timestamp(segment.start)}] {text}")
                count += 1
                srt_parts.append(
                    f"{count}\n{format_srt_timestamp(segment.start)} --> "
                    f"{format_srt_timestamp(segment.end)}\n{text}"
                )
                if count % 4 == 0:
                    update_job(job_id, progress=min(95, 12 + count),
                               message="Transcribiendo la llamada…",
                               detail=f"{count} segmentos reconocidos.")
            transcript = " ".join(transcript_parts).strip()
            if not transcript:
                raise RuntimeError("No se detectó voz en la grabación. Comprueba que el audio tenga sonido audible.")
            timestamped = "\n".join(timed_parts).strip()
            update_job(
                job_id, status="done", progress=100, message="Transcripción completada.",
                detail=f"{count} segmentos reconocidos.", transcript=timestamped or transcript,
                transcript_plain=transcript, srt="\n\n".join(srt_parts).strip() + "\n",
                language=getattr(info, "language", "es"),
                language_probability=getattr(info, "language_probability", None),
                segment_count=count,
            )
    except Exception as exc:
        update_job(job_id, status="failed", progress=0, message="Error durante la transcripción.",
                   error=f"{type(exc).__name__}: {exc}")
    finally:
        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            pass


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/api/health")
def health():
    return jsonify(ok=True, model_loaded=MODEL is not None, model=MODEL_NAME, mode="local")


@app.post("/api/transcribe")
def create_transcription():
    origin = request.headers.get("Origin")
    if origin and origin not in ALLOWED_ORIGINS:
        return jsonify(error="Origen no permitido."), 403
    uploaded = request.files.get("audio")
    if uploaded is None or not uploaded.filename:
        return jsonify(error="Selecciona una grabación de audio."), 400
    safe_name = secure_filename(uploaded.filename)
    extension = Path(safe_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify(error="Formato no admitido. Usa WAV, MP3, OGG/OPUS, AAC, M4A, FLAC o WEBM."), 415
    job_id = uuid.uuid4().hex
    file_path = UPLOAD_DIR / f"{job_id}{extension}"
    try:
        uploaded.save(file_path)
    except Exception as exc:
        return jsonify(error=f"No se pudo guardar temporalmente el audio: {exc}"), 500
    with JOBS_LOCK:
        cutoff = time.time() - 3 * 60 * 60
        for old_id in list(JOBS):
            if JOBS[old_id].get("updated_at", 0) < cutoff:
                JOBS.pop(old_id, None)
        JOBS[job_id] = {"status": "queued", "progress": 1,
                        "message": "Audio recibido; esperando el motor de transcripción.",
                        "detail": safe_name, "updated_at": time.time()}
    worker = threading.Thread(target=run_transcription, args=(job_id, file_path),
                              daemon=True, name=f"AudEX-{job_id[:8]}")
    worker.start()
    return jsonify(job_id=job_id), 202


@app.get("/api/jobs/<job_id>")
def get_job(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None:
            return jsonify(error="No se encontró este trabajo. Inicia la transcripción nuevamente."), 404
        return jsonify(dict(job))


@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="El archivo supera el límite local de 1 GB."), 413


if __name__ == "__main__":
    print("\nAudEX está activo en http://127.0.0.1:8765")
    print("El audio se procesa localmente. Presiona Ctrl+C para cerrar el servidor.\n")
    app.run(host=APP_HOST, port=APP_PORT, debug=False, use_reloader=False, threaded=True)
