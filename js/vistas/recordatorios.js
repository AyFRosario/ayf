// ============================================================
//  A&F · Recordatorios (vencimientos del local)
// ============================================================
// Matafuegos, limpieza de campana, control de plagas, habilitación,
// seguro… Cada uno tiene fecha de vencimiento y cada cuántos meses se
// repite. "Hecho" lo renueva. Los vencidos o próximos se avisan en el
// salón a dueño y encargado.
import { S, fechaStr, deFechaStr, fechaLarga, estadoRecordatorio, log } from "../store.js";
import { db } from "../db.js";
import { esc, fecha, icon, modal, toast, confirmar } from "../util.js";

export const PLANTILLAS = [
  { titulo: "Recarga de matafuegos", cadaMeses: 12, avisar: 20 },
  { titulo: "Limpieza de campana y conductos", cadaMeses: 6, avisar: 15 },
  { titulo: "Control de plagas (desinsectación)", cadaMeses: 1, avisar: 5 },
  { titulo: "Limpieza de tanque de agua", cadaMeses: 6, avisar: 15 },
  { titulo: "Habilitación municipal", cadaMeses: 12, avisar: 30 },
  { titulo: "Seguro del local", cadaMeses: 12, avisar: 20 },
  { titulo: "Carnet de manipulación de alimentos", cadaMeses: 36, avisar: 30 },
];

export function sumarMeses(s, n) {
  const [y, m, d] = s.split("-").map(Number);
  const f = new Date(y, m - 1 + n, 1);
  const ult = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
  f.setDate(Math.min(d, ult));
  return fechaStr(f.getTime());
}

export const pendientesRecordatorios = () => S.recordatorios.filter((r) => r.activo !== false && estadoRecordatorio(r).estado !== "ok");

