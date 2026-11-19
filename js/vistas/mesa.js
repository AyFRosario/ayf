// ============================================================
//  A&F · Comanda de una mesa (pantalla del mozo)
// ============================================================
import { S, puede, itemsDe, vigentes, totalItems, categorias, productoPorCodigo, ESTADOS_ITEM, dispositivo, log, agrupar } from "../store.js";
import { db, inc } from "../db.js";
import { esc, fmt, hora, durTxt, icon, modal, toast, confirmar, pedirTexto, beep, vibrar } from "../util.js";
import { buscar } from "../buscar.js";
import { abrirEscaner, escucharLectorUSB, precargarEscaner } from "../scanner.js";
import { imprimir, ticketComanda, ticketPrecuenta } from "../print.js";
import { abrirCobro } from "./cobro.js";

const NOTAS_RAPIDAS = ["Sin sal", "Sin hielo", "Bien cocido", "Jugoso", "Sin cebolla", "Para compartir", "Sale primero", "Apto celíaco"];

export function mount(root, { param: cid }) {
  let tab = "carta";
  let cat = "Todas";
  let q = "";
  let esperando = Date.now();

  root.innerHTML = `
    <div class="comanda" data-tab="${tab}">
      <div class="comanda-cab" id="cCab"></div>
      <div class="comanda-tabs">
        <button data-tab="pedido">Pedido <span class="contador" id="cCont"></span></button>
        <button data-tab="carta">Carta</button>
      </div>
      <div class="comanda-cuerpo">
        <section class="panel-pedido"><div id="cPedido"></div></section>
        <section class="panel-carta">
          <div class="carta-busqueda">
            <div class="input-icono">${icon("buscar")}<input id="cBusq" class="input" type="search" placeholder="Buscar en la carta…" autocomplete="off" enterkeyhint="search"></div>
            <button class="btn btn-icono-txt" data-act="scan" title="Escanear código">${icon("scan")}<span>Escanear</span></button>
          </div>
          <div class="chips desliza" id="cCats"></div>
          <div class="carta-grid" id="cCarta"></div>
        </section>
      </div>
      <div class="comanda-pie" id="cPie"></div>
    </div>`;
  const wrap = root.querySelector(".comanda");
  precargarEscaner();

  const comanda = () => S.comandas.find((c) => c.id === cid);
  const items = () => itemsDe(cid);

  // ── Render ──
  function render() {
    const c = comanda();
    if (!c) {
      // Recién creada (todavía no llegó) o ya cobrada en otro dispositivo
      if (Date.now() - esperando < 4000) { root.querySelector("#cCab").innerHTML = `<p class="ayuda">Cargando mesa…</p>`; return; }
      toast("Esta mesa ya está cerrada");
      location.hash = "#/salon";
      return;
    }
    const its = items();
    const nuevos = its.filter((i) => i.estado === "nuevo");
    const total = totalItems(its);

    root.querySelector("#cCab").innerHTML = `
      <a href="#/salon" class="btn-icono" aria-label="Volver al salón">${icon("atras")}</a>
      <div class="cc-titulo">
        <h2>${esc(c.mesaNombre)}${c.estado === "cuenta" ? ` <span class="pill ambar">Pidió la cuenta</span>` : ""}</h2>
        <small>${icon("personas")} ${c.comensales || 1} · ${esc(c.mozo || "")} · ${icon("reloj")} ${durTxt(c.abierta)}</small>
      </div>
      <button class="btn-icono" data-act="menu" aria-label="Más opciones">${icon("puntos")}</button>`;
    root.querySelector("#cCont").textContent = vigentes(its).length ? vigentes(its).reduce((s, i) => s + i.cant, 0) : "";

    // Pedido
    const enviados = its.filter((i) => i.estado !== "nuevo").sort((a, b) => (a.enviado || a.ts) - (b.enviado || b.ts));
    let html = "";
    if (!its.length) html = `<div class="vacio chico">${icon("recibo")}<p>Todavía no hay nada cargado.<br>Tocá productos de la carta para agregarlos.</p></div>`;
    if (nuevos.length) {
      html += `<h4 class="subtitulo">Por enviar</h4>` + nuevos.map((i) => `
        <div class="item nuevo">
          <div class="item-txt"><b>${esc(i.desc)}</b>${i.nota ? `<span class="nota-item">${esc(i.nota)}</span>` : ""}<small>${fmt(i.precio)} c/u</small></div>
          <div class="stepper"><button data-act="menos" data-id="${esc(i.id)}" aria-label="Menos">${icon(i.cant > 1 ? "menos" : "basura")}</button><span>${i.cant}</span><button data-act="mas" data-id="${esc(i.id)}" aria-label="Más">${icon("mas")}</button></div>
          <button class="btn-icono" data-act="nota" data-id="${esc(i.id)}" aria-label="Nota">${icon("nota")}</button>
        </div>`).join("");
    }
    if (enviados.length) {
      html += `<h4 class="subtitulo">Enviado</h4>` + enviados.map((i) => `
        <div class="item ${i.estado}">
          <div class="item-txt"><b>${i.cant}× ${esc(i.desc)}</b>${i.nota ? `<span class="nota-item">${esc(i.nota)}</span>` : ""}
            <small>${hora(i.enviado)} · ${fmt(i.precio * i.cant)}${i.estado === "anulado" && i.motivo ? ` · ${esc(i.motivo)}` : ""}</small></div>
          <span class="estado-item ${i.estado}">${i.sector === "ninguno" && i.estado === "entregado" ? "Servido" : ESTADOS_ITEM[i.estado] || i.estado}</span>
          ${i.estado !== "anulado" && puede("anular") ? `<button class="btn-icono" data-act="anular" data-id="${esc(i.id)}" aria-label="Anular">${icon("x")}</button>` : ""}
        </div>`).join("");
    }
    root.querySelector("#cPedido").innerHTML = html;

    // Pie
    let botones = "";
    if (nuevos.length) botones = `<button class="btn btn-pri btn-grande" data-act="enviar">Enviar ${nuevos.reduce((s, i) => s + i.cant, 0)} ${icon("check")}</button>`;
    else if (vigentes(its).length && puede("cobrar")) botones = `<button class="btn btn-pri btn-grande" data-act="cobrar">${icon("dinero")} Cobrar</button>`;
    else if (vigentes(its).length) botones = c.estado === "cuenta"
      ? `<button class="btn btn-grande" data-act="cuenta">Quitar "pidió la cuenta"</button>`
      : `<button class="btn btn-pri btn-grande" data-act="cuenta">Pidió la cuenta</button>`;
    root.querySelector("#cPie").innerHTML = `
      <div class="pie-total"><small>Total</small><b>${fmt(total)}</b></div>
      <div class="pie-botones">${botones}</div>`;

    renderCarta();
  }

  function renderCarta() {
    const cats = categorias();
    if (cat !== "Todas" && !cats.includes(cat)) cat = "Todas";
    root.querySelector("#cCats").innerHTML = ["Todas", ...cats]
      .map((x) => `<button class="chip ${x === cat ? "activo" : ""}" data-cat="${esc(x)}">${esc(x)}</button>`)
      .join("");
    let lista = S.productos.filter((p) => p.activo !== false);
    if (q) lista = buscar(lista, q);
    else if (cat !== "Todas") lista = lista.filter((p) => (p.categoria || "Otros") === cat);
    const enPedido = {};
    for (const i of items()) if (i.estado === "nuevo") enPedido[i.productoId] = (enPedido[i.productoId] || 0) + i.cant;
    root.querySelector("#cCarta").innerHTML = lista.length
      ? lista.map((p) => {
          const sin = p.controlStock && (Number(p.stock) || 0) <= 0;
          return `<button class="prod ${sin ? "sin-stock" : ""}" data-act="agregar" data-id="${esc(p.id)}">
            <span class="prod-nom">${esc(p.nombre)}</span>
            <span class="prod-pie"><span class="prod-pre">${fmt(p.precio)}</span>${sin ? `<span class="prod-tag">sin stock</span>` : ""}</span>
            ${enPedido[p.id] ? `<span class="prod-cant">${enPedido[p.id]}</span>` : ""}</button>`;
        }).join("")
      : `<p class="ayuda centro">No encontré "${esc(q)}".</p>`;
  }

  // ── Acciones ──
  function agregar(p, cant = 1) {
    const c = comanda();
    if (!c) return;
    const ex = items().find((i) => i.estado === "nuevo" && i.productoId === p.id && !i.nota);
    if (ex) db.update("items", ex.id, { cant: inc(cant) });
    else db.add("items", {
      comandaId: cid, mesaId: c.mesaId, mesaNombre: c.mesaNombre,
      productoId: p.id, desc: p.nombre, precio: Number(p.precio) || 0, cant,
      nota: "", sector: p.sector || "cocina", estado: "nuevo", cerrado: false,
      mozo: c.mozo || S.perfil.nombre, mozoUid: c.mozoUid || S.user.uid, cargadoPor: S.perfil.nombre, ts: Date.now(),
    });
    if (p.controlStock && (Number(p.stock) || 0) <= 0) toast(`${p.nombre}: figura sin stock`, "aviso");
  }

  function enviar() {
    const c = comanda();
    const nuevos = items().filter((i) => i.estado === "nuevo");
    if (!c || !nuevos.length) return;
    const envioId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const t = Date.now();
    const ops = nuevos.map((i) => ({
      op: "update", col: "items", id: i.id,
      data: i.sector === "ninguno"
        ? { estado: "entregado", envioId, enviado: t, entregadoTs: t }
        : { estado: "pendiente", envioId, enviado: t },
    }));
    if (c.estado === "cuenta") ops.push({ op: "update", col: "comandas", id: cid, data: { estado: "abierta" } });
    db.batch(ops);
    const aCocina = nuevos.filter((i) => i.sector !== "ninguno");
    beep("ok");
    vibrar();
    toast(aCocina.length ? "Pedido enviado" : "Cargado a la mesa");
    if (aCocina.length && dispositivo().impresora.alEnviar) {
      imprimir(ticketComanda({ mesa: c.mesaNombre, mozo: c.mozo, comensales: c.comensales, items: aCocina, ts: t }), { silencioso: true });
    }
    tab = "pedido";
    wrap.dataset.tab = tab;
    marcarTabs();
  }

  function cambiarCant(id, d) {
    const i = items().find((x) => x.id === id);
    if (!i) return;
    if (i.cant + d <= 0) db.remove("items", id);
    else db.update("items", id, { cant: inc(d) });
  }

  async function nota(id) {
    const i = items().find((x) => x.id === id);
    if (!i) return;
    const t = await pedirTexto(`Nota para ${i.desc}`, { valor: i.nota || "", placeholder: "Ej: sin sal, punto jugoso", sugerencias: NOTAS_RAPIDAS });
    if (t === null) return;
    if (i.cant > 1 && t && !i.nota) {
      // La nota va para una sola unidad: separar
      db.batch([
        { op: "update", col: "items", id, data: { cant: inc(-1) } },
        { op: "set", col: "items", id: db.newId("items"), data: { ...sinId(i), cant: 1, nota: t, ts: Date.now() } },
      ]);
    } else db.update("items", id, { nota: t });
  }

  async function anular(id) {
    const i = items().find((x) => x.id === id);
    if (!i) return;
    const motivo = await pedirTexto(`Anular ${i.cant}× ${i.desc}`, { placeholder: "Motivo", sugerencias: ["Error de carga", "El cliente no lo quiso", "Demora", "Invitación de la casa"], ok: "Anular" });
    if (motivo === null) return;
    db.update("items", id, { estado: "anulado", motivo: motivo || "Sin motivo", anuladoPor: S.perfil.nombre, anuladoTs: Date.now() });
    log("anulacion", `Ítem anulado en ${i.mesaNombre}: ${i.cant}× ${i.desc} (${motivo || "sin motivo"})`);
  }

  function menu() {
    const c = comanda();
    if (!c) return;
    const its = items();
    const hayEnviados = vigentes(its).some((i) => i.estado !== "nuevo");
    const m = modal({
      titulo: c.mesaNombre,
      clase: "modal-chico",
      cuerpo: `<div class="menu-lista">
        <button data-m="precuenta">${icon("print")} Imprimir precuenta</button>
        <button data-m="cuenta">${icon("recibo")} ${c.estado === "cuenta" ? 'Quitar "pidió la cuenta"' : "Marcar: pidió la cuenta"}</button>
        ${puede("cobrar") && vigentes(its).length ? `<button data-m="cobrar">${icon("dinero")} Cobrar</button>` : ""}
        <button data-m="reimprimir">${icon("print")} Reimprimir comanda</button>
        <button data-m="comensales">${icon("personas")} Cambiar comensales</button>
        <button data-m="mover">${icon("mover")} Pasar a otra mesa</button>
        ${!hayEnviados || puede("anular") ? `<button data-m="cerrar" class="peligro">${icon("x")} ${hayEnviados ? "Cerrar sin cobrar" : "Liberar mesa"}</button>` : ""}
      </div>`,
    });
    m.el.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-m]");
      if (!b) return;
      m.cerrar();
      const a = b.dataset.m;
      if (a === "precuenta") precuenta();
      else if (a === "cuenta") marcarCuenta();
      else if (a === "cobrar") abrirCobro(cid);
      else if (a === "reimprimir") reimprimir();
      else if (a === "comensales") {
        const n = await pedirTexto("Comensales", { valor: String(c.comensales || 1), tipo: "numero" });
        if (n) db.update("comandas", cid, { comensales: Math.max(1, parseInt(n, 10) || 1) });
      } else if (a === "mover") mover();
      else if (a === "cerrar") cerrarSinCobrar(hayEnviados);
    });
  }

  function precuenta() {
    const c = comanda();
    const its = agrupar(vigentes(items()));
    imprimir(ticketPrecuenta({ mesa: c.mesaNombre, mozo: c.mozo, items: its, total: totalItems(items()) }));
  }
  function marcarCuenta() {
    const c = comanda();
    db.update("comandas", cid, { estado: c.estado === "cuenta" ? "abierta" : "cuenta" });
  }
  function reimprimir() {
    const c = comanda();
    const its = vigentes(items()).filter((i) => i.estado !== "nuevo" && i.sector !== "ninguno");
    if (!its.length) return toast("No hay nada enviado a cocina o barra");
    imprimir(ticketComanda({ mesa: c.mesaNombre, mozo: c.mozo, comensales: c.comensales, items: its, reimpresion: true }));
  }

  function mover() {
    const c = comanda();
    const libres = S.mesas.filter((m) => !m.comandaId || !S.comandas.some((x) => x.id === m.comandaId));
    if (!libres.length) return toast("No hay mesas libres");
    const m = modal({
      titulo: `Pasar ${c.mesaNombre} a…`,
      cuerpo: `<div class="mesas chicas">${libres.map((x) => `<button class="mesa libre" data-mesa="${esc(x.id)}"><span class="mesa-nom">${esc(x.nombre)}</span><span class="mesa-info">${esc(x.sector || "")}</span></button>`).join("")}</div>`,
    });
    m.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mesa]");
      if (!b) return;
      const nueva = S.mesas.find((x) => x.id === b.dataset.mesa);
      const ops = [
        { op: "update", col: "comandas", id: cid, data: { mesaId: nueva.id, mesaNombre: nueva.nombre } },
        { op: "update", col: "mesas", id: c.mesaId, data: { comandaId: null } },
        { op: "update", col: "mesas", id: nueva.id, data: { comandaId: cid } },
        ...items().map((i) => ({ op: "update", col: "items", id: i.id, data: { mesaId: nueva.id, mesaNombre: nueva.nombre } })),
      ];
      db.batch(ops);
      log("mesa", `${c.mesaNombre} pasó a ${nueva.nombre}`, { comandaId: cid });
      toast(`Ahora es ${nueva.nombre}`);
      m.cerrar();
    });
  }

  async function cerrarSinCobrar(hayEnviados) {
    const c = comanda();
    let motivo = "";
    if (hayEnviados) {
      motivo = await pedirTexto(`Cerrar ${c.mesaNombre} sin cobrar`, { placeholder: "Motivo", sugerencias: ["Invitación de la casa", "Se fueron sin pagar", "Error"], ok: "Cerrar mesa" });
      if (motivo === null) return;
    } else if (!(await confirmar(`¿Liberar ${c.mesaNombre}?`, { ok: "Liberar" }))) return;
    const t = Date.now();
    const ops = [
      { op: "update", col: "comandas", id: cid, data: { estado: "anulada", cerrada: t, motivo: motivo || "Sin consumo", cerradaPor: S.perfil.nombre } },
      { op: "update", col: "mesas", id: c.mesaId, data: { comandaId: null } },
    ];
    for (const i of items()) {
      if (i.estado === "nuevo") ops.push({ op: "delete", col: "items", id: i.id });
      else ops.push({ op: "update", col: "items", id: i.id, data: { cerrado: true } });
    }
    db.batch(ops);
    if (hayEnviados) log("anulacion", `${c.mesaNombre} cerrada sin cobrar (${motivo || "sin motivo"}) · ${fmt(totalItems(items()))}`, { comandaId: cid });
    location.hash = "#/salon";
  }

  function porCodigo(codigo) {
    const p = productoPorCodigo(codigo);
    if (!p) return { ok: false, texto: `El código ${codigo} no está cargado` };
    if (p.activo === false) return { ok: false, texto: `${p.nombre} está desactivado` };
    agregar(p);
    return { ok: true, texto: `+1 ${p.nombre}` };
  }

  function marcarTabs() {
    root.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("activo", b.dataset.tab === tab));
  }

  // ── Eventos ──
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t && t.tagName === "BUTTON") { tab = t.dataset.tab; wrap.dataset.tab = tab; marcarTabs(); return; }
    const ch = e.target.closest("[data-cat]");
    if (ch) { cat = ch.dataset.cat; q = ""; root.querySelector("#cBusq").value = ""; renderCarta(); return; }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case "agregar": {
        const p = S.productos.find((x) => x.id === id);
        if (p) { agregar(p); beep("ok"); vibrar(25); b.classList.remove("pulso"); void b.offsetWidth; b.classList.add("pulso"); }
        break;
      }
      case "mas": cambiarCant(id, 1); break;
      case "menos": cambiarCant(id, -1); break;
      case "nota": nota(id); break;
      case "anular": anular(id); break;
      case "enviar": enviar(); break;
      case "cobrar": abrirCobro(cid); break;
      case "cuenta": marcarCuenta(); break;
      case "menu": menu(); break;
      case "scan":
        abrirEscaner({ titulo: `Cargar a ${comanda()?.mesaNombre || "la mesa"}`, continuo: true, onCodigo: porCodigo });
        break;
    }
  });
  const busq = root.querySelector("#cBusq");
  busq.addEventListener("input", () => { q = busq.value.trim(); renderCarta(); });
  busq.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const primero = root.querySelector("#cCarta [data-act=agregar]");
      if (primero && q) { primero.click(); busq.value = ""; q = ""; renderCarta(); }
    }
  });
  const soltarLector = escucharLectorUSB((codigo) => {
    const r = porCodigo(codigo);
    beep(r.ok ? "ok" : "error");
    toast(r.texto, r.ok ? "" : "error");
  });

  marcarTabs();
  render();
  const revisar = setTimeout(render, 4200); // si la mesa no aparece, volver al salón
  const reloj = setInterval(() => { if (!document.querySelector(".modal-fondo")) render(); }, 60000);
  return {
    update(claves) {
      if (claves.some((k) => ["comandas", "items", "productos", "usuarios", "config", "perfil"].includes(k))) render();
    },
    unmount() { soltarLector(); clearTimeout(revisar); clearInterval(reloj); },
  };
}

function sinId(o) {
  const { id, ...resto } = o;
  return resto;
}
