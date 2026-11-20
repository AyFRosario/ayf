// ============================================================
//  A&F · Insumos y recetas (stock por receta)
// ============================================================
// Un insumo es lo que compra el bar para cocinar: carne, muzzarella,
// papas, harina, aceite… Cada producto puede tener una receta
// ("una milanesa napolitana usa 0,25 kg de carne, 0,1 kg de muzza…").
//
// Cuando el mozo ENVÍA el pedido a cocina, se descuentan los insumos
// de la receta (con incrementos, como todo el stock). Si después se
// anula ese ítem, vuelven. Así el aviso de "se está terminando la
// muzzarella" llega durante el servicio y no recién al cobrar.
import { S, UNIDADES, fmtCantidad, usosDeInsumo, log } from "../store.js";
import { db, inc } from "../db.js";
import { esc, fmt, num, icon, modal, toast, confirmar, pedirTexto } from "../util.js";
import { buscar } from "../buscar.js";

export function montarInsumos(cont) {
  let q = "";
  cont.innerHTML = `
    <div class="prod-barra">
      <div class="input-icono">${icon("buscar")}<input id="iBusq" class="input" type="search" placeholder="Buscar insumo…" autocomplete="off"></div>
      <div class="prod-botones">
        <button class="btn" data-ins="ingreso">${icon("mas")} Ingreso de insumos</button>
        <button class="btn btn-pri" data-ins="nuevo">${icon("mas")} Insumo</button>
      </div>
    </div>
    <div id="iLista"></div>`;

  function render() {
    let lista = S.insumos;
    if (q) lista = buscar(lista, q);
    const el = cont.querySelector("#iLista");
    if (!S.insumos.length) {
      el.innerHTML = `<div class="vacio">${icon("productos")}
        <p><b>Todavía no hay insumos.</b><br>Cargá lo que usa la cocina (carne, muzzarella, papas, harina…). Después, en cada plato, armás la receta y el stock se descuenta solo cuando se envía el pedido.</p>
        <button class="btn btn-pri" data-ins="nuevo">${icon("mas")} Primer insumo</button></div>`;
      return;
    }
    el.innerHTML = `<div class="tabla-prod">${lista.map((i) => {
      const bajo = (Number(i.stock) || 0) <= (Number(i.stockMin) || 0);
      const usos = usosDeInsumo(i.id).length;
      return `<button class="fila-prod" data-insumo="${esc(i.id)}">
        <span class="fp-nom"><b>${esc(i.nombre)}</b><small>${usos ? `En ${usos} receta${usos === 1 ? "" : "s"}` : "Sin recetas"}${i.costo ? ` · ${fmt(i.costo)} por ${esc(UNIDADES[i.unidad] || i.unidad)}` : ""}</small></span>
        <span class="fp-stock ${bajo ? "bajo" : ""}">${fmtCantidad(i.stock, i.unidad)}</span>
        <span class="fp-precio">${i.stockMin ? `<small>mín. ${fmtCantidad(i.stockMin, i.unidad)}</small>` : ""}</span>
      </button>`;
    }).join("") || `<p class="ayuda centro">No encontré "${esc(q)}".</p>`}</div>`;
  }

  cont.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ins]");
    if (b) { b.dataset.ins === "nuevo" ? editarInsumo() : ingresoInsumos(); return; }
    const f = e.target.closest("[data-insumo]");
    if (f) editarInsumo(S.insumos.find((x) => x.id === f.dataset.insumo));
  });
  const busq = cont.querySelector("#iBusq");
  busq.addEventListener("input", () => { q = busq.value.trim(); render(); });
  render();
  return { update(claves) { if (claves.includes("insumos") || claves.includes("productos")) render(); } };
}

