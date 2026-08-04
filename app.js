const MAP_URL = "https://maps.app.goo.gl/AM7NTFfv98BUCmkb8?g_st=ic";
const TIMES = ["9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","1:00 PM","1:30 PM","2:00 PM","2:30 PM"];
const DOCS = ["Identificación oficial","Número de IMSS","CURP","RFC","Acta de nacimiento","Último comprobante de estudios","Comprobante de domicilio actual"];
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const cfg = window.PMW_CONFIG || {};
const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("PASTE_") &&
  cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PASTE_");
const db = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

const state = {
  step: 1, inMexicali: null, role: "", name: "", phone: "",
  has_license: null, license_type: "", document_file: null,
  date: "", time: "", taken: new Set()
};

const app = document.getElementById("app");
const progressBar = document.getElementById("progressBar");

function setProgress() {
  const widths = {1:14,2:28,3:43,4:57,5:72,6:86,7:100};
  progressBar.style.width = `${widths[state.step] || 14}%`;
}
function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"
  })[c]);
}
function render() {
  setProgress();
  const views = {
    1: renderLocation, 2: renderRole, 3: renderDetails, 4: renderDate,
    5: renderTime, 6: renderReview, 7: renderSuccess
  };
  app.innerHTML = views[state.step]();
  wireEvents();
  window.scrollTo({top:0, behavior:"smooth"});
}
function renderLocation() {
  return `<span class="step-tag">Paso 1 de 6</span>
    <h1>Agenda tu entrevista</h1>
    <p class="subtitle">Primero necesitamos confirmar que puedes acudir presencialmente.</p>
    ${!configured ? '<div class="notice">Modo de vista previa: falta conectar Supabase.</div>' : ''}
    <div class="option-grid">
      <button class="option-btn" data-action="mexicali-yes">Sí, estoy en Mexicali</button>
      <button class="option-btn danger" data-action="mexicali-no">No estoy en Mexicali</button>
    </div>`;
}
function renderRole() {
  return `<span class="step-tag">Paso 2 de 6</span>
    <h1>¿A qué puesto deseas aplicar?</h1>
    <p class="subtitle">Selecciona una vacante para continuar.</p>
    <div class="option-grid">
      ${["Soldador","Armador"].map(role =>
        `<button class="option-btn" data-role="${role}">${role}</button>`
      ).join("")}
    </div>
    <div class="actions"><button class="secondary-btn" data-back>Regresar</button></div>`;
}
function renderDetails() {
  return `<span class="step-tag">Paso 3 de 6</span>
    <h1>Cuéntanos sobre ti</h1>
    <p class="subtitle">La identificación se usa únicamente para el proceso de reclutamiento.</p>
    <form id="detailsForm" class="form-grid" novalidate>
      <label>Nombre completo
        <input id="name" type="text" autocomplete="name" value="${esc(state.name)}" required>
      </label>
      <label>Número de teléfono
        <input id="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(state.phone)}" required>
      </label>
      <label>¿Tienes licencia de conducir?
        <select id="hasLicense" required>
          <option value="">Selecciona una opción</option>
          <option value="yes" ${state.has_license === true ? "selected" : ""}>Sí</option>
          <option value="no" ${state.has_license === false ? "selected" : ""}>No</option>
        </select>
      </label>
      <label id="licenseTypeWrap" ${state.has_license === true ? "" : "hidden"}>Tipo de licencia
        <input id="licenseType" type="text" placeholder="Ej. A, B o C" value="${esc(state.license_type)}">
      </label>
      <label>Foto de INE o licencia
        <input id="documentFile" type="file" accept="image/*,.pdf,application/pdf" required>
        <span class="help">Archivo obligatorio. Imagen o PDF, máximo 8 MB.</span>
      </label>
      ${state.document_file ? `<div class="file-chip">Seleccionado: ${esc(state.document_file.name)}</div>` : ""}
      <div id="formError" class="error" hidden></div>
      <div class="actions">
        <button type="button" class="secondary-btn" data-back>Regresar</button>
        <button type="submit" class="primary-btn">Continuar</button>
      </div>
    </form>`;
}
function nextBusinessDays(count = 20) {
  const out = [];
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate()+1);
  while (out.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
    d.setDate(d.getDate()+1);
  }
  return out;
}
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatDate(key, long = true) {
  const [y,m,d] = key.split("-").map(Number);
  const dt = new Date(y,m-1,d,12);
  return new Intl.DateTimeFormat("es-MX", long
    ? {weekday:"long",day:"numeric",month:"long",year:"numeric"}
    : {weekday:"short",day:"numeric",month:"short"}).format(dt);
}
function renderDate() {
  return `<span class="step-tag">Paso 4 de 6</span>
    <h1>Selecciona el día</h1>
    <p class="subtitle">Las entrevistas están disponibles de lunes a viernes.</p>
    <div class="date-grid">${nextBusinessDays().map(d => {
      const key = dateKey(d);
      return `<button class="date-btn" data-date="${key}">
        <strong>${formatDate(key,false)}</strong><span>Ver horarios</span>
      </button>`;
    }).join("")}</div>
    <div class="actions"><button class="secondary-btn" data-back>Regresar</button></div>`;
}
async function loadTaken() {
  state.taken = new Set();
  if (!db) return;
  const {data,error} = await db.rpc("get_booked_slots",{p_date:state.date});
  if (error) throw error;
  (data || []).forEach(row => state.taken.add(row.time_slot));
}
function renderTime() {
  return `<span class="step-tag">Paso 5 de 6</span>
    <h1>Selecciona un horario</h1>
    <p class="subtitle">${formatDate(state.date)} · Cada entrevista dura 30 minutos.</p>
    <div class="slot-grid">${TIMES.map(time =>
      `<button class="slot-btn" data-time="${time}" ${state.taken.has(time) ? "disabled" : ""}>${time}</button>`
    ).join("")}</div>
    <div class="actions"><button class="secondary-btn" data-back>Regresar</button></div>`;
}
function renderReview() {
  return `<span class="step-tag">Paso 6 de 6</span>
    <h1>Revisa tu entrevista</h1>
    <p class="subtitle">Confirma que la información sea correcta antes de agendar.</p>
    <div class="summary-box">
      <div class="summary-row"><span>Nombre</span><strong>${esc(state.name)}</strong></div>
      <div class="summary-row"><span>Teléfono</span><strong>${esc(state.phone)}</strong></div>
      <div class="summary-row"><span>Puesto</span><strong>${esc(state.role)}</strong></div>
      <div class="summary-row"><span>Licencia</span><strong>${state.has_license ? "Sí" : "No"}</strong></div>
      ${state.has_license ? `<div class="summary-row"><span>Tipo</span><strong>${esc(state.license_type || "No indicado")}</strong></div>` : ""}
      <div class="summary-row"><span>Documento</span><strong>${esc(state.document_file?.name || "")}</strong></div>
      <div class="summary-row"><span>Fecha</span><strong>${formatDate(state.date)}</strong></div>
      <div class="summary-row"><span>Hora</span><strong>${esc(state.time)}</strong></div>
    </div>
    <div class="notice">Al confirmar, el horario quedará reservado y el documento será enviado de forma privada.</div>
    <div id="bookingError" class="error" hidden></div>
    <div class="actions">
      <button class="secondary-btn" data-back>Regresar</button>
      <button class="primary-btn" data-action="confirm">Confirmar entrevista</button>
    </div>`;
}
function renderSuccess() {
  return `<div class="success-icon">✓</div>
    <span class="step-tag">Confirmada</span>
    <h1>¡Tu entrevista ha sido agendada!</h1>
    <p class="subtitle">Guarda esta información y llega 10 minutos antes.</p>
    <div class="summary-box">
      <div class="summary-row"><span>Nombre</span><strong>${esc(state.name)}</strong></div>
      <div class="summary-row"><span>Puesto</span><strong>${esc(state.role)}</strong></div>
      <div class="summary-row"><span>Fecha</span><strong>${formatDate(state.date)}</strong></div>
      <div class="summary-row"><span>Hora</span><strong>${esc(state.time)}</strong></div>
    </div>
    <div class="docs-box"><h3>Documentación para nuevo ingreso</h3>
      <ul>${DOCS.map(d => `<li>${d}</li>`).join("")}</ul>
    </div>
    <div class="location-box"><h3>Ubicación de la entrevista</h3>
      <p>Precision Metal Works, Mexicali.</p>
      <a class="map-btn" href="${MAP_URL}" target="_blank" rel="noopener">Abrir ubicación en Maps</a>
    </div>
    <div class="actions"><button class="secondary-btn" data-action="new">Agendar otra entrevista</button></div>`;
}
function go(step) { state.step = step; render(); }
function showFatal(message) {
  app.innerHTML = `<h1>No se pudo continuar</h1><div class="error">${esc(message)}</div>
    <div class="actions"><button class="secondary-btn" onclick="location.reload()">Intentar de nuevo</button></div>`;
}
function safeFileName(name) {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g,"") : "";
  return `${crypto.randomUUID()}${ext}`;
}
async function ensureAnonymousSession() {
  const {data:{session}} = await db.auth.getSession();
  if (session) return session.user;
  const {data,error} = await db.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}
