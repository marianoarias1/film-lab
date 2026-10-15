import { applyPixels, normalizeSettings } from "./engine.js";
const cache = /* @__PURE__ */ new Map(), samples = new Uint8ClampedArray([118, 170, 195, 255, 142, 153, 102, 255, 224, 167, 115, 255]);
function recipePalette(recipe) {
  const key = JSON.stringify(recipe.settings || {});
  if (cache.has(key)) return cache.get(key);
  const settings = normalizeSettings(recipe.settings);
  Object.assign(settings, { grain: 0, sharpness: 0, clarity: 0, denoise: 0, vignette: 0 });
  const pixels = applyPixels(samples, 3, 1, settings), colors = [0, 4, 8].map((i) => "#" + [pixels[i], pixels[i + 1], pixels[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
  cache.set(key, colors);
  return colors;
}
let thumbnailGeneration = 0;
let thumbnailSource = null;
let thumbnailSample = null;
const photoThumbCache = /* @__PURE__ */ new Map();
function renderRecipeThumbnails(container, recipes, preview, photoId) {
  const generation = ++thumbnailGeneration;
  if (!preview?.width || !preview?.height) return;
  if (thumbnailSource !== preview) {
    thumbnailSource = preview;
    photoThumbCache.clear();
    const original = document.createElement("canvas");
    original.width = preview.width;
    original.height = preview.height;
    original.getContext("2d").putImageData(preview, 0, 0);
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 96 / Math.max(preview.width, preview.height));
    canvas.width = Math.max(1, Math.round(preview.width * ratio));
    canvas.height = Math.max(1, Math.round(preview.height * ratio));
    canvas.getContext("2d").drawImage(original, 0, 0, canvas.width, canvas.height);
    thumbnailSample = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    original.width = original.height = 1;
  }
  const sample = thumbnailSample;
  const cards = [...container.querySelectorAll(".recipe-card")];
  let index = 0;
  const later = (fn) => setTimeout(fn, 0);
  function drawNext() {
    if (generation !== thumbnailGeneration || index >= cards.length) return;
    const card = cards[index], recipe = recipes[index++];
    if (!recipe || !card.isConnected) return;
    const key = photoId + JSON.stringify(recipe.settings);
    let url = photoThumbCache.get(key);
    if (!url) {
      const canvas = document.createElement("canvas");
      canvas.width = sample.width;
      canvas.height = sample.height;
      const settings = normalizeSettings(recipe.settings);
      const pixels = applyPixels(sample.data, sample.width, sample.height, settings);
      canvas.getContext("2d").putImageData(new ImageData(pixels, sample.width, sample.height), 0, 0);
      url = canvas.toDataURL("image/jpeg", 0.8);
      if (photoThumbCache.size > 120) photoThumbCache.clear();
      photoThumbCache.set(key, url);
    }
    const thumb = card.querySelector(".recipe-thumb");
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Vista previa de " + recipe.name + " en tu archivo";
    thumb.classList.add("has-photo");
    thumb.replaceChildren(image);
    if (recipe.description) {
      const description = document.createElement("span");
      description.className = "recipe-description";
      description.textContent = recipe.description.split(". ")[0] + ".";
      card.querySelector("span:nth-child(2)").append(description);
    }
    later(drawNext);
  }
  later(drawNext);
}
export {
  recipePalette,
  renderRecipeThumbnails
};