export function editarInsumo(i = null) {
  const nuevo = !i;
  i = i || { nombre: "", unidad: "kg", stock: 0, stockMin: 0, costo: 0 };
  const usos = nuevo ? [] : usosDeInsumo(i.id);
  const m = modal({
    titulo: nuevo ? "Nuevo insumo" : i.nombre,
    cuerpo: `<form class="form" id="fIns">
      <label class="campo"><span>Nombre</span><input class="input" id="inNom" value="${esc(i.nombre)}" placeholder="Ej: Muzzarella" required ${nuevo ? "autofocus" : ""}></label>
      <div class="campo"><span>Se mide en</span>
        <div class="segmentado ancho" id="inUni">${Object.entries(UNIDADES).map(([k, v]) => `<button type="button" data-u="${k}" class="${i.unidad === k ? "activo" : ""}">${v}</button>`).join("")}</div>
        <small class="ayuda">Usá la misma unidad con la que lo comprás: carne y quesos en kg, aceite en litros, huevos y panes por unidad.</small></div>
      <div class="dos-col">
        <label class="campo"><span>Stock actual</span><input class="input" id="inStock" inputmode="decimal" value="${String(Number(i.stock) || 0).replace(".", ",")}"></label>
        <label class="campo"><span>Avisar con menos de</span><input class="input" id="inMin" inputmode="decimal" value="${String(Number(i.stockMin) || 0).replace(".", ",")}"></label>
      </div>
      <label class="campo"><span>Costo por <b id="inUniTxt">${esc(UNIDADES[i.unidad])}</b> (opcional)</span><input class="input" id="inCosto" inputmode="decimal" value="${i.costo ? Math.round(i.costo) : ""}" placeholder="$ 0"><small class="ayuda">Con el costo, cada producto muestra cuánto cuesta hacerlo y su margen.</small></label>
      ${usos.length ? `<p class="ayuda">Se usa en: ${usos.map((p) => esc(p.nombre)).join(", ")}.</p>` : ""}
    </form>`,
    pie: `${nuevo ? "" : `<button class="btn btn-peligro" data-a="borrar">${icon("basura")}</button>`}<button type="submit" form="fIns" class="btn btn-pri">${nuevo ? "Crear" : "Guardar"}</button>`,
  });
  const $ = (s) => m.el.querySelector(s);
  let unidad = i.unidad;
  $("#inUni").onclick = (e) => {
    const b = e.target.closest("[data-u]");
    if (!b) return;
    unidad = b.dataset.u;
    m.el.querySelectorAll("[data-u]").forEach((x) => x.classList.toggle("activo", x === b));
    $("#inUniTxt").textContent = UNIDADES[unidad];
  };
  const borrar = m.el.querySelector('[data-a="borrar"]');
  if (borrar) borrar.onclick = async () => {
    if (usos.length) return toast(`Se usa en ${usos.length} receta${usos.length === 1 ? "" : "s"}. Sacalo de ahí primero.`, "error");
    if (!(await confirmar(`¿Borrar el insumo "${i.nombre}"?`, { ok: "Borrar", peligro: true }))) return;
    db.remove("insumos", i.id);
    log("insumo", `Insumo borrado: ${i.nombre}`);
    m.cerrar();
  };
  $("#fIns").onsubmit = (e) => {
    e.preventDefault();
    const nombre = $("#inNom").value.trim();
    if (!nombre) return;
    const repetido = S.insumos.find((x) => x.id !== i.id && x.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (repetido) return toast(`Ya existe "${repetido.nombre}"`, "error");
    const datos = { nombre, unidad, stockMin: num($("#inMin").value), costo: Math.round(num($("#inCosto").value)) };
    const stock = num($("#inStock").value);
    if (nuevo) {
      db.add("insumos", { ...datos, stock, orden: Date.now() });
      log("insumo", `Insumo creado: ${nombre} (${fmtCantidad(stock, unidad)})`);
    } else {
      if (stock !== (Number(i.stock) || 0)) {
        datos.stock = stock;
        log("stock", `Ajuste de insumo ${nombre}: ${fmtCantidad(i.stock, i.unidad)} → ${fmtCantidad(stock, unidad)}`);
      }
      db.update("insumos", i.id, datos);
    }
    m.cerrar();
    toast(nuevo ? "Insumo creado" : "Guardado");
  };
}

// Ingreso rápido: tocás el insumo, escribís cuánto entró y se suma
export function ingresoInsumos() {
  if (!S.insumos.length) return toast("Primero cargá los insumos");
  const sesion = [];
  const m = modal({
    titulo: "Ingreso de insumos",
    cuerpo: `<p class="ayuda">Tocá el insumo y escribí cuánto entró. Se suma al stock.</p>
      <div class="input-icono">${icon("buscar")}<input class="input" id="iiB" placeholder="Buscar insumo…" autocomplete="off"></div>
      <div class="lista" id="iiL"></div><div id="iiSes"></div>`,
    pie: `<button class="btn btn-pri" data-cerrar>Listo</button>`,
    onClose: () => { if (sesion.length) log("stock", `Ingreso de insumos: ${sesion.map((x) => `${x.nombre} +${x.txt}`).join(", ")}`); },
  });
  const inp = m.el.querySelector("#iiB");
  const pintar = () => {
    const q = inp.value.trim();
    const l = q ? buscar(S.insumos, q) : S.insumos;
    m.el.querySelector("#iiL").innerHTML = l.map((i) => `<button class="fila-lista boton" data-ii="${esc(i.id)}"><div><b>${esc(i.nombre)}</b><small>Hay ${fmtCantidad(i.stock, i.unidad)}</small></div>${icon("mas")}</button>`).join("");
    m.el.querySelector("#iiSes").innerHTML = sesion.length ? `<h4 class="subtitulo">Cargado ahora</h4>${sesion.map((x) => `<div class="co-linea"><span>${esc(x.nombre)}</span><span class="pos">+${esc(x.txt)}</span></div>`).join("")}` : "";
  };
  inp.addEventListener("input", pintar);
  m.el.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ii]");
    if (!b) return;
    const i = S.insumos.find((x) => x.id === b.dataset.ii);
    const v = await pedirTexto(`¿Cuánto entró de ${i.nombre}? (en ${UNIDADES[i.unidad]})`, { tipo: "numero", placeholder: "Ej: 5 o 2,5", ok: "Sumar" });
    const cant = num(v);
    if (!(cant > 0)) return;
    db.update("insumos", i.id, { stock: inc(cant) });
    sesion.push({ nombre: i.nombre, txt: fmtCantidad(cant, i.unidad) });
    toast(`${i.nombre}: +${fmtCantidad(cant, i.unidad)}`);
    setTimeout(pintar, 50);
  });
  pintar();
}

