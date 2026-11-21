// ============================================================
//  A&F · Usuarios y roles (dueño y administrador)
// ============================================================
import { S, ROLES, log, visibleParaMi, rolesAsignables } from "../store.js";
import { db, auth, MODO } from "../db.js";
import { esc, icon, modal, toast, iniciales } from "../util.js";

const DESCRIPCION = {
  admin: "Todo, y no aparece en esta lista para los demás. Solo otro administrador puede cambiarlo.",
  dueno: "Todo, incluido usuarios.",
  encargado: "Salón, caja, cobros, productos y anulaciones.",
  mozo: "Abre mesas, carga y envía pedidos. Cobra solo si está habilitado en Ajustes.",
  cocina: "Solo la pantalla de cocina y barra.",
};

export function mount(root) {
  root.innerHTML = `
    <div class="usuarios">
      <div class="barra-acciones"><p class="ayuda">Cada persona entra con su usuario: así queda registrado quién abrió, cargó, cobró o anuló.</p>
        <button class="btn btn-pri" data-act="nuevo">${icon("mas")} Usuario</button></div>
      <div id="uLista" class="lista"></div>
      <div class="tarjeta roles">${rolesAsignables().map(([k, v]) => `<p><b>${v}:</b> ${DESCRIPCION[k]}</p>`).join("")}</div>
    </div>`;

  function render() {
    const orden = ["admin", "dueno", "encargado", "mozo", "cocina"];
    const us = S.usuarios.filter(visibleParaMi).sort((a, b) => orden.indexOf(a.rol) - orden.indexOf(b.rol) || String(a.nombre).localeCompare(String(b.nombre)));
    root.querySelector("#uLista").innerHTML = us.map((u) => `
      <button class="fila-lista boton ${u.activo === false ? "inactivo" : ""}" data-uid="${esc(u.id)}">
        <span class="avatar">${esc(iniciales(u.nombre))}</span>
        <div><b>${esc(u.nombre)}${u.id === S.user.uid ? " (vos)" : ""}</b><small>${esc(u.email || "")}</small></div>
        <span class="pill">${esc(ROLES[u.rol] || u.rol)}</span>
        ${u.activo === false ? `<span class="pill rojo">Inactivo</span>` : ""}
      </button>`).join("");
  }

  function editar(u = null) {
    const nuevo = !u;
    const propio = u?.id === S.user.uid;
    const m = modal({
      titulo: nuevo ? "Nuevo usuario" : u.nombre,
      clase: "modal-chico",
      cuerpo: `<form class="form" id="fUsr">
        <label class="campo"><span>Nombre</span><input class="input" id="uNom" value="${esc(u?.nombre || "")}" required autofocus></label>
        ${nuevo && MODO !== "demo" ? `
          <label class="campo"><span>Email</span><input class="input" id="uEmail" type="email" required autocomplete="off"></label>
          <label class="campo"><span>Contraseña inicial</span><input class="input" id="uPass" type="text" minlength="6" required autocomplete="off"><small class="ayuda">Mínimo 6 caracteres. Pasásela a la persona.</small></label>` : ""}
        <label class="campo"><span>Rol</span><select class="input" id="uRol" ${propio ? "disabled" : ""}>${rolesAsignables().map(([k, v]) => `<option value="${k}" ${(u?.rol || "mozo") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        ${!nuevo && !propio ? `<label class="switch"><input type="checkbox" id="uAct" ${u.activo !== false ? "checked" : ""}><span>Activo (puede entrar)</span></label>` : ""}
        <p class="error" id="uErr" hidden></p>
      </form>`,
      pie: `<button type="submit" form="fUsr" class="btn btn-pri btn-bloque" id="uOk">${nuevo ? "Crear usuario" : "Guardar"}</button>`,
    });
    const $ = (s) => m.el.querySelector(s);
    $("#fUsr").onsubmit = async (e) => {
      e.preventDefault();
      const nombre = $("#uNom").value.trim();
      const rol = $("#uRol").value;
      if (!nombre) return;
      if (!nuevo) {
        const datos = { nombre };
        if (!propio) { datos.rol = rol; datos.activo = $("#uAct").checked; }
        db.update("usuarios", u.id, datos);
        if (!propio && (u.rol !== rol || (u.activo !== false) !== datos.activo)) log("usuario", `${nombre}: ${ROLES[rol]}${datos.activo ? "" : " (desactivado)"}`);
        m.cerrar();
        return;
      }
      const btn = $("#uOk");
      btn.disabled = true;
      btn.textContent = "Creando…";
      try {
        const email = $("#uEmail")?.value.trim() || "";
        const uid = await auth.crearCuenta(email, $("#uPass")?.value || "");
        db.set("usuarios", uid, { nombre, email, rol, activo: true, creado: Date.now() });
        log("usuario", `Usuario creado: ${nombre} (${ROLES[rol]})`);
        toast(`Usuario creado: ${nombre}`);
        m.cerrar();
      } catch (err) {
        const c = err.code || "";
        $("#uErr").textContent = c.includes("email-already") ? "Ese email ya tiene cuenta." : c.includes("invalid-email") ? "Email inválido." : c.includes("weak-password") ? "La contraseña es muy corta." : "No se pudo crear: " + (err.message || err);
        $("#uErr").hidden = false;
        btn.disabled = false;
        btn.textContent = "Crear usuario";
      }
    };
  }

  root.addEventListener("click", (e) => {
    if (e.target.closest('[data-act="nuevo"]')) return editar();
    const b = e.target.closest("[data-uid]");
    if (b) { const u = S.usuarios.find((x) => x.id === b.dataset.uid); if (u && visibleParaMi(u)) editar(u); }
  });

  render();
  return { update(claves) { if (claves.includes("usuarios")) render(); } };
}
