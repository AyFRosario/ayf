// ============================================================
//  A&F · Ajustes: este dispositivo, negocio y mesas
// ============================================================
import { S, puede, MEDIOS, dispositivo, guardarDispositivo, sectoresMesas, comandaDeMesa, log } from "../store.js";
import { db, auth, MODO } from "../db.js";
import { esc, icon, modal, toast, confirmar, pedirTexto } from "../util.js";
import { imprimir, ticketPrueba, conectarBluetooth, conectarUSB, btConectada, usbConectada } from "../print.js";

const MODOS = {
  ninguna: { t: "Sin impresora", d: "Este dispositivo no imprime." },
  sistema: { t: "Impresora de la PC", d: "Usa el diálogo de impresión. Sirve para cualquier térmica instalada en Windows (USB o de red). Para que la cocina imprima sin preguntar, abrí Chrome con la opción --kiosk-printing (ver LEEME)." },
  bluetooth: { t: "Bluetooth directo", d: "Chrome en Android o en la PC. Imprime sin preguntar. Funciona con la mayoría de las térmicas Bluetooth de 58 y 80 mm (BLE)." },
  usb: { t: "USB directo", d: "Chrome en Android con cable OTG. Imprime sin preguntar. En Windows usá \"Impresora de la PC\"." },
  rawbt: { t: "App RawBT (Android)", d: "Instalá RawBT desde Google Play y configurá ahí la impresora (Bluetooth clásico, USB o de red/wifi). Cada impresión abre RawBT un instante." },
};

