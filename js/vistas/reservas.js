// ============================================================
//  A&F · Reservas
// ============================================================
// Por día: crear, confirmar por WhatsApp, sentar en una mesa (abre
// la comanda con los comensales), cancelar o marcar "no vino".
// Las reservas de hoy aparecen también en el salón.
import { S, puede, fechaStr, deFechaStr, fechaLarga, waLink, comandaDeMesa, log } from "../store.js";
import { db } from "../db.js";
import { esc, icon, modal, toast, confirmar } from "../util.js";

export const ESTADOS_RESERVA = { pendiente: "Sin confirmar", confirmada: "Confirmada", sentada: "Sentada", cancelada: "Cancelada", novino: "No vino" };

export function mount(root) {
  let dia = fechaStr();
  let lista = [];
  let soltar = null;

  root.innerHTML = `
    <div class="reservas">
      <div class="barra-acciones">
        <div class="res-dias">
          <button class="btn-icono" data-d="-1" aria-label="Día anterior">${icon("atras")}</button>
          <input type="date" class="input chico" id="rDia">
          <button class="btn-icono gira" data-d="1" aria-label="Día siguiente">${icon("atras")}</button>
          <button class="chip" data-hoy>Hoy</button>
        </div>
        <button class="btn btn-pri" data-act="nueva">${icon("mas")} Reserva</button>
      </div>
      <h2 id="rTitulo"></h2>
      <p class="ayuda" id="rResumen"></p>
      <div id="rLista" class="res-lista"></div>
    </div>`;

  function escuchar() {
    soltar?.();
    root.querySelector("#rDia").value = dia;
    soltar = db.listen("reservas", { where: [["fecha", "==", dia]] }, (a) => { lista = a.sort((x, y) => (x.hora || "").localeCompare(y.hora || "")); render(); });
  }

  function render() {
    root.querySelector("#rTitulo").textContent = fechaLarga(dia);
    const activas = lista.filter((r) => !["cancelada", "novino"].includes(r.estado));
    const personas = activas.reduce((s, r) => s + (Number(r.personas) || 0), 0);
    root.querySelector("#rResumen").textContent = lista.length ? `${activas.length} reserva${activas.length === 1 ? "" : "s"} · ${personas} persona${personas === 1 ? "" : "s"}` : "";
    root.querySelector("#rLista").innerHTML = lista.length
      ? lista.map(tarjeta).join("")
      : `<div class="vacio">${icon("calendario")}<p>No hay reservas para este día.</p></div>`;
  }

  function tarjeta(r) {
    const mesa = S.mesas.find((m) => m.id === r.mesaId);
    const cerrada = ["cancelada", "novino", "sentada"].includes(r.estado);
    const esHoy = r.fecha === fechaStr();
    return `<article class="res-card ${r.estado}">
      <div class="res-hora">${esc(r.hora || "--:--")}</div>
      <div class="res-datos">
        <b>${esc(r.nombre)}</b> <span class="pill">${r.personas || "?"} pers.</span> ${mesa ? `<span class="pill">${esc(mesa.nombre)}</span>` : ""}
        <small>${r.telefono ? esc(r.telefono) + " · " : ""}<span class="res-estado ${r.estado}">${ESTADOS_RESERVA[r.estado] || r.estado}</span>${r.nota ? ` · ${esc(r.nota)}` : ""}</small>
      </div>
      <div class="res-acciones">${!cerrada && esHoy ? `<button class="btn chico btn-pri" data-r="sentar" data-id="${esc(r.id)}">Sentar</button>` : ""}${!cerrada && r.telefono ? `<button class="btn chico" data-r="wa" data-id="${esc(r.id)}">WhatsApp</button>` : ""}</div>
      <button class="btn-icono res-menu" data-r="menu" data-id="${esc(r.id)}" aria-label="Opciones">${icon("puntos")}</button>
    </article>`;
  }

  root.addEventListener("click", async (e) => {
    const d = e.target.closest("[data-d]");
    if (d) { dia = fechaStr(deFechaStr(dia, "12:00") + Number(d.dataset.d) * 86400000); escuchar(); return; }
    if (e.target.closest("[data-hoy]")) { dia = fechaStr(); escuchar(); return; }
    if (e.target.closest('[data-act="nueva"]')) return editarReserva(null, dia);
    const b = e.target.closest("[data-r]");
    if (!b) return;
    const r = lista.find((x) => x.id === b.dataset.id);
    if (!r) return;
    if (b.dataset.r === "sentar") sentar(r);
    else if (b.dataset.r === "wa") whatsapp(r);
    else menuReserva(r);
  });
  root.querySelector("#rDia").addEventListener("change", (e) => { if (e.target.value) { dia = e.target.value; escuchar(); } });

  escuchar();
  return { update(claves) { if (claves.includes("mesas")) render(); }, unmount() { soltar?.(); } };
}