async function uploadDocument() {
  const user = await ensureAnonymousSession();
  const path = `${user.id}/${safeFileName(state.document_file.name)}`;
  const {error} = await db.storage.from("documents").upload(path, state.document_file, {
    cacheControl: "3600",
    upsert: false,
    contentType: state.document_file.type || undefined
  });
  if (error) throw error;
  return path;
}
function wireEvents() {
  app.querySelector('[data-action="mexicali-yes"]')?.addEventListener("click",() => {
    state.inMexicali = true; go(2);
  });
  app.querySelector('[data-action="mexicali-no"]')?.addEventListener("click",() => {
    app.innerHTML = `<span class="step-tag">Entrevistas presenciales</span>
      <h1>Por el momento solo atendemos en Mexicali</h1>
      <p class="subtitle">Necesitas poder acudir presencialmente a Precision Metal Works.</p>
      <div class="actions"><button class="secondary-btn" id="restart">Regresar</button></div>`;
    document.getElementById("restart").onclick = () => go(1);
  });
  app.querySelectorAll("[data-role]").forEach(button =>
    button.addEventListener("click",() => { state.role = button.dataset.role; go(3); })
  );
  document.getElementById("hasLicense")?.addEventListener("change", event => {
    document.getElementById("licenseTypeWrap").hidden = event.target.value !== "yes";
  });
  document.getElementById("detailsForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const hasLicenseValue = document.getElementById("hasLicense").value;
    const licenseType = document.getElementById("licenseType")?.value.trim() || "";
    const file = document.getElementById("documentFile").files[0] || state.document_file;
    const err = document.getElementById("formError");
    const fail = message => { err.hidden = false; err.textContent = message; };

    if (name.split(/\s+/).length < 2) return fail("Escribe tu nombre y al menos un apellido.");
    if (phone.replace(/\D/g,"").length < 10) return fail("Escribe un teléfono válido de 10 dígitos.");
    if (!hasLicenseValue) return fail("Indica si tienes licencia de conducir.");
    if (hasLicenseValue === "yes" && !licenseType) return fail("Escribe el tipo de licencia.");
    if (!file) return fail("Selecciona una foto de INE o licencia.");
    if (file.size > MAX_FILE_BYTES) return fail("El archivo supera el límite de 8 MB.");
    const allowed = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) return fail("El archivo debe ser una imagen o PDF.");

    state.name = name;
    state.phone = phone;
    state.has_license = hasLicenseValue === "yes";
    state.license_type = state.has_license ? licenseType : "";
    state.document_file = file;
    go(4);
  });
  app.querySelectorAll("[data-date]").forEach(button =>
    button.addEventListener("click", async () => {
      state.date = button.dataset.date; state.time = "";
      app.innerHTML = '<p class="subtitle">Cargando horarios disponibles…</p>';
      try { await loadTaken(); go(5); }
      catch { showFatal("No pudimos cargar los horarios. Intenta de nuevo."); }
    })
  );
  app.querySelectorAll("[data-time]").forEach(button =>
    button.addEventListener("click",() => { state.time = button.dataset.time; go(6); })
  );
  app.querySelectorAll("[data-back]").forEach(button =>
    button.addEventListener("click",() => go(Math.max(1,state.step-1)))
  );
  app.querySelector('[data-action="confirm"]')?.addEventListener("click", async () => {
    const button = app.querySelector('[data-action="confirm"]');
    const err = document.getElementById("bookingError");
    if (!db) {
      err.hidden = false;
      err.textContent = "Falta conectar Supabase.";
      return;
    }
    button.disabled = true;
    button.textContent = "Subiendo documento…";
    let documentPath = "";
    try {
      documentPath = await uploadDocument();
      button.textContent = "Confirmando…";
      const {error} = await db.from("interviews").insert({
        full_name: state.name,
        phone: state.phone,
        role: state.role,
        interview_date: state.date,
        time_slot: state.time,
        status: "Confirmada",
        has_license: state.has_license,
        license_type: state.license_type || null,
        document_url: documentPath
      });
      if (error) throw error;
      go(7);
    } catch (error) {
      if (documentPath) await db.storage.from("documents").remove([documentPath]);
      button.disabled = false;
      button.textContent = "Confirmar entrevista";
      err.hidden = false;
      err.textContent = error?.code === "23505"
        ? "Ese horario acaba de ocuparse. Regresa y elige otro."
        : "No pudimos guardar la entrevista o el documento. Revisa la configuración e intenta de nuevo.";
      console.error(error);
    }
  });
  app.querySelector('[data-action="new"]')?.addEventListener("click",() => {
    Object.assign(state,{
      step:1,inMexicali:null,role:"",name:"",phone:"",
      has_license:null,license_type:"",document_file:null,
      date:"",time:"",taken:new Set()
    });
    render();
  });
}
render();
