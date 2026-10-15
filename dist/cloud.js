import { confirmAction } from "./dialogs.js";
import { uploadOriginal } from "./cloud-upload.js";
import { createClient } from "./vendor/supabase/client.js";
import { cloudConfig } from "./cloud-config.js";
import {
  treatmentOf,
  inferAction,
  stateChanges,
  safeRecipe,
  guestKeys,
  nextCursor
} from "./cloud-model.js";
const $ = (id) => document.getElementById(id), checked = (result) => {
  if (result.error) throw result.error;
  return result.data;
}, uuid = () => crypto.randomUUID();
const text = (tag, value, className = "") => {
  const el = document.createElement(tag);
  el.textContent = value;
  el.className = className;
  return el;
};
const actionNames = {
  import: "Archivo guardado",
  recipe: "Receta aplicada",
  adjust: "Ajustes modificados",
  paste: "Ajustes pegados",
  restore: "Versión recuperada",
  export: "Archivo exportado",
  remove: "Archivo quitado del proyecto"
};
function mountCloud(adapter, {
  client = createClient(cloudConfig.url, cloudConfig.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  })
} = {}) {
  let user = null, current = null, working = false, autoTimer = null, collectionTimer = null, authMode = "login", generation = 0, historyCursor = null, projectOffset = 0, recovery = false, loadingAuth = true, operationAbort = null, draftProjectId = null, copyMode = false, historyProject = null, autoWorking = false, autoTask = null, draftTimer = null;
  let syncFailed = false;
  const pending = /* @__PURE__ */ new Map();
  let collectionPending = false;
  let lastUid = null, identityTask = null;
  let recipeQueue = Promise.resolve(), favoriteQueue = Promise.resolve(), recipeJob = null;
  const favoriteJobs = /* @__PURE__ */ new Map(), deletedRecipes = /* @__PURE__ */ new Set(), recipeDeletes = /* @__PURE__ */ new Map();
  let guestView = null, guestJob = null, guestImporting = false, guestPromptTimer = null;
  function status(message, error = false) {
    const element = $("cloudStatus");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", error);
  }
  function showAccount() {
    if (user) {
      $("profileDialog").showModal();
      refreshProfile();
    } else $("authDialog").showModal();
  }
  function setWorking(on, message = "") {
    if (on) operationAbort = new AbortController();
    working = on;
    adapter.setBusy(on, message);
    $("saveCloudProject").disabled = on;
    $("cloudNewProject").disabled = on;
    $("cloudSignOut").disabled = on;
    updateHeader();
  }
  function requireUser() {
    if (!user) throw new Error("Iniciá sesión para guardar en tu cuenta.");
    return user.id;
  }
  function assertIdentity(uid) {
    if (user?.id !== uid) throw new Error("La cuenta cambió durante la operación. Reintentá.");
  }
  function fault(error) {
    const msg = String(error?.message || error);
    if (error?.code === "23505" || msg.includes("projects_owner_name_unique"))
      return "Ya tenés un proyecto con ese nombre. Elegí otro nombre.";
    if (msg.includes("UPLOAD_PENDING"))
      return "La subida del original todavía no se completó. Reintentá Guardar proyecto; tus ajustes locales se conservan.";
    if (msg.includes("EDIT_CONFLICT"))
      return "Este archivo cambió desde otro dispositivo o pestaña. Abrí el proyecto de nuevo o guardá una copia; tus ajustes locales siguen disponibles.";
    if (msg.includes("Invalid login credentials")) return "Email o contraseña incorrectos.";
    if (msg.includes("Email not confirmed")) return "Confirmá tu email antes de ingresar.";
    if (msg.includes("rate limit"))
      return "Hay demasiados intentos. Esperá unos minutos y reintentá.";
    if (msg.includes("500") || msg.includes("fetch") || msg.includes("Network") || /offline/i.test(msg))
      return "No pudimos conectar con la nube. Tus ajustes siguen en esta sesión.";
    if (msg.includes("User not allowed") || msg.includes("Email address not authorized"))
      return "El envío de emails todavía no está configurado para este usuario. Podés seguir editando sin cuenta.";
    if (/^(Usá|Ingresá|Cargá|Guardá|Iniciá|La cuenta|La sesión)/.test(msg) || msg.includes("supera 50 MB"))
      return msg;
    return "No se completó la operación. Reintentá; tu edición local sigue disponible.";
  }
  function updateHeader() {
    $("accountButton").textContent = user ? "Mi perfil" : "Ingresar / Crear cuenta";
    $("cloudUserName").textContent = user?.user_metadata?.display_name || user?.email || "Mi cuenta";
    $("cloudProjectLabel").textContent = current ? (current.is_draft ? "Borrador activo: " : "Proyecto activo: ") + current.name : "Sesión nueva · guardado automático local";
    $("privacyLabel").textContent = !user ? "Guardado local · cuenta opcional" : current?.localOnly ? "Borrador local · nube pendiente" : current ? "Copia local + nube privada" : "Cuenta conectada · borrador automático";
    $("cloudSaveHint").textContent = user ? "Con cuenta, los originales y ajustes se suben automáticamente a un borrador privado. Este botón permite nombrarlo. Máximo 50 MB por archivo en la nube; los mayores quedan solo en el dispositivo." : "Sin cuenta, las recetas y favoritas quedan solo en este navegador.";
    $("saveCloudProject").textContent = current?.is_draft ? "Nombrar proyecto" : current ? "Guardar en «" + current.name + "»" : "Nombrar y guardar proyecto";
    $("retryCloudDraft").hidden = !user || !syncFailed || working || autoWorking;
    $("cloudNewProject").hidden = !current;
    $("startNewCloudProject").hidden = !current && !adapter.getPhotos().some((p) => !p.isDemo);
    $("startNewCloudProject").textContent = user ? "Nuevo proyecto" : "Nueva sesión";
    $("confirmSave").textContent = user ? "Guardar en mi cuenta" : "Guardar en este navegador";
    $("recipeSaveLocation").textContent = user ? "Se guarda en tu cuenta y estará disponible en otros dispositivos. También podés descargar el JSON." : "Sin cuenta, se guarda solo en este navegador. Creá una cuenta para sincronizarla entre dispositivos.";
  }
  function saveDialog(copy = false) {
    copyMode = copy;
    if (copy) draftProjectId = null;
    $("projectName").value = copy ? (current?.name || "Mi proyecto") + " · copia" : current?.name || "Mi proyecto";
    $("projectSaveStatus").textContent = "";
    $("projectSaveTitle").textContent = copy ? "Guardar una copia." : "Guardar proyecto.";
    updateHeader();
    $("cloudProjectDialog").showModal();
  }
  async function leaveProject({ empty = false } = {}) {
    if (working || autoWorking) {
      status(
        "Terminando la copia en la nube. Esperá a que termine o reintentá cuando vuelva la conexión."
      );
      return false;
    }
    adapter.saveActive();
    await flush();
    if (pending.size) {
      status("Hay cambios sin guardar. Reintentá Guardar antes de empezar otro proyecto.", true);
      return false;
    }
    clearTimeout(autoTimer);
    current = null;
    draftProjectId = null;
    copyMode = false;
    syncFailed = false;
    adapter.detachCloud();
    if (!empty) adapter.resetEditor?.();
    await adapter.persistSession?.();
    updateHeader();
    status(
      user ? "Sesión nueva · los proyectos anteriores siguen guardados en tu cuenta" : "Sesión nueva · se descartó la copia local anterior"
    );
    return true;
  }
  async function readCollectionRows(table, columns, uid, key) {
    const result = [];
    let cursor = null;
    for (; ; ) {
      let query = client.from(table).select(columns).eq("owner_id", uid).order(key).limit(200);
      if (cursor) query = query.gt(key, cursor);
      const rows = checked(await query);
      assertIdentity(uid);
      result.push(...rows);
      if (rows.length < 200) break;
      cursor = rows.at(-1)[key];
    }
    return result;
  }
  async function queryCollection(uid) {
    const recipeRows = await readCollectionRows("recipes", "id,payload", uid, "id"), recipes = recipeRows.map((r) => safeRecipe(r.payload)).filter(Boolean), favs = await readCollectionRows("favorites", "recipe_key,recipe_snapshot", uid, "recipe_key");
    assertIdentity(uid);
    adapter.setCollection(
      recipes,
      new Set(favs.map((r) => r.recipe_key)),
      favs.map((r) => safeRecipe(r.recipe_snapshot)).filter(Boolean)
    );
  }
  function identity(session) {
    const uid = session?.user?.id || null;
    if (uid === lastUid && !loadingAuth) return identityTask || Promise.resolve();
    identityTask = runIdentity(session);
    return identityTask;
  }
  async function runIdentity(session) {
    const next = session?.user || null;
    if ((next?.id || null) === lastUid && !loadingAuth) return;
    loadingAuth = false;
    lastUid = next?.id || null;
    operationAbort?.abort();
    generation++;
    syncFailed = false;
    autoWorking = false;
    autoTask = null;
    clearTimeout(draftTimer);
    const identityGeneration = generation;
    const local = await adapter.prepareIdentity?.(next?.id || null);
    if (generation !== identityGeneration) return;
    $("cloudProjectList").replaceChildren();
    $("cloudHistoryList").replaceChildren();
    clearTimeout(autoTimer);
    clearTimeout(collectionTimer);
    pending.clear();
    collectionPending = false;
    recipeJob = null;
    favoriteJobs.clear();
    deletedRecipes.clear();
    recipeDeletes.clear();
    clearTimeout(guestPromptTimer);
    guestView = null;
    guestJob = null;
    guestImporting = false;
    $("guestImportDialog").close();
    $("guestTransferNotice").hidden = true;
    historyProject = null;
    const hadCloud = !!current;
    current = null;
    draftProjectId = null;
    user = next;
    if (user && local?.project?.owner_id === user.id) {
      current = local.project;
      draftProjectId = local.draftId || null;
    }
    updateHeader();
    if (adapter.hydrateSession) await adapter.hydrateSession(local);
    if (!user) {
      adapter.loadGuest(hadCloud);
      status(
        "Invitado · originales y ajustes guardados en este dispositivo cuando la barra lo confirma"
      );
      return;
    }
    adapter.loadCachedCollection(user.id);
    status("Cuenta conectada · consultando tu colección…");
    try {
      const uid = user.id;
      checked(
        await client.from("profiles").upsert(
          { id: uid, display_name: String(user.user_metadata?.display_name || "").slice(0, 90) },
          { onConflict: "id" }
        )
      );
      await recoverCollection(uid);
      await queryCollection(uid);
      for (const key of [
        "film-lab-recipes:",
        "film-lab-favorites:",
        "film-lab-pending-recipes:",
        "film-lab-pending-favorites:"
      ])
        localStorage.removeItem(key + uid);
      status(
        current ? "Sesión recuperada · retomando sincronización de «" + current.name + "»" : "Cuenta conectada · los archivos nuevos crearán un borrador automático"
      );
      offerGuestCollection(uid);
      scheduleDraft();
    } catch (e) {
      status("Cuenta conectada. " + fault(e), true);
      scheduleDraft();
    }
  }
  const authListener = client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recovery = true;
      setTimeout(() => {
        $("recoveryDialog").showModal();
      }, 0);
    }
    setTimeout(() => identity(session).catch((e) => status(fault(e), true)), 0);
  });
  const ready = client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    return identity(data.session);
  }).catch(async (e) => {
    await identity(null).catch(() => {
    });
    status("Podés editar sin cuenta. " + fault(e), true);
  });
  $("accountButton").onclick = showAccount;
  $("saveCloudProject").onclick = () => {
    if (!user) {
      $("authDialog").showModal();
      return;
    }
    saveDialog();
  };
  $("confirmCloudSave").onclick = () => saveProject().catch((e) => {
    status(fault(e), true);
    $("projectSaveStatus").textContent = fault(e);
  });
  $("cloudNewProject").onclick = () => {
    if (working || autoWorking) {
      status("Terminando la copia en la nube. Podés seguir editando mientras tanto.");
      return;
    }
    if (!adapter.getPhotos().some((p) => !p.isDemo)) {
      status(
        "Cargá al menos un archivo para guardar una copia. El proyecto original sigue en tu cuenta.",
        true
      );
      return;
    }
    saveDialog(true);
  };
  $("startNewCloudProject").onclick = async () => {
    const actionGeneration = generation;
    if (working || autoWorking) {
      status("Terminando la copia en la nube. Podés seguir editando mientras tanto.");
      return;
    }
    if (adapter.getPhotos().some((p) => !p.isDemo) && !await confirmAction(
      "¿Empezar un proyecto nuevo? Los archivos guardados siguen en tu cuenta. Los archivos nuevos sin subir se quitarán de esta sesión y su copia local. Si no llegaron a la nube, exportalos antes de continuar.",
      { title: "Empezar una sesión nueva", confirmLabel: "Empezar nueva sesión", danger: true }
    ))
      return;
    if (actionGeneration !== generation) return;
    await leaveProject();
  };
  for (const id of ["authLoginTab", "authSignupTab"])
    $(id).onclick = () => {
      authMode = id === "authLoginTab" ? "login" : "signup";
      $("authNameField").hidden = authMode === "login";
      $("authSubmit").textContent = authMode === "login" ? "Ingresar" : "Crear cuenta";
      $("authError").textContent = "";
      $("authPassword").autocomplete = authMode === "login" ? "current-password" : "new-password";
      $("authPassword").minLength = authMode === "signup" ? 8 : 1;
      for (const tab of ["authLoginTab", "authSignupTab"])
        $(tab).classList.toggle("active", tab === id);
    };
  $("authForm").onsubmit = async (e) => {
    e.preventDefault();
    $("authSubmit").disabled = true;
    $("authError").textContent = "";
    try {
      const email = $("authEmail").value.trim(), password = $("authPassword").value;
      if (authMode === "signup" && password.length < 8)
        throw new Error("Usá una contraseña de al menos 8 caracteres.");
      const result = authMode === "login" ? await client.auth.signInWithPassword({ email, password }) : await client.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: $("authName").value.trim().slice(0, 90) },
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
      if (result.error) throw result.error;
      $("authPassword").value = "";
      if (result.data.session) {
        $("authDialog").close();
        await identity(result.data.session);
      } else
        $("authError").textContent = "Revisá tu email para confirmar la cuenta. Después podés ingresar; tu edición sigue disponible.";
    } catch (error) {
      $("authError").textContent = fault(error);
    } finally {
      $("authSubmit").disabled = false;
    }
  };
  $("authForgot").onclick = async () => {
    const email = $("authEmail").value.trim();
    if (!email) {
      $("authError").textContent = "Ingresá tu email para recuperar la contraseña.";
      return;
    }
    try {
      checked(
        await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname
        })
      );
      $("authError").textContent = "Si existe una cuenta con ese email, recibirás instrucciones para recuperar la contraseña.";
    } catch (e) {
      $("authError").textContent = fault(e);
    }
  };
  $("recoveryForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const password = $("recoveryPassword").value;
      if (password.length < 8) throw new Error("Usá al menos 8 caracteres.");
      checked(await client.auth.updateUser({ password }));
      $("recoveryPassword").value = "";
      $("recoveryDialog").close();
      recovery = false;
      status("Contraseña actualizada.");
    } catch (e2) {
      $("recoveryError").textContent = fault(e2);
    }
  };
  $("cloudSignOut").onclick = async () => {
    const actionGeneration = generation;
    if (working) return;
    if ((pending.size || current || autoWorking || collectionPending || favoriteJobs.size || guestJob || recipeDeletes.size) && !await confirmAction(
      "¿Cerrar sesión? Los proyectos guardados quedan en tu cuenta. La sesión privada se conserva en este dispositivo cuando la barra confirma el guardado local; las subidas pendientes continuarán al volver a ingresar.",
      { title: "Cerrar sesión", confirmLabel: "Cerrar sesión" }
    ))
      return;
    if (actionGeneration !== generation) return;
    try {
      await adapter.persistSession?.();
      operationAbort?.abort();
      checked(await client.auth.signOut());
      await identity(null);
      $("profileDialog").close();
    } catch (e) {
      status(fault(e), true);
    }
  };
  async function upsertRecipes(recipes) {
    const uid = requireUser();
    const rows = recipes.map(safeRecipe).filter((recipe) => recipe && !deletedRecipes.has(uid + ":" + recipe.id)).map((recipe) => ({
      owner_id: uid,
      client_id: recipe.id,
      name: recipe.name,
      payload: recipe
    }));
    for (let i = 0; i < rows.length; i += 100) {
      assertIdentity(uid);
      checked(
        await client.from("recipes").upsert(rows.slice(i, i + 100), { onConflict: "owner_id,client_id" })
      );
      assertIdentity(uid);
    }
  }
  async function saveFavorite(id, enabled, recipe) {
    if (!user) return;
    const uid = user.id;
    if (enabled && deletedRecipes.has(uid + ":" + id)) return;
    if (enabled && recipe)
      checked(
        await client.from("favorites").upsert(
          { owner_id: uid, recipe_key: id, recipe_snapshot: recipe },
          { onConflict: "owner_id,recipe_key" }
        )
      );
    else checked(await client.from("favorites").delete().eq("owner_id", uid).eq("recipe_key", id));
  }
  async function saveCollection() {
    if (!user) return;
    const uid = user.id, recipes = structuredClone(adapter.getCollection().recipes);
    const job = { uid, recipes };
    recipeJob = job;
    collectionPending = true;
    status("Guardando recetas en tu cuenta…");
    const task = recipeQueue.catch(() => {
    }).then(async () => {
      assertIdentity(uid);
      await upsertRecipes(recipes);
      if (recipeJob === job) {
        recipeJob = null;
        collectionPending = false;
      }
      status("Recetas guardadas en tu cuenta · disponibles en otros dispositivos");
    });
    recipeQueue = task;
    try {
      await task;
    } catch (e) {
      if (user?.id === uid)
        status(
          "Receta sin sincronizar. Mantené esta pestaña abierta y reintentá. " + fault(e),
          true
        );
      throw e;
    }
  }
  function pendingFavorites(uid) {
    try {
      return JSON.parse(localStorage.getItem("film-lab-pending-favorites:" + uid) || "{}");
    } catch {
      return {};
    }
  }
  async function favorite(id, enabled, recipe) {
    if (!user) return;
    const uid = user.id, entry = { uid, enabled, recipe };
    favoriteJobs.set(id, entry);
    status(enabled ? "Guardando favorita en tu cuenta…" : "Quitando favorita de tu cuenta…");
    try {
      const task = favoriteQueue.catch(() => {
      }).then(async () => {
        assertIdentity(uid);
        await saveFavorite(id, enabled, recipe);
        assertIdentity(uid);
      });
      favoriteQueue = task;
      await task;
      assertIdentity(uid);
      if (favoriteJobs.get(id) === entry) favoriteJobs.delete(id);
      status(enabled ? "Favorita guardada en tu cuenta" : "Favorita quitada de tu cuenta");
    } catch (e) {
      if (user?.id === uid)
        status(
          "Favorita sin sincronizar. Reintentaremos al recuperar la conexión. " + fault(e),
          true
        );
    }
  }
  async function recoverCollection(uid) {
    assertIdentity(uid);
    const recipes = localStorage.getItem("film-lab-pending-recipes:" + uid);
    if (recipes) {
      await upsertRecipes(JSON.parse(recipes));
      if (localStorage.getItem("film-lab-pending-recipes:" + uid) === recipes)
        localStorage.removeItem("film-lab-pending-recipes:" + uid);
    }
    const jobs = pendingFavorites(uid);
    for (const [id, job] of Object.entries(jobs)) {
      assertIdentity(uid);
      await saveFavorite(id, job.enabled, job.recipe);
      const remaining = pendingFavorites(uid);
      if (JSON.stringify(remaining[id]) === JSON.stringify(job)) delete remaining[id];
      localStorage.setItem("film-lab-pending-favorites:" + uid, JSON.stringify(remaining));
    }
  }
  function assertGuestJob(job) {
    assertIdentity(job.uid);
    if (job.generation !== generation) throw new Error("La sesión cambió durante la importación.");
  }
  function notice(message, error = false) {
    $("guestTransferNotice").hidden = false;
    $("guestTransferStatus").textContent = message;
    $("guestTransferStatus").classList.toggle("error", error);
  }
  function guestItems() {
    const guest = adapter.getGuestCollection(), collection = adapter.getCollection(), owned = new Set(collection.recipes.map((r) => r.id)), favorites = new Set(collection.favorites);
    const recipes = guest.recipes.map(safeRecipe).filter(Boolean), items = [];
    for (const recipe of recipes)
      if (!owned.has(recipe.id)) items.push({ key: "recipe:" + recipe.id, kind: "recipe", recipe });
    for (const id of new Set(guest.favorites)) {
      if (favorites.has(id)) continue;
      const recipe = safeRecipe(recipes.find((r) => r.id === id) || adapter.findRecipe(id));
      items.push({ key: "favorite:" + id, kind: "favorite", recipe, id });
    }
    return items;
  }
  function selectionChanged() {
    const count = $("guestImportItems").querySelectorAll("input:checked").length;
    $("guestSelectionCount").textContent = count + " seleccionados";
    $("confirmGuestImport").disabled = !count;
  }
  function guestReviews(uid) {
    try {
      const rows = JSON.parse(
        window.sessionStorage.getItem("film-lab-guest-review:" + uid) || "[]"
      );
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }
  function dismissGuestPrompt() {
    if (guestView) {
      try {
        const reviewed = new Set(guestReviews(guestView.uid));
        for (const item of guestView.items) reviewed.add(JSON.stringify([item.key, item.recipe]));
        window.sessionStorage.setItem(
          "film-lab-guest-review:" + guestView.uid,
          JSON.stringify([...reviewed])
        );
      } catch {
      }
    }
    clearTimeout(guestPromptTimer);
    $("guestImportDialog").close();
  }
  function offerGuestCollection(uid) {
    assertIdentity(uid);
    const reviewed = new Set(guestReviews(uid)), items = guestItems().filter((i) => !reviewed.has(JSON.stringify([i.key, i.recipe])));
    if (!items.length) return;
    guestView = { uid, items, generation };
    $("guestImportItems").replaceChildren();
    for (const item of items) {
      const row = document.createElement("label");
      row.className = "guest-import-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.key = item.key;
      input.disabled = !item.recipe;
      input.checked = false;
      input.onchange = selectionChanged;
      const info = document.createElement("span");
      info.append(
        text("strong", item.recipe?.name || item.id),
        text(
          "small",
          (item.kind === "recipe" ? "Receta propia" : "Favorita") + " · " + (item.recipe?.creator || "Receta no disponible: no puede importarse")
        )
      );
      row.append(input, info);
      $("guestImportItems").append(row);
    }
    selectionChanged();
    const view = guestView;
    function show() {
      if (user?.id !== uid || guestView !== view) return;
      if ([...document.querySelectorAll("dialog[open]")].some((d) => d.id !== "guestImportDialog")) {
        guestPromptTimer = setTimeout(show, 300);
        return;
      }
      $("guestImportDialog").showModal();
    }
    guestPromptTimer = setTimeout(show, 0);
  }
  $("selectAllGuestItems").onclick = () => {
    for (const input of $("guestImportItems").querySelectorAll("input:not(:disabled)"))
      input.checked = true;
    selectionChanged();
  };
  $("clearGuestItems").onclick = () => {
    for (const input of $("guestImportItems").querySelectorAll("input")) input.checked = false;
    selectionChanged();
  };
  for (const id of ["skipGuestImport", "closeGuestImport"]) $(id).onclick = dismissGuestPrompt;
  $("guestImportDialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    dismissGuestPrompt();
  });
  async function runGuestImport(job) {
    if (guestImporting || !job) return;
    assertGuestJob(job);
    guestImporting = true;
    $("retryGuestTransfer").hidden = true;
    notice("Guardando " + job.items.length + " elementos en segundo plano. Podés seguir editando…");
    const previousFavorites = favoriteQueue;
    const task = recipeQueue.catch(() => {
    }).then(async () => {
      await previousFavorites.catch(() => {
      });
      assertGuestJob(job);
      for (const item of job.items) {
        assertGuestJob(job);
        if (job.completed.has(item.key)) continue;
        if (deletedRecipes.has(job.uid + ":" + item.recipe.id)) {
          job.completed.add(item.key);
          continue;
        }
        if (item.kind === "recipe") {
          const recipe = item.recipe;
          checked(
            await client.from("recipes").upsert(
              { owner_id: job.uid, client_id: recipe.id, name: recipe.name, payload: recipe },
              { onConflict: "owner_id,client_id", ignoreDuplicates: true }
            )
          );
        } else {
          checked(
            await client.from("favorites").upsert(
              { owner_id: job.uid, recipe_key: item.recipe.id, recipe_snapshot: item.recipe },
              { onConflict: "owner_id,recipe_key", ignoreDuplicates: true }
            )
          );
        }
        assertGuestJob(job);
        job.completed.add(item.key);
        adapter.mergeImported?.(item.kind, item.recipe);
        notice(
          "Guardando en segundo plano · " + job.completed.size + "/" + job.items.length + " elementos"
        );
      }
      assertGuestJob(job);
      notice(
        job.items.length + " elementos agregados a tu cuenta. Tu colección de invitado se conserva."
      );
      guestJob = null;
    });
    recipeQueue = task;
    favoriteQueue = task;
    try {
      await task;
    } catch (e) {
      if (user?.id === job.uid && job.generation === generation) {
        notice(
          "Se guardaron " + job.completed.size + "/" + job.items.length + " elementos. " + fault(e) + " Podés reintentar los restantes.",
          true
        );
        $("retryGuestTransfer").hidden = false;
      }
    } finally {
      if (user?.id === job.uid && job.generation === generation) guestImporting = false;
    }
  }
  $("confirmGuestImport").onclick = () => {
    if (!guestView || user?.id !== guestView.uid || guestImporting || !$("guestImportDialog").hasAttribute("open"))
      return;
    const keys = new Set(
      [...$("guestImportItems").querySelectorAll("input:checked")].map((i) => i.dataset.key)
    ), items = guestView.items.filter((i) => keys.has(i.key) && i.recipe);
    if (!items.length) return;
    guestJob = { uid: user.id, generation, items: structuredClone(items), completed: /* @__PURE__ */ new Set() };
    dismissGuestPrompt();
    runGuestImport(guestJob).catch((e) => notice(fault(e), true));
  };
  $("retryGuestTransfer").onclick = () => runGuestImport(guestJob).catch((e) => notice(fault(e), true));
  async function deleteRecipe(id) {
    const uid = requireUser();
    if (!adapter.getCollection().recipes.some((r) => r.id === id) && !recipeDeletes.has(id))
      throw new Error("La receta ya no está en tu colección.");
    deletedRecipes.add(uid + ":" + id);
    recipeDeletes.set(id, { uid, id });
    favoriteJobs.delete(id);
    status("Eliminando receta de tu cuenta…");
    const previousFavorites = favoriteQueue;
    const task = recipeQueue.catch(() => {
    }).then(async () => {
      await previousFavorites.catch(() => {
      });
      assertIdentity(uid);
      checked(await client.from("favorites").delete().eq("owner_id", uid).eq("recipe_key", id));
      checked(await client.from("recipes").delete().eq("owner_id", uid).eq("client_id", id));
      assertIdentity(uid);
      recipeDeletes.delete(id);
      adapter.removeRecipe?.(id);
      status("Receta eliminada de tu cuenta. Los ajustes aplicados a tus archivos se conservan.");
    });
    recipeQueue = task;
    favoriteQueue = task;
    try {
      await task;
    } catch (e) {
      if (user?.id === uid)
        status(
          "No pudimos completar la eliminación. Reintentá; tu receta sigue visible. " + fault(e),
          true
        );
      throw e;
    }
  }
  function track(photo, action = null) {
    if (!user || photo.isDemo) return;
    if (!current) {
      scheduleDraft();
      return;
    }
    if (photo.cloudProjectId !== current.id || !photo.cloudId || !photo.cloudUploaded) {
      status("Archivo nuevo · se está preparando la copia automática en la nube");
      scheduleDraft();
      return;
    }
    pending.set(photo.id, { photo, action });
    clearTimeout(autoTimer);
    status("Cambios pendientes · guardando…");
    autoTimer = setTimeout(flush, 1500);
  }
  async function saveOne(photo, action = null) {
    const uid = requireUser();
    if (!photo.cloudId || photo.cloudProjectId !== current?.id) return;
    const after = treatmentOf(photo), before = photo.cloudSnapshot;
    if (!photo.cloudPending && JSON.stringify(after) === JSON.stringify(before) && !["export", "remove", "restore"].includes(action))
      return;
    const job = photo.cloudPending || {
      eventId: uuid(),
      snapshot: after,
      revision: photo.cloudRevision || 0,
      action: action || inferAction(before, after)
    };
    photo.cloudPending = job;
    await adapter.persistSession?.();
    const result = checked(
      await client.rpc("save_edit", {
        p_asset_id: photo.cloudId,
        p_snapshot: job.snapshot,
        p_expected_revision: job.revision,
        p_action: job.action,
        p_event_id: job.eventId
      })
    );
    assertIdentity(uid);
    photo.cloudRevision = result.revision;
    photo.cloudSnapshot = job.snapshot;
    photo.cloudPending = null;
    await adapter.persistSession?.();
    if (job.action === "remove") photo.cloudRemoved = true;
    if (job.action === "restore") photo.cloudRemoved = false;
    if (JSON.stringify(treatmentOf(photo)) !== JSON.stringify(job.snapshot))
      pending.set(photo.id, { photo, action: null });
  }
  async function flush() {
    if (working || autoWorking || !user || !current || !pending.size) return;
    working = true;
    syncFailed = false;
    updateHeader();
    const uid = user.id, projectId = current.id;
    const items = [...pending.values()];
    let index = 0;
    pending.clear();
    try {
      for (index = 0; index < items.length; index++) {
        const { photo, action } = items[index];
        await saveOne(photo, action);
      }
      status(
        (pending.size ? "Cambios pendientes · " : "Guardado en tu cuenta · ") + (/* @__PURE__ */ new Date()).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      if (user?.id === uid && current?.id === projectId) {
        for (const item of items.slice(index))
          if (!pending.has(item.photo.id)) pending.set(item.photo.id, item);
        syncFailed = true;
        status(fault(e), true);
      }
    } finally {
      working = false;
      updateHeader();
      if (pending.size && items.some((item) => pending.get(item.photo.id) !== item))
        autoTimer = setTimeout(flush, 1500);
    }
  }
  async function saveProject() {
    if (autoTask) {
      $("projectSaveStatus").textContent = "Terminando la copia automática antes de guardar el nombre…";
      await autoTask;
    }
    if (working) return;
    const uid = requireUser();
    adapter.saveActive();
    const photos = adapter.getPhotos().filter((p) => !p.isDemo && (!$("cloudSaveSelected").checked || p.selected));
    if (!photos.length) throw new Error("Cargá al menos una foto o video.");
    if (photos.length > 100) throw new Error("Guardá un máximo de 100 archivos por proyecto.");
    const oversized = photos.find((p) => p.file.size > cloudConfig.maxFileBytes);
    if (oversized)
      throw new Error(
        oversized.name + " supera 50 MB. Podés seguir editándolo localmente; deseleccionalo y activá Subir solo los archivos seleccionados."
      );
    const name = $("projectName").value.trim().slice(0, 120);
    if (!name) throw new Error("Ingresá un nombre para el proyecto.");
    const sourceProject = current;
    if (copyMode) {
      await flush();
      if (pending.size)
        throw new Error("Guardá los cambios pendientes antes de copiar el proyecto.");
    }
    const copying = copyMode;
    setWorking(true, "Guardando proyecto…");
    $("projectSaveStatus").textContent = "Preparando archivos…";
    try {
      const existing = checked(
        await client.from("projects").select("id,name").eq("owner_id", uid).eq("name_key", name.toLowerCase())
      );
      if (existing.some(
        (p) => p.id !== (copying ? draftProjectId : current?.id || draftProjectId) && p.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
      ))
        throw new Error("Ingresá otro nombre: ya tenés un proyecto con ese nombre.");
      if (copying || !current || current.localOnly) {
        draftProjectId = draftProjectId || (!copying && current?.localOnly ? current.id : null) || uuid();
        const project = checked(
          await client.from("projects").upsert(
            { id: draftProjectId, owner_id: uid, name, is_draft: false },
            { onConflict: "id" }
          ).select().single()
        );
        assertIdentity(uid);
        current = project;
      } else {
        const project = checked(
          await client.from("projects").update({ name, is_draft: false }).eq("id", current.id).eq("owner_id", uid).select().single()
        );
        assertIdentity(uid);
        current = project;
      }
      for (let i = 0; i < photos.length; i++) {
        assertIdentity(uid);
        const p = photos[i];
        $("projectSaveStatus").textContent = `Archivo ${i + 1}/${photos.length}: ${p.name}`;
        if (p.cloudProjectId !== current.id) {
          p.cloudId = uuid();
          p.cloudRevision = 0;
          p.cloudSnapshot = null;
          p.cloudEventId = null;
          p.cloudUploaded = false;
          p.cloudProjectId = current.id;
          await adapter.persistSession?.();
        }
        const ext = (p.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin", path = `${uid}/${current.id}/${p.cloudId}/original.${ext}`, thumbPath = `${uid}/${current.id}/${p.cloudId}/thumbnail.jpg`;
        if (!p.cloudUploaded) {
          checked(
            await client.from("media_assets").upsert(
              {
                id: p.cloudId,
                project_id: current.id,
                owner_id: uid,
                filename: p.name.slice(0, 255),
                kind: p.kind || "photo",
                mime_type: p.file.type || "application/octet-stream",
                size_bytes: p.file.size,
                original_path: path,
                thumbnail_path: p.thumbnail ? thumbPath : null,
                width: p.width || null,
                height: p.height || null,
                duration: p.duration || null,
                status: "pending",
                is_active: true
              },
              { onConflict: "id" }
            )
          );
          await uploadOriginal(
            client,
            path,
            p.file,
            (percent) => $("projectSaveStatus").textContent = `Archivo ${i + 1}/${photos.length}: ${p.name} · ${percent}%`,
            operationAbort?.signal
          );
          assertIdentity(uid);
          if (p.thumbnail) {
            const blob = await (await fetch(p.thumbnail)).blob();
            checked(
              await client.storage.from("film-thumbnails").upload(thumbPath, blob, {
                contentType: "image/jpeg",
                upsert: true,
                cacheControl: "3600"
              })
            );
          }
          checked(
            await client.from("media_assets").update({ status: "ready" }).eq("id", p.cloudId).eq("owner_id", uid)
          );
          p.cloudUploaded = true;
          await adapter.persistSession?.();
        }
        await saveOne(p, p.cloudSnapshot ? null : "import");
        if (!p.cloudPending && JSON.stringify(treatmentOf(p)) === JSON.stringify(p.cloudSnapshot))
          pending.delete(p.id);
      }
      syncFailed = false;
      copyMode = false;
      draftProjectId = null;
      await adapter.persistSession?.();
      updateHeader();
      $("cloudProjectDialog").close();
      status("Proyecto guardado · originales privados y ajustes sincronizados");
    } catch (e) {
      if (copying && current === sourceProject) copyMode = true;
      updateHeader();
      $("projectSaveStatus").textContent = fault(e);
      throw e;
    } finally {
      setWorking(false);
      if (pending.size) autoTimer = setTimeout(flush, 0);
    }
  }
  function scheduleDraft(delay = 600) {
    if (!user || adapter.canAutoSave?.() === false) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => syncDraft(), delay);
  }
  function needsDraft() {
    return adapter.getPhotos().filter((p) => !p.isDemo && p.file.size <= cloudConfig.maxFileBytes).slice(0, 100).some(
      (p) => !p.cloudUploaded || p.cloudProjectId !== current?.id || p.cloudPending || JSON.stringify(treatmentOf(p)) !== JSON.stringify(p.cloudSnapshot)
    );
  }
  async function syncDraft() {
    if (working || autoWorking || !user || adapter.canAutoSave?.() === false) return;
    if (!needsDraft()) {
      if (adapter.getPhotos().some((p) => !p.isDemo && p.file.size > cloudConfig.maxFileBytes))
        status(
          "Hay archivos mayores de 50 MB: se conservan solo en este dispositivo cuando la barra local lo confirma."
        );
      return;
    }
    const uid = user.id, epoch = generation;
    autoWorking = true;
    syncFailed = false;
    updateHeader();
    operationAbort = new AbortController();
    const ensure = () => {
      assertIdentity(uid);
      if (epoch !== generation) throw new Error("La sesión cambió durante la copia.");
    };
    autoTask = (async () => {
      let successful = false;
      try {
        adapter.saveActive();
        const eligible = adapter.getPhotos().filter((p) => !p.isDemo && p.file.size <= cloudConfig.maxFileBytes).slice(0, 100);
        if (!eligible.length) return;
        if (!current) {
          draftProjectId = draftProjectId || uuid();
          current = {
            id: draftProjectId,
            owner_id: uid,
            name: "Borrador " + (/* @__PURE__ */ new Date()).toLocaleString("es-AR") + " · " + draftProjectId.slice(0, 6),
            is_draft: true,
            localOnly: true
          };
          updateHeader();
          await adapter.persistSession?.();
        }
        if (current.localOnly) {
          ensure();
          const project = checked(
            await client.from("projects").upsert(
              { id: current.id, owner_id: uid, name: current.name, is_draft: true },
              { onConflict: "id" }
            ).select().single()
          );
          ensure();
          current = project;
          await adapter.persistSession?.();
          updateHeader();
        }
        for (let i = 0; i < eligible.length; i++) {
          ensure();
          const photo = eligible[i];
          if (photo.cloudProjectId !== current.id) {
            photo.cloudId = uuid();
            photo.cloudProjectId = current.id;
            photo.cloudUploaded = false;
            photo.cloudSnapshot = null;
            photo.cloudRevision = 0;
            photo.cloudPending = null;
            await adapter.persistSession?.();
          }
          const ext = (photo.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin", path = uid + "/" + current.id + "/" + photo.cloudId + "/original." + ext;
          if (!photo.cloudUploaded) {
            status("Copia automática · " + photo.name + " · " + (i + 1) + "/" + eligible.length);
            checked(
              await client.from("media_assets").upsert(
                {
                  id: photo.cloudId,
                  project_id: current.id,
                  owner_id: uid,
                  filename: photo.name.slice(0, 255),
                  kind: photo.kind || "photo",
                  mime_type: photo.file.type || "application/octet-stream",
                  size_bytes: photo.file.size,
                  original_path: path,
                  thumbnail_path: null,
                  width: photo.width || null,
                  height: photo.height || null,
                  duration: photo.duration || null,
                  status: "pending",
                  is_active: true
                },
                { onConflict: "id" }
              )
            );
            await uploadOriginal(
              client,
              path,
              photo.file,
              (percent) => {
                if (epoch === generation)
                  status("Subiendo " + photo.name + " · " + percent + "% · podés seguir editando");
              },
              operationAbort.signal
            );
            ensure();
            checked(
              await client.from("media_assets").update({ status: "ready" }).eq("id", photo.cloudId).eq("owner_id", uid)
            );
            ensure();
            photo.cloudUploaded = true;
            await adapter.persistSession?.();
          }
          await saveOne(photo, photo.cloudSnapshot ? null : "import");
          if (!photo.cloudPending && JSON.stringify(treatmentOf(photo)) === JSON.stringify(photo.cloudSnapshot))
            pending.delete(photo.id);
        }
        ensure();
        await adapter.persistSession?.();
        const localOnly = adapter.getPhotos().filter((p) => !p.isDemo && p.file.size > cloudConfig.maxFileBytes).length + Math.max(
          0,
          adapter.getPhotos().filter((p) => !p.isDemo && p.file.size <= cloudConfig.maxFileBytes).length - 100
        );
        status(
          "Sincronizado en tu cuenta" + (localOnly ? " · " + localOnly + " archivos quedan solo en este dispositivo por el límite de 50 MB/archivo o 100 archivos/proyecto" : "")
        );
        successful = true;
      } catch (e) {
        if (epoch === generation) {
          syncFailed = true;
          status(
            "Copia en la nube pendiente. " + fault(e) + " La barra de guardado local indica si podés recuperar esta sesión.",
            true
          );
        }
      } finally {
        if (epoch === generation) {
          autoWorking = false;
          autoTask = null;
          updateHeader();
          if (successful && needsDraft()) scheduleDraft(700);
        }
      }
    })();
    await autoTask;
  }
  $("retryCloudDraft").onclick = () => {
    if (autoWorking) return;
    flush();
    syncDraft();
  };
  async function listAssets(projectId) {
    let result = [];
    for (let offset = 0; ; offset += 100) {
      const rows = checked(
        await client.from("media_assets").select("*,edits(snapshot,revision)").eq("project_id", projectId).order("created_at").order("id").range(offset, offset + 99)
      );
      result.push(...rows);
      if (rows.length < 100) break;
    }
    return result;
  }
  async function openProject(projectId, { quiet = false } = {}) {
    const actionGeneration = generation;
    if (working || autoWorking) {
      status(
        "Terminando la sincronización. Podés seguir editando y abrir el proyecto al terminar."
      );
      return;
    }
    if (!quiet && adapter.getPhotos().some((p) => !p.isDemo) && !await confirmAction(
      "¿Abrir este proyecto? La sesión actual se reemplazará. Guardá o exportá cualquier cambio pendiente antes de continuar.",
      { title: "Abrir proyecto", confirmLabel: "Abrir proyecto" }
    ))
      return;
    if (actionGeneration !== generation) return;
    const uid = requireUser();
    setWorking(true, "Abriendo proyecto…");
    try {
      const project = checked(
        await client.from("projects").select().eq("id", projectId).eq("owner_id", uid).single()
      ), assets = await listAssets(projectId), files = [];
      for (const a of assets.filter((a2) => a2.is_active && a2.status === "ready")) {
        assertIdentity(uid);
        $("profileStatus").textContent = "Descargando " + a.filename + "…";
        const blob = checked(await client.storage.from("film-originals").download(a.original_path));
        let thumbnail = "";
        if (a.thumbnail_path) {
          try {
            const thumb = checked(
              await client.storage.from("film-thumbnails").download(a.thumbnail_path)
            );
            thumbnail = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(thumb);
            });
          } catch {
          }
        }
        const edit = Array.isArray(a.edits) ? a.edits[0] : a.edits;
        files.push({
          file: new File([blob], a.filename, { type: a.mime_type }),
          asset: a,
          edit,
          thumbnail
        });
      }
      assertIdentity(uid);
      current = project;
      draftProjectId = null;
      copyMode = false;
      pending.clear();
      syncFailed = false;
      setWorking(false);
      await adapter.loadProject(files, project);
      updateHeader();
      $("profileDialog").close();
      status("Proyecto recuperado · guardado automático activado");
    } catch (e) {
      $("profileStatus").textContent = fault(e);
      status(fault(e), true);
    } finally {
      setWorking(false);
    }
  }
  async function deleteProject(project) {
    const actionGeneration = generation;
    if (working || autoWorking || !await confirmAction(
      `¿Eliminar «${project.name}» y todos sus archivos e historial de la nube? Esta acción no se puede deshacer.`,
      { title: "Eliminar proyecto", confirmLabel: "Eliminar definitivamente", danger: true }
    ))
      return;
    if (actionGeneration !== generation) return;
    setWorking(true, "Eliminando proyecto…");
    try {
      const assets = await listAssets(project.id);
      for (const bucket of ["film-originals", "film-thumbnails"]) {
        const paths = assets.map((a) => bucket === "film-originals" ? a.original_path : a.thumbnail_path).filter(Boolean);
        for (let i = 0; i < paths.length; i += 100)
          checked(await client.storage.from(bucket).remove(paths.slice(i, i + 100)));
      }
      checked(await client.from("projects").delete().eq("id", project.id).eq("owner_id", user.id));
      if (current?.id === project.id) {
        current = null;
        draftProjectId = null;
        pending.clear();
        syncFailed = false;
        adapter.detachCloud();
        adapter.resetEditor?.();
        await adapter.persistSession?.();
        updateHeader();
      }
      await refreshProfile();
      $("profileStatus").textContent = "Proyecto y archivos eliminados.";
    } catch (e) {
      $("profileStatus").textContent = "No se completó la eliminación. Podés reintentar. " + fault(e);
    } finally {
      setWorking(false);
    }
  }
  async function refreshProfile() {
    if (!user) return;
    projectOffset = 0;
    historyCursor = null;
    historyProject = null;
    $("cloudHistoryTitle").textContent = "Historial por proyecto";
    $("cloudProjectList").replaceChildren();
    $("cloudHistoryList").replaceChildren();
    $("moreCloudHistory").hidden = true;
    $("profileStatus").textContent = "";
    try {
      await moreProjects();
      $("cloudHistoryList").append(
        text("p", "Elegí Historial en un proyecto para ver sus archivos y cambios.", "muted")
      );
    } catch (e) {
      $("profileStatus").textContent = fault(e);
    }
  }
  async function moreProjects() {
    const uid = requireUser();
    const rows = checked(
      await client.from("projects").select("*,media_assets(status,is_active)").eq("owner_id", uid).order("updated_at", { ascending: false }).order("id", { ascending: false }).range(projectOffset, projectOffset + 19)
    );
    assertIdentity(uid);
    projectOffset += rows.length;
    $("moreCloudProjects").hidden = rows.length < 20;
    for (const project of rows) {
      const row = text("article", "", "cloud-project-card");
      row.append(
        text("strong", project.name + (project.is_draft ? " · Borrador automático" : "")),
        text("small", "Actualizado " + new Date(project.updated_at).toLocaleString("es-AR"))
      );
      const assets = project.media_assets || [];
      row.append(
        text(
          "small",
          assets.filter((a) => a.status === "ready" && a.is_active).length + " archivos guardados" + (assets.some((a) => a.status === "pending") ? " · Hay subidas pendientes; reintentá desde la sesión original o eliminá el proyecto." : "")
        )
      );
      const open = text("button", "Abrir proyecto", "button outline compact");
      open.onclick = () => openProject(project.id);
      const remove = text("button", "Eliminar", "text-button");
      remove.onclick = () => deleteProject(project);
      const history = text("button", "Historial", "button outline compact");
      history.onclick = () => showProjectHistory(project);
      row.append(open, history, remove);
      $("cloudProjectList").append(row);
    }
    if (!projectOffset)
      $("cloudProjectList").append(
        text(
          "p",
          "Todavía no guardaste proyectos. Podés guardar tu sesión desde el editor.",
          "muted"
        )
      );
  }
  async function showProjectHistory(project) {
    historyProject = project;
    historyCursor = null;
    $("cloudHistoryList").replaceChildren();
    $("cloudHistoryTitle").textContent = "Historial · " + project.name;
    $("moreCloudHistory").hidden = true;
    try {
      await moreHistory();
      $("cloudHistoryTitle").scrollIntoView?.({ block: "start", behavior: "smooth" });
    } catch (e) {
      $("profileStatus").textContent = fault(e);
    }
  }
  async function moreHistory() {
    if (!historyProject) return;
    const selected = historyProject;
    const uid = requireUser();
    let query = client.from("editing_history").select(
      "id,project_id,asset_id,filename,action,before_snapshot,after_snapshot,revision,created_at"
    ).eq("owner_id", uid).eq("project_id", selected.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(20);
    if (historyCursor)
      query = query.or(
        `created_at.lt.${historyCursor.date},and(created_at.eq.${historyCursor.date},id.lt.${historyCursor.id})`
      );
    const rows = checked(await query);
    assertIdentity(uid);
    if (historyProject?.id !== selected.id) return;
    historyCursor = nextCursor(rows) || historyCursor;
    $("moreCloudHistory").hidden = rows.length < 20;
    for (const event of rows) {
      const row = text("article", "", "cloud-history-card");
      row.append(
        text("small", "Proyecto: " + selected.name),
        text("strong", event.filename),
        text("small", new Date(event.created_at).toLocaleString("es-AR")),
        text("p", actionNames[event.action] || "Edición guardada")
      );
      row.append(text("p", "Receta: " + (event.after_snapshot.recipe?.name || "Original"), "tiny"));
      const changes = stateChanges(event.before_snapshot, event.after_snapshot);
      if (changes.length) {
        const details = document.createElement("details");
        details.append(text("summary", `Ver ${changes.length} cambios`));
        const table = document.createElement("table");
        for (const change of changes) {
          const tr = document.createElement("tr");
          tr.append(
            text("th", change.label),
            text("td", String(change.before) + " → " + String(change.after))
          );
          table.append(tr);
        }
        details.append(table);
        row.append(details);
      }
      const restore = text("button", "Recuperar estos ajustes", "button outline compact");
      restore.onclick = () => restoreHistory(event);
      row.append(restore);
      $("cloudHistoryList").append(row);
    }
    if (!historyCursor)
      $("cloudHistoryList").append(
        text("p", "El historial aparecerá al guardar y editar tus archivos.", "muted")
      );
  }
  async function restoreHistory(event) {
    const actionGeneration = generation;
    if (working || autoWorking || !await confirmAction(
      "¿Recuperar estos ajustes y abrir el proyecto? Se guardará una nueva versión y se reemplazará la sesión actual. Guardá cualquier cambio pendiente antes de continuar.",
      { title: "Recuperar versión", confirmLabel: "Recuperar ajustes" }
    ))
      return;
    if (actionGeneration !== generation) return;
    try {
      const edit = checked(
        await client.from("edits").select("revision").eq("asset_id", event.asset_id).single()
      );
      checked(
        await client.rpc("save_edit", {
          p_asset_id: event.asset_id,
          p_snapshot: event.after_snapshot,
          p_expected_revision: edit.revision,
          p_action: "restore",
          p_event_id: uuid()
        })
      );
      await openProject(event.project_id, { quiet: true });
    } catch (e) {
      $("profileStatus").textContent = fault(e);
    }
  }
  $("moreCloudProjects").onclick = () => moreProjects().catch((e) => $("profileStatus").textContent = fault(e));
  $("moreCloudHistory").onclick = () => moreHistory().catch((e) => $("profileStatus").textContent = fault(e));
  window.addEventListener("online", () => {
    scheduleDraft(0);
    flush();
    if (user) recoverCollection(user.id).catch((e) => status(fault(e), true));
    if (collectionPending) saveCollection().catch(() => {
    });
    for (const [id, job] of favoriteJobs) favorite(id, job.enabled, job.recipe);
    if (guestJob) runGuestImport(guestJob).catch(() => {
    });
    for (const [id, job] of recipeDeletes) deleteRecipe(id).catch(() => {
    });
  });
  window.addEventListener("beforeunload", (e) => {
    if (collectionPending || favoriteJobs.size || guestJob || recipeDeletes.size || (pending.size || working || autoWorking) && adapter.isLocallySaved?.() !== true) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  updateHeader();
  return {
    ready,
    dispose: () => {
      generation++;
      user = null;
      autoWorking = false;
      clearTimeout(autoTimer);
      clearTimeout(collectionTimer);
      clearTimeout(guestPromptTimer);
      clearTimeout(draftTimer);
      operationAbort?.abort();
      authListener?.data?.subscription?.unsubscribe();
      client.auth.stopAutoRefresh?.();
    },
    showHistory: () => {
      if (!user) {
        showAccount();
        return;
      }
      $("profileDialog").showModal();
      if (current) {
        $("cloudHistoryList").replaceChildren();
        showProjectHistory(current);
      } else refreshProfile();
    },
    getUser: () => user,
    keys: () => guestKeys(user?.id),
    track,
    saveCollection,
    favorite,
    deleteRecipe,
    removed: async (photo) => {
      if (autoTask) await autoTask;
      await flush();
      return !pending.has(photo.id);
    },
    sessionEmptied: () => leaveProject({ empty: true }),
    filesAdded: () => {
      updateHeader();
      if (user) {
        status("Copia automática en la nube pendiente · podés seguir editando");
        scheduleDraft();
      } else status("Invitado · copia automática solo en este dispositivo");
    },
    exported: (photos) => {
      for (const photo of photos) track(photo, "export");
    },
    isSaving: () => working || autoWorking,
    hasPending: () => !!(working || autoWorking || pending.size || collectionPending || favoriteJobs.size || guestJob || recipeDeletes.size),
    saveProject,
    flush,
    currentProject: () => current,
    draftId: () => draftProjectId,
    syncDraft
  };
}
export {
  mountCloud
};
