const $ = (id) => document.getElementById(id);
const cloudShape = '<path d="M7 18H6a4 4 0 0 1-.7-7.94A6.5 6.5 0 0 1 18 8.5a4.75 4.75 0 0 1 .5 9.47"/>';
const symbols = {
  pending: '<circle cx="17" cy="17" r="6" fill="#405a47" stroke="#fbfbf7" stroke-width="1"/><path d="M17 13.5V17l2 1" stroke="white" stroke-width="1.8"/>',
  ok: '<circle cx="17" cy="17" r="6" fill="#405a47" stroke="#fbfbf7" stroke-width="1"/><path d="m14 17 2 2 4-4" stroke="white" stroke-width="1.9"/>',
  error: '<circle cx="17" cy="17" r="6" fill="#914d3f" stroke="#fbfbf7" stroke-width="1"/><path d="M17 13.5v4m0 2v.1" stroke="white" stroke-width="1.9"/>',
  local: '<path d="M10 14v6m-2-2 2 2 2-2"/>'
};
function deriveSaveIndicator({ signedIn, localMessage, localError, cloudMessage, cloudError }) {
  if (localError || signedIn && cloudError) return { state: "error", label: "Revisar guardado" };
  const pending = /preparando|guardando|subiendo|consultando|sincronizando|retomando|pendiente|conectando|copia automática/i;
  if (pending.test(localMessage) || signedIn && pending.test(cloudMessage)) {
    return { state: "pending", label: "Guardado en curso" };
  }
  if (!signedIn) return { state: "local", label: "Guardado local · cuenta opcional" };
  return { state: "ok", label: "Guardado · consultar detalles" };
}
function mountMobileUX({ getState, getUser, openExport, showPanel, openHistory }) {
  const toolbar = document.querySelector(".stage-toolbar");
  const projectActions = $("projectActions");
  projectActions.append(document.querySelector(".cloud-strip"));
  const viewProject = document.createElement("button");
  viewProject.id = "desktopProject";
  viewProject.className = "button outline compact";
  viewProject.textContent = "Proyecto";
  viewProject.onclick = () => {
    const project = $("projectPanel");
    project.classList.toggle("desktop-open");
    viewProject.setAttribute("aria-expanded", project.classList.contains("desktop-open"));
  };
  $("accountButton").before(viewProject);
  const indicator = document.createElement("button");
  indicator.id = "saveIndicator";
  indicator.className = "save-indicator";
  indicator.type = "button";
  $("accountButton").before(indicator);
  const detail = () => [
    $("localSessionStatus").textContent,
    getUser() ? $("cloudStatus").textContent : "Sin cuenta: la sesión se conserva solo en este dispositivo. Iniciá sesión para tener una copia en la nube."
  ].filter(Boolean).join("\n\n");
  indicator.onclick = () => {
    $("syncDetails").textContent = detail();
    $("syncDialog").showModal();
  };
  $("syncProject").onclick = () => {
    $("syncDialog").close();
    if (matchMedia("(max-width:850px)").matches) showPanel("project");
    else $("projectPanel").classList.add("desktop-open");
  };
  $("projectHistory").onclick = openHistory;
  const expand = document.createElement("button");
  expand.type = "button";
  expand.id = "fullscreenButton";
  expand.className = "tool-button";
  expand.textContent = "⛶ Pantalla completa";
  $("dropZone").append(expand);
  const hint = document.createElement("p");
  hint.id = "holdHint";
  hint.className = "tiny muted";
  hint.textContent = "Mantené la foto para ver el original";
  toolbar.append(hint);
  $("undoButton").innerHTML = '<span aria-hidden="true">↶</span><small>Deshacer</small>';
  $("redoButton").innerHTML = '<span aria-hidden="true">↷</span><small>Rehacer</small>';
  $("undoButton").title = "Deshacer";
  $("redoButton").title = "Rehacer";
  const look = document.createElement('div');
  look.id = 'mobileLook'; look.className = 'mobile-look';
  $('mobilePreviewDock').append(look);
  const navIcons = {
    photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 5-5 4 3 3-5 4 6"/>',
    recipes: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    adjustments: '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="9" cy="6" r="2" fill="var(--bg)"/><circle cx="16" cy="12" r="2" fill="var(--bg)"/><circle cx="7" cy="18" r="2" fill="var(--bg)"/>',
    project: '<path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  };
  for (const button of document.querySelectorAll('.mobile-tabs button')) {
    const label = button.textContent;
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[button.dataset.panel]}</svg><span>${label}</span>`;
  }
  function update() {
    const state = getState(), count = state.photos.filter((p) => p.selected).length;
    $("mobileExport").textContent = `Exportar ${count} ${count === 1 ? "archivo" : "archivos"} ↗`;
    $("fullscreenExport").textContent = $("mobileExport").textContent;
    $("mobileExport").disabled = state.busy || !count;
    $("fullscreenExport").disabled = state.busy || !count;
    expand.disabled = state.busy || !state.file;
    const lookLabel = state.current.name + ' · ' + (state.photos.findIndex(p=>p.id===state.activeId)+1) + ' de ' + state.photos.length;
    if(look.textContent !== lookLabel) look.textContent = lookLabel;
    $('accountButton').setAttribute('aria-label',getUser()?'Mi perfil':'Ingresar o crear cuenta');
    const next = deriveSaveIndicator({
      signedIn: !!getUser(),
      localMessage: $("localSessionStatus").textContent,
      localError: $("localSessionStatus").classList.contains("error"),
      cloudMessage: $("cloudStatus").textContent,
      cloudError: $("cloudStatus").classList.contains("error")
    });
    if (indicator.dataset.state !== next.state) {
      indicator.dataset.state = next.state;
      indicator.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cloudShape}${symbols[next.state]}</svg>`;
    }
    indicator.title = next.label;
    indicator.setAttribute("aria-label", next.label);
    if ($("syncDialog").open) $("syncDetails").textContent = detail();
  }
  const observer = new MutationObserver(update);
  for (const id of ["localSessionStatus", "cloudStatus", "photoList", "accountButton", "selectedName"]) {
    observer.observe($(id), { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "disabled"] });
  }
  $("mobileExport").onclick = openExport;
  $("fullscreenExport").onclick = () => {
    closeFullscreen();
    openExport();
  };
  let firstHint = false;
  document.addEventListener("film-files-added", () => {
    if (firstHint) return;
    firstHint = true;
    const filters = document.querySelector('[data-panel="recipes"]');
    filters.classList.add("filter-nudge");
    filters.title = "Tocá Filtros para probar una receta. En Editar ajustás luz y color.";
    const helper = document.createElement("p");
    helper.id = "filterOnboarding";
    helper.className = "filter-onboarding";
    helper.textContent = "Probá Filtros o ajustá luz y color en Editar.";
    helper.setAttribute("role", "status");
    document.querySelector(".mobile-export-dock").prepend(helper);
    setTimeout(() => filters.classList.remove("filter-nudge"), 6500);
    filters.addEventListener("click", () => {
      filters.classList.remove("filter-nudge");
      helper.remove();
    }, { once: true });
    setTimeout(() => helper.remove(), 1e4);
  });
  const frame = $("imageFrame"), area = $("dropZone"), dialog = $("fullscreenDialog");
  let holdTimer = null, holdOrigin = null;
  function endHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    frame.classList.remove("holding-original");
    document.body.classList.remove('holding-photo');
  }
  frame.addEventListener("pointerdown", (e) => {
    endHold();
    if (dialog.open && points.size > 0) return;
    if (e.target === $("compareRange") && getState().compare) return;
    if (getState().busy || !getState().file || e.button > 0) return;
    if(e.cancelable) e.preventDefault();
    window.getSelection()?.removeAllRanges();
    holdOrigin = { x: e.clientX, y: e.clientY };
    holdTimer = setTimeout(() => {
      window.getSelection()?.removeAllRanges();
      document.body.classList.add('holding-photo');
      frame.classList.add('holding-original');
    }, 300);
  });
  frame.addEventListener("pointermove", (e) => {
    if (holdOrigin && Math.hypot(e.clientX - holdOrigin.x, e.clientY - holdOrigin.y) > 8) endHold();
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) window.addEventListener(event, endHold);
  window.addEventListener("blur", endHold);
  for(const event of ['contextmenu','selectstart','dragstart']) frame.addEventListener(event,e=>e.preventDefault());
  frame.addEventListener('touchstart',e=>{
    if(e.target === $('compareRange') && getState().compare) return;
    if(e.cancelable)e.preventDefault();
  },{passive:false});
  frame.addEventListener('touchend',endHold);
  frame.addEventListener('touchcancel',endHold);
  let anchors = [], scale = 1, x = 0, y = 0;
  const points = /* @__PURE__ */ new Map();
  let last = null;
  function transform() {
    const bounds = $("fullscreenMedia").getBoundingClientRect();
    x = Math.max(-bounds.width * (scale - 1) / 2, Math.min(bounds.width * (scale - 1) / 2, x));
    y = Math.max(-bounds.height * (scale - 1) / 2, Math.min(bounds.height * (scale - 1) / 2, y));
    frame.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    $("fullscreenZoom").textContent = scale > 1 ? "Ajustar" : "Ampliar";
  }
  function openFullscreen() {
    if (getState().busy || !getState().file) return;
    anchors = [area, $("videoControls"), toolbar].map((el) => {
      const marker = document.createComment("fullscreen-return");
      el.before(marker);
      return { el, marker };
    });
    $("fullscreenMedia").append(area);
    $("fullscreenTools").append($("videoControls"), toolbar);
    scale = 1;
    x = y = 0;
    dialog.showModal();
    document.body.classList.add("fullscreen-open");
    transform();
  }
  function restoreFullscreen() {
    endHold();
    points.clear();
    last = null;
    frame.style.transform = "";
    for (const { el, marker } of anchors) {
      marker.replaceWith(el);
    }
    anchors = [];
    document.body.classList.remove("fullscreen-open");
    window.dispatchEvent(new Event("resize"));
  }
  function closeFullscreen() {
    dialog.close();
  }
  expand.onclick = openFullscreen;
  $("closeFullscreen").onclick = closeFullscreen;
  dialog.addEventListener("close", restoreFullscreen);
  $("fullscreenZoom").onclick = () => {
    endHold();
    scale = scale > 1 ? 1 : 2;
    x = y = 0;
    transform();
  };
  const media = $("fullscreenMedia");
  function geometry() {
    const a = [...points.values()];
    return { cx: a.reduce((s, p) => s + p.x, 0) / a.length, cy: a.reduce((s, p) => s + p.y, 0) / a.length, distance: a.length > 1 ? Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y) : 0 };
  }
  media.addEventListener("pointerdown", (e) => {
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last = geometry();
    media.setPointerCapture(e.pointerId);
    if (points.size > 1) endHold();
  });
  media.addEventListener("pointermove", (e) => {
    if (!points.has(e.pointerId)) return;
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const next = geometry();
    if (points.size > 1 && last?.distance) {
      scale = Math.max(1, Math.min(4, scale * next.distance / last.distance));
      endHold();
    }
    if (scale > 1 && last) {
      x += next.cx - last.cx;
      y += next.cy - last.cy;
      endHold();
    }
    last = next;
    transform();
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) media.addEventListener(event, (e) => {
    points.delete(e.pointerId);
    last = points.size ? geometry() : null;
    endHold();
  });
  media.addEventListener("dblclick", () => {
    scale = scale > 1 ? 1 : 2;
    x = y = 0;
    transform();
  });
  media.addEventListener("wheel", (e) => {
    e.preventDefault();
    endHold();
    scale = Math.max(1, Math.min(4, scale - e.deltaY * 2e-3));
    transform();
  }, { passive: false });
  update();
}
export {
  deriveSaveIndicator,
  mountMobileUX
};
