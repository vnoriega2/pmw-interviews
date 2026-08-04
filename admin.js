const cfg = window.PMW_CONFIG || {};
const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const root = document.getElementById("adminApp");
const esc = (v="") => String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));

function loginView(message="") {
  root.innerHTML = `<h1>Panel administrativo</h1>
    <p class="subtitle">Inicia sesión con el correo autorizado de Recursos Humanos.</p>
    <form id="loginForm" class="form-grid">
      <label>Correo<input id="email" type="email" required></label>
      <label>Contraseña<input id="password" type="password" required></label>
      ${message ? `<div class="error">${esc(message)}</div>` : ""}
      <button class="primary-btn" type="submit">Entrar</button>
    </form>`;
  document.getElementById("loginForm").addEventListener("submit", login);
}
async function login(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const {error} = await db.auth.signInWithPassword({email,password});
  if (error) return loginView("Correo o contraseña incorrectos.");
  loadDashboard();
}
async function loadDashboard() {
  root.innerHTML = `<p class="subtitle">Cargando entrevistas…</p>`;
  const {data,error} = await db.from("interviews")
    .select("*")
    .order("interview_date",{ascending:true})
    .order("time_slot",{ascending:true});
  if (error) return loginView("No se pudieron cargar las entrevistas. Revisa las políticas RLS.");
  root.innerHTML = `<div class="admin-header">
      <div><span class="step-tag">Recursos Humanos</span><h1>Entrevistas</h1></div>
      <button class="secondary-btn" id="logout">Cerrar sesión</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Puesto</th><th>Fecha</th><th>Hora</th><th>Licencia</th><th>Tipo</th><th>Documento</th><th></th></tr></thead>
      <tbody>${(data||[]).map(row => `<tr>
        <td>${esc(row.full_name)}</td><td>${esc(row.phone)}</td><td>${esc(row.role)}</td>
        <td>${esc(row.interview_date)}</td><td>${esc(row.time_slot)}</td>
        <td>${row.has_license ? "Sí" : "No"}</td><td>${esc(row.license_type || "—")}</td>
        <td>${row.document_url ? `<button class="link-btn" data-document="${esc(row.document_url)}">Ver documento</button>` : "—"}</td>
        <td><button class="danger-btn" data-delete="${row.id}" data-path="${esc(row.document_url || "")}">Eliminar</button></td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  document.getElementById("logout").onclick = async () => { await db.auth.signOut(); loginView(); };
  root.querySelectorAll("[data-document]").forEach(button => button.onclick = async () => {
    button.disabled = true;
    const {data,error} = await db.storage.from("documents").createSignedUrl(button.dataset.document, 300);
    button.disabled = false;
    if (error) return alert("No se pudo abrir el documento.");
    window.open(data.signedUrl,"_blank","noopener");
  });
  root.querySelectorAll("[data-delete]").forEach(button => button.onclick = async () => {
    if (!confirm("¿Eliminar esta entrevista?")) return;
    const path = button.dataset.path;
    if (path) await db.storage.from("documents").remove([path]);
    const {error} = await db.from("interviews").delete().eq("id",button.dataset.delete);
    if (error) return alert("No se pudo eliminar.");
    loadDashboard();
  });
}
(async function init(){
  const {data:{session}} = await db.auth.getSession();
  if (session && !session.user.is_anonymous) loadDashboard();
  else loginView();
})();
