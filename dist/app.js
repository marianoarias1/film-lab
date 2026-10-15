import { mountMobileUX } from "./mobile-ux.js";
import { renderRecipeThumbnails } from "./recipe-preview.js";
import { confirmAction } from "./dialogs.js";
import { createSessionStore } from "./session-store.js";
import { mountCloud } from "./cloud.js";
import { recipePalette } from "./recipe-preview.js";
import { mountCurve } from "./curve.js";
import { isVideo, openVideo, createVideoRenderer, recordVideo, recordingType } from "./video.js";
import { defaults, normalizeSettings, parseRecipe, safeUrl } from "./engine.js";
import { builtins, sources, editorialLooks } from "./recipes.js";
import { createPhoto, snapshot, copyTreatment, pasteTreatment, settingsAtIntensity, uniqueImageNames, photoDimensions } from "./album.js";
import { zipFiles } from "./zip.js";
const $ = (id) => document.getElementById(id), clone = (x) => structuredClone(x), escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let cloud = null, localReady = false;
const sessionStore = createSessionStore({ onStatus: (message, error) => {
  const el = $("localSessionStatus");
  if (el) {
    el.textContent = message;
    el.classList.toggle("error", error);
    if ($("retryLocalSession")) $("retryLocalSession").hidden = !error;
  }
} });
const deletingRecipes = /* @__PURE__ */ new Set();
const state = { mediaEpoch: 0, cloudFavoriteRecipes: [], previewMuted: false, mobilePanel: "photo", videoMedia: null, videoRenderer: null, videoRAF: 0, videoLast: 0, exportAudioContext: null, source: null, width: 0, height: 0, file: null, preview: null, current: builtins[0], settings: clone(defaults), intensity: 100, filter: "all", favorites: /* @__PURE__ */ new Set(), custom: [], undo: [], redo: [], busy: false, compare: false, generation: 0, rawWorker: null, exported: null, isDemo: false, photos: [], activeId: null, copiedSettings: null, preparedExport: null, sharing: false, exportCancelled: false, cancelRaw: null, onlineRecipes: [], catalogLoaded: false };
try {
  state.custom = JSON.parse(localStorage.getItem("film-lab-recipes") || "[]").filter((r) => r && r.id && r.settings).map((r) => ({ ...r, source: safeUrl(r.source), settings: normalizeSettings(r.settings) }));
  state.favorites = new Set(JSON.parse(localStorage.getItem("film-lab-favorites") || "[]"));
} catch {
}
function persistLocal() {
  if (cloud?.getUser()) return;
  localStorage.setItem("film-lab-recipes", JSON.stringify(state.custom));
  localStorage.setItem("film-lab-favorites", JSON.stringify([...state.favorites]));
}
async function persist() {
  if (cloud?.getUser()) {
    await cloud.saveCollection();
    return "Receta guardada en tu cuenta · disponible en todos tus dispositivos.";
  }
  persistLocal();
  return "Receta guardada solo en este navegador. Creá una cuenta para tenerla en otros dispositivos.";
}
function toast(message) {
  if (!$("toast")) return;
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    const element = $("toast");
    if (element) element.hidden = true;
  }, 6500);
}
function busy(on, message = "Procesando…", detail = "Tus fotos permanecen en tu dispositivo.") {
  state.busy = on;
  $("busyOverlay").hidden = !on;
  $("busyText").textContent = message;
  $("busyDetail").textContent = detail;
  $("exportButton").disabled = on || !state.photos.length;
  $("uploadButton").disabled = on;
  $("photoInput").disabled = on;
  renderAlbum();
}
function mobilePanel(panel) {
  state.mobilePanel = panel;
  syncMobilePreview();
  document.querySelectorAll(".workspace .panel").forEach((e) => e.classList.toggle("mobile-active", e.id === { photo: "photoPanel", recipes: "recipesPanel", adjustments: "adjustmentsPanel", project: "projectPanel" }[panel]));
  document.querySelectorAll(".mobile-tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.panel === panel);
    b.setAttribute("aria-selected", b.dataset.panel === panel);
  });
}
mobilePanel("photo");
document.querySelectorAll(".mobile-tabs button").forEach((b) => b.onclick = () => mobilePanel(b.dataset.panel));
function allRecipes() {
  return [...new Map([...builtins, ...editorialLooks.map((r) => ({ ...r, settings: normalizeSettings(r.settings) })), ...state.onlineRecipes, ...state.cloudFavoriteRecipes, ...state.custom].map((r) => [r.id, r])).values()];
}
function renderRecipes() {
  const query = $("search").value.trim().toLowerCase();
  let recipes = allRecipes().filter((r) => (!r.hiddenFromCatalog || !!query || state.favorites.has(r.id) || state.current.id === r.id) && `${r.name} ${r.creator} ${r.description}`.toLowerCase().includes(query) && (state.filter !== "favorites" || state.favorites.has(r.id)) && (state.filter !== "custom" || state.custom.some((c) => c.id === r.id)));
  $("recipeCount").textContent = recipes.length;
  $("recipeList").innerHTML = "";
  for (const r of recipes) {
    const card = document.createElement("div");
    card.className = "recipe-card" + (state.current.id === r.id ? " selected" : "");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.setAttribute("aria-label", `Aplicar ${r.name} de ${r.creator}`);
    card.setAttribute("aria-pressed", state.current.id === r.id);
    const palette = recipePalette(r);
    card.innerHTML = `<span class="recipe-thumb" style="--sky:${palette[0]};--earth:${palette[1]};--sun:${palette[2]}"></span><span><strong>${escape(r.name)}</strong><small>${escape(r.creator)}</small>${r.type === "adapted" ? '<span class="tag">ADAPTACIÓN FUJI</span>' : ""}</span><button class="recipe-fav" aria-label="${state.favorites.has(r.id) ? "Quitar de" : "Agregar a"} favoritas" aria-pressed="${state.favorites.has(r.id)}">${state.favorites.has(r.id) ? "♥" : "♡"}</button>`;
    card.onclick = () => selectRecipe(r);
    card.onkeydown = (e) => {
      if (e.target === card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        selectRecipe(r);
      }
    };
    card.querySelector("button").onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(r.id);
    };
    if (state.custom.some((c) => c.id === r.id)) {
      card.classList.add("own-recipe");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "recipe-delete";
      remove.textContent = "🗑";
      remove.setAttribute("aria-label", "Eliminar receta " + r.name);
      remove.title = "Eliminar receta propia";
      remove.disabled = deletingRecipes.has(r.id);
      remove.onclick = (e) => {
        e.stopPropagation();
        deleteOwnRecipe(r);
      };
      card.append(remove);
    }
    $("recipeList").append(card);
  }
  if (!recipes.length) {
    const empty = document.createElement("p");
    empty.className = "recipe-empty";
    empty.textContent = state.filter === "custom" ? "Todavía no guardaste recetas. Importá una o guardá tus ajustes." : "No encontramos coincidencias en tu colección. Explorá las fuentes de creadores.";
    $("recipeList").append(empty);
  }
  renderRecipeThumbnails($("recipeList"), recipes, state.preview || null, activePhoto()?.id || "");
}
function removeOwnRecipe(id) {
  state.custom = state.custom.filter((r) => r.id !== id);
  state.favorites.delete(id);
  state.cloudFavoriteRecipes = state.cloudFavoriteRecipes.filter((r) => r.id !== id);
  renderRecipes();
  updateSummary();
}
async function deleteOwnRecipe(recipe) {
  const actionScope = sessionStore.scope();
  if (deletingRecipes.has(recipe.id)) return;
  if (!await confirmAction(`¿Eliminar definitivamente «${recipe.name}»${cloud?.getUser() ? " de tu cuenta" : " de este navegador"}? También se quitará de favoritas. Los ajustes ya aplicados a tus fotos y videos se conservan.`, { title: "Eliminar receta", confirmLabel: "Eliminar definitivamente", danger: true })) return;
  if (actionScope !== sessionStore.scope()) return;
  deletingRecipes.add(recipe.id);
  renderRecipes();
  toast("Eliminando receta…");
  try {
    if (cloud?.getUser()) await cloud.deleteRecipe(recipe.id);
    else {
      const previous = state.custom, wasFavorite = state.favorites.has(recipe.id);
      state.custom = state.custom.filter((r) => r.id !== recipe.id);
      state.favorites.delete(recipe.id);
      try {
        persistLocal();
      } catch (e) {
        state.custom = previous;
        if (wasFavorite) state.favorites.add(recipe.id);
        throw e;
      }
    }
    removeOwnRecipe(recipe.id);
    toast("Receta eliminada definitivamente. Tus fotos y videos conservan sus ajustes.");
  } catch (e) {
    toast("No se completó la eliminación. La receta sigue visible; podés reintentar.");
  } finally {
    deletingRecipes.delete(recipe.id);
    renderRecipes();
  }
}
let searchTimer, catalogPromise;
async function loadCatalog() {
  if (state.catalogLoaded) {
    renderRecipes();
    return;
  }
  if (catalogPromise) return catalogPromise;
  $("catalogStatus").textContent = "Consultando catálogo online de Film Lab…";
  $("onlineSearchButton").disabled = true;
  catalogPromise = (async () => {
    try {
      const response = await fetch("./catalog.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("No se pudo conectar.");
      const catalog = await response.json();
      if (!Array.isArray(catalog.recipes)) throw new Error("Catálogo inválido.");
      state.onlineRecipes = catalog.recipes.filter((r) => r.id && r.name && r.settings).map((r) => ({ ...r, source: safeUrl(r.source), settings: normalizeSettings(r.settings) }));
      state.catalogLoaded = true;
      try {
        localStorage.setItem("film-lab-online-catalog", JSON.stringify(state.onlineRecipes));
      } catch {
      }
      $("catalogStatus").textContent = `${state.onlineRecipes.length} looks adicionales de Film Lab disponibles. Buscá por nombre o creador.`;
      $("onlineSearchButton").textContent = "Catálogo online actualizado";
      renderRecipes();
    } catch (e) {
      $("catalogStatus").textContent = "No se pudo consultar el catálogo. Tu colección local sigue disponible.";
    } finally {
      $("onlineSearchButton").disabled = false;
      catalogPromise = null;
    }
  })();
  return catalogPromise;
}
$("onlineSearchButton").onclick = loadCatalog;
try {
  state.onlineRecipes = JSON.parse(localStorage.getItem("film-lab-online-catalog") || "[]").filter((r) => r.id && r.settings).map((r) => ({ ...r, source: safeUrl(r.source), settings: normalizeSettings(r.settings) }));
} catch {
}
function toggleFavorite(id) {
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  persistLocal();
  const enabled = state.favorites.has(id);
  renderRecipes();
  updateSummary();
  toast((enabled ? "Receta agregada a favoritas" : "Receta quitada de favoritas") + (cloud?.getUser() ? " · sincronizando tu cuenta…" : " · solo en este navegador; iniciá sesión para sincronizar."));
  cloud?.favorite(id, enabled, allRecipes().find((r) => r.id === id));
}
$("favoriteCurrent").onclick = () => toggleFavorite(state.current.id);
$("search").oninput = () => {
  renderRecipes();
  clearTimeout(searchTimer);
  if ($("search").value.trim() && !document.querySelector(".recipe-card") && !state.catalogLoaded) searchTimer = setTimeout(loadCatalog, 500);
};
document.querySelectorAll("[data-filter]").forEach((b) => b.onclick = () => {
  state.filter = b.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((x) => x.classList.toggle("active", x === b));
  renderRecipes();
});
function checkpoint() {
  state.undo.push(snapshot(state.settings, state.intensity, state.current));
  if (state.undo.length > 40) state.undo.shift();
  state.redo = [];
  updateHistory();
}
function updateHistory() {
  $("undoButton").disabled = state.busy || !state.undo.length;
  $("redoButton").disabled = state.busy || !state.redo.length;
}
function restore(entry) {
  state.settings = normalizeSettings(entry.settings);
  state.intensity = entry.intensity;
  state.current = clone(entry.recipe || allRecipes().find((r) => r.id === entry.current) || builtins[0]);
  syncControls();
  renderRecipes();
  updateSummary();
  schedulePreview();
  updateHistory();
}
$("undoButton").onclick = () => {
  if (state.busy || !state.undo.length) return;
  state.redo.push(snapshot(state.settings, state.intensity, state.current));
  restore(state.undo.pop());
};
$("redoButton").onclick = () => {
  if (state.busy || !state.redo.length) return;
  state.undo.push(snapshot(state.settings, state.intensity, state.current));
  restore(state.redo.pop());
};
function selectRecipe(r) {
  if (state.busy) return;
  checkpoint();
  state.current = r;
  state.settings = clone(r.settings);
  state.intensity = 100;
  syncControls();
  renderRecipes();
  updateSummary();
  schedulePreview();
}
function updateSummary() {
  $("selectedName").textContent = state.current.name;
  $("selectedCreator").textContent = state.current.creator;
  $("favoriteCurrent").textContent = state.favorites.has(state.current.id) ? "♥" : "♡";
  $("favoriteCurrent").setAttribute("aria-pressed", state.favorites.has(state.current.id));
  const note = $("recipeNote");
  note.textContent = state.current.type === "adapted" ? "Adaptación aproximada: los valores Fuji se interpretan sobre tu foto. No reproduce su motor propietario." : "Look editable de " + state.current.creator + ". El resultado depende del revelado y la luz de tu foto.";
  if (state.current.source) {
    const a = document.createElement("a");
    a.href = safeUrl(state.current.source);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = " Ver receta original ↗";
    note.append(a);
  }
}
function effective() {
  return settingsAtIntensity(state.settings, state.intensity);
}
const groups = [["Luz y tono", [["exposure", "Exposición", -3, 3, 0.05, " EV"], ["contrast", "Contraste", -100, 100, 1], ["highlights", "Altas luces", -100, 100, 1], ["shadows", "Sombras", -100, 100, 1], ["whites", "Blancos", -100, 100, 1], ["blacks", "Negros", -100, 100, 1]], true], ["Balance y color", [["temperature", "Temperatura", -100, 100, 1], ["tint", "Matiz", -100, 100, 1], ["saturation", "Saturación", -100, 100, 1], ["vibrance", "Intensidad del color", -100, 100, 1], ["colorChrome", "Profundidad del color", 0, 100, 1], ["blueChrome", "Profundidad de azules", 0, 100, 1]], true], ["Textura y detalle", [["sharpness", "Nitidez", -100, 100, 1], ["clarity", "Claridad", -100, 100, 1], ["denoise", "Suavizado de ruido", 0, 100, 1], ["grain", "Grano", 0, 100, 1], ["grainSize", "Tamaño del grano", 1, 6, 1]], false], ["Acabado", [["fade", "Negros lavados", 0, 100, 1], ["gamma", "Medios tonos", -100, 100, 1], ["vignette", "Viñeta", 0, 100, 1]], false]];
const controlRefs = {};
function sliderControl(key, label, min, max, step = 1, suffix = "") {
  let d = document.createElement("div");
  d.className = "slider-control";
  d.innerHTML = `<div class="control-label"><label for="control-${key}">${label}</label><output id="value-${key}"></output></div><input id="control-${key}" type="range" min="${min}" max="${max}" step="${step}">`;
  const input = d.querySelector("input"), output = d.querySelector("output");
  controlRefs[key] = { input, output, suffix };
  let started = false;
  input.onpointerdown = () => {
    if (!started) {
      checkpoint();
      started = true;
    }
  };
  input.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) && !started) {
      checkpoint();
      started = true;
    }
  };
  input.oninput = () => {
    if (!started) {
      checkpoint();
      started = true;
    }
    state.settings[key] = Number(input.value);
    output.textContent = formatValue(Number(input.value), suffix);
    schedulePreview();
  };
  input.onchange = () => {
    started = false;
  };
  input.onpointerup = input.onpointercancel = input.onblur = () => {
    started = false;
  };
  return d;
}
function formatValue(v, suffix = "") {
  return (v > 0 ? "+" : "") + (suffix ? v.toFixed(2) : Math.round(v)) + suffix;
}
for (const [title, controls, open] of groups) {
  const d = document.createElement("details");
  d.open = open;
  const s = document.createElement("summary");
  s.textContent = title;
  d.append(s);
  for (const c of controls) d.append(sliderControl(...c));
  $("controls").append(d);
}
const hslDetail = document.createElement("details");
hslDetail.innerHTML = '<summary>Mezclador de colores · HSL</summary><select class="hsl-select" id="hslColor" aria-label="Color a modificar"><option>Rojo</option><option>Naranja</option><option>Amarillo</option><option>Verde</option><option>Cian</option><option>Azul</option><option>Violeta</option><option>Magenta</option></select>';
const hslControls = {};
for (const [k, label, min, max] of [["h", "Tono", -30, 30], ["s", "Saturación", -100, 100], ["l", "Luminosidad", -100, 100]]) {
  const d = document.createElement("div");
  d.className = "slider-control";
  d.innerHTML = `<div class="control-label"><label for="hsl-${k}">${label}</label><output></output></div><input type="range" id="hsl-${k}" min="${min}" max="${max}" value="0">`;
  const i = d.querySelector("input"), o = d.querySelector("output");
  hslControls[k] = { i, o };
  let hslStarted = false;
  const hslStart = () => {
    if (!hslStarted) {
      checkpoint();
      hslStarted = true;
    }
  };
  i.onpointerdown = hslStart;
  i.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) hslStart();
  };
  i.onchange = i.onpointerup = i.onpointercancel = i.onblur = () => hslStarted = false;
  i.oninput = () => {
    hslStart();
    state.settings.hsl[$("hslColor").selectedIndex][k] = Number(i.value);
    o.textContent = formatValue(Number(i.value));
    schedulePreview();
  };
  hslDetail.append(d);
}
$("controls").append(hslDetail);
$("hslColor").onchange = syncControls;
const curveDetail = document.createElement("details");
curveDetail.open = true;
$("controls").append(curveDetail);
const curveEditor = mountCurve(curveDetail, { getSettings: () => state.settings, checkpoint, onChange: schedulePreview });
function syncControls() {
  for (const [key, { input, output, suffix }] of Object.entries(controlRefs)) {
    input.value = state.settings[key];
    output.textContent = formatValue(state.settings[key], suffix);
  }
  for (const [k, { i, o }] of Object.entries(hslControls)) {
    let v = state.settings.hsl[$("hslColor").selectedIndex][k];
    i.value = v;
    o.textContent = formatValue(v);
  }
  curveEditor.render();
  $("intensity").value = state.intensity;
  $("intensityValue").textContent = state.intensity + "%";
}
let intensityStarted = false;
const intensityStart = () => {
  if (!intensityStarted) {
    checkpoint();
    intensityStarted = true;
  }
};
$("intensity").onpointerdown = intensityStart;
$("intensity").onkeydown = (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) intensityStart();
};
$("intensity").onchange = $("intensity").onpointerup = $("intensity").onpointercancel = $("intensity").onblur = () => intensityStarted = false;
$("intensity").oninput = (e) => {
  intensityStart();
  state.intensity = Number(e.target.value);
  $("intensityValue").textContent = state.intensity + "%";
  schedulePreview();
};
$("resetButton").onclick = () => {
  checkpoint();
  state.settings = clone(state.current.settings);
  state.intensity = 100;
  syncControls();
  schedulePreview();
  toast("Restablecimos los valores de esta receta.");
};
const worker = new Worker(new URL("./process-worker.js", import.meta.url), { type: "module" }), pending = /* @__PURE__ */ new Map();
let taskId = 0;
worker.onmessage = ({ data }) => {
  const p = pending.get(data.id);
  if (!p) return;
  pending.delete(data.id);
  clearTimeout(p.timer);
  data.error ? p.reject(new Error(data.error)) : p.resolve(new Uint8ClampedArray(data.pixels));
};
worker.onerror = () => {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error("El motor de ajustes no pudo iniciar. Recargá la página."));
  }
  pending.clear();
};
function processPixels(pixels, width, height, settings, geometry) {
  return new Promise((resolve, reject) => {
    const id = ++taskId;
    let timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("El procesamiento tardó demasiado. Probá un tamaño menor."));
    }, 12e4);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, pixels: pixels.buffer, width, height, settings, geometry }, [pixels.buffer]);
  });
}
let previewTimer;
function schedulePreview() {
  if (state.videoMedia) renderVideoPreview();
  saveActive();
  renderAlbum();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 70);
}
async function renderPreview() {
  if (state.videoMedia) {
    renderVideoPreview();
    return;
  }
  if (!state.preview) return;
  const generation = ++state.generation, preview = state.preview, settings = effective();
  try {
    const pixels = await processPixels(new Uint8ClampedArray(preview.data), preview.width, preview.height, settings, { referenceWidth: state.width, fullWidth: preview.width, fullHeight: preview.height });
    if (generation !== state.generation || state.preview !== preview) return;
    const ctx = $("afterCanvas").getContext("2d");
    ctx.putImageData(new ImageData(pixels, preview.width, preview.height), 0, 0);
    drawHistogram(pixels);
    updateActiveThumbnail();
    $("previewLabel").textContent = "Preview " + preview.width + " px";
  } catch (e) {
    toast(e.message);
  }
}
function drawHistogram(pixels) {
  const bins = Array.from({ length: 3 }, () => new Uint32Array(128));
  for (let i = 0; i < pixels.length; i += 16) for (let c = 0; c < 3; c++) bins[c][pixels[i + c] >> 1]++;
  const canvas = $("histogram"), ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const max = Math.max(...bins.flatMap((b) => Array.from(b))) || 1;
  ["#a4866890", "#75895790", "#688b9490"].forEach((color, c) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 70);
    for (let x = 0; x < 128; x++) ctx.lineTo(x * 280 / 127, 70 - Math.sqrt(bins[c][x] / max) * 62);
    ctx.lineTo(280, 70);
    ctx.closePath();
    ctx.fill();
  });
}
function comparePosition() {
  const v = Number($("compareRange").value);
  $("afterCanvas").style.clipPath = state.compare ? `inset(0 0 0 ${v}%)` : "inset(0 0 0 0)";
  $("comparisonLine").style.left = v + "%";
}
$("compareRange").oninput = comparePosition;
$("compareButton").onclick = () => {
  state.compare = !state.compare;
  $("compareButton").setAttribute("aria-pressed", state.compare);
  $("imageFrame").classList.toggle("comparing", state.compare);
  comparePosition();
};
$("zoomButton").onclick = () => {
  const on = $("imageFrame").classList.toggle("zoomed");
  $("zoomButton").setAttribute("aria-pressed", on);
  $("zoomButton").textContent = on ? "⊖ Ajustar" : "⊕ Acercar";
};
function clearCanvas(c) {
  c.width = 1;
  c.height = 1;
}
function attachSource(canvas, file, meta = "", demo = false) {
  if (state.source) clearCanvas(state.source);
  state.source = canvas;
  state.width = canvas.width;
  state.height = canvas.height;
  state.file = file;
  state.isDemo = demo;
  state.exported = null;
  const scale = Math.min(1, 1100 / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale)), h = Math.max(1, Math.round(canvas.height * scale));
  const before = $("beforeCanvas");
  before.width = w;
  before.height = h;
  const ctx = before.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  state.preview = ctx.getImageData(0, 0, w, h);
  $("afterCanvas").width = w;
  $("afterCanvas").height = h;
  $("emptyState").hidden = true;
  $("imageFrame").hidden = false;
  $("fileName").textContent = demo ? "Una foto para experimentar" : file.name;
  $("fileMeta").textContent = `${canvas.width} × ${canvas.height} · ${demo ? "DEMO" : file.name.split(".").pop().toUpperCase()}${meta ? " · " + meta : ""}`;
  $("demoCredit").textContent = demo ? "Foto de demostración · Unsplash. Cargá tu foto para empezar." : "Tu original se conserva. Los cambios son reversibles.";
  $("exportButton").disabled = false;
  comparePosition();
  renderRecipes();
  schedulePreview();
}
const rawExtensions = /\.(arw|dng|cr2|cr3|nef|raf|rw2|orf|pef|srw|raw|tif|tiff)$/i;
function activePhoto() {
  return state.photos.find((p) => p.id === state.activeId);
}
let imageLinks = [];
let preparedZip = null;
function clearPreparedZip(){
  if(preparedZip) URL.revokeObjectURL(preparedZip.url);
  preparedZip = null;
  $('zipDownload')?.replaceChildren();
}
function clearImageLinks() {
  for (const url of imageLinks) URL.revokeObjectURL(url);
  imageLinks = [];
  $("individualExports").replaceChildren();
}
function invalidateExports() {
  clearPreparedZip();
  clearImageLinks();
  state.preparedExport = null;
  $("shareButton").classList.remove("ready-share");
  $("shareButton").textContent = "Compartir / Guardar en galería";
}
function saveActive() {
  const p = activePhoto();
  if (!p) return;
  const next = snapshot(state.settings, state.intensity, state.current), prior = snapshot(p.settings, p.intensity, p.recipe);
  if (JSON.stringify(next) !== JSON.stringify(prior)) {
    p.settings = clone(next.settings);
    p.intensity = next.intensity;
    p.recipe = clone(next.recipe);
    p.revision++;
    invalidateExports();
    if (!state.cloudHydrating) cloud?.track(p);
  }
  p.undo = state.undo;
  p.redo = state.redo;
  saveLocalSession();
}
function restorePhoto(p) {
  state.settings = clone(p.settings);
  state.intensity = p.intensity;
  state.current = clone(p.recipe);
  state.undo = p.undo;
  state.redo = p.redo;
  syncControls();
  updateSummary();
  updateHistory();
  renderRecipes();
}
function renderAlbum() {
  syncMobilePreview();
  const selected = state.photos.filter((p) => p.selected).length;
  $("album").hidden = !state.photos.length;
  $("albumCount").textContent = `${state.photos.length} ${state.photos.length === 1 ? "archivo" : "archivos"} · ${selected} seleccionadas`;
  $("photoList").innerHTML = "";
  for (const p of state.photos) {
    const card = document.createElement("div");
    card.className = "photo-card" + (p.id === state.activeId ? " active" : "") + (p.error ? " error" : "");
    card.setAttribute("role", "listitem");
    const open = document.createElement("button");
    open.className = "photo-open";
    open.disabled = state.busy;
    open.setAttribute("aria-label", `Editar ${p.name}`);
    open.setAttribute("aria-pressed", p.id === state.activeId);
    const thumb = document.createElement("span");
    thumb.className = "photo-thumb";
    if (p.thumbnail) {
      const image = document.createElement("img");
      image.src = p.thumbnail;
      image.alt = "";
      thumb.append(image);
    } else thumb.textContent = p.file.name.split(".").pop().toUpperCase();
    const name = document.createElement("strong");
    name.textContent = p.name;
    const recipe = document.createElement("small");
    recipe.textContent = p.error ? "No se pudo abrir · reintentá" : (p.kind === "video" ? "▶ " : "") + p.recipe.name;
    open.append(thumb, name, recipe);
    open.onclick = () => activatePhoto(p.id);
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "photo-check";
    check.checked = p.selected;
    check.disabled = state.busy;
    check.setAttribute("aria-label", `Seleccionar ${p.name}`);
    check.onchange = () => {
      p.selected = check.checked;
      invalidateExports();
      renderAlbum();
    };
    const remove = document.createElement("button");
    remove.className = "photo-remove";
    remove.textContent = "×";
    remove.disabled = state.busy;
    remove.setAttribute("aria-label", `Quitar ${p.name} de la sesión`);
    remove.onclick = () => removePhoto(p.id);
    card.append(open, check, remove);
    $("photoList").append(card);
  }
  $("copySettings").disabled = state.busy || !activePhoto();
  $("pasteSettings").disabled = state.busy || !state.copiedSettings || !activePhoto();
  $("pasteSelected").disabled = state.busy || !state.copiedSettings || !selected;
  $("selectAllPhotos").disabled = state.busy;
  $("selectAllPhotos").textContent = selected === state.photos.length ? "Deseleccionar todas" : "Seleccionar todas";
  $("exportButton").disabled = state.busy || !state.photos.length;
  saveLocalSession();
}
function smallThumbnail(canvas) {
  const c = document.createElement("canvas");
  c.width = 180;
  c.height = Math.max(1, Math.round(canvas.height / canvas.width * 180));
  c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.72);
  clearCanvas(c);
  return url;
}
function updateActiveThumbnail() {
  const p = activePhoto();
  if (!p || !state.preview) return;
  try {
    p.thumbnail = smallThumbnail($("afterCanvas"));
    renderAlbum();
  } catch {
  }
}
async function decodePhotoFile(file) {
  let canvas = document.createElement("canvas");
  try {
    if (rawExtensions.test(file.name)) {
      const result = await decodeRaw(await file.arrayBuffer());
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx2 = canvas.getContext("2d");
      ctx2.putImageData(new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height), 0, 0);
      ctx2.getImageData(0, 0, 1, 1);
      return { canvas, meta: String(result.meta?.camera_model || "RAW revelado") };
    }
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      bitmap = await imageFromBlob(file);
    }
    canvas.width = bitmap.width || bitmap.naturalWidth;
    canvas.height = bitmap.height || bitmap.naturalHeight;
    if (!canvas.width || !canvas.height) throw new Error("No se pudo leer la imagen.");
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    ctx.getImageData(0, 0, 1, 1);
    return { canvas, meta: "" };
  } catch (e) {
    clearCanvas(canvas);
    throw e;
  }
}
async function activatePhoto(id) {
  if (state.busy) return;
  const photo = state.photos.find((p) => p.id === id);
  if (!photo) return;
  if (id === state.activeId && (state.source || state.videoMedia) && !photo.error) return;
  saveActive();
  closeActiveVideo();
  state.generation++;
  clearTimeout(previewTimer);
  if (state.source) {
    clearCanvas(state.source);
    state.source = null;
  }
  state.preview = null;
  const mediaEpoch = ++state.mediaEpoch;
  state.activeId = id;
  restorePhoto(photo);
  busy(true, rawExtensions.test(photo.name) ? "Revelando " + photo.name : "Abriendo " + photo.name);
  $("cancelRaw").hidden = !rawExtensions.test(photo.name);
  try {
    if (photo.kind === "video") {
      await activateVideo(photo, mediaEpoch);
      return;
    }
    const { canvas, meta } = await decodePhotoFile(photo.file);
    if (mediaEpoch !== state.mediaEpoch) {
      clearCanvas(canvas);
      return;
    }
    photo.error = "";
    photo.status = "ready";
    photo.width = canvas.width;
    photo.height = canvas.height;
    photo.meta = meta;
    attachSource(canvas, photo.file, meta, photo.isDemo);
    photo.thumbnail = smallThumbnail(canvas);
    $("albumHint").textContent = "Cada foto o video conserva sus ajustes. La sesión se guarda automáticamente en este dispositivo. La barra superior indica si también está sincronizada en tu cuenta.";
  } catch (e) {
    if (mediaEpoch !== state.mediaEpoch) return;
    photo.error = e.message;
    photo.status = "error";
    $("imageFrame").hidden = true;
    $("emptyState").hidden = false;
    $("fileName").textContent = photo.name;
    $("fileMeta").textContent = "No se pudo abrir. Seleccioná la foto para reintentar.";
    state.file = photo.file;
    state.width = photo.width;
    state.height = photo.height;
    toast(e.message === "RAW_CANCELLED" ? "Revelado cancelado." : `No se pudo abrir ${photo.name}: ${e.message}`);
  } finally {
    if (mediaEpoch === state.mediaEpoch) {
      $("cancelRaw").hidden = true;
      busy(false);
      renderAlbum();
    }
  }
}
async function addFiles(files) {
  if (state.busy) return;
  if (!localReady) await cloud?.ready;
  const valid = Array.from(files || []).filter((file) => {
    if (file.size > (isVideo(file) ? 500 : 160) * 1024 * 1024) {
      toast(`${file.name} supera el límite de ${isVideo(file) ? 500 : 160} MB y no se agregó.`);
      return false;
    }
    if (!isVideo(file) && !rawExtensions.test(file.name) && !(/\.(jpe?g|png|webp)$/i.test(file.name) || /^image\/(jpeg|png|webp)$/.test(file.type))) {
      toast(`${file.name}: formato no compatible.`);
      return false;
    }
    return true;
  });
  if (!valid.length) return;
  saveActive();
  if (state.photos.length === 1 && state.photos[0].isDemo) {
    state.photos = [];
    state.activeId = null;
    if (state.source) clearCanvas(state.source);
    state.source = null;
    state.preview = null;
  }
  const entries = valid.map((file) => createPhoto(file, builtins[0]));
  state.photos.push(...entries);
  await persistSession();
  cloud?.filesAdded();
  invalidateExports();
  renderAlbum();
  busy(true, "Preparando miniaturas…");
  for (const photo of entries) {
    if (photo.kind !== "video" && !rawExtensions.test(photo.name)) {
      try {
        const bitmap = await createImageBitmap(photo.file, { resizeWidth: 180, resizeQuality: "low" });
        const c = document.createElement("canvas");
        c.width = bitmap.width;
        c.height = bitmap.height;
        c.getContext("2d").drawImage(bitmap, 0, 0);
        photo.thumbnail = smallThumbnail(c);
        bitmap.close?.();
        clearCanvas(c);
      } catch {
      }
    }
  }
  busy(false);
  renderAlbum();
  if (!activePhoto()) await activatePhoto(entries[0].id);
  else toast(`${entries.length} ${entries.length === 1 ? "archivo agregado" : "archivos agregados"}. Elegí una miniatura para editar.`);
  document.dispatchEvent(new CustomEvent("film-files-added"));
  $("photoInput").value = "";
  try {
    navigator.storage?.persist?.().catch(() => {
    });
  } catch {
  }
}
async function removePhoto(id) {
  if (state.busy) return;
  saveActive();
  const index = state.photos.findIndex((p) => p.id === id);
  if (index < 0) return;
  const photo = state.photos[index], actionScope = sessionStore.scope();
  if (!await confirmAction("¿Quitar «" + photo.name + "» del editor y de su copia local? " + (photo.cloudUploaded ? "La copia guardada en tu cuenta se conserva." : "Si todavía no está sincronizado, exportalo antes: se descartarán sus ajustes de esta sesión."), { title: "Quitar archivo", confirmLabel: "Quitar del editor", danger: !photo.cloudUploaded })) return;
  if (actionScope !== sessionStore.scope() || state.photos[index]?.id !== id) return;
  const wasActive = id === state.activeId;
  if (await cloud?.removed(state.photos[index]) === false) {
    toast("Todavía hay ajustes sin sincronizar. Reintentá antes de quitar este archivo.");
    return;
  }
  if (state.photos[index]?.id !== id) return;
  state.photos.splice(index, 1);
  invalidateExports();
  if (wasActive) {
    closeActiveVideo();
    state.generation++;
    if (state.source) clearCanvas(state.source);
    state.source = null;
    state.preview = null;
    state.activeId = null;
    if (state.photos.length) await activatePhoto(state.photos[Math.min(index, state.photos.length - 1)].id);
    else {
      $("imageFrame").hidden = true;
      $("emptyState").hidden = false;
      $("fileName").textContent = "Tu próxima fotografía";
      $("fileMeta").textContent = "JPEG o RAW";
      state.file = null;
    }
  }
  renderAlbum();
  if (!state.photos.length) await cloud?.sessionEmptied();
  await persistSession();
  toast(cloud?.getUser() ? "Archivo quitado del editor. Tu proyecto guardado se conserva en tu cuenta." : "Archivo quitado de esta sesión.");
}
$("selectAllPhotos").onclick = () => {
  const select = !state.photos.every((p) => p.selected);
  for (const p of state.photos) p.selected = select;
  invalidateExports();
  renderAlbum();
};
$("copySettings").onclick = () => {
  saveActive();
  const photo = activePhoto();
  if (!photo) return;
  state.copiedSettings = copyTreatment(photo);
  renderAlbum();
  toast(`Ajustes de «${photo.recipe.name}» copiados, incluida la intensidad.`);
};
function pastePhotos(photos) {
  if (state.busy || !state.copiedSettings) return;
  saveActive();
  for (const photo of photos) {
    pasteTreatment(photo, state.copiedSettings);
    cloud?.track(photo, "paste");
    if (photo.id !== state.activeId) photo.thumbnail = "";
  }
  ;
  invalidateExports();
  const current = activePhoto();
  if (current && photos.includes(current)) {
    restorePhoto(current);
    schedulePreview();
  }
  renderAlbum();
  toast(`Ajustes pegados en ${photos.length} ${photos.length === 1 ? "foto" : "fotos"}. Podés seguir editando cada una.`);
}
$("pasteSettings").onclick = () => {
  const photo = activePhoto();
  if (photo) pastePhotos([photo]);
};
$("pasteSelected").onclick = () => pastePhotos(state.photos.filter((p) => p.selected));
function imageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagen no compatible"));
    };
    img.src = url;
  });
}
function decodeRaw(buffer) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./raw-worker.js", import.meta.url), { type: "module" });
    state.rawWorker = w;
    const timer = setTimeout(() => finish(new Error("El revelado RAW superó el tiempo disponible.")), 18e4);
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.terminate();
      state.rawWorker = null;
      state.cancelRaw = null;
      error ? reject(error) : resolve(result);
    };
    w.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data);
    w.onerror = (e) => finish(new Error(e.message || "Error del revelador RAW"));
    w.postMessage({ buffer }, [buffer]);
    state.cancelRaw = () => finish(new Error("RAW_CANCELLED"));
    $("cancelRaw").onclick = state.cancelRaw;
  });
}
for (const id of ["uploadButton", "emptyUploadButton"]) $(id).onclick = () => $("photoInput").click();
$("photoInput").onchange = (e) => addFiles(e.target.files);
let dragDepth = 0;
document.addEventListener("dragover", (e) => e.preventDefault());
$("dropZone").ondragenter = (e) => {
  e.preventDefault();
  dragDepth++;
  if (!state.busy) $("dropOverlay").hidden = false;
};
$("dropZone").ondragleave = () => {
  if (--dragDepth <= 0) $("dropOverlay").hidden = true;
};
$("dropZone").ondrop = (e) => {
  e.preventDefault();
  dragDepth = 0;
  $("dropOverlay").hidden = true;
  addFiles(e.dataTransfer.files);
};
$("helpButton").onclick = () => $("helpDialog").showModal();
let recipeSaveDraft = null, recipeImportDraft = null;
function showImport() {
  recipeImportDraft = null;
  $("importError").textContent = "";
  $("recipeDialog").showModal();
}
$("importRecipeButton").onclick = showImport;
$("recipeFileButton").onclick = () => $("recipeFile").click();
$("recipeFile").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 1024 * 1024) {
    $("importError").textContent = "La receta supera 1 MB.";
    return;
  }
  $("recipeJson").value = await f.text();
};
let importMode = "json";
function setImportMode(mode) {
  importMode = mode;
  $("jsonImport").hidden = mode !== "json";
  $("fujiImport").hidden = mode !== "fuji";
  $("jsonTab").classList.toggle("active", mode === "json");
  $("fujiTab").classList.toggle("active", mode === "fuji");
}
$("jsonTab").onclick = () => setImportMode("json");
$("fujiTab").onclick = () => setImportMode("fuji");
const fujiFields = [["white_balance_red", "Balance · rojo", -9, 9, 0, 1], ["white_balance_blue", "Balance · azul", -9, 9, 0, 1], ["highlight", "Altas luces", -2, 4, 0, 0.5], ["shadow", "Sombras", -2, 4, 0, 0.5], ["color", "Color", -4, 4, 0, 1], ["sharpness", "Nitidez", -4, 4, 0, 1], ["clarity", "Claridad", -5, 5, 0, 1], ["high_iso_nr", "Reducción de ruido", -4, 4, 0, 1]];
for (const [key, label, min, max, val, step] of fujiFields) {
  const l = document.createElement("label");
  l.className = "field";
  l.innerHTML = `${label}<input id="fuji-${key}" type="number" min="${min}" max="${max}" step="${step}" value="${val}">`;
  $("fujiFields").append(l);
}
$("confirmImportRecipe").onclick = async () => {
  if ($("confirmImportRecipe").disabled) return;
  $("confirmImportRecipe").disabled = true;
  try {
    let value;
    if (importMode === "json") value = JSON.parse($("recipeJson").value);
    else {
      if (!$("fujiName").value.trim()) throw new Error("Ingresá el nombre de la receta.");
      value = { name: $("fujiName").value.trim(), source_attribution: $("fujiCreator").value.trim() || "Creador no indicado", source_url: $("fujiSource").value.trim(), film_simulation: $("fujiSimulation").value, grain_roughness: $("fujiGrain").value, grain_size: $("fujiGrainSize").value };
      for (const [key, label, min, max] of fujiFields) {
        const v = Number($("fuji-" + key).value);
        if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${label}: usá un valor entre ${min} y ${max}.`);
        value[key] = v;
      }
    }
    const fingerprint = JSON.stringify(value);
    if (recipeImportDraft?.fingerprint !== fingerprint) recipeImportDraft = { fingerprint, recipe: parseRecipe(value) };
    const recipe = recipeImportDraft.recipe;
    if (!state.custom.some((r) => r.id === recipe.id)) state.custom.push(recipe);
    toast(cloud?.getUser() ? "Guardando receta en tu cuenta…" : "Guardando receta…");
    const savedMessage = await persist();
    $("recipeDialog").close();
    state.filter = "all";
    document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
    $("search").value = "";
    selectRecipe(recipe);
    toast(savedMessage);
  } catch (e) {
    $("importError").textContent = "No se guardó la receta. Reintentá o descargá su JSON.";
    toast("Receta sin guardar: mantené esta pestaña abierta y reintentá.");
  } finally {
    $("confirmImportRecipe").disabled = false;
  }
};
$("saveRecipeButton").onclick = () => {
  recipeSaveDraft = null;
  $("saveName").value = state.current.name + " · mi versión";
  $("saveCreator").value = "";
  $("saveDialog").showModal();
};
function recipeToSave() {
  return { v: 1, name: $("saveName").value.trim() || "Mi receta", creator: $("saveCreator").value.trim() || "Mi colección", source: state.current.source || "", settings: effective() };
}
$("confirmSave").onclick = async () => {
  if ($("confirmSave").disabled) return;
  const button = $("confirmSave");
  button.disabled = true;
  button.textContent = "Guardando…";
  try {
    const value = recipeToSave(), fingerprint = JSON.stringify(value);
    if (recipeSaveDraft?.fingerprint !== fingerprint) recipeSaveDraft = { fingerprint, recipe: parseRecipe(value) };
    const r = recipeSaveDraft.recipe;
    if (!state.custom.some((recipe) => recipe.id === r.id)) state.custom.push(r);
    toast(cloud?.getUser() ? "Guardando receta en tu cuenta…" : "Guardando receta…");
    const message = await persist();
    state.current = r;
    state.settings = clone(r.settings);
    state.intensity = 100;
    syncControls();
    renderRecipes();
    updateSummary();
    schedulePreview();
    $("saveDialog").close();
    toast(message);
  } catch (e) {
    toast("No se guardó la receta en tu cuenta. Mantené esta pestaña abierta y reintentá.");
  } finally {
    button.disabled = false;
    button.textContent = cloud?.getUser() ? "Guardar en mi cuenta" : "Guardar en este navegador";
  }
};
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
$("downloadRecipe").onclick = () => {
  downloadBlob(new Blob([JSON.stringify(recipeToSave(), null, 2)], { type: "application/json" }), "film-lab-receta.json");
};
function renderSources() {
  const query = $("sourceSearch").value.trim(), lower = query.toLowerCase();
  $("sourceList").innerHTML = "";
  const matching = sources.filter((s) => `${s.name} ${s.creator} ${s.description}`.toLowerCase().includes(lower));
  for (const s of matching.length ? matching : sources) {
    const card = document.createElement("article");
    card.className = "source-card";
    card.innerHTML = `<h3>${escape(s.name)}</h3><p>${escape(s.creator)}</p><p class="muted">${escape(s.description)}</p><a href="${escape(query && s.search ? s.search + encodeURIComponent(query) : s.url)}" target="_blank" rel="noopener noreferrer">${query && s.search ? "Buscar «" + escape(query) + "» en esta fuente" : "Visitar la fuente"} ↗</a>`;
    $("sourceList").append(card);
  }
  const own = document.createElement("p");
  own.className = "tiny muted";
  own.textContent = "Las recetas de terceros conservan su autor y enlace. No se importan automáticamente páginas ni catálogos completos.";
  $("sourceList").append(own);
}
$("sourcesButton").onclick = () => {
  $("sourceSearch").value = $("search").value;
  renderSources();
  $("sourcesDialog").showModal();
};
$("sourceSearch").oninput = renderSources;
$("sourceImportButton").onclick = () => {
  $("sourcesDialog").close();
  setImportMode("fuji");
  showImport();
};
function exportPhotos() {
  const scope = $("exportScope").value;
  return scope === "active" ? activePhoto() ? [activePhoto()] : [] : scope === "selected" ? state.photos.filter((p) => p.selected) : state.photos;
}
function currentExportOptions() {
  return { videoSide: Number($("videoSize").value), videoAudio: $("videoAudio").checked, size: $("exportSize").value, custom: Number($("customSize").value), type: $("exportFormat").value, quality: Number($("exportQuality").value) / 100 };
}
function exportKey(photos, options) {
  return JSON.stringify({ photos: photos.map((p) => [p.id, p.revision]), options });
}
function updateExport() {
  saveActive();
  invalidateExports();
  const photos = exportPhotos(), options = currentExportOptions();
  $('exportSelectedThumbs').replaceChildren();
  for(const photo of photos){
    const item=document.createElement('div');item.className='export-selected-item';
    if(photo.thumbnail){const image=document.createElement('img');image.src=photo.thumbnail;image.alt='';item.append(image);}
    const label=document.createElement('small');label.textContent=photo.name;item.append(label);$('exportSelectedThumbs').append(item);
  }
  $("exportSelectionSummary").textContent = $("exportScope").value === "selected" ? `${photos.length} archivos seleccionados · se exportarán solo los seleccionados.` : $("exportScope").value === "active" ? "Se exportará únicamente el archivo que estás editando." : `Elegiste exportar todos los archivos (${photos.length}).`;
  $("videoExportOptions").hidden = !photos.some((p) => p.kind === "video");
  $("videoExportInfo").textContent = recordingType() ? "Videos: hasta 2 min, 30 fps objetivo, lado mayor " + options.videoSide + " px; " + (/mp4/.test(recordingType()) ? "MP4" : "WebM") + ". Se exportan reproduciendo el clip: mantené la pestaña visible." : "La exportación de video no está disponible en este navegador.";
  $("customSizeField").hidden = options.size !== "custom";
  $("jpegQualityField").hidden = options.type !== "image/jpeg";
  $("customSize").max = Math.max(24e3, state.width || 0);
  $("exportDimensions").textContent = photos.length ? `${photos.length} ${photos.length === 1 ? "archivo" : "archivos"} · ${options.size === "original" ? "resolución completa de cada foto" : options.size === "2048" ? "hasta 2048 px en el lado mayor" : "hasta " + options.custom + " px en el lado mayor"} para fotos · ajustes independientes` : "No hay archivos seleccionados.";
  $("downloadButton").disabled = !photos.length || state.busy;
  $("shareButton").hidden = false;
  $("shareButton").disabled = !photos.length || state.busy;
  $("exportStatus").textContent = typeof navigator.share !== "function" ? "Compartir preparará imágenes individuales para descargar o abrir." : "";
}
function setExportBusy(on) {
  state.busy = on;
  $("downloadButton").disabled = on;
  $("shareButton").disabled = on;
  $("cancelExport").hidden = !on;
  $("exportButton").disabled = on;
  for (const id of ["exportScope", "exportSize", "exportFormat", "customSize", "exportQuality", "videoSize", "videoAudio", "uploadButton", "photoInput"]) $(id).disabled = on;
  document.querySelector("#exportDialog .dialog-close").disabled = on;
  document.querySelectorAll("#adjustmentsPanel input,#adjustmentsPanel select,#adjustmentsPanel button,#recipeList button").forEach((e) => e.disabled = on);
  renderAlbum();
}
function checkExportCancelled() {
  if (state.exportCancelled) throw new Error("EXPORT_CANCELLED");
}
async function exportPhoto(photo, options, name, onProgress) {
  if (photo.kind === "video") {
    const result = await recordVideo(photo.file, settingsAtIntensity(photo.settings, photo.intensity), { longSide: options.videoSide, audio: options.videoAudio, audioContext: state.exportAudioContext, onProgress, cancelled: () => state.exportCancelled });
    return new File([result.blob], name.replace(/\.(jpg|png)$/i, "." + result.extension), { type: result.blob.type });
  }
  let source = null, scaled = null, target = null;
  try {
    checkExportCancelled();
    $("exportStatus").textContent = `Revelando ${photo.name}…`;
    const decoded = await decodePhotoFile(photo.file);
    source = decoded.canvas;
    photo.width = source.width;
    photo.height = source.height;
    photo.meta = decoded.meta;
    const { width, height } = photoDimensions(source.width, source.height, options.size, options.custom);
    const settings = settingsAtIntensity(photo.settings, photo.intensity);
    const working = width === source.width && height === source.height ? source : scaled = document.createElement("canvas");
    if (scaled) {
      scaled.width = width;
      scaled.height = height;
      scaled.getContext("2d").drawImage(source, 0, 0, width, height);
      clearCanvas(source);
      source = null;
    }
    const src = working.getContext("2d", { willReadFrequently: true });
    target = document.createElement("canvas");
    target.width = width;
    target.height = height;
    const dst = target.getContext("2d");
    if (!dst) throw new Error("No hay memoria suficiente para exportar. Elegí menos fotos o menor tamaño.");
    for (let y = 0; y < height; y += 192) {
      checkExportCancelled();
      const top = Math.max(0, y - 1), end = Math.min(height, y + 193), band = src.getImageData(0, top, width, end - top), result = await processPixels(band.data, width, end - top, settings, { fullWidth: width, fullHeight: height, offsetY: top, referenceWidth: photo.width });
      dst.putImageData(new ImageData(result, width, end - top), 0, top, 0, y - top, width, Math.min(192, height - y));
      onProgress(Math.min(1, (y + 192) / height), width, height);
      await new Promise((r) => setTimeout(r, 0));
    }
    checkExportCancelled();
    const blob = await new Promise((resolve) => target.toBlob(resolve, options.type, options.quality));
    if (!blob || !blob.size) throw new Error("El navegador no pudo exportar este tamaño. Probá 2048 px.");
    return new File([blob], name, { type: blob.type });
  } finally {
    if (source) clearCanvas(source);
    if (scaled) clearCanvas(scaled);
    if (target) clearCanvas(target);
  }
}
async function prepareExport() {
  saveActive();
  const photos = exportPhotos().map((p) => ({ ...p, settings: clone(p.settings), recipe: clone(p.recipe) })), options = currentExportOptions(), key = exportKey(photos, options);
  if (!photos.length) throw new Error("Seleccioná al menos una foto.");
  if (state.preparedExport?.key === key) return state.preparedExport.files;
  if (options.size === "custom" && (!Number.isFinite(options.custom) || options.custom < 256)) throw new Error("El tamaño personalizado debe ser de al menos 256 px.");
  state.exportCancelled = false;
  state.videoMedia?.video.pause();
  setExportBusy(true);
  state.generation++;
  clearTimeout(previewTimer);
  if (state.source) {
    clearCanvas(state.source);
    state.source = null;
  }
  const files = [], names = uniqueImageNames(photos, options.type);
  let totalBytes = 0;
  try {
    for (let index = 0; index < photos.length; index++) {
      checkExportCancelled();
      const photo = photos[index];
      let file;
      try {
        file = await exportPhoto(photo, options, names[index], (fraction, width, height) => {
          $("exportStatus").textContent = `Archivo ${index + 1}/${photos.length}: ${photo.name} · ${Math.round(fraction * 100)}% · ${width} × ${height} px`;
        });
      } catch (e) {
        if (e.message === "EXPORT_CANCELLED" || e.message === "RAW_CANCELLED") throw new Error("EXPORT_CANCELLED");
        throw new Error(`${photo.name}: ${e.message}`);
      }
      totalBytes += file.size;
      if (totalBytes > 250 * 1024 * 1024) throw new Error("El lote supera 250 MB en memoria. Exportá menos fotos seleccionadas o elegí un tamaño menor.");
      files.push(file);
    }
    checkExportCancelled();
    state.preparedExport = { key, files };
    $("shareButton").classList.add("ready-share");
    $("shareButton").textContent = `Compartir / Guardar ${files.length} ${files.length === 1 ? "archivo" : "archivos"}`;
    $("exportStatus").textContent = `${files.length} ${files.length === 1 ? "archivo listo" : "archivos listos"} · ${(totalBytes / 1048576).toFixed(1)} MB. Tocá Compartir para abrir el menú del teléfono.`;
    return files;
  } catch (e) {
    state.preparedExport = null;
    throw e;
  } finally {
    setExportBusy(false);
    if (state.exportAudioContext) {
      await state.exportAudioContext.close().catch(() => {
      });
      state.exportAudioContext = null;
    }
  }
}
function reportExportError(error) {
  $("exportStatus").textContent = error.message === "EXPORT_CANCELLED" ? "Preparación cancelada. Tus ajustes se conservan." : `No se pudo exportar: ${error.message}`;
}
function openExport() {
  $("exportScope").value = "selected";
  updateExport();
  $("exportDialog").showModal();
}
$("exportButton").onclick = openExport;
for (const id of ["exportScope", "exportSize", "exportFormat", "videoSize", "videoAudio"]) $(id).onchange = updateExport;
$("customSize").oninput = updateExport;
$("exportQuality").oninput = (e) => {
  $("exportQualityValue").textContent = e.target.value + "%";
  invalidateExports();
};
$("cancelExport").onclick = () => {
  state.exportCancelled = true;
  state.cancelRaw?.();
};
$("exportDialog").addEventListener("cancel", (e) => {
  if (state.busy) {
    e.preventDefault();
    state.exportCancelled = true;
    state.cancelRaw?.();
  }
});
$("downloadButton").onclick = async () => {
  if (state.busy) return;
  const downloadKey = exportKey(exportPhotos(),currentExportOptions());
  if(preparedZip?.key===downloadKey){$('zipDownload').querySelector('a')?.click();return;}
  unlockExportAudio();
  try {
    const files = await prepareExport();
    setExportBusy(true);
    $("cancelExport").hidden = true;
    $("exportStatus").textContent = "Armando el ZIP con los archivos individuales…";
    const zip = await zipFiles(files, (done, total) => $("exportStatus").textContent = `Armando ZIP: ${done}/${total} archivos`);
    clearPreparedZip();
    preparedZip={key:exportKey(exportPhotos(),currentExportOptions()),url:URL.createObjectURL(zip)};
    const link=document.createElement('a');link.href=preparedZip.url;link.download=`film-lab-${files.length}-archivos.zip`;
    link.className='button dark full';link.textContent=`Descargar ZIP listo · ${files.length} archivos ↗`;
    $('zipDownload').append(link);
    link.click();
    cloud?.exported(exportPhotos());
    $("exportStatus").textContent = `ZIP listo: ${files.length} ${files.length === 1 ? "archivo" : "archivos"} · ${(zip.size / 1048576).toFixed(1)} MB. Si no comenzó la descarga, tocá «Descargar ZIP listo». Para Fotos usá Compartir.`;
  } catch (e) {
    reportExportError(e);
  } finally {
    setExportBusy(false);
  }
};
function shareSupport(files) {
  if (!window.isSecureContext) return "insecure";
  const policy = document.permissionsPolicy || document.featurePolicy;
  try {
    if (policy?.allowsFeature("web-share") === false) return "policy";
  } catch {
  }
  if (typeof navigator.share !== "function") return "unavailable";
  if (typeof navigator.canShare !== "function") return "unknown";
  try {
    if (navigator.canShare({ files })) return "batch";
    if (files.some((file) => navigator.canShare({ files: [file] }))) return "single";
    return "files";
  } catch {
    return "unknown";
  }
}
function renderIndividualExports(files) {
  clearImageLinks();
  const list = $("individualExports");
  const note = document.createElement("p");
  note.className = "tiny muted";
  note.textContent = "Archivos individuales: descargá cada foto o video, o abrilo. En iPhone, mantené presionada la imagen abierta y elegí Guardar en Fotos, si Safari ofrece esa opción.";
  list.append(note);
  for (const file of files) {
    const row = document.createElement("div");
    row.className = "individual-export";
    const name = document.createElement("strong");
    name.textContent = file.name;
    const url = URL.createObjectURL(file);
    imageLinks.push(url);
    const download = document.createElement("a");
    download.href = url;
    download.download = file.name;
    download.textContent = file.type.startsWith("video/") ? "Descargar video" : "Descargar imagen";
    const open = document.createElement("a");
    open.href = url;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = file.type.startsWith("video/") ? "Abrir video" : "Abrir imagen";
    const share = document.createElement("button");
    share.type = "button";
    share.className = "text-button";
    share.textContent = file.type.startsWith("video/") ? "Compartir este video" : "Compartir esta imagen";
    share.hidden = !["batch", "single", "unknown"].includes(shareSupport([file]));
    share.onclick = () => sharePrepared([file]);
    row.append(name, download, open, share);
    list.append(row);
  }
}
function explainShare(files) {
  const support = shareSupport(files), messages = { policy: "Esta vista bloquea compartir. Abrí Film Lab directamente en Safari o Chrome; también podés usar las imágenes individuales de abajo.", insecure: "Compartir requiere una página HTTPS. Usá las imágenes individuales de abajo.", unavailable: "Este navegador no ofrece el menú de compartir archivos. Las imágenes individuales están disponibles abajo.", files: "Este navegador rechaza compartir archivos, incluso individualmente. No es una limitación por cantidad de archivos. Usá Descargar imagen o Abrir imagen abajo.", single: "El navegador acepta imágenes individuales, pero rechaza el lote. Usá Compartir esta imagen en cada archivo.", unknown: "Imágenes preparadas. Tocá nuevamente Compartir para intentar abrir el menú.", batch: "Imágenes preparadas. Tocá nuevamente Compartir y elegí Guardar imágenes en el menú." };
  $("exportStatus").textContent = messages[support];
  return support;
}
async function sharePrepared(files) {
  if (state.busy || state.sharing) return;
  state.sharing = true;
  $("shareButton").disabled = true;
  try {
    await navigator.share({ files });
    cloud?.exported(exportPhotos());
    $("exportStatus").textContent = "El menú se cerró. Las imágenes se guardan si elegiste Guardar imágenes allí.";
  } catch (e) {
    if (e.name === "AbortError") $("exportStatus").textContent = "Compartir cancelado. Las imágenes siguen disponibles abajo.";
    else $("exportStatus").textContent = `No se pudo compartir (${e.name || "error"}). Usá las imágenes individuales de abajo; si estás en una vista embebida, abrí el sitio directamente en Safari o Chrome.`;
  } finally {
    state.sharing = false;
    $("shareButton").disabled = false;
  }
}
$("shareButton").onclick = async () => {
  if (state.busy || state.sharing) return;
  saveActive();
  const key = exportKey(exportPhotos(), currentExportOptions());
  if (!state.preparedExport || state.preparedExport.key !== key) {
    unlockExportAudio();
    try {
      const files2 = await prepareExport();
      renderIndividualExports(files2);
      explainShare(files2);
    } catch (e) {
      reportExportError(e);
    }
    return;
  }
  const files = state.preparedExport.files;
  renderIndividualExports(files);
  const support = shareSupport(files);
  if (["batch", "unknown"].includes(support)) return sharePrepared(files);
  explainShare(files);
};
for (const d of document.querySelectorAll("dialog")) d.addEventListener("click", (e) => {
  if (e.target === d && !state.busy) {
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }
});
syncControls();
renderRecipes();
updateSummary();
(async () => {
  try {
    const response = await fetch("./demo.jpg");
    if (!response.ok) return;
    const blob = await response.blob();
    if (state.photos.length || state.busy) return;
    const file = new File([blob], "demo-landscape.jpg", { type: "image/jpeg" }), photo = createPhoto(file, builtins[1]);
    photo.isDemo = true;
    state.photos.push(photo);
    await activatePhoto(photo.id);
  } catch {
  }
})();
window.addEventListener("beforeunload", (e) => {
  saveActive();
  if (sessionStore.hasUnsaved() || cloud?.hasPending() && !localReady) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveActive();
    saveLocalSession();
  }
});
function syncMobilePreview() {
  const area = $("dropZone"), dock = $("mobilePreviewDock"), toolbar = document.querySelector(".stage-toolbar");
  if (!area || !dock || $("fullscreenDialog")?.open) return;
  const show = window.innerWidth <= 850 && ["recipes", "adjustments"].includes(state.mobilePanel) && !!activePhoto();
  dock.hidden = !show;
  if (show) {
    dock.append(area, $("videoControls"), toolbar);
    if($("mobileLook")) dock.append($("mobileLook"));
  } else {
    document.querySelector(".selected-summary").before(area, $("videoControls"), toolbar);
  }
  document.body.dataset.mobilePanel = state.mobilePanel;
  document.body.classList.toggle("portrait-preview", state.height > state.width);
}
window.addEventListener("resize", syncMobilePreview);
function closeActiveVideo() {
  cancelAnimationFrame(state.videoRAF);
  state.videoMedia?.close();
  state.videoRenderer?.close();
  state.videoMedia = null;
  state.videoRenderer = null;
  $("videoControls").hidden = true;
}
async function activateVideo(photo, epoch = state.mediaEpoch) {
  const media = await openVideo(photo.file);
  if (epoch !== state.mediaEpoch) {
    media.close();
    return;
  }
  state.videoMedia = media;
  const v = media.video;
  v.muted = state.previewMuted;
  syncVideoAudio();
  photo.width = v.videoWidth;
  photo.height = v.videoHeight;
  photo.duration = v.duration;
  state.width = v.videoWidth;
  state.height = v.videoHeight;
  state.file = photo.file;
  const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight)), width = Math.round(v.videoWidth * scale), height = Math.round(v.videoHeight * scale);
  for (const id of ["beforeCanvas", "afterCanvas"]) {
    $(id).width = width;
    $(id).height = height;
  }
  const glCanvas = document.createElement("canvas");
  try {
    state.videoRenderer = createVideoRenderer(glCanvas, width, height);
  } catch (e) {
    media.close();
    state.videoMedia = null;
    throw e;
  }
  state.videoCanvas = glCanvas;
  photo.status = "ready";
  photo.error = "";
  $("emptyState").hidden = true;
  $("imageFrame").hidden = false;
  $("videoControls").hidden = false;
  $("videoSeek").max = v.duration;
  $("videoSeek").value = 0;
  $("fileName").textContent = photo.name;
  $("fileMeta").textContent = `VIDEO · ${v.videoWidth} × ${v.videoHeight} · ${v.duration.toFixed(1)} s`;
  $("videoHint").textContent = "Audio original en la preview. El botón Audio no cambia la opción de audio al exportar.";
  $("demoCredit").textContent = "Video original conservado. Exportación en el dispositivo.";
  v.onpause = v.onplay = () => {
    $("videoPlay").textContent = v.paused ? "▶ Reproducir" : "Ⅱ Pausar";
  };
  v.onseeked = () => renderVideoPreview();
  v.onended = () => {
    $("videoPlay").textContent = "▶ Reproducir";
  };
  renderVideoPreview();
  state.preview = $("beforeCanvas").getContext("2d").getImageData(0, 0, width, height);
  renderRecipes();
  photo.thumbnail = smallThumbnail($("afterCanvas"));
  comparePosition();
  function loop(time) {
    if (!state.videoMedia || state.videoMedia !== media) return;
    if (!v.paused && time - state.videoLast > 33) {
      state.videoLast = time;
      try {
        renderVideoPreview();
      } catch (e) {
        v.pause();
        toast(e.message);
      }
    }
    state.videoRAF = requestAnimationFrame(loop);
  }
  state.videoRAF = requestAnimationFrame(loop);
  renderAlbum();
}
function renderVideoPreview() {
  if (!state.videoMedia || !state.videoRenderer) return;
  const v = state.videoMedia.video;
  if (v.readyState < 2) return;
  state.videoRenderer.draw(v, effective());
  $("beforeCanvas").getContext("2d").drawImage(v, 0, 0, $("beforeCanvas").width, $("beforeCanvas").height);
  $("afterCanvas").getContext("2d").drawImage(state.videoCanvas, 0, 0);
  if (v.paused) {
    drawHistogram($("afterCanvas").getContext("2d").getImageData(0, 0, $("afterCanvas").width, $("afterCanvas").height).data);
    const p = activePhoto();
    if (p) p.thumbnail = smallThumbnail($("afterCanvas"));
  }
  $("videoSeek").value = v.currentTime;
  $("videoTime").textContent = `${v.currentTime.toFixed(1)} / ${v.duration.toFixed(1)} s`;
}
$("videoPlay").onclick = async () => {
  if (state.busy) return;
  const v = state.videoMedia?.video;
  if (!v) return;
  if (v.paused) {
    if (v.ended) v.currentTime = 0;
    try {
      await v.play();
    } catch (e) {
      toast("No se pudo reproducir este video.");
    }
  } else v.pause();
};
$("videoSeek").oninput = (e) => {
  const v = state.videoMedia?.video;
  if (v && !state.busy) {
    v.pause();
    v.currentTime = Number(e.target.value);
  }
};
function unlockExportAudio() {
  if (state.preparedExport?.key === exportKey(exportPhotos(), currentExportOptions())) return;
  if (!exportPhotos().some((p) => p.kind === "video") || !$("videoAudio").checked || state.exportAudioContext) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (Audio) {
    state.exportAudioContext = new Audio();
    state.exportAudioContext.resume().catch(() => {
    });
  }
}
function syncVideoAudio() {
  const button = $("videoMute");
  button.textContent = state.previewMuted ? "🔇 Audio apagado" : "🔊 Audio encendido";
  button.setAttribute("aria-pressed", String(!state.previewMuted));
  if (state.videoMedia) state.videoMedia.video.muted = state.previewMuted;
}
$("videoMute").onclick = () => {
  state.previewMuted = !state.previewMuted;
  syncVideoAudio();
};
function normalizedRecipe(recipe) {
  return { ...recipe, name: String(recipe.name || "Mi receta").slice(0, 90), creator: String(recipe.creator || "Mi colección").slice(0, 90), source: safeUrl(recipe.source), settings: normalizeSettings(recipe.settings) };
}
function loadCollectionCache(uid = null) {
  state.cloudFavoriteRecipes = [];
  if (uid) {
    state.custom = [];
    state.favorites = /* @__PURE__ */ new Set();
    renderRecipes();
    updateSummary();
    return;
  }
  const keys = uid ? { recipes: "film-lab-recipes:" + uid, favorites: "film-lab-favorites:" + uid } : { recipes: "film-lab-recipes", favorites: "film-lab-favorites" };
  try {
    state.custom = JSON.parse(localStorage.getItem(keys.recipes) || "[]").filter((r) => r?.id && r.settings).map(normalizedRecipe);
    state.favorites = new Set(JSON.parse(localStorage.getItem(keys.favorites) || "[]"));
  } catch {
    state.custom = [];
    state.favorites = /* @__PURE__ */ new Set();
  }
  renderRecipes();
  updateSummary();
}
function resetEditor() {
  saveActive();
  state.mediaEpoch++;
  state.cancelRaw?.();
  closeActiveVideo();
  busy(false);
  state.generation++;
  clearTimeout(previewTimer);
  if (state.source) clearCanvas(state.source);
  state.source = null;
  state.preview = null;
  state.file = null;
  state.photos = [];
  state.activeId = null;
  state.settings = clone(defaults);
  state.current = builtins[0];
  state.intensity = 100;
  state.undo = [];
  state.redo = [];
  invalidateExports();
  $("imageFrame").hidden = true;
  $("emptyState").hidden = false;
  $("fileName").textContent = "Tu próxima fotografía";
  $("fileMeta").textContent = "Fotos o videos";
  syncControls();
  updateHistory();
  updateSummary();
  renderAlbum();
}
const photoFields = ["id", "kind", "name", "recipe", "settings", "intensity", "undo", "redo", "width", "height", "duration", "meta", "thumbnail", "selected", "revision", "cloudId", "cloudProjectId", "cloudRevision", "cloudSnapshot", "cloudPending", "cloudUploaded"];
function sessionSnapshot() {
  return { version: 1, photos: state.photos.filter((p) => !p.isDemo).map((p) => Object.fromEntries(photoFields.filter((k) => p[k] !== void 0).map((k) => [k, p[k]]))), activeId: state.activeId, copiedSettings: state.copiedSettings, project: cloud?.currentProject() || null, draftId: cloud?.draftId?.() || null };
}
function saveLocalSession() {
  if (!localReady || state.cloudHydrating) return Promise.resolve(true);
  return sessionStore.save(sessionSnapshot(), state.photos);
}
async function persistSession() {
  await saveLocalSession();
  return sessionStore.flush();
}
async function prepareIdentity(uid) {
  const wasReady = localReady, carry = wasReady && sessionStore.scope() === "guest" && !!uid && state.photos.some((p) => !p.isDemo);
  saveActive();
  const carried = carry ? { ...sessionSnapshot(), project: null, draftId: null, photos: state.photos.map((p) => ({ ...Object.fromEntries(photoFields.filter((k) => p[k] !== void 0).map((k) => [k, p[k]])), file: p.file })) } : null;
  state.cloudHydrating = true;
  const saved = await sessionStore.switchScope(uid);
  localReady = true;
  return saved?.photos?.length ? saved : carried;
}
async function hydrateSession(record) {
  try {
    resetEditor();
    if (record) {
      state.copiedSettings = record.copiedSettings || null;
      for (const item of record.photos || []) {
        if (!item.file) continue;
        const recipe = normalizedRecipe(item.recipe || builtins[0]), photo = createPhoto(item.file, recipe);
        Object.assign(photo, item, { recipe, settings: normalizeSettings(item.settings), undo: (item.undo || []).slice(-40), redo: (item.redo || []).slice(-40), status: "pending", error: "" });
        state.photos.push(photo);
      }
      renderAlbum();
      state.cloudHydrating = false;
      await persistSession();
      state.cloudHydrating = true;
      if (state.photos.length) {
        await activatePhoto(state.photos.find((p) => p.id === record.activeId)?.id || state.photos[0].id);
        toast("Sesión recuperada: originales, recetas y ajustes conservados.");
      }
    }
  } finally {
    state.cloudHydrating = false;
    await persistSession();
  }
}
cloud = mountCloud({
  prepareIdentity,
  hydrateSession,
  persistSession,
  canAutoSave: () => localReady && !state.cloudHydrating,
  isLocallySaved: () => localReady && !sessionStore.hasUnsaved(),
  saveActive,
  getPhotos: () => state.photos,
  findRecipe: (id) => allRecipes().find((r) => r.id === id),
  getCollection: () => ({ recipes: state.custom, favorites: [...state.favorites] }),
  removeRecipe: removeOwnRecipe,
  mergeImported: (kind, recipe) => {
    const normalized = normalizedRecipe(recipe);
    if (kind === "recipe") {
      if (!state.custom.some((r) => r.id === recipe.id)) state.custom.push(normalized);
    } else {
      state.favorites.add(recipe.id);
      if (!allRecipes().some((r) => r.id === recipe.id)) state.cloudFavoriteRecipes.push(normalized);
    }
    renderRecipes();
    updateSummary();
  },
  getGuestCollection: () => {
    try {
      return { recipes: JSON.parse(localStorage.getItem("film-lab-recipes") || "[]").filter((r) => r?.id && r.settings).map(normalizedRecipe), favorites: JSON.parse(localStorage.getItem("film-lab-favorites") || "[]") };
    } catch {
      return { recipes: [], favorites: [] };
    }
  },
  setCollection: (recipes, favorites, favoriteRecipes = []) => {
    state.custom = recipes.map(normalizedRecipe);
    state.favorites = favorites;
    const extra = favoriteRecipes.filter((r) => !allRecipes().some((existing) => existing.id === r.id)).map(normalizedRecipe);
    state.cloudFavoriteRecipes = extra;
    renderRecipes();
    updateSummary();
  },
  resetEditor,
  persistLocal: () => {
    try {
      persistLocal();
    } catch {
    }
  },
  loadCachedCollection: (uid) => loadCollectionCache(uid),
  loadGuest: () => {
    loadCollectionCache();
  },
  detachCloud: () => {
    for (const p of state.photos) {
      delete p.cloudId;
      delete p.cloudProjectId;
      delete p.cloudRevision;
      delete p.cloudSnapshot;
      delete p.cloudPending;
      p.cloudUploaded = false;
    }
  },
  setBusy: (on, message) => {
    busy(on, message || "Procesando proyecto…", "Tu edición local se conserva si falla la conexión.");
    document.querySelectorAll("#adjustmentsPanel input,#adjustmentsPanel select,#adjustmentsPanel button").forEach((el) => el.disabled = on);
    if (!on) updateHistory();
  },
  loadProject: async (files, project) => {
    state.cloudHydrating = true;
    try {
      resetEditor();
      for (const entry of files) {
        const recipe = entry.edit?.snapshot?.recipe ? normalizedRecipe(entry.edit.snapshot.recipe) : builtins[0], photo = createPhoto(entry.file, recipe);
        if (entry.edit) {
          photo.settings = normalizeSettings(entry.edit.snapshot.settings);
          photo.intensity = entry.edit.snapshot.intensity ?? 100;
        }
        Object.assign(photo, { thumbnail: entry.thumbnail, width: entry.asset.width || 0, height: entry.asset.height || 0, duration: entry.asset.duration || 0, cloudId: entry.asset.id, cloudProjectId: project.id, cloudRevision: entry.edit?.revision || 0, cloudSnapshot: entry.edit?.snapshot || null, cloudUploaded: true });
        state.photos.push(photo);
      }
      renderAlbum();
      state.cloudHydrating = false;
      await persistSession();
      state.cloudHydrating = true;
      if (state.photos.length) await activatePhoto(state.photos[0].id);
    } finally {
      state.cloudHydrating = false;
      await persistSession();
    }
  }
});
$("retryLocalSession").onclick = () => persistSession();
const cloudReady = cloud.ready;
const disposeCloud = async () => {
  await persistSession();
  clearTimeout(previewTimer);
  state.generation++;
  worker.terminate();
  state.rawWorker?.terminate();
  closeActiveVideo();
  cloud.dispose();
  await sessionStore.close();
};
const localSessionFlushed = () => persistSession();
mountMobileUX({ getState: () => state, getUser: () => cloud?.getUser(), openExport, showPanel: mobilePanel, openHistory: () => cloud?.showHistory() });
export {
  cloudReady,
  disposeCloud,
  localSessionFlushed
};