export function editarReserva(r = null, diaInicial = fechaStr()) {
  const nueva = !r;
  r = r || { nombre: "", telefono: "", fecha: diaInicial, hora: "21:00", personas: 2, mesaId: "", nota: "", estado: "pendiente" };
  const m = modal({
    titulo: nueva ? "Nueva reserva" : "Editar reserva",
    cuerpo: `<form class="form" id="fRes">
      <div class="dos-col">
        <label class="campo"><span>Nombre</span><input class="input" id="reNom" value="${esc(r.nombre)}" required autofocus></label>
        <label class="campo"><span>Teléfono</span><input class="input" id="reTel" inputmode="tel" value="${esc(r.telefono || "")}" placeholder="341 555-1234"></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Día</span><input class="input" id="reFecha" type="date" value="${esc(r.fecha)}" required></label>
        <label class="campo"><span>Hora</span><input class="input" id="reHora" type="time" value="${esc(r.hora)}" required></label>
      </div>
      <div class="dos-col">
        <label class="campo"><span>Personas</span><input class="input" id="rePers" inputmode="numeric" value="${r.personas || 2}"></label>
        <label class="campo"><span>Mesa (opcional)</span><select class="input" id="reMesa"><option value="">Sin asignar</option>${S.mesas.map((x) => `<option value="${esc(x.id)}" ${x.id === r.mesaId ? "selected" : ""}>${esc(x.nombre)}${x.capacidad ? ` (${x.capacidad})` : ""}</option>`).join("")}</select></label>
      </div>
      <label class="campo"><span>Nota</span><input class="input" id="reNota" value="${esc(r.nota || "")}" placeholder="Cumpleaños, silla para bebé, celíaco…"></label>
    </form>`,
    pie: `<button type="submit" form="fRes" class="btn btn-pri btn-bloque">${nueva ? "Guardar reserva" : "Guardar"}</button>`,
  });
  const $ = (s) => m.el.querySelector(s);
  $("#fRes").onsubmit = (e) => {
    e.preventDefault();
    const datos = {
      nombre: $("#reNom").value.trim(), telefono: $("#reTel").value.trim(),
      fecha: $("#reFecha").value, hora: $("#reHora").value,
      personas: Math.max(1, parseInt($("#rePers").value, 10) || 1),
      mesaId: $("#reMesa").value, nota: $("#reNota").value.trim(),
    };
    if (!datos.nombre || !datos.fecha) return;
    datos.ts = deFechaStr(datos.fecha, datos.hora);
    if (nueva) {
      db.add("reservas", { ...datos, estado: "pendiente", creada: Date.now(), creadaPor: S.perfil.nombre });
      log("reserva", `Reserva: ${datos.nombre} (${datos.personas}) ${datos.fecha} ${datos.hora}`);
    } else db.update("reservas", r.id, datos);
    m.cerrar();
    toast(nueva ? "Reserva guardada" : "Guardado");
  };
}

