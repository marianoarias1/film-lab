// The decoder may rotate its output. Preserve original dimensions in that
// orientation while keeping only a small working image in the editor.
export function rawDimensions(image, meta, reduced) {
  if (!reduced) return {width: image.width, height: image.height};
  let width = Number(meta?.width), height = Number(meta?.height);
  if (!(width > 0 && height > 0)) return {width: image.width * 2, height: image.height * 2};
  if ((width > height) !== (image.width > image.height)) [width, height] = [height, width];
  return {width, height};
}

export function rawPixels(image, maxSide = Infinity) {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const rgb = new Uint8Array(image.data), rgba = new Uint8ClampedArray(width * height * 4);
  if (scale === 1) {
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += image.colors) {
      rgba[i] = rgb[j]; rgba[i + 1] = rgb[j + 1]; rgba[i + 2] = rgb[j + 2]; rgba[i + 3] = 255;
    }
  } else {
    for (let y = 0; y < height; y++) {
      const sy = Math.max(0, (y + .5) * image.height / height - .5);
      const y0 = Math.floor(sy), y1 = Math.min(image.height - 1, y0 + 1), fy = sy - y0;
      for (let x = 0; x < width; x++) {
        const sx = Math.max(0, (x + .5) * image.width / width - .5);
        const x0 = Math.floor(sx), x1 = Math.min(image.width - 1, x0 + 1), fx = sx - x0;
        const a = (y0 * image.width + x0) * image.colors, b = (y0 * image.width + x1) * image.colors;
        const c = (y1 * image.width + x0) * image.colors, d = (y1 * image.width + x1) * image.colors, i = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) rgba[i + channel] =
          (rgb[a + channel] * (1 - fx) + rgb[b + channel] * fx) * (1 - fy) +
          (rgb[c + channel] * (1 - fx) + rgb[d + channel] * fx) * fy;
        rgba[i + 3] = 255;
      }
    }
  }
  return {width, height, pixels: rgba.buffer};
}
