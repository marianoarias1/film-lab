# Ejecutar en Windows

Requiere Node.js. Extraé el ZIP y abrí la carpeta film-lab en VS Code. Ejecutá npm run dev y abrí http://localhost:5173. No requiere npm install. Para actualizar Vercel, reemplazá el código del repo (sin cambiar su Root Directory); vercel.json ya fija dist.

# Film Lab · Sony

Browser-local photo editor. Static HTML, CSS and ES modules; no image upload backend. Sites deployment serves `dist/`.

## Implemented
- JPEG/PNG/WebP import with browser orientation handling.
- RAW decoding (Sony ARW and LibRaw-supported formats) from sensor data via LibRaw-Wasm 1.0.5 in a module Web Worker. Camera white balance, full output dimensions, sRGB 8-bit. No silent embedded-thumbnail fallback.
- Local original presets and one explicitly approximate, attributed adaptation of Nostalgic Summer.
- Search by recipe/creator, favorites, browser-local custom recipes, JSON and OFR import, manual Fuji settings import, recipe JSON export.
- Source directory with links and source-site search; not a synced third-party catalog or scraper.
- Exposure, contrast, highlight/shadow/white/black tonal adjustments, temperature/tint, saturation/vibrance, selective HSL, 5-point curve, color-depth controls, grain, local detail/denoise, vignette, intensity.
- Before/after comparison; undo/redo; original source retained.
- Full-resolution JPEG/PNG export, 2048px/custom-size options, JPEG quality control and optional native file sharing.

## Rendering
Preview uses up to 1400px on the longest edge. Export uses original dimensions unless a smaller size is explicitly selected. Export processes 192-row bands with 1-row halos, with source-coordinate grain and vignette; each band executes in a worker. Target canvas remains full-sized. Very large images may exceed Safari memory/canvas limits; errors are surfaced without automatic downsampling. JPEG/PNG output does not retain camera EXIF metadata. The engine works on developed sRGB pixels and does not reproduce Fujifilm proprietary simulations or physically restore clipped capture data.

## Verification
- Syntax and HTML reference/asset checks.
- Neutral transform preserves test pixels exactly.
- Full processing equals tiled processing including detail halos, grain and vignette.
- A real Sony ILME-FX30 ARW decoded to 6272x4168 RGB pixels using the bundled decoder.
- DOM interaction checks passed for recipe selection, adjustments, undo, creator search, favorites, JSON import/persistence, source directory and mobile tabs.
- Browser UI QA unavailable in this environment; Safari/iPhone import, memory limits, downloads and sharing need device verification.

## Dependencies and attribution
See `dist/notices.txt`. LibRaw-Wasm is pinned and self-hosted. Demo photo is from Unsplash. No third-party creator photographs are included. Imported recipes retain source URLs and author attribution.


## Actualización photo + video
- Preview mobile: el mismo lienzo aparece encima de Recetas/Ajustes y queda sticky al desplazarse.
- Curva interactiva de hasta 16 puntos con arrastre X/Y, teclado, agregar y quitar puntos; conserva cinco controles numéricos por zona y controles X/Y del punto seleccionado. Compatible con recetas anteriores.
- 12 recetas originales editoriales/retro, además de las 7 iniciales y las 20 del catálogo online. No hay ranking verificable de popularidad ni copia de LUTs propietarios de Tezza/Prequel.
- Videos MP4/MOV/WebM reproducibles por el navegador: mismas recetas, copiar/pegar entre foto y video, preview WebGL y exportación con MediaRecorder. Los colores son una interpretación GPU del motor de foto; la interpolación y el grano pueden diferir ligeramente.
- Video beta: máximo 2 minutos; 720 o 1080 px de lado mayor, sin ampliar clips pequeños, 30 fps objetivo (dependiente del dispositivo), MP4 si el navegador permite, WebM en caso contrario. Puede conservar audio original con WebAudio. Recodifica durante reproducción en tiempo real: dejar pestaña visible y pantalla activa. No conserva HDR, códec, metadatos ni fps originales; salida SDR, sin LUTs externos. No solicita micrófono ni cámara.
- La edición y exportación de video requieren WebGL, canvas.captureStream y MediaRecorder. Si el formato/códec no es compatible, la UI lo informa; prueba recomendada en Safari actualizado para iPhone.
- Exportación por ZIP o archivos individuales incluye los clips procesados. Guardado en Fotos depende del soporte del menú del dispositivo.
- La sesión de fotos y videos sigue en memoria; no se añadió persistencia de proyectos en esta actualización.
- vercel.json incluido: publicar dist sin build, Root Directory en carpeta con package.json.

Validación: pruebas DOM de editor/álbum/share y preview mobile; curva aplicada a píxeles; shader GLSL compilado con EGL; flujo de grabación/audio/cancelación con APIs simuladas. No hubo QA en navegador real ni verificación de encoding/audio en iPhone.


## Correcciones v3.1
- Las tarjetas de recetas usan colores obtenidos al aplicar los ajustes a muestras azul/verde/cálida; también se aplica a recetas importadas y al catálogo online.
- Elegir una receta en mobile conserva el panel Recetas y la preview sticky.
- Preview de video con audio original al pulsar Reproducir; botón de audio independiente de la opción de exportación.
- Exportación: se prepara y dibuja un canvas de salida 2D, se espera a que la reproducción esté iniciada y al primer fotograma presentado (requestVideoFrameCallback, cuando existe) antes de arrancar MediaRecorder. Elimina la espera previa de play de la línea de tiempo grabada. Sin requestVideoFrameCallback se arranca después de resolver play.
- Pruebas: retención del panel, toggle de audio, paletas distintas y grabación que espera reproducción/primer frame; falta revalidación visual del inicio exportado en Safari real.
