const editingPanels = new Set(['recipes', 'adjustments', 'laboratory']);
export function viewportState({layoutHeight, visualHeight, scale = 1, textFocused = false}) {
  if (Math.abs(scale - 1) > .05) return null; // Leave deliberate pinch zoom alone.
  const height = Number.isFinite(visualHeight) && visualHeight > 0 ? visualHeight : layoutHeight;
  if (!(height > 0)) return null;
  return {height:Math.round(height), keyboard:textFocused && layoutHeight - height > 120};
}

export function mountMobileViewport() {
  let timer = null, photoScroll = 0, restorePhotoScroll = null;
  const textFocused = () => document.activeElement?.matches('input:not([type=range]):not([type=checkbox]):not([type=button]):not([type=color]),textarea,[contenteditable=true]');
  const editorActive = () => window.innerWidth <= 850 && editingPanels.has(document.body.dataset.mobilePanel);
  function resetDocumentScroll() {
    window.scrollTo(0, 0);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.documentElement.scrollTop = document.body.scrollTop = 0;
  }
  function sync() {
    timer = null;
    document.documentElement.classList.toggle('mobile-editor-locked', editorActive());
    if (window.innerWidth > 850) {
      document.documentElement.style.removeProperty('--mobile-editor-height');
      document.body.classList.remove('software-keyboard');
      return;
    }
    if (document.getElementById('fullscreenDialog')?.open) return;
    const viewport = window.visualViewport;
    const next = viewportState({layoutHeight:window.innerHeight, visualHeight:viewport?.height, scale:viewport?.scale || 1, textFocused:!!textFocused()});
    if (!next) return;
    const height = next.height + 'px';
    if (document.documentElement.style.getPropertyValue('--mobile-editor-height') !== height) document.documentElement.style.setProperty('--mobile-editor-height', height);
    document.body.classList.toggle('software-keyboard', next.keyboard);
    // Safari may retain the document offset used to reveal a focused input.
    // Only reset the outer document; each tools panel keeps its own scroll.
    if (!textFocused() && editorActive() && (window.scrollY || document.scrollingElement?.scrollTop)) resetDocumentScroll();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(sync, 0); }
  function settle() { schedule(); setTimeout(schedule, 180); setTimeout(schedule, 450); }
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', settle);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', settle);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') settle(); });
  sync();
  return {
    beforePanelChange(nextPanel) {
      if (window.innerWidth > 850) return;
      const current = document.body.dataset.mobilePanel, wasEditor = editingPanels.has(current), nextEditor = editingPanels.has(nextPanel);
      if (nextEditor) {
        if (!wasEditor && current === 'photo') photoScroll = Math.max(0, window.scrollY || document.scrollingElement?.scrollTop || 0);
        // Reset while Photos still owns the normal document, before its preview
        // is reparented and the layout switches to a fixed editing viewport.
        resetDocumentScroll();
      }
      restorePhotoScroll = wasEditor && nextPanel === 'photo' ? photoScroll : null;
      document.documentElement.classList.toggle('mobile-editor-locked', nextEditor);
    },
    panelChanged() {
      if (window.innerWidth <= 850 && textFocused()) document.activeElement.blur();
      sync();
      if (restorePhotoScroll !== null) {
        window.scrollTo(0, restorePhotoScroll);
        restorePhotoScroll = null;
      }
      settle();
    }
  };
}
