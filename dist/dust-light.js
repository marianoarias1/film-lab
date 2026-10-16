const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function dustLightDefaults() {
  return { enabled: false, intensity: 62, amount: 55, size: 40, temperature: 85, diffusion: 40, seed: 30117 };
}

export function normalizeDustLight(input) {
  const out = dustLightDefaults();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  out.enabled = input.enabled === true;
  for (const key of ['intensity', 'amount', 'size', 'temperature', 'diffusion']) {
    if (Number.isFinite(input[key])) out[key] = clamp(input[key], 0, 100);
  }
  if (Number.isFinite(input.seed)) out.seed = clamp(input.seed, 0, 4294967295) >>> 0;
  return out;
}

function random(index, channel, seed) {
  let n = Math.imul(index + seed, 374761393) ^ Math.imul(channel + seed, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

// Normalized positions and radii keep the same layout across preview sizes and
// independent export bands. Only each particle's local bounding box is visited.
export function applyDustLight(pixels, width, height, input, geometry = {}) {
  const s = normalizeDustLight(input);
  if (!s.enabled || !s.intensity) return pixels;
  const fullWidth = geometry.fullWidth || width, fullHeight = geometry.fullHeight || height;
  const offsetY = geometry.offsetY || 0, minSide = Math.min(fullWidth, fullHeight);
  const strength = s.intensity / 100, diffuse = s.diffusion / 100, warm = s.temperature / 100;
  const tint = [.62 + .38 * warm, .81 - .11 * warm, 1 - .72 * warm];

  // A restrained luminous veil leaves facial detail intact. No full-size blur
  // buffer is allocated, so export uses the same bounded memory as other tools.
  if (diffuse) for (let i = 0; i < pixels.length; i += 4) {
    const luma = (.2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]) / 255;
    const light = strength * diffuse * (.012 + .065 * luma * luma);
    for (let k = 0; k < 3; k++) pixels[i + k] = Math.round(255 - (255 - pixels[i + k]) * (1 - light * (.75 + tint[k] * .25)));
  }

  const count = Math.round(s.amount / 100 * 2600), scale = .4 + s.size / 100 * 1.8;
  for (let j = 0; j < count; j++) {
    const cx = random(j, 1, s.seed) * fullWidth, cy = random(j, 2, s.seed) * fullHeight;
    const layer = random(j, 3, s.seed), large = layer > .96;
    const radius = (large ? .0018 + random(j, 4, s.seed) ** 2 * .008 : .0002 + random(j, 4, s.seed) * .0008) * minSide * scale;
    const softness = large ? .2 + diffuse * .65 : .15 + diffuse * .4;
    const outer = radius * (1 + diffuse * 1.5) + .5;
    const top = Math.max(0, Math.floor(cy - outer - offsetY)), bottom = Math.min(height, Math.ceil(cy + outer - offsetY));
    if (top >= bottom) continue;
    const left = Math.max(0, Math.floor(cx - outer)), right = Math.min(width, Math.ceil(cx + outer));
    const opacity = strength * (.18 + random(j, 5, s.seed) * .65);
    const hue = random(j, 6, s.seed), color = tint.map(v => v + (1 - v) * hue * .55);
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const distance = Math.hypot(x + .5 - cx, y + offsetY + .5 - cy);
      const edge = clamp((radius + .5 - distance) / Math.max(.65, radius * softness));
      const halo = diffuse * .18 * clamp(1 - distance / outer) ** 2;
      const alpha = clamp((edge + halo) * opacity);
      if (!alpha) continue;
      const i = (y * width + x) * 4;
      for (let k = 0; k < 3; k++) pixels[i + k] = Math.round(255 - (255 - pixels[i + k]) * (1 - alpha * color[k]));
    }
  }
  return pixels;
}
