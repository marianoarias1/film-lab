# Film Lab v6.1 · Mobile layout corrections

- Editing layout reserves independent scrolling space for filters/controls. Both portrait and landscape previews share a bounded height; full-screen remains available. The Fotos screen retains its larger photo below the collection.
- Single-column filter list, compact undo/redo row, current-look chip, image-corner fullscreen action and bottom navigation icons follow the approved reference. Existing colors and fonts are unchanged.
- Cloud badges use green fill with a white clock/check; errors use a contrasting red badge.
- Hold-original suppresses native selection, callout and image dragging on the canvas, without disabling selection in text inputs. Release/cancellation restores the edited image.
- ZIP exports retain an explicit download link after preparation, so browsers that block an asynchronous automatic download can retry from a fresh tap. Changing scope/settings invalidates the retained URL.
- Export sheet shows selected thumbnails and exposes detailed format/quality in a disclosure.

Validation: syntax and simulated DOM integration, including selected-only ZIP creation/retry/invalidation, native-selection event prevention, undo/redo, fullscreen restoration and persisted sessions. Browser-native Safari gesture behavior and actual device layout still require iPhone validation; no visual browser QA was available here.

# Film Lab v6 · Mobile editing workspace

- Mobile navigation: Fotos, Filtros, Editar, Proyecto. First import gently highlights Filtros without navigating. Reduced motion is respected.
- Larger orientation-aware sticky preview while editing, with undo/redo, compare and full-screen viewing. Full screen supports hold-original, pinch/wheel zoom and pan; closing returns to the same section.
- Fixed mobile export action counts selected files. Every export opening defaults to selection; all/current remain explicit options. ZIP and individual sharing keep their existing behavior.
- Cloud/local state is summarized by an accessible icon; details and retries remain available in a dialog/Proyecto. Guests are explicitly local-only. No database changes.
- Seven original Film Lab looks use distinct curves/HSL treatments: Botánica, Flash de Diario, Plata Editorial, Bronce Salino, Piel de Seda, Plata Marina and Costa Editorial. They are visual interpretations, not third-party presets. Five overlapping legacy looks are hidden from the default catalog but retain IDs, favorites, search and project compatibility.
- Filter thumbnails render the user's developed photo. They preview the preset at full intensity; final rendering uses each file's own settings/intensity.
- Per-file undo/redo and local/cloud recovery are preserved. Slider edits group one gesture into one undo step, including keyboard/assistive input.

Validation: syntax checks; simulated DOM integration for mobile navigation, selected-only actual export preparation, fullscreen enter/exit, hold-original, independent undo/redo and reload recovery. Native Safari touch, memory limits, RAW decoding and real video export still need device validation. No browser visual QA was available in the managed preview environment.

## Previous behavior and deployment instructions

# Film Lab v5 · Automatic recovery and private drafts

This release changes saving behavior: originals and per-file edit state are saved automatically on this device using IndexedDB; signed-in sessions also upload automatically to private Supabase drafts. Guests are never uploaded. The session is restored automatically on reload, including active file, selection, copied settings and each file’s undo/redo. The original JPEG/RAW/video bytes are stored, not only thumbnails.

The session bar distinguishes actual local transaction completion from cloud synchronization. Local storage failures/quota and cloud failures are shown separately, with retry controls. We request persistent browser storage when available, but browsers/users can still clear it. Private sessions are scoped by account; signing out restores the guest session and keeps the private local session for that account’s next login. Another tab cannot silently overwrite a newer local session.

Uploads and edit RPC retries persist their stable project/asset/event IDs before network requests. A reload retries unfinished uploads (from the beginning when necessary) without creating duplicate originals or history. Background cloud copying leaves editing controls available. Naming a draft uses the same project ID; saving a copy creates independent IDs. The current configuration uploads up to 100 files/project and 50 MB/file; larger files remain local and the status explains this. A cloud-only project remains accessible from My profile if the browser copy is cleared. Reloading the website still needs the app page/assets to be available; this release does not add an offline service worker.

App confirmations use branded dialogs for deleting recipes/projects, removing files, starting sessions, signing out, opening projects and restoring versions. Destructive actions are explicit. The browser’s warning about leaving while a local transaction or non-durable collection operation is pending remains browser-controlled. Deleting an active cloud project also closes its editor session so it is not automatically uploaded again.

## Run and deploy