// ── Editor de receta dentro del formulario de producto ──
export function editorReceta(recetaInicial = [], precioInicial = 0) {
  let filas = (recetaInicial || []).map((r) => ({ ...r }));
  const html = `<div class="campo receta">
      <span>Receta: qué insumos usa cada unidad vendida (opcional)</span>
      <div id="recFilas"></div>
      <div class="rec-pie"><button type="button" class="btn chico" data-rec="add">${icon("mas")} Insumo</button><small class="ayuda" id="recCosto"></small></div>
    </div>`;
  let el = null, precio = precioInicial;
  const opciones = (sel) => `<option value="">Elegí…</option>${S.insumos.map((i) => `<option value="${esc(i.id)}" ${i.id === sel ? "selected" : ""}>${esc(i.nombre)}</option>`).join("")}`;
  function pintar() {
    const c = el.querySelector("#recFilas");
    if (!S.insumos.length) {
      c.innerHTML = `<p class="ayuda">Todavía no hay insumos. Se cargan en Productos → Insumos.</p>`;
      el.querySelector('[data-rec="add"]').hidden = true;
      return;
    }
    c.innerHTML = filas.map((f, k) => {
      const ins = S.insumos.find((i) => i.id === f.insumoId);
      return `<div class="rec-fila">
        <select class="input" data-ri="${k}">${opciones(f.insumoId)}</select>
        <input class="input" data-rc="${k}" inputmode="decimal" value="${f.cant ? String(f.cant).replace(".", ",") : ""}" placeholder="0">
        <span class="rec-u">${esc(ins ? UNIDADES[ins.unidad] : "")}</span>
        <button type="button" class="btn-icono" data-rx="${k}" aria-label="Quitar">${icon("x")}</button></div>`;
    }).join("");
    costo();
  }
  function costo() {
    let total = 0, completo = true;
    for (const f of filas) {
      const ins = S.insumos.find((i) => i.id === f.insumoId);
      if (!ins || !f.cant) continue;
      if (!ins.costo) completo = false;
      total += (ins.costo || 0) * f.cant;
    }
    const t = el.querySelector("#recCosto");
    if (!total) { t.textContent = ""; return; }
    const margen = precio > 0 ? Math.round(((precio - total) / precio) * 100) : null;
    t.textContent = `Costo de insumos: ${fmt(total)}${margen !== null ? ` · margen ${margen}%` : ""}${completo ? "" : " (faltan costos de algunos insumos)"}`;
  }
  return {
    html,
    montar(raiz) {
      el = raiz;
      el.addEventListener("click", (e) => {
        if (e.target.closest('[data-rec="add"]')) { filas.push({ insumoId: "", cant: 0 }); pintar(); return; }
        const x = e.target.closest("[data-rx]");
        if (x) { filas.splice(Number(x.dataset.rx), 1); pintar(); }
      });
      el.addEventListener("change", (e) => {
        if (e.target.dataset.ri !== undefined) { filas[Number(e.target.dataset.ri)].insumoId = e.target.value; pintar(); }
      });
      el.addEventListener("input", (e) => {
        if (e.target.dataset.rc !== undefined) { filas[Number(e.target.dataset.rc)].cant = num(e.target.value); costo(); }
      });
      pintar();
    },
    precio(p) { precio = p; if (el) costo(); },
    valor: () => filas.filter((f) => f.insumoId && f.cant > 0).map((f) => ({ insumoId: f.insumoId, cant: f.cant })),
  };
}
