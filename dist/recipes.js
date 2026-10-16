import { normalizeSettings, adaptFuji } from "./engine.js";
const make = (id, name, description, settings, palette) => ({ id, name, creator: "Film Lab", description, type: "original", settings: normalizeSettings(settings), palette });
const summer = { name: "Nostalgic Summer", source_attribution: "Josh Edgoose · Fujifilm", source_url: "https://www.fujifilm-x.com/en-gb/learning-centre/make-your-own-film-simulation-recipe/", film_simulation: "Nostalgic Neg.", dynamic_range: "DR400", grain_roughness: "Weak", grain_size: "Large", color_chrome_effect: "Weak", color_chrome_fx_blue: "Weak", white_balance: "Kelvin", wb_kelvin: 5600, white_balance_red: 0, white_balance_blue: -3, highlight: -1.5, shadow: -1, color: 3, sharpness: -1, high_iso_nr: 0, clarity: 0 };
const builtins = [make("neutral", "Original", "Una base limpia, sin tratamiento.", {}, ["#b1c6cc", "#c3bb9d"]), make("gold", "Golden Hour", "Luz tibia, sombras suaves y un aire de verano.", { temperature: 18, contrast: -8, highlights: -22, shadows: 15, vibrance: 12, fade: 9, grain: 12 }, ["#ecc477", "#788473"]), make("chrome", "Muted Chrome", "Color contenido, azules profundos y contraste equilibrado.", { contrast: 15, saturation: -22, highlights: -14, shadows: -8, colorChrome: 30, blueChrome: 30, grain: 10 }, ["#829783", "#d6bd99"]), make("soft", "Soft Portrait", "Pieles suaves, color delicado y luz envolvente.", { contrast: -13, highlights: -18, shadows: 16, saturation: -6, temperature: 5, sharpness: -18, fade: 4 }, ["#d8ac99", "#baa4b8"]), make("negative", "Urban Negative", "Sombras frías, negros levantados y calidez en el color.", { contrast: 21, temperature: -5, tint: 6, saturation: -12, fade: 12, grain: 24, vignette: 12, hsl: [{ h: 0, s: 5, l: 0 }, { h: 0, s: 0, l: 0 }, { h: -12, s: -10, l: 0 }, { h: 10, s: -20, l: -5 }, { h: 0, s: -10, l: 0 }, { h: -8, s: -15, l: -8 }, { h: 0, s: 0, l: 0 }, { h: 0, s: 0, l: 0 }] }, ["#687f88", "#d49f79"]), make("mono", "Silver Mono", "Blanco y negro con textura y contraste suave.", { mono: 1, contrast: 22, highlights: -10, fade: 6, grain: 23, sharpness: 12 }, ["#939391", "#303d39"]), { id: "nostalgic-summer", name: "Nostalgic Summer", creator: "Josh Edgoose · Fujifilm", description: "Color cálido y vivo, luces suaves y grano fino.", type: "adapted", settings: adaptFuji(summer), original: summer, source: summer.source_url, palette: ["#d7b175", "#8a9b78"] }];
const sources = [{ name: "Fuji X Weekly", creator: "Ritchie Roesch", url: "https://fujixweekly.com/", search: "https://fujixweekly.com/?s=", description: "Catálogo de recetas por sensor y cámara." }, { name: "Film Recipes", creator: "Justin Gould", url: "https://film.recipes/", search: "https://film.recipes/?s=", description: "Recetas organizadas por luz, escena y estilo." }, { name: "Fujifilm Learning Centre", creator: "Josh Edgoose y otros creadores", url: summer.source_url, description: "Nostalgic Summer y explicación de cada parámetro." }];
const editorialLooks = [{ "id": "editorial-0", "name": "Café Editorial", "creator": "Film Lab", "type": "original", "description": "Marrones cálidos, verdes discretos y negros suaves.", "settings": { "temperature": 20, "saturation": -24, "contrast": 12, "fade": 12, "highlights": -25, "grain": 14 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-1", "name": "Crema 90", "creator": "Film Lab", "type": "original", "description": "Luz cremosa y color suave de los noventa.", "settings": { "temperature": 14, "contrast": -16, "shadows": 22, "highlights": -30, "fade": 14, "grain": 18 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-2", "name": "Indie Flash", "creator": "Film Lab", "type": "original", "description": "Color vivo y contraste de una cámara compacta.", "settings": { "contrast": 24, "vibrance": 32, "saturation": 12, "grain": 17, "shadows": -12 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-3", "name": "Rose Diary", "creator": "Film Lab", "type": "original", "description": "Rosa suave y nostalgia romántica.", "settings": { "tint": 17, "temperature": 7, "contrast": -14, "saturation": -12, "fade": 20, "grain": 20 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-4", "name": "Blue Motel", "creator": "Film Lab", "type": "original", "description": "Azules apagados y atmósfera cinematográfica.", "settings": { "temperature": -18, "blueChrome": 38, "saturation": -20, "contrast": 20, "vignette": 12, "fade": 8 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-5", "name": "Cinema Honey", "creator": "Film Lab", "type": "original", "description": "Ámbar, sombras densas y textura analógica.", "settings": { "temperature": 25, "contrast": 24, "highlights": -28, "shadows": -15, "grain": 28, "vignette": 18 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-6", "name": "Y2K Pop", "creator": "Film Lab", "type": "original", "description": "Color brillante y medios tonos luminosos.", "settings": { "vibrance": 36, "saturation": 18, "gamma": 10, "tint": 9, "contrast": 10 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-7", "name": "Muted Muse", "creator": "Film Lab", "type": "original", "description": "Tonos contenidos y retrato editorial.", "settings": { "saturation": -30, "contrast": -8, "highlights": -18, "shadows": 16, "sharpness": -12, "fade": 9 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-8", "name": "Retro Riviera", "creator": "Film Lab", "type": "original", "description": "Verano retro con azules profundos.", "settings": { "temperature": 12, "vibrance": 18, "blueChrome": 44, "fade": 16, "grain": 24 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-9", "name": "Late Night Film", "creator": "Film Lab", "type": "original", "description": "Oscuro, frío y con grano de película.", "settings": { "exposure": -0.15, "contrast": 30, "temperature": -12, "saturation": -18, "grain": 34, "vignette": 25 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-10", "name": "Peach Weekend", "creator": "Film Lab", "type": "original", "description": "Pieles cálidas y color melocotón.", "settings": { "temperature": 15, "tint": 8, "highlights": -22, "contrast": -10, "vibrance": 10, "fade": 8 }, "palette": ["#c5b28f", "#8a8d76"] }, { "id": "editorial-11", "name": "Monochrome Diary", "creator": "Film Lab", "type": "original", "description": "Blanco y negro nostálgico con negros lavados.", "settings": { "mono": 1, "contrast": 18, "fade": 22, "grain": 30, "highlights": -20 }, "palette": ["#c5b28f", "#8a8d76"] }];
const channels = (entries) => Array.from({ length: 8 }, (_, i) => ({ h: 0, s: 0, l: 0, ...entries[i] }));
const newLooks = [
  make("botanica", "Botánica", "Piel cálida, verdes profundos y textura fina.", {
    temperature: 6,
    tint: 2,
    contrast: 5,
    highlights: -15,
    grain: 10,
    grainSize: 1,
    curve: [0.02, 0.2, 0.5, 0.8, 0.98],
    hsl: channels({ 0: { s: -5 }, 1: { s: -4, l: 4 }, 2: { h: 8, s: -22, l: -2 }, 3: { h: 6, s: -24, l: -10 }, 4: { s: -12 }, 5: { s: -10 } })
  }, ["#71856a", "#cfaa88"]),
  make("flash-diario", "Flash de Diario", "Color directo, rojos presentes y negros firmes.", {
    contrast: 17,
    temperature: 2,
    whites: 8,
    highlights: -6,
    shadows: -7,
    grain: 14,
    grainSize: 1,
    sharpness: 3,
    curve: [0, 0.19, 0.51, 0.82, 1],
    hsl: channels({ 0: { s: 14, l: 1 }, 1: { s: -5, l: 3 }, 2: { s: -8 }, 3: { s: -6 }, 5: { s: 8 } })
  }, ["#c85845", "#e7d5bd"]),
  make("plata-editorial", "Plata Editorial", "Blanco y negro limpio, medios definidos y grano fino.", {
    mono: 1,
    contrast: 10,
    whites: 7,
    highlights: -10,
    grain: 13,
    grainSize: 1,
    sharpness: 5,
    curve: [8e-3, 0.2, 0.51, 0.81, 1]
  }, ["#c4c3bd", "#303a34"]),
  make("bronce-salino", "Bronce Salino", "Piel dorada, marrones densos y fondos discretos.", {
    temperature: 9,
    tint: 1,
    contrast: 12,
    shadows: -11,
    highlights: -15,
    saturation: -5,
    grain: 17,
    grainSize: 1,
    curve: [0.012, 0.18, 0.47, 0.77, 0.98],
    hsl: channels({ 0: { h: 3, s: -8 }, 1: { h: 3, s: -5, l: -2 }, 2: { h: -6, s: -27, l: -4 }, 3: { s: -32, l: -12 }, 4: { s: -20, l: -3 }, 5: { s: -25, l: -5 } })
  }, ["#c9a173", "#3e4d43"]),
  make("piel-seda", "Piel de Seda", "Luz cremosa, labios contenidos y textura natural.", {
    temperature: 5,
    tint: -3,
    contrast: -6,
    highlights: -19,
    shadows: 6,
    saturation: -4,
    grain: 5,
    grainSize: 1,
    curve: [0.025, 0.26, 0.54, 0.79, 0.98],
    hsl: channels({ 0: { s: -12, l: 3 }, 1: { h: 1, s: -10, l: 5 }, 2: { h: -3, s: -23, l: 3 }, 3: { s: -24 }, 5: { s: -18 } })
  }, ["#dfc6a0", "#748273"]),
  make("plata-marina", "Plata Marina", "Azules grisáceos, sombras profundas y reflejos vivos.", {
    temperature: -5,
    tint: -2,
    saturation: -13,
    contrast: 11,
    shadows: -16,
    whites: 12,
    highlights: 0,
    grain: 12,
    grainSize: 1,
    curve: [8e-3, 0.17, 0.46, 0.79, 1],
    hsl: channels({ 0: { s: -8 }, 1: { s: -8, l: -2 }, 2: { s: -27 }, 3: { s: -35, l: -5 }, 4: { s: -25, l: 5 }, 5: { h: -8, s: -32, l: 7 }, 6: { s: -25 } })
  }, ["#9baeb2", "#374e52"]),
  make("costa-editorial", "Costa Editorial", "Piel cálida, agua cian y blancos luminosos.", {
    temperature: 3,
    tint: 2,
    contrast: 9,
    whites: 9,
    highlights: -10,
    grain: 8,
    grainSize: 1,
    curve: [5e-3, 0.21, 0.52, 0.81, 1],
    hsl: channels({ 0: { s: 5 }, 1: { h: 1, s: 4, l: 4 }, 2: { s: -18 }, 3: { s: -20 }, 4: { h: 3, s: 10, l: 3 }, 5: { h: -12, s: -8, l: 3 } })
  }, ["#58a4b0", "#d2a077"])
];
editorialLooks.push(...newLooks);
for (const r of [...builtins, ...editorialLooks]) {
  if (["soft", "mono", "editorial-1", "editorial-7", "editorial-10"].includes(r.id)) r.hiddenFromCatalog = true;
}
export {
  builtins,
  editorialLooks,
  sources
};
