# Film Lab · código actualizado

Editor fotográfico local con importación JPEG, PNG, WebP y RAW mediante LibRaw WASM.

## Ejecutar en Windows

Instalá Node.js LTS. Extraé el ZIP, abrí la carpeta film-lab en VS Code y ejecutá en la terminal:

```powershell
npm run dev
```

Abrí http://localhost:5173. No hace falta instalar dependencias. No abras index.html directamente: los módulos y Web Workers requieren un servidor HTTP.

## Funciones incluidas

- Varias fotos con ajustes, receta e historial independientes.
- Copiar y pegar ajustes en una foto o en las seleccionadas.
- Exportar todas, seleccionadas o la actual, con resolución original o reducida.
- Descargar un ZIP con archivos JPEG o PNG individuales.
- Compartir archivos individuales con el menú nativo, cuando el navegador lo permite.
- Si compartir no está disponible: enlaces independientes para descargar o abrir cada foto; no obliga a usar ZIP.
- Catálogo online propio en dist/catalog.json, búsqueda por nombre y creador, favoritas e importación/exportación de recetas JSON.

## Compartir desde el celular

Publicá dist/ bajo HTTPS. El primer toque prepara las imágenes y el siguiente abre el menú nativo, si es compatible. Guardar en Fotos depende de la opción elegida en ese menú. En una vista embebida puede bloquearse compartir: abrí el sitio directamente en Safari. Si el lote no es compatible, la interfaz ofrece archivos individuales.

## Archivos principales

- dist/app.js: interfaz, sesión, edición y exportación por lote.
- dist/album.js: ajustes independientes, copiar/pegar y nombres de salida.
- dist/engine.js: procesamiento de píxeles y adaptación aproximada de recetas Fuji.
- dist/zip.js: ZIP sin dependencias, con CRC y nombres UTF-8.
- dist/recipes.js: recetas iniciales y atribuciones.
- dist/catalog.json: 20 looks adicionales originales de Film Lab.
- dist/process-worker.js: procesamiento en segundo plano.
- dist/raw-worker.js y dist/vendor/libraw/: revelado RAW y dependencia WASM incluida.
- dist/notices.txt: licencias y atribuciones.

## Alcances

Las imágenes se procesan en el dispositivo. La sesión de fotos no se conserva al recargar. Las recetas y favoritas se guardan en el navegador. Exportación sRGB de 8 bits; no genera RAW ni conserva EXIF. Las recetas Fuji son aproximaciones, no una réplica del motor propietario. El catálogo online pertenece a Film Lab; no consulta automáticamente una API de terceros.

Esta versión incluye la corrección de compartir verificada por el usuario en su celular.