Extract the ZIP, open the film-lab folder, run `npm install` and `npm run dev` (http://localhost:5173). For Vercel use the same project setup as before: `dist` contains the deployable site. The Supabase project already has the automatic-drafts migration applied; do not rerun the SQL files there. `database/film_lab_automatic_drafts.sql` is a reference patch for older installations, while the consolidated foundation includes the latest schema. Public browser configuration is in `dist/cloud-config.js`; there is no privileged service key in this code.

## Verification

JavaScript checks; DOM tests for the full editor across reloads, selection/undo, branded confirmation cancellation and deletion; IndexedDB tests for exact RAW/video original bytes, atomic quota failure/retry, account isolation and two-tab conflicts; mocked Supabase end-to-end tests for interrupted-upload and lost-RPC-response reload recovery without duplicate project/asset/history records; real Supabase rollback transaction verifies private draft creation, naming and owner isolation. Existing batch export/sharing, mobile panel, curve and guest-collection tests also passed. Actual Safari/mobile layout, large-file storage behavior and real user email login still need device validation.

The existing Supabase advisory for leaked-password protection remains documented below; no new RLS policies were needed for draft metadata.

---

## Historical release notes (v5 saving behavior supersedes the earlier manual-save flow)

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


## Film Lab v4 · Supabase

El proyecto Supabase film lab ya tiene la base aplicada: profiles, projects, media_assets, edits, recipes, favorites y editing_history, con RLS por propietario. Originales y miniaturas en buckets privados. SQL de referencia en database/; ya está aplicado, no volver a ejecutarlo sobre el mismo proyecto. Las migraciones están registradas en Supabase.

### Uso
- Invitado: edición y exportación libre, recetas/favoritas locales, sin subida de fotos.
- Cuenta opcional con email/contraseña, confirmación y recuperación de contraseña.
- Guardar proyecto es la primera subida explícita de originales. Puede subir solo los archivos seleccionados. Después se guardan automáticamente los ajustes de los archivos ya guardados (agrupados tras 1.5 s sin cambios). Para agregar originales nuevos usar Guardar proyecto otra vez.
- Perfil: abrir proyectos, importar colección local, ver historial con valores anteriores/nuevos y fecha, recuperar versiones, eliminar proyectos.
- Quitar un archivo de la sesión de un proyecto guardado lo archiva en el proyecto: conserva original/historial para recuperar. Eliminar un proyecto quita sus objetos y luego sus metadatos/historial; si falla, se puede reintentar.
- Cambiar de cuenta mantiene colecciones separadas. Cerrar la cuenta con proyecto privado limpia esa sesión del editor.
- Historial desde el primer guardado en nube; no es un registro forense ni registra ediciones hechas antes de subir el proyecto.
- Originales: 50 MB/archivo en esta configuración; hasta 100 archivos por guardado. Archivos grandes pueden editarse localmente. Para elevar el límite cambiar límite del bucket, restricción size_bytes de media_assets y maxFileBytes en cloud-config.js.
- Archivos mayores a 6 MB se suben en chunks TUS de 6 MB con reintentos durante la sesión. Los originales solo se suben una vez por proyecto salvo reintento. No se prometen reanudaciones después de cerrar/reiniciar el navegador: los archivos pendientes siguen en memoria.
- Proyectos e historial paginados; colección por lotes; carga de archivos secuencial; conflictos entre pestañas/dispositivos detectados mediante revision en save_edit. Si hay conflicto, recuperar el proyecto o guardar una copia.
- Proyectos/ediciones se guardan en el servidor; invitados conservan recetas/favoritas en localStorage. No se añadió IndexedDB en esta versión.

### Configuración de Auth que falta hacer en el dashboard

La integración disponible no permite modificar URLs de Auth ni configurar las credenciales del proveedor SMTP. No se desactivó la confirmación de email.

1. En Authentication → URL Configuration, usar Site URL https://film-lab-joy.vercel.app/ y autorizar como Redirect URLs:
   - https://film-lab-joy.vercel.app/
   - http://localhost:5173/
   - https://mariano-film-lab.softacorn9.chatgpt.site/ (si se usa la versión de prueba).
2. Configurar un proveedor SMTP propio en Authentication para registros y recuperación de usuarios externos. El SMTP por defecto de Supabase solo envía a miembros del equipo y tiene límites muy bajos. Elegir proveedor y cargar credenciales en el dashboard, nunca en el frontend ni en el chat.
3. Registrar una cuenta desde la app, confirmar email, guardar un proyecto y reabrirlo en otra sesión/dispositivo. No se enviaron emails reales ni se crearon usuarios de prueba permanentes durante el desarrollo.

Documentación: [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

### Código y dependencias

- npm run dev: servidor local, no requiere npm install porque los clientes están incluidos en dist/vendor/supabase.
- npm ci + npm run vendor: regenerar SDKs con dependencias fijadas en package-lock.json.
- @supabase/supabase-js 2.117.3 y tus-js-client 4.3.1, bundle con esbuild 0.25.12.
- cloud-config.js contiene únicamente la URL y una clave publishable pública. Nunca añadir service_role o secret keys allí. La autorización real está en RLS y las políticas de Storage.
- cloud.js: cuenta, sincronización, perfil/proyectos/historial. cloud-model.js: snapshots y diferencias. cloud-upload.js: subida estándar/TUS.
- Al desplegar en Vercel usar vercel.json incluido, sin build y dist como salida. La versión de Vercel se actualiza subiendo este código al repositorio del usuario.

### Validación

Pruebas DOM de editor/álbum/share/mobile, APIs simuladas para cuenta/subida/historial/favoritos/reintentos, guardas de video y pruebas SQL sobre Supabase real con usuarios temporales dentro de transacciones revertidas. Aislamiento, snapshots, deduplicación y concurrencia verificados. API anónima devuelve 401 a tablas y RPC privados. Advisors de seguridad sin avisos; rendimiento solo reporta [índices nuevos aún sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), esperado antes de tráfico.

No hubo QA visual en navegador real ni prueba de registro, email, subida TUS o recuperación de proyecto desde un teléfono real. Quedan esas pruebas de aceptación tras configurar Auth/SMTP.

## v4.1 · Projects and collection fixes

- The active project is explicit in the session bar, including on mobile. New project starts a fresh editor session. Removing an editor file does not delete or archive its saved original; deleting a cloud project remains an explicit confirmed action. Emptying the editor exits the project after pending edits save.
- Save a copy creates a separate project with the currently loaded files; it requires at least one file and never clears the source project.
- Project names are unique per account, ignoring case and surrounding spaces. Existing duplicates are preserved with numbered names. The connected database already has the migration; the SQL file is a reference for other installations.
- Each project card has its own History button. History queries filter project_id before pagination.
- Signed-in recipes and favorites go directly to Supabase, with immediate progress/success feedback. Guest collections remain browser-local with an explicit notice. Account collections are not persisted in localStorage; failed operations remain in memory and warn before closing. Previously pending browser jobs are recovered once and then removed. Authentication still persists the login session.

Validation: JavaScript checks, mocked DOM project/collection regression tests and a rollback-only Supabase uniqueness test. Actual mobile layout and email sign-in still need testing on the target device.

Supabase advisory at validation: compromised-password checking is disabled in Auth. Configure it in the dashboard when available for your plan: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . The project-name migration introduces no new Auth or RLS policies.

## v4.2 · Selective guest import and recipe deletion

- On sign-in/session recovery, a dialog offers guest recipes and favorites that are not already in the account. Each item has an independent checkbox, initially unchecked, with name, creator and type. Selection shortcuts and a count are provided. Unresolvable favorites remain visible but disabled. The old profile import button is removed.
- Confirm closes the dialog immediately. Import runs in the background without locking the editor or replacing its session/selected look. Progress, completion, and retry for unfinished selected items appear in the session bar. Guest originals stay in the guest collection; neither unselected recipes nor the recipe behind a selected favorite are implicitly imported as owned recipes. Existing account entries are not overwritten. Keep the tab open until completion. Ahora no / dismiss avoids repeating the same prompt during the browser session; account switches isolate the background work.
- Own recipe cards have an accessible Delete button and a permanent-deletion confirmation. Guest deletion updates browser storage; account deletion removes the owned recipe and its favorite from Supabase. Stored project snapshots and adjustments already applied to files remain intact. Writes and deletion are serialized so queued sync cannot recreate the deleted recipe. Failed deletion remains visible and can be retried. Built-in/editorial recipes have no delete button.

Validation: DOM tests for selected-only import, editor availability, deletion/queued writes and confirmation cancellation; real Supabase transaction verifies authenticated owner deletion and other-owner protection (rolled back). No schema migration is required for v4.2. Device/browser visual verification remains pending.