export function mount(root) {
  const negocio = puede("ajustesNegocio");
  root.innerHTML = `
    <div class="ajustes">
      <section class="tarjeta" id="aDisp"></section>
      ${negocio ? `<section class="tarjeta" id="aNeg"></section><section class="tarjeta" id="aMesas"></section>` : ""}
      ${MODO === "demo" ? `<section class="tarjeta"><h3>Modo demo</h3><p class="ayuda">Los datos están solo en este navegador.</p><button class="btn btn-peligro" data-act="reset">Reiniciar datos del demo</button></section>` : ""}
    </div>`;

  // ── Este dispositivo ──
  function renderDisp() {
    const d = dispositivo();
    const imp = d.impresora;
    const conectada = imp.modo === "bluetooth" ? btConectada() : imp.modo === "usb" ? usbConectada() : null;
    root.querySelector("#aDisp").innerHTML = `
      <h3>Este dispositivo</h3>
      <p class="ayuda">Estos ajustes quedan guardados solo en este celular, tablet o PC.</p>
      <div class="form">
        <label class="campo"><span>Código del dispositivo</span><input class="input chico" id="dCod" value="${esc(d.codigo)}" maxlength="4"><small class="ayuda">Va adelante del número de venta (${esc(d.codigo)}-0001). Que no se repita entre dispositivos.</small></label>
        <label class="campo"><span>Impresora</span><select class="input" id="dModo">${Object.entries(MODOS).map(([k, v]) => `<option value="${k}" ${imp.modo === k ? "selected" : ""}>${v.t}</option>`).join("")}</select>
          <small class="ayuda">${esc(MODOS[imp.modo]?.d || "")}</small></label>
        ${imp.modo !== "ninguna" ? `
          <div class="campo"><span>Ancho del papel</span><div class="segmentado"><button type="button" data-ancho="58" class="${imp.ancho === 58 ? "activo" : ""}">58 mm</button><button type="button" data-ancho="80" class="${imp.ancho === 80 ? "activo" : ""}">80 mm</button></div></div>
          ${imp.modo !== "sistema" ? `
            <label class="switch"><input type="checkbox" id="dCorte" ${imp.cortar ? "checked" : ""}><span>Cortar el papel al terminar</span></label>
            <label class="switch"><input type="checkbox" id="dAcentos" ${imp.sinAcentos ? "checked" : ""}><span>Imprimir sin acentos (si salen símbolos raros)</span></label>` : ""}
          ${S.rol !== "cocina" ? `<label class="switch"><input type="checkbox" id="dEnviar" ${imp.alEnviar ? "checked" : ""}><span>Imprimir la comanda cuando el mozo envía un pedido desde este dispositivo</span></label>` : ""}
          <div class="fila-botones">
            ${imp.modo === "bluetooth" || imp.modo === "usb" ? `<button class="btn" data-act="conectar">${icon(imp.modo === "bluetooth" ? "bluetooth" : "print")} ${conectada ? "Cambiar impresora" : "Conectar impresora"}</button>` : ""}
            <button class="btn btn-pri" data-act="prueba">${icon("print")} Imprimir prueba</button>
          </div>
          ${conectada !== null ? `<p class="ayuda">${conectada ? `Conectada${imp.btNombre ? `: ${esc(imp.btNombre)}` : ""}` : "Sin conectar"}</p>` : ""}` : ""}
      </div>`;
  }

  // ── Negocio ──
  function renderNeg() {
    const el = root.querySelector("#aNeg");
    if (!el || el.querySelector("form")) return; // no pisar lo que se está escribiendo
    const c = S.config;
    el.innerHTML = `
      <h3>Negocio</h3>
      <form class="form" id="fNeg">
        <label class="campo"><span>Nombre</span><input class="input" id="nNom" value="${esc(c.nombre)}"></label>
        <label class="campo"><span>Lema (sale en los tickets)</span><input class="input" id="nLema" value="${esc(c.lema || "")}"></label>
        <label class="campo"><span>Pie del ticket</span><input class="input" id="nPie" value="${esc(c.pieTicket || "")}"></label>
        <label class="switch"><input type="checkbox" id="nMozo" ${c.mozoCobra ? "checked" : ""}><span>Los mozos pueden cobrar</span></label>
        <div class="campo"><span>Medios de pago</span><div class="checks">${Object.entries(MEDIOS).map(([k, v]) => `<label class="check"><input type="checkbox" data-medio="${k}" ${(c.medios || []).includes(k) ? "checked" : ""}> ${v}</label>`).join("")}</div></div>
        <button class="btn btn-pri">Guardar</button>
      </form>`;
    el.querySelector("#fNeg").onsubmit = (e) => {
      e.preventDefault();
      const medios = [...el.querySelectorAll("[data-medio]:checked")].map((x) => x.dataset.medio);
      if (!medios.length) return toast("Elegí al menos un medio de pago", "error");
      db.merge("config", "general", {
        nombre: el.querySelector("#nNom").value.trim() || "A&F",
        lema: el.querySelector("#nLema").value.trim(),
        pieTicket: el.querySelector("#nPie").value.trim(),
        mozoCobra: el.querySelector("#nMozo").checked,
        medios,
      });
      log("ajustes", "Datos del negocio actualizados");
      toast("Guardado");
    };
  }

  // ── Mesas ──
  function renderMesas() {
    const el = root.querySelector("#aMesas");
    if (!el) return;
    const sectores = sectoresMesas();
    const por = {};
    for (const m of S.mesas) (por[m.sector || "Salón"] ||= []).push(m);
    el.innerHTML = `
      <div class="tarjeta-cab"><h3>Mesas</h3>
        <div class="chips"><button class="chip" data-act="agregarMesa">${icon("mas")} Mesa</button><button class="chip" data-act="agregarVarias">${icon("mas")} Varias</button></div></div>
      ${sectores.map((s) => `<h4 class="subtitulo">${esc(s)}</h4><div class="mesas-edit">${por[s].map((m) => `
        <div class="mesa-edit"><button class="btn-texto" data-renombrar="${esc(m.id)}">${esc(m.nombre)}</button><small>${m.capacidad || "–"} lug.</small>
          <button class="btn-icono" data-borrarmesa="${esc(m.id)}" aria-label="Borrar">${icon("basura")}</button></div>`).join("")}</div>`).join("")
        || `<p class="ayuda">No hay mesas todavía.</p>`}`;
  }

  async function agregarMesas(varias) {
    const sectores = sectoresMesas();
    const nums = S.mesas.map((m) => parseInt(String(m.nombre).replace(/\D+/g, ""), 10)).filter((n) => !isNaN(n));
    const sig = (nums.length ? Math.max(...nums) : 0) + 1;
    const m = modal({
      titulo: varias ? "Agregar varias mesas" : "Agregar mesa",
      clase: "modal-chico",
      cuerpo: `<form class="form" id="fMesa">
        ${varias
          ? `<div class="dos-col"><label class="campo"><span>Desde el número</span><input class="input" id="mDesde" inputmode="numeric" value="${sig}"></label><label class="campo"><span>Hasta</span><input class="input" id="mHasta" inputmode="numeric" value="${sig + 3}"></label></div>`
          : `<label class="campo"><span>Nombre</span><input class="input" id="mNom" value="Mesa ${sig}" autofocus></label>`}
        <label class="campo"><span>Sector</span><input class="input" id="mSec" list="mSecs" value="${esc(sectores[0] || "Salón")}"><datalist id="mSecs">${sectores.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label>
        <label class="campo"><span>Lugares</span><input class="input" id="mCap" inputmode="numeric" value="4"></label>
      </form>`,
      pie: `<button type="submit" form="fMesa" class="btn btn-pri btn-bloque">Agregar</button>`,
    });
    const $ = (s) => m.el.querySelector(s);
    $("#fMesa").onsubmit = (e) => {
      e.preventDefault();
      const sector = $("#mSec").value.trim() || "Salón";
      const capacidad = parseInt($("#mCap").value, 10) || 0;
      let orden = Math.max(0, ...S.mesas.map((x) => Number(x.orden) || 0));
      const nombres = varias
        ? (() => { const a = parseInt($("#mDesde").value, 10), b = parseInt($("#mHasta").value, 10); return a && b && b >= a && b - a < 60 ? Array.from({ length: b - a + 1 }, (_, i) => `Mesa ${a + i}`) : []; })()
        : [$("#mNom").value.trim()].filter(Boolean);
      if (!nombres.length) return toast("Revisá los datos", "error");
      const repetidas = nombres.filter((n) => S.mesas.some((x) => x.nombre.toLowerCase() === n.toLowerCase()));
      if (repetidas.length) return toast(`Ya existe: ${repetidas.join(", ")}`, "error");
      db.batch(nombres.map((nombre) => ({ op: "set", col: "mesas", id: db.newId("mesas"), data: { nombre, sector, capacidad, orden: ++orden, comandaId: null } })));
      log("ajustes", `Mesas agregadas: ${nombres.join(", ")}`);
      m.cerrar();
    };
  }

  // ── Eventos ──
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "dModo") { guardarDispositivo({ impresora: { modo: t.value } }); renderDisp(); }
    else if (t.id === "dCorte") guardarDispositivo({ impresora: { cortar: t.checked } });
    else if (t.id === "dAcentos") guardarDispositivo({ impresora: { sinAcentos: t.checked } });
    else if (t.id === "dEnviar") guardarDispositivo({ impresora: { alEnviar: t.checked } });
    else if (t.id === "dCod") {
      const v = t.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (v) { guardarDispositivo({ codigo: v }); toast("Código guardado"); }
      renderDisp();
    }
  });
  root.addEventListener("click", async (e) => {
    const an = e.target.closest("[data-ancho]");
    if (an) { guardarDispositivo({ impresora: { ancho: Number(an.dataset.ancho) } }); renderDisp(); return; }
    const rn = e.target.closest("[data-renombrar]");
    if (rn) {
      const m = S.mesas.find((x) => x.id === rn.dataset.renombrar);
      const n = await pedirTexto("Nombre de la mesa", { valor: m.nombre });
      if (n && n !== m.nombre) db.update("mesas", m.id, { nombre: n });
      return;
    }
    const bm = e.target.closest("[data-borrarmesa]");
    if (bm) {
      const m = S.mesas.find((x) => x.id === bm.dataset.borrarmesa);
      if (comandaDeMesa(m)) return toast("La mesa está ocupada", "error");
      if (await confirmar(`¿Borrar ${m.nombre}?`, { ok: "Borrar", peligro: true })) { db.remove("mesas", m.id); log("ajustes", `Mesa borrada: ${m.nombre}`); }
      return;
    }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    switch (a.dataset.act) {
      case "prueba": imprimir(ticketPrueba()); break;
      case "conectar":
        try {
          const n = dispositivo().impresora.modo === "usb" ? await conectarUSB() : await conectarBluetooth();
          toast(`Conectada: ${n}`);
        } catch (err) { if (err.name !== "NotFoundError") toast(err.message || "No se pudo conectar", "error"); }
        renderDisp();
        break;
      case "agregarMesa": agregarMesas(false); break;
      case "agregarVarias": agregarMesas(true); break;
      case "reset": if (await confirmar("Se borran todas las ventas y cambios del demo.", { ok: "Reiniciar", peligro: true })) auth.demoReset(); break;
    }
  });

  renderDisp();
  renderNeg();
  renderMesas();
  return {
    update(claves) {
      if (claves.includes("mesas")) renderMesas();
      if (claves.includes("config")) renderNeg();
    },
  };
}
