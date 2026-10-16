export const catalogDescriptions = {
  'online-amber-print': 'Tonos ámbar, negros suaves y grano fino.',
  'online-coastal-blue': 'Tonos fríos, azules profundos y luces suaves.',
  'online-dusty-rose': 'Matiz rosado, color apagado y negros lavados.',
  'online-forest-walk': 'Color profundo, sombras densas y calidez suave.',
  'online-pastel-morning': 'Colores pastel, sombras claras y contraste suave.',
  'online-cinema-teal': 'Tonos fríos, contraste marcado y bordes oscuros.',
  'online-desert-light': 'Calidez dorada, luces suaves y textura fina.',
  'online-rainy-city': 'Color frío y apagado, con contraste definido.',
  'online-soft-wedding': 'Luz cálida, sombras abiertas y detalle suave.',
  'online-autumn-paper': 'Tonos cálidos y rosados, negros lavados y grano.',
  'online-night-neon': 'Color intenso, azules profundos y sombras firmes.',
  'online-clean-travel': 'Color vivo, sombras claras y detalle definido.',
  'online-faded-denim': 'Tonos fríos, negros lavados y grano visible.',
  'online-warm-portrait': 'Calidez suave, luces contenidas y detalle delicado.',
  'online-noir-street': 'Blanco y negro de alto contraste, sombras densas y grano.',
  'online-soft-silver': 'Blanco y negro suave, negros lavados y grano fino.',
  'online-sepia-notes': 'Color casi monocromo, calidez intensa y textura granulada.',
  'online-summer-postcard': 'Color cálido y vivo, luces suaves y negros lavados.',
  'online-studio-neutral': 'Color neutro, sombras claras y detalle suavizado.',
  'online-deep-woodland': 'Color profundo y contenido, con sombras densas.'
};

export function recipeDescription(recipe) {
  let text = String(recipe?.description || '').trim();
  if (!text || /look original editable|ajust[aá] sus valores a la luz|interpretación para fotos sony/i.test(text)) {
    text = catalogDescriptions[recipe?.id] || describeSettings(recipe?.settings || {});
  }
  text = text.split(/\.\s+/)[0].replace(/[.\s]+$/, '');
  if (text.length > 115) text = text.slice(0, 112).replace(/\s+\S*$/, '') + '…';
  return text.endsWith('…') ? text : text + '.';
}

function describeSettings(s) {
  const traits = [];
  if (s.mono >= .7) traits.push('Blanco y negro');
  else if (s.temperature > 8) traits.push('Tonos cálidos');
  else if (s.temperature < -8) traits.push('Tonos fríos');
  if (s.saturation < -10) traits.push('color contenido');
  else if (s.saturation > 10 || s.vibrance > 15) traits.push('color vivo');
  if (s.contrast > 12) traits.push('contraste marcado');
  else if (s.contrast < -8) traits.push('contraste suave');
  if (s.fade > 8) traits.push('negros lavados');
  if (s.highlights < -10) traits.push('luces suaves');
  if (s.grain > 10) traits.push('textura de grano');
  return traits.length ? traits.slice(0, 3).join(', ') : 'Luz y color equilibrados';
}
