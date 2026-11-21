// ============================================================
//  A&F · Pantalla de cocina / barra
// ============================================================
// Pendiente → En preparación → Listo. Suena cuando entra un pedido
// y, si está activado en este dispositivo, lo imprime solo.
import { S, dispositivo, guardarDispositivo } from "../store.js";
import { db } from "../db.js";
import { esc, hora, minutos, icon, beep, toast } from "../util.js";
import { imprimir, ticketComanda, btConectada, usbConectada, conectarBluetooth, conectarUSB } from "../print.js";
import { TIPOS_PEDIDO } from "../pedidos.js";

const SIG = { pendiente: "preparando", preparando: "listo", listo: "entregado" };
const BOTON = { pendiente: "Empezar", preparando: "Listo", listo: "Entregado" };
const TITULO = { pendiente: "Pendiente", preparando: "En preparación", listo: "Listo" };
const IMP_KEY = "af_impresos";

export function mount(root) {
  let disp = dispositivo();
  let sector = disp.cocina.sector;
  let col = "pendiente";
  const vistos = new Set();
  let primera = true;
  const recientes = new Map(); // clave → ts en que llegó (para resaltar)
  let impresos = {};
  try { impresos = JSON.parse(localStorage.getItem(IMP_KEY)) || {}; } catch {}

  root.innerHTML = `
    <div class="kds">
      <div class="kds-cab">
        <div class="segmentado" id="kSector">
          <button data-sector="cocina">Cocina</button><button data-sector="barra">Barra</button><button data-sector="todo">Todo</button>
        </div>
        <div class="kds-opciones">
          <label class="switch"><input type="checkbox" id="kSonido"><span>Sonido</span></label>
          <label class="switch"><input type="checkbox" id="kAuto"><span>Imprimir solo</span></label>
          <span id="kImp"></span>
          <button class="btn-icono" data-act="pantalla" title="Pantalla completa">${icon("pantalla")}</button>
        </div>
      </div>
      <div class="kds-tabs" id="kTabs"></div>
      <div class="kds-cols" id="kCols" data-col="${col}">
        ${["pendiente", "preparando", "listo"].map((e) => `<section class="kds-col" data-estado="${e}"><h3>${TITULO[e]} <span class="contador"></span></h3><div class="kds-lista"></div></section>`).join("")}
      </div>
    </div>`;

  const chkSonido = root.querySelector("#kSonido");
  const chkAuto = root.querySelector("#kAuto");
  chkSonido.checked = disp.cocina.sonido;
  chkAuto.checked = disp.cocina.auto;
  chkSonido.onchange = () => { disp = guardarDispositivo({ cocina: { sonido: chkSonido.checked } }); if (chkSonido.checked) beep("ok"); };
  chkAuto.onchange = () => { disp = guardarDispositivo({ cocina: { auto: chkAuto.checked } }); renderImpresora(); };

  // Pantalla siempre encendida mientras se usa la cocina
  let wake = null;
  const pedirWake = async () => { try { wake = await navigator.wakeLock?.request("screen"); } catch {} };
  const onVis = () => { if (document.visibilityState === "visible") pedirWake(); };
  document.addEventListener("visibilitychange", onVis);
  pedirWake();

  function grupos() {
    const g = new Map();
    for (const i of S.items) {
      if (!SIG[i.estado] || i.sector === "ninguno") continue;
      if (sector !== "todo" && i.sector !== sector) continue;
      const k = `${i.envioId || i.comandaId}|${i.sector}`;
      if (!g.has(k)) g.set(k, { clave: k, items: [], mesa: i.mesaNombre, mozo: i.mozo, enviado: i.enviado || i.ts, sector: i.sector, comandaId: i.comandaId, tipo: i.tipo, hora: i.hora });
      g.get(k).items.push(i);
    }
    for (const x of g.values()) {
      x.estado = x.items.some((i) => i.estado === "pendiente") ? "pendiente" : x.items.some((i) => i.estado === "preparando") ? "preparando" : "listo";
      x.enviado = Math.min(...x.items.map((i) => i.enviado || i.ts));
    }
    return [...g.values()].sort((a, b) => a.enviado - b.enviado);
  }

  function tarjeta(g) {
    const m = minutos(g.enviado);
    const nivel = g.estado === "listo" ? "ok" : m >= 20 ? "rojo" : m >= 10 ? "ambar" : "ok";
    const tp = TIPOS_PEDIDO[g.tipo];
    const comensales = tp ? 0 : S.comandas.find((c) => c.id === g.comandaId)?.comensales;
    return `<article class="kds-card nivel-${nivel} ${recientes.has(g.clave) ? "nuevo" : ""} ${tp ? "pedido" : ""}">
      ${tp ? `<div class="kds-pedido">${icon(tp.icono)} ${tp.corto.toUpperCase()}${g.hora ? ` · ${esc(g.hora)} h` : ""}</div>` : ""}
      <header>
        <b>${esc(tp && g.tipo !== "mostrador" ? g.mesa.replace(/^[^·]+·\s*/, "") : g.mesa)}</b>
        <span class="kds-meta">${esc(g.mozo || "")}${comensales ? ` · ${comensales} pers.` : ""}${sector === "todo" ? ` · ${g.sector === "barra" ? "Barra" : "Cocina"}` : ""}</span>
        <span class="kds-tiempo">${icon("reloj")} ${m} min</span>
      </header>
      <ul>${g.items.map((i) => `<li class="${i.estado}" data-act="item" data-id="${esc(i.id)}">
        <span class="kds-cant">${i.cant}</span><span class="kds-desc">${esc(i.desc)}${i.nota ? `<em>${esc(i.nota)}</em>` : ""}</span>
        <span class="kds-est">${i.estado === "preparando" ? "•" : i.estado === "listo" ? icon("check") : ""}</span></li>`).join("")}</ul>
      <footer>
        <small>${hora(g.enviado)}</small>
        <button class="btn-icono" data-act="reimprimir" data-clave="${esc(g.clave)}" title="Imprimir">${icon("print")}</button>
        <button class="btn ${g.estado === "listo" ? "" : "btn-pri"} kds-avanzar" data-act="avanzar" data-clave="${esc(g.clave)}">${BOTON[g.estado]}</button>
      </footer>
    </article>`;
  }

  function imprimirGrupo(g, reimpresion = false) {
    impresos[g.clave] = Date.now();
    const limite = Date.now() - 86400000;
    for (const k of Object.keys(impresos)) if (impresos[k] < limite) delete impresos[k];
    try { localStorage.setItem(IMP_KEY, JSON.stringify(impresos)); } catch {}
    const comensales = S.comandas.find((c) => c.id === g.comandaId)?.comensales;
    return imprimir(ticketComanda({ mesa: g.mesa, mozo: g.mozo, comensales, items: g.items.filter((i) => i.estado !== "anulado"), ts: g.enviado, reimpresion }), { silencioso: !reimpresion });
  }

  function render() {
    root.querySelectorAll("[data-sector]").forEach((b) => b.classList.toggle("activo", b.dataset.sector === sector));
    const gs = grupos();

    // Pedidos nuevos: sonido + impresión automática
    const nuevos = [];
    for (const g of gs) {
      if (g.estado !== "pendiente" || vistos.has(g.clave)) continue;
      vistos.add(g.clave);
      if (primera) {
        if (disp.cocina.auto && !impresos[g.clave] && minutos(g.enviado) < 5) nuevos.push(g);
      } else {
        nuevos.push(g);
        recientes.set(g.clave, Date.now());
      }
    }
    if (nuevos.length && !primera && disp.cocina.sonido) beep("pedido");
    if (disp.cocina.auto) nuevos.filter((g) => !impresos[g.clave]).forEach((g) => imprimirGrupo(g));
    primera = false;
    for (const [k, t] of recientes) if (Date.now() - t > 15000) recientes.delete(k);

    const cont = { pendiente: 0, preparando: 0, listo: 0 };
    for (const e of Object.keys(cont)) {
      const lista = gs.filter((g) => g.estado === e);
      cont[e] = lista.length;
      const sec = root.querySelector(`.kds-col[data-estado="${e}"]`);
      sec.querySelector(".contador").textContent = lista.length || "";
      sec.querySelector(".kds-lista").innerHTML = lista.length ? lista.map(tarjeta).join("") : `<p class="kds-vacio">${e === "pendiente" ? "Sin pedidos" : "—"}</p>`;
    }
    root.querySelector("#kTabs").innerHTML = Object.keys(cont).map((e) => `<button data-col="${e}" class="${e === col ? "activo" : ""}">${TITULO[e]}${cont[e] ? ` <b>${cont[e]}</b>` : ""}</button>`).join("");
    root.querySelector("#kCols").dataset.col = col;
  }

  function renderImpresora() {
    const imp = dispositivo().impresora;
    const el = root.querySelector("#kImp");
    if (!chkAuto.checked) { el.innerHTML = ""; return; }
    if (imp.modo === "bluetooth" && !btConectada()) el.innerHTML = `<button class="btn chico btn-ambar" data-act="conectar">${icon("bluetooth")} Conectar impresora</button>`;
    else if (imp.modo === "usb" && !usbConectada()) el.innerHTML = `<button class="btn chico btn-ambar" data-act="conectar">${icon("print")} Conectar impresora USB</button>`;
    else if (imp.modo === "ninguna") el.innerHTML = `<a class="btn chico btn-ambar" href="#/ajustes">Configurar impresora</a>`;
    else el.innerHTML = "";
  }

  function avanzarItems(its, desde) {
    const t = Date.now();
    const ops = its.filter((i) => i.estado === desde).map((i) => {
      const est = SIG[desde];
      const data = { estado: est, [est + "Ts"]: t };
      if (est === "entregado" && i.comandaCerrada) data.cerrado = true;
      return { op: "update", col: "items", id: i.id, data };
    });
    if (ops.length) db.batch(ops);
  }

  root.addEventListener("click", async (e) => {
    const s = e.target.closest("[data-sector]");
    if (s) { sector = s.dataset.sector; disp = guardarDispositivo({ cocina: { sector } }); vistos.clear(); primera = true; render(); return; }
    const c = e.target.closest("[data-col]");
    if (c && c.tagName === "BUTTON") { col = c.dataset.col; render(); return; }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const g = b.dataset.clave ? grupos().find((x) => x.clave === b.dataset.clave) : null;
    switch (b.dataset.act) {
      case "avanzar": if (g) avanzarItems(g.items, g.estado); break;
      case "item": {
        const i = S.items.find((x) => x.id === b.dataset.id);
        if (i && SIG[i.estado]) avanzarItems([i], i.estado);
        break;
      }
      case "reimprimir": if (g) imprimirGrupo(g, true); break;
      case "pantalla":
        try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); } catch {}
        break;
      case "conectar":
        try {
          const n = dispositivo().impresora.modo === "usb" ? await conectarUSB() : await conectarBluetooth();
          toast(`Impresora conectada: ${n}`);
        } catch (err) { if (err.name !== "NotFoundError") toast(err.message || "No se pudo conectar", "error"); }
        renderImpresora();
        break;
    }
  });

  const reloj = setInterval(render, 20000);
  render();
  renderImpresora();
  return {
    update(claves) { if (claves.some((k) => ["items", "comandas"].includes(k))) render(); },
    unmount() { clearInterval(reloj); document.removeEventListener("visibilitychange", onVis); try { wake?.release(); } catch {} },
  };
}