export function txtDias({ dias }) {
  if (dias < 0) return `Venció hace ${-dias} día${dias === -1 ? "" : "s"}`;
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Vence en ${dias} días`;
}

export function mount(root) {
  root.innerHTML = `
    <div class="recordatorios">
      <div class="barra-acciones"><p class="ayuda">Te avisamos en el salón con anticipación. Al tocar <b>Hecho</b>, la fecha pasa al próximo vencimiento.</p>
        <button class="btn btn-pri" data-act="nuevo">${icon("mas")} Recordatorio</button></div>
      <div id="rcLista"></div>
    </div>`;

  function render() {
    const l = [...S.recordatorios].sort((a, b) => (a.vence || "").localeCompare(b.vence || ""));
    root.querySelector("#rcLista").innerHTML = l.length ? `<div class="lista">${l.map((r) => {
      const e = estadoRecordatorio(r);
      return `<div class="fila-lista rec-item ${e.estado}">
        <span class="rec-ico">${icon(e.estado === "ok" ? "check" : "alarma")}</span>
        <div><b>${esc(r.titulo)}</b><small>${txtDias(e)} · ${esc(fechaLarga(r.vence))}${r.cadaMeses ? ` · cada ${r.cadaMeses} mes${r.cadaMeses === 1 ? "" : "es"}` : ""}${r.nota ? ` · ${esc(r.nota)}` : ""}</small></div>
        <div class="rec-acc">${e.estado !== "ok" ? `<button class="btn chico btn-pri" data-hecho="${esc(r.id)}">${icon("check")} Hecho</button>` : ""}<button class="btn-icono" data-ed="${esc(r.id)}" aria-label="Editar">${icon("nota")}</button></div>
      </div>`;
    }).join("")}</div>` : `<div class="vacio">${icon("alarma")}<p>Anotá los vencimientos del local para que no se pasen.</p>
      <div class="chips centrados">${PLANTILLAS.map((p, k) => `<button class="chip" data-pl="${k}">${icon("mas")} ${esc(p.titulo)}</button>`).join("")}</div></div>`;
  }

  root.addEventListener("click", (e) => {
    if (e.target.closest('[data-act="nuevo"]')) return editarRecordatorio();
    const pl = e.target.closest("[data-pl]");
    if (pl) return editarRecordatorio(null, PLANTILLAS[Number(pl.dataset.pl)]);
    const h = e.target.closest("[data-hecho]");
    if (h) return marcarHecho(S.recordatorios.find((r) => r.id === h.dataset.hecho));
    const ed = e.target.closest("[data-ed]");
    if (ed) editarRecordatorio(S.recordatorios.find((r) => r.id === ed.dataset.ed));
  });
  render();
  return { update(claves) { if (claves.includes("recordatorios")) render(); } };
}

export async function marcarHecho(r) {
  if (!r) return;
  const base = r.vence < fechaStr() ? fechaStr() : r.vence;
  if (!r.cadaMeses) {
    if (!(await confirmar(`¿Ya está "${r.titulo}"? Como no se repite, se borra de la lista.`, { ok: "Sí, borrar" }))) return;
    db.remove("recordatorios", r.id);
    log("recordatorio", `Hecho: ${r.titulo}`);
    return;
  }
  const prox = sumarMeses(base, r.cadaMeses);
  db.update("recordatorios", r.id, { vence: prox, ultimoHecho: Date.now(), hechoPor: S.perfil.nombre });
  log("recordatorio", `Hecho: ${r.titulo}. Próximo: ${prox}`);
  toast(`Listo. Próximo vencimiento: ${fecha(deFechaStr(prox, "12:00"))}`);
}

export function editarRecordatorio(r = null, plantilla = null) {
  const nuevo = !r;
  r = r || { titulo: plantilla?.titulo || "", vence: plantilla ? sumarMeses(fechaStr(), plantilla.cadaMeses) : fechaStr(), cadaMeses: plantilla?.cadaMeses ?? 12, avisar: plantilla?.avisar ?? 15, nota: "" };
  const m = modal({
    titulo: nuevo ? "Nuevo recordatorio" : "Editar recordatorio",
    clase: "modal-chico",
    cuerpo: `<form class="form" id="fRec">
      <label class="campo"><span>Qué hay que hacer</span><input class="input" id="rcTit" value="${esc(r.titulo)}" list="rcPlant" required ${nuevo && !plantilla ? "autofocus" : ""}>
        <datalist id="rcPlant">${PLANTILLAS.map((p) => `<option value="${esc(p.titulo)}">`).join("")}</datalist></label>
      <label class="campo"><span>Próximo vencimiento</span><input class="input" type="date" id="rcVence" value="${esc(r.vence)}" required></label>
      <div class="dos-col">
        <label class="campo"><span>Se repite cada</span><select class="input" id="rcCada">${[[0, "No se repite"], [1, "1 mes"], [2, "2 meses"], [3, "3 meses"], [4, "4 meses"], [6, "6 meses"], [12, "1 año"], [24, "2 años"], [36, "3 años"]].map(([v, t]) => `<option value="${v}" ${Number(r.cadaMeses) === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="campo"><span>Avisar antes</span><select class="input" id="rcAvisar">${[3, 5, 7, 15, 20, 30, 45, 60].map((v) => `<option value="${v}" ${Number(r.avisar) === v ? "selected" : ""}>${v} días</option>`).join("")}</select></label>
      </div>
      <label class="campo"><span>Nota</span><input class="input" id="rcNota" value="${esc(r.nota || "")}" placeholder="Proveedor, teléfono, nº de póliza…"></label>
    </form>`,
    pie: `${!nuevo ? `<button type="button" class="btn" data-borrar aria-label="Borrar">${icon("basura")}</button>` : ""}<button type="submit" form="fRec" class="btn btn-pri">${nuevo ? "Guardar" : "Guardar cambios"}</button>`,
  });
  const $ = (s) => m.el.querySelector(s);
  $("#rcTit").addEventListener("change", () => {
    const p = PLANTILLAS.find((x) => x.titulo === $("#rcTit").value);
    if (p && nuevo) { $("#rcCada").value = p.cadaMeses; $("#rcAvisar").value = p.avisar; }
  });
  $("#fRec").onsubmit = (e) => {
    e.preventDefault();
    const datos = { titulo: $("#rcTit").value.trim(), vence: $("#rcVence").value, cadaMeses: Number($("#rcCada").value), avisar: Number($("#rcAvisar").value), nota: $("#rcNota").value.trim(), activo: true };
    if (!datos.titulo || !datos.vence) return;
    if (nuevo) { db.add("recordatorios", { ...datos, creado: Date.now() }); log("recordatorio", `Recordatorio: ${datos.titulo} (${datos.vence})`); }
    else db.update("recordatorios", r.id, datos);
    m.cerrar();
  };
  const b = m.el.querySelector("[data-borrar]");
  if (b) b.onclick = async () => {
    if (!(await confirmar(`¿Borrar "${r.titulo}"?`, { ok: "Borrar", peligro: true }))) return;
    db.remove("recordatorios", r.id);
    m.cerrar();
  };
}