function whatsapp(r) {
  const neg = S.config.nombre || "A&F";
  const fecha = fechaLarga(r.fecha).replace(/^Hoy, |^Mañana, /, "");
  const txt = `¡Hola ${r.nombre.split(" ")[0]}! Te escribimos de ${neg} para confirmar tu reserva para ${r.personas} persona${r.personas === 1 ? "" : "s"} el ${fecha} a las ${r.hora} h. ¿Nos confirmás? ¡Gracias!`;
  const url = waLink(r.telefono, txt);
  if (!url) return toast("El teléfono no parece válido", "error");
  window.open(url, "_blank", "noopener");
  if (r.estado === "pendiente") setTimeout(async () => {
    if (await confirmar(`¿${r.nombre} confirmó la reserva?`, { ok: "Sí, confirmada", cancelar: "Todavía no" })) db.update("reservas", r.id, { estado: "confirmada" });
  }, 600);
}

function menuReserva(r) {
  const m = modal({
    titulo: `${r.nombre} · ${r.hora}`,
    clase: "modal-chico",
    cuerpo: `<div class="menu-lista">
      <button data-m="editar">${icon("nota")} Editar</button>
      ${r.estado === "pendiente" ? `<button data-m="confirmada">${icon("check")} Marcar confirmada</button>` : ""}
      ${["pendiente", "confirmada"].includes(r.estado) ? `<button data-m="novino">${icon("x")} No vino</button><button data-m="cancelada" class="peligro">${icon("x")} Cancelar reserva</button>` : `<button data-m="pendiente">${icon("reloj")} Volver a "sin confirmar"</button>`}
    </div>`,
  });
  m.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]");
    if (!b) return;
    m.cerrar();
    if (b.dataset.m === "editar") editarReserva(r);
    else { db.update("reservas", r.id, { estado: b.dataset.m }); log("reserva", `Reserva ${r.nombre}: ${ESTADOS_RESERVA[b.dataset.m]}`); }
  });
}

// Sentar: elige mesa (la asignada si está libre) y abre la comanda
export function sentar(r) {
  if (!puede("mesa")) return;
  const libre = (m) => !comandaDeMesa(m);
  const sugerida = S.mesas.find((m) => m.id === r.mesaId && libre(m));
  const abrir = (mesa) => {
    const cid = db.newId("comandas");
    db.batch([
      { op: "set", col: "comandas", id: cid, data: { mesaId: mesa.id, mesaNombre: mesa.nombre, mozo: S.perfil.nombre, mozoUid: S.user.uid, comensales: r.personas || 1, abierta: Date.now(), estado: "abierta", abiertaPor: S.perfil.nombre, reservaId: r.id, reserva: r.nombre } },
      { op: "update", col: "mesas", id: mesa.id, data: { comandaId: cid } },
      { op: "update", col: "reservas", id: r.id, data: { estado: "sentada", comandaId: cid, mesaId: mesa.id, sentadaTs: Date.now() } },
    ]);
    log("reserva", `${r.nombre} sentado en ${mesa.nombre}`);
    location.hash = "#/mesa/" + cid;
  };
  if (sugerida) return abrir(sugerida);
  const libres = S.mesas.filter(libre);
  if (!libres.length) return toast("No hay mesas libres", "error");
  const m = modal({
    titulo: `Sentar a ${r.nombre} (${r.personas})`,
    cuerpo: `<div class="mesas chicas">${libres.map((x) => `<button class="mesa libre" data-mesa="${esc(x.id)}"><span class="mesa-nom">${esc(x.nombre)}</span><span class="mesa-info">${x.capacidad ? `${x.capacidad} lug.` : esc(x.sector || "")}</span></button>`).join("")}</div>`,
  });
  m.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mesa]");
    if (!b) return;
    m.cerrar();
    abrir(S.mesas.find((x) => x.id === b.dataset.mesa));
  });
}
