// ============================================================
//  A&F · Salón (mapa de mesas)
// ============================================================
import { S, puede, itemsDe, vigentes, totalItems, comandaDeMesa, sectoresMesas, log, insumosBajos, fmtCantidad, fechaStr, deFechaStr, estadoRecordatorio } from "../store.js";
import { db } from "../db.js";
import { esc, fmt, durTxt, minutos, icon, modal, toast, iniciales } from "../util.js";
import { sentar } from "./reservas.js";
import { pendientesRecordatorios, txtDias } from "./recordatorios.js";

// Reservas de hoy que todavía no llegaron
export const reservasDeHoy = () => S.reservas
  .filter((r) => r.fecha === fechaStr() && ["pendiente", "confirmada"].includes(r.estado))
  .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
// Reserva próxima de una mesa libre: desde 1 h antes de la hora hasta 1 h después
const reservaDeMesa = (m) => reservasDeHoy().find((r) => r.mesaId === m.id && Math.abs(Date.now() - deFechaStr(r.fecha, r.hora)) <= 3600000 * (Date.now() < deFechaStr(r.fecha, r.hora) ? 3 : 1));

export function mount(root) {
  let sector = localStorage.getItem("af_salon_sector") || "Todos";
  root.innerHTML = `
    <div class="salon">
      <div class="aviso-caja" id="sAviso"></div>
      <div class="res-hoy" id="sReservas"></div>
      <div class="listos" id="sListos"></div>
      <div class="salon-cab">
        <div class="chips desliza" id="sSectores"></div>
        <div class="salon-resumen" id="sResumen"></div>
      </div>
      <div id="sMesas"></div>
    </div>`;

  const reloj = setInterval(() => render(), 30000);

  function render() {
    // Aviso de caja cerrada (solo quien puede abrirla)
    const bajos = puede("productos") ? insumosBajos() : [];
    root.querySelector("#sAviso").innerHTML =
      (!S.jornada && puede("caja")
        ? `<a href="#/caja" class="banda ambar">${icon("caja")} La caja está cerrada. Abrila para poder cobrar.</a>`
        : "") +
      (bajos.length
        ? `<a href="#/productos/insumos" class="banda rojo">${icon("alerta")} Por terminarse: ${bajos.slice(0, 4).map((i) => `${esc(i.nombre)} (${fmtCantidad(i.stock, i.unidad)})`).join(", ")}${bajos.length > 4 ? ` y ${bajos.length - 4} más` : ""}</a>`
        : "") +
      (puede("recordatorios") ? pendientesRecordatorios().slice(0, 3).map((r) => {
        const e = estadoRecordatorio(r);
        return `<a href="#/recordatorios" class="banda ${e.estado === "vencido" ? "rojo" : "ambar"}">${icon("alarma")} ${esc(r.titulo)}: ${txtDias(e).toLowerCase()}</a>`;
      }).join("") : "");

    // Reservas de hoy
    const rh = puede("reservas") ? reservasDeHoy() : [];
    root.querySelector("#sReservas").innerHTML = rh.length
      ? `<div class="res-hoy-cab">${icon("calendario")} Reservas de hoy <a href="#/reservas">Ver todas</a></div><div class="res-hoy-lista">${rh.map((r) => {
          const tarde = Date.now() - deFechaStr(r.fecha, r.hora) > 15 * 60000;
          const mesa = S.mesas.find((m) => m.id === r.mesaId);
          return `<div class="res-chip ${tarde ? "tarde" : ""} ${r.estado}"><span><b>${esc(r.hora)}</b> ${esc(r.nombre)} · ${r.personas}${mesa ? ` · ${esc(mesa.nombre)}` : ""}${tarde ? ` · <i>demorada</i>` : r.estado === "pendiente" ? ` · <i>sin confirmar</i>` : ""}</span>
            ${puede("mesa") ? `<button class="btn chico" data-act="sentar" data-rid="${esc(r.id)}">Sentar</button>` : ""}</div>`;
        }).join("")}</div>`
      : "";

    // Pedidos listos para llevar
    const listos = S.items.filter((i) => i.estado === "listo");
    const grupos = {};
    for (const i of listos) (grupos[i.comandaId] ||= []).push(i);
    const ordenG = Object.values(grupos).sort((a, b) => (a[0].mozoUid === S.user.uid ? -1 : 0) - (b[0].mozoUid === S.user.uid ? -1 : 0));
    root.querySelector("#sListos").innerHTML = ordenG.length && S.rol !== "cocina"
      ? `<div class="listos-cab">${icon("campana")} Listo para llevar</div>` +
        ordenG.map((g) => `
          <div class="listo-fila ${g[0].mozoUid === S.user.uid ? "mio" : ""}">
            <div><b>${esc(g[0].mesaNombre)}</b> <small>${esc(g[0].mozo || "")}</small>
              <div class="listo-items">${g.map((i) => `${i.cant}× ${esc(i.desc)}`).join(" · ")}</div></div>
            <button class="btn btn-verde" data-act="entregar" data-cid="${esc(g[0].comandaId)}">${icon("check")} Entregado</button>
          </div>`).join("")
      : "";

    // Sectores
    const sectores = sectoresMesas();
    if (sector !== "Todos" && !sectores.includes(sector)) sector = "Todos";
    root.querySelector("#sSectores").innerHTML = (sectores.length > 1 ? ["Todos", ...sectores] : [])
      .map((s) => `<button class="chip ${s === sector ? "activo" : ""}" data-sector="${esc(s)}">${esc(s)}</button>`)
      .join("");

    // Resumen
    const ocupadas = S.mesas.filter((m) => comandaDeMesa(m)).length;
    const pendiente = S.comandas.reduce((s, c) => s + totalItems(itemsDe(c.id)), 0);
    root.querySelector("#sResumen").innerHTML = `<span>${ocupadas}/${S.mesas.length} ocupadas</span>${puede("caja") ? `<span>${fmt(pendiente)} en mesas</span>` : ""}`;

    // Mesas agrupadas por sector
    const visibles = S.mesas.filter((m) => sector === "Todos" || (m.sector || "Salón") === sector);
    const porSector = {};
    for (const m of visibles) (porSector[m.sector || "Salón"] ||= []).push(m);
    const cont = root.querySelector("#sMesas");
    if (!S.mesas.length) {
      cont.innerHTML = `<div class="vacio">${icon("mesas")}<p>Todavía no hay mesas cargadas.</p>${puede("ajustesNegocio") ? `<a class="btn btn-pri" href="#/ajustes">Cargar mesas</a>` : ""}</div>`;
      return;
    }
    cont.innerHTML = Object.entries(porSector)
      .map(([sec, ms]) => `<h3 class="titulo-sector">${esc(sec)}</h3><div class="mesas">${ms.map(tarjeta).join("")}</div>`)
      .join("");
  }

  function tarjeta(m) {
    const c = comandaDeMesa(m);
    if (!c) {
      const r = reservaDeMesa(m);
      return `<button class="mesa libre ${r ? "reservada" : ""}" data-act="abrir" data-id="${esc(m.id)}">
        <span class="mesa-nom">${esc(m.nombre)}</span>
        <span class="mesa-info">${m.capacidad ? `${m.capacidad} lugares` : "Libre"}</span>
        ${r ? `<span class="mesa-badge">${icon("calendario")} ${esc(r.hora)} · ${esc(r.nombre.split(" ")[0])}</span>` : ""}</button>`;
    }
    const its = itemsDe(c.id);
    const v = vigentes(its);
    const listos = v.filter((i) => i.estado === "listo").length;
    const sinEnviar = v.filter((i) => i.estado === "nuevo").length;
    const enCocina = v.filter((i) => i.estado === "pendiente" || i.estado === "preparando").length;
    const demora = minutos(c.abierta);
    let badge = "";
    if (listos) badge = `<span class="mesa-badge verde">${listos} listo${listos > 1 ? "s" : ""}</span>`;
    else if (sinEnviar) badge = `<span class="mesa-badge rojo">${sinEnviar} sin enviar</span>`;
    else if (c.estado === "cuenta") badge = `<span class="mesa-badge ambar">Pidió la cuenta</span>`;
    else if (enCocina) badge = `<span class="mesa-badge">${enCocina} en preparación</span>`;
    return `<button class="mesa ocupada ${c.estado === "cuenta" ? "cuenta" : ""}" data-act="ir" data-cid="${esc(c.id)}">
      <span class="mesa-nom">${esc(m.nombre)}</span>
      <span class="mesa-total">${fmt(totalItems(its))}</span>
      <span class="mesa-info">${icon("reloj")} ${durTxt(c.abierta)} · <span class="mini-avatar" title="${esc(c.mozo || "")}">${esc(iniciales(c.mozo))}</span></span>
      ${badge}</button>`;
  }

  function abrirMesa(mesa) {
    const mozos = S.usuarios.filter((u) => u.activo !== false && ["mozo", "encargado", "dueno"].includes(u.rol));
    const elegirMozo = S.rol !== "mozo" && mozos.length > 1;
    const m = modal({
      titulo: `Abrir ${mesa.nombre}`,
      clase: "modal-chico",
      cuerpo: `${reservaDeMesa(mesa) ? `<button type="button" class="banda azul boton-banda" data-reserva>${icon("calendario")} <span>Reservada para <b>${esc(reservaDeMesa(mesa).nombre)}</b> (${reservaDeMesa(mesa).personas}) a las ${esc(reservaDeMesa(mesa).hora)}. Tocá acá si es la reserva.</span></button>` : ""}
      <form class="form" id="fAbrir">
        <div class="campo"><span>Comensales</span>
          <div class="stepper grande"><button type="button" data-d="-1" aria-label="Menos">${icon("menos")}</button><input class="input" id="aCom" inputmode="numeric" value="${mesa.capacidad || 2}"><button type="button" data-d="1" aria-label="Más">${icon("mas")}</button></div>
        </div>
        ${elegirMozo ? `<label class="campo"><span>Mozo</span><select class="input" id="aMozo">${mozos.map((u) => `<option value="${esc(u.id)}" ${u.id === S.user.uid ? "selected" : ""}>${esc(u.nombre)}</option>`).join("")}</select></label>` : ""}
      </form>`,
      pie: `<button type="submit" form="fAbrir" class="btn btn-pri btn-bloque">Abrir mesa</button>`,
    });
    const br = m.el.querySelector("[data-reserva]");
    if (br) br.onclick = () => { const r = reservaDeMesa(mesa); m.cerrar(); if (r) sentar(r); };
    const inp = m.el.querySelector("#aCom");
    m.el.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { inp.value = Math.max(1, (parseInt(inp.value, 10) || 0) + Number(b.dataset.d)); }));
    m.el.querySelector("#fAbrir").onsubmit = (e) => {
      e.preventDefault();
      // ¿alguien la abrió recién desde otro celular?
      const fresca = S.mesas.find((x) => x.id === mesa.id);
      const existente = comandaDeMesa(fresca);
      if (existente) { m.cerrar(); location.hash = "#/mesa/" + existente.id; return; }
      const mozoUid = elegirMozo ? m.el.querySelector("#aMozo").value : S.user.uid;
      const mozo = S.usuarios.find((u) => u.id === mozoUid)?.nombre || S.perfil.nombre;
      const cid = db.newId("comandas");
      db.batch([
        { op: "set", col: "comandas", id: cid, data: {
          mesaId: mesa.id, mesaNombre: mesa.nombre, mozo, mozoUid,
          comensales: Math.max(1, parseInt(inp.value, 10) || 1),
          abierta: Date.now(), estado: "abierta", abiertaPor: S.perfil.nombre,
        } },
        { op: "update", col: "mesas", id: mesa.id, data: { comandaId: cid } },
      ]);
      log("mesa", `${mesa.nombre} abierta`, { comandaId: cid });
      m.cerrar();
      location.hash = "#/mesa/" + cid;
    };
  }

  root.addEventListener("click", (e) => {
    const s = e.target.closest("[data-sector]");
    if (s) { sector = s.dataset.sector; localStorage.setItem("af_salon_sector", sector); render(); return; }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "ir") location.hash = "#/mesa/" + b.dataset.cid;
    else if (b.dataset.act === "sentar") { const r = S.reservas.find((x) => x.id === b.dataset.rid); if (r) sentar(r); }
    else if (b.dataset.act === "abrir") {
      if (!puede("mesa")) return;
      const mesa = S.mesas.find((x) => x.id === b.dataset.id);
      if (mesa) abrirMesa(mesa);
    } else if (b.dataset.act === "entregar") {
      const its = S.items.filter((i) => i.comandaId === b.dataset.cid && i.estado === "listo");
      const t = Date.now();
      db.batch(its.map((i) => ({ op: "update", col: "items", id: i.id, data: { estado: "entregado", entregadoTs: t, ...(i.comandaCerrada ? { cerrado: true } : {}) } })));
      toast(`${its[0]?.mesaNombre || "Mesa"}: entregado`);
    }
  });

  render();
  return { update: render, unmount: () => clearInterval(reloj) };
}
