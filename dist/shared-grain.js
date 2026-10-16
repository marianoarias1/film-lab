const amount = value => Math.max(0, Math.min(100, Number(value) || 0));

export function hasLegacyGrain(settings) {
  return settings?.laboratory?.film?.enabled === true && amount(settings.laboratory.film.grain) > 0;
}

export function sharedGrainValue(settings) {
  const base = amount(settings?.grain);
  if (!hasLegacyGrain(settings)) return base;
  // Older edits used two different noise fields. Keep their pixels unchanged
  // until the user edits grain; this RMS estimate is only the shared UI value.
  const filmEquivalent = amount(settings.laboratory.film.grain) * 24 / (255 * .14);
  return Math.min(100, Math.round(Math.hypot(base, filmEquivalent)));
}

export function setSharedGrain(settings, value) {
  settings.grain = amount(value);
  if (settings.laboratory?.film) settings.laboratory.film.grain = 0;
  return settings.grain;
}
