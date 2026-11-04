# Historial de versiones de AudEX

Este proyecto utiliza una numeración entera y visible. La versión que aparece al pie de la página debe coincidir con los comentarios de los archivos de código y con `VERSION.txt`.

## Versión 1 — 04/11/2026

- Se establece el sistema de versiones visible dentro de la página.
- Se añaden marcadores de versión a `index.html`, `app.js` y `transcriber.worker.js`.
- Se incorpora `VERSION.txt` como referencia única del número vigente.
- Se añade este historial para registrar futuras modificaciones.
- Se versionan las URL de los módulos para evitar que el navegador reutilice archivos de una versión anterior.

## Regla para futuros cambios

Cada vez que se publique una modificación de código:
1. Incrementar el número: 1 → 2 → 3, y así sucesivamente.
2. Actualizar el comentario `AUDEX VERSION N` en los archivos de código modificados.
3. Actualizar el número visible en `index.html` y `app.js`.
4. Actualizar `VERSION.txt` y añadir una entrada a este historial.
5. Actualizar los parámetros de caché de los módulos para que el navegador descargue la nueva versión.
6. Confirmar que el número visible en la página coincida con `VERSION.txt`.

No se debe reutilizar un número de versión ya publicado.
