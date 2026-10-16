import LibRaw from './vendor/libraw/index.js';
import {rawDimensions, rawPixels} from './raw-preview.js';
self.onmessage = async ({data}) => {
  try {
    const previewOnly = data.previewOnly === true, raw = new LibRaw();
    await raw.open(new Uint8Array(data.buffer), {useCameraWb:true, outputColor:1, outputBps:8, halfSize:previewOnly, noAutoBright:true, userQual:3});
    const meta = await raw.metadata(), img = await raw.imageData();
    if (!img?.data || !img.width || !img.height) throw new Error('El revelador no devolvió una imagen válida.');
    if (img.bits !== 8 || img.colors < 3) throw new Error('Formato de salida RAW no compatible.');
    const dimensions = rawDimensions(img, meta, previewOnly);
    const result = rawPixels(img, previewOnly ? 1100 : Infinity);
    self.postMessage({...result, sourceWidth:dimensions.width, sourceHeight:dimensions.height, meta}, [result.pixels]);
  } catch (e) { self.postMessage({error:e?.message || 'No se pudo revelar el RAW.'}); }
};
