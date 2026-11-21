// ============================================================
//  A&F · Opciones de los productos (variantes y agregados)
// ============================================================
// Grupos reutilizables, guardados en la configuración del negocio:
//   "Guarnición"  → elegir una, obligatoria: papas, puré, ensalada
//   "Punto"       → elegir una, obligatoria: jugoso, a punto, cocido
//   "Agregados"   → elegir varias, opcional: huevo frito +$800…
// Cada producto lleva la lista de grupos que usa (p.grupos = [ids]).
// Al cargarlo en la comanda se eligen las opciones: el ítem guarda
// lo elegido, el detalle ("Puré · Jugoso") y el precio con extras.
import { S, categorias, log } from "./store.js";
import { db } from "./db.js";
import { esc, fmt, num, icon, modal, toast, confirmar } from "./util.js";

export const grupos = () => (Array.isArray(S.config.grupos) ? S.config.grupos : []);
export const gruposDe = (p) => (p?.grupos || []).map((id) => grupos().find((g) => g.id === id)).filter(Boolean);
export const detalleOpciones = (ops = []) => ops.map((o) => o.n).join(" · ");
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Texto corto para la carta QR: "Guarnición: papas, puré o ensalada"
export function resumenGrupos(p) {
  return gruposDe(p).map((g) => {
    const ns = g.opciones.map((o) => o.n.toLowerCase() + (o.precio ? ` (+${fmt(o.precio)})` : ""));
    // "Una": papas, puré o ensalada · "Varias": se listan con comas (los nombres pueden tener "y")
    const lista = g.tipo === "una" && ns.length > 1 ? `${ns.slice(0, -1).join(", ")} o ${ns[ns.length - 1]}` : ns.join(", ");
    return `${g.nombre}${g.tipo === "varias" && !g.obligatorio ? " (opcional)" : ""}: ${lista}`;
  }).join(" · ");
}

// ── Elegir al cargar en la comanda ──
export function elegirOpciones(p) {
  return new Promise((listo) => {
    const gs = gruposDe(p);
    const sel = Object.fromEntries(gs.map((g) => [g.id, new Set()]));
    let cant = 1;
    let resuelto = false;
    const m = modal({
      titulo: p.nombre,
      clase: "modal-chico modal-opciones",
      cuerpo: `<div id="opGrupos">${gs.map((g) => `
        <fieldset class="op-grupo" data-g="${esc(g.id)}">
          <legend><b>${esc(g.nombre)}</b><small>${g.tipo === "una" ? (g.obligatorio ? "Elegí una" : "Opcional, una") : `${g.obligatorio ? "Elegí al menos una" : "Opcional"}${g.max ? ` · hasta ${g.max}` : ""}`}</small></legend>
          ${g.opciones.map((o) => `<label class="op-opcion"><input type="${g.tipo === "una" ? "radio" : "checkbox"}" name="g_${esc(g.id)}" value="${esc(o.id)}"><span>${esc(o.n)}</span>${o.precio ? `<em>+ ${fmt(o.precio)}</em>` : ""}</label>`).join("")}
        </fieldset>`).join("")}</div>`,
      pie: `<div class="stepper op-cant"><button type="button" data-c="-1" aria-label="Menos">${icon("menos")}</button><span id="opCant">1</span><button type="button" data-c="1" aria-label="Más">${icon("mas")}</button></div>
        <button type="button" class="btn btn-pri" id="opOk">Agregar</button>`,
      onClose: () => { if (!resuelto) listo(null); },
    });
    const precioUnit = () => (Number(p.precio) || 0) + gs.reduce((s, g) => s + g.opciones.filter((o) => sel[g.id].has(o.id)).reduce((a, o) => a + (Number(o.precio) || 0), 0), 0);
    const falta = () => gs.find((g) => g.obligatorio && !sel[g.id].size);
    const pintar = () => {
      m.el.querySelector("#opCant").textContent = cant;
      const f = falta();
      const ok = m.el.querySelector("#opOk");
      ok.textContent = f ? `Elegí ${f.nombre.toLowerCase()}` : `Agregar ${cant > 1 ? `${cant} · ` : ""}${fmt(precioUnit() * cant)}`;
      ok.disabled = !!f;
      // Tope de "varias": se deshabilita el resto al llegar al máximo
      for (const g of gs) {
        if (g.tipo !== "varias" || !g.max) continue;
        m.el.querySelectorAll(`[data-g="${CSS.escape(g.id)}"] input`).forEach((i) => { i.disabled = !i.checked && sel[g.id].size >= g.max; });
      }
    };
    m.el.addEventListener("change", (e) => {
      const fs = e.target.closest("[data-g]");
      if (!fs) return;
      const g = gs.find((x) => x.id === fs.dataset.g);
      if (g.tipo === "una") sel[g.id] = new Set([e.target.value]);
      else if (e.target.checked) sel[g.id].add(e.target.value);
      else sel[g.id].delete(e.target.value);
      pintar();
    });
    m.el.addEventListener("click", (e) => {
      const c = e.target.closest("[data-c]");
      if (c) { cant = Math.max(1, cant + Number(c.dataset.c)); pintar(); }
    });
    m.el.querySelector("#opOk").onclick = () => {
      if (falta()) return;
      const opciones = [];
      for (const g of gs) for (const o of g.opciones) if (sel[g.id].has(o.id)) opciones.push({ g: g.nombre, n: o.n, precio: Number(o.precio) || 0 });
      resuelto = true;
      m.cerrar();
      listo({ opciones, detalle: detalleOpciones(opciones), precio: precioUnit(), cant });
    };
    pintar();
  });
}

// ── Administrar grupos (Productos → Opciones) ──
function guardarGrupos(lista) { db.merge("config", "general", { grupos: lista }); }

export function administrarOpciones() {
  const m = modal({
    titulo: "Opciones de los productos",
    cuerpo: `<p class="ayuda">Variantes y agregados que se eligen al cargar el producto en la comanda: guarnición, punto de la carne, extras con precio… Un mismo grupo sirve para varios productos.</p>
      <div id="agL"></div>
      <div class="chips" id="agPl" style="margin-top:12px"></div>`,
    pie: `<button class="btn btn-pri" data-a="nuevo">${icon("mas")} Grupo de opciones</button>`,
  });
  const PLANTILLAS = [
    { nombre: "Guarnición", tipo: "una", obligatorio: true, opciones: ["Papas fritas", "Puré", "Ensalada mixta"] },
    { nombre: "Punto de la carne", tipo: "una", obligatorio: true, opciones: ["Jugoso", "A punto", "Bien cocido"] },
    { nombre: "Agregados", tipo: "varias", obligatorio: false, opciones: ["Huevo frito", "Jamón y queso", "Panceta"] },
  ];
  const pintar = () => {
    const gs = grupos();
    m.el.querySelector("#agL").innerHTML = gs.length ? `<div class="lista">${gs.map((g) => {
      const n = S.productos.filter((p) => (p.grupos || []).includes(g.id)).length;
      return `<button class="fila-lista boton" data-g="${esc(g.id)}"><div><b>${esc(g.nombre)}</b>
        <small>${g.tipo === "una" ? "Elegir una" : "Elegir varias"}${g.obligatorio ? " · obligatoria" : " · opcional"} · ${g.opciones.map((o) => esc(o.n)).join(", ")}</small></div>
        <span class="pill">${n} producto${n === 1 ? "" : "s"}</span></button>`;
    }).join("")}</div>` : `<div class="vacio chico">${icon("lista")}<p>Todavía no hay grupos de opciones.</p></div>`;
    const usadas = new Set(gs.map((g) => g.nombre.toLowerCase()));
    m.el.querySelector("#agPl").innerHTML = PLANTILLAS.filter((t) => !usadas.has(t.nombre.toLowerCase())).map((t, k) => `<button class="chip" data-pl="${k}">${icon("mas")} ${esc(t.nombre)}</button>`).join("");
  };
  m.el.addEventListener("click", (e) => {
    const g = e.target.closest("[data-g]");
    if (g) return editarGrupo(grupos().find((x) => x.id === g.dataset.g), pintar);
    const pl = e.target.closest("[data-pl]");
    if (pl) {
      const t = PLANTILLAS.filter((x) => !grupos().some((y) => y.nombre.toLowerCase() === x.nombre.toLowerCase()))[Number(pl.dataset.pl)];
      return editarGrupo({ id: "", nombre: t.nombre, tipo: t.tipo, obligatorio: t.obligatorio, max: 0, opciones: t.opciones.map((n) => ({ id: nid(), n, precio: 0 })) }, pintar);
    }
    if (e.target.closest('[data-a="nuevo"]')) editarGrupo(null, pintar);
  });
  pintar();
}

export function editarGrupo(g0, alGuardar) {
  const nuevo = !g0?.id;
  const g = JSON.parse(JSON.stringify(g0 || { nombre: "", tipo: "una", obligatorio: true, max: 0, opciones: [{ id: nid(), n: "", precio: 0 }] }));
  const usan = new Set(nuevo ? [] : S.productos.filter((p) => (p.grupos || []).includes(g.id)).map((p) => p.id));
  let filtro = "";
  const m = modal({
    titulo: nuevo ? "Nuevo grupo de opciones" : g.nombre,
    cuerpo: `<form class="form" id="fGr">
      <label class="campo"><span>Nombre</span><input class="input" id="grNom" value="${esc(g.nombre)}" placeholder="Guarnición, Punto, Agregados…" required></label>
      <div class="segmentado ancho" id="grTipo"><button type="button" data-t="una">Elegir una</button><button type="button" data-t="varias">Elegir varias</button></div>
      <div class="dos-col">
        <label class="switch"><input type="checkbox" id="grObl"><span>Obligatoria</span></label>
        <label class="campo" id="grMaxW"><span>Máximo</span><select class="input" id="grMax"><option value="0">Sin límite</option>${[2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></label>
      </div>
      <div class="campo"><span>Opciones <small class="ayuda">(precio extra, si suma algo)</small></span><div id="grOps"></div>
        <button type="button" class="btn chico" data-a="op">${icon("mas")} Opción</button></div>
      <div class="campo"><span>Productos que la usan <small class="ayuda" id="grCuenta"></small></span>
        <input class="input" id="grFiltro" placeholder="Buscar producto…" autocomplete="off">
        <div class="gr-prods" id="grProds"></div></div>
    </form>`,
    pie: `${nuevo ? "" : `<button type="button" class="btn" data-a="borrar" aria-label="Borrar">${icon("basura")}</button>`}<button type="submit" form="fGr" class="btn btn-pri">${nuevo ? "Crear" : "Guardar"}</button>`,
  });
  const $ = (s) => m.el.querySelector(s);
  const pintarTipo = () => {
    m.el.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("activo", b.dataset.t === g.tipo));
    $("#grMaxW").hidden = g.tipo !== "varias";
  };
  const pintarOps = () => {
    $("#grOps").innerHTML = g.opciones.map((o, k) => `<div class="gr-op">
      <input class="input" data-on="${k}" value="${esc(o.n)}" placeholder="Opción ${k + 1}">
      <input class="input" data-op="${k}" inputmode="decimal" value="${o.precio ? Math.round(o.precio) : ""}" placeholder="+ $ 0">
      <button type="button" class="btn-icono" data-x="${k}" aria-label="Quitar">${icon("x")}</button></div>`).join("");
  };
  const pintarProds = () => {
    const f = filtro.toLowerCase();
    $("#grCuenta").textContent = usan.size ? `(${usan.size})` : "";
    $("#grProds").innerHTML = categorias().map((cat) => {
      const ps = S.productos.filter((p) => (p.categoria || "Otros") === cat && p.activo !== false && (!f || p.nombre.toLowerCase().includes(f)));
      if (!ps.length) return "";
      return `<div class="gr-cat"><small>${esc(cat)}</small>${ps.map((p) => `<label class="op-opcion"><input type="checkbox" data-p="${esc(p.id)}" ${usan.has(p.id) ? "checked" : ""}><span>${esc(p.nombre)}</span></label>`).join("")}</div>`;
    }).join("") || `<p class="ayuda">No hay productos${f ? ` con "${esc(filtro)}"` : ""}.</p>`;
  };
  $("#grObl").checked = !!g.obligatorio;
  $("#grMax").value = String(g.max || 0);
  pintarTipo(); pintarOps(); pintarProds();

  m.el.addEventListener("click", (e) => {
    const t = e.target.closest("[data-t]");
    if (t) { g.tipo = t.dataset.t; pintarTipo(); return; }
    const x = e.target.closest("[data-x]");
    if (x) { g.opciones.splice(Number(x.dataset.x), 1); pintarOps(); return; }
    if (e.target.closest('[data-a="op"]')) { g.opciones.push({ id: nid(), n: "", precio: 0 }); pintarOps(); m.el.querySelector(`[data-on="${g.opciones.length - 1}"]`)?.focus(); }
  });
  m.el.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.on !== undefined) g.opciones[Number(t.dataset.on)].n = t.value;
    else if (t.dataset.op !== undefined) g.opciones[Number(t.dataset.op)].precio = Math.max(0, Math.round(num(t.value)) || 0);
    else if (t.id === "grFiltro") { filtro = t.value.trim(); pintarProds(); }
  });
  m.el.addEventListener("change", (e) => {
    const p = e.target.dataset?.p;
    if (p) { if (e.target.checked) usan.add(p); else usan.delete(p); $("#grCuenta").textContent = usan.size ? `(${usan.size})` : ""; }
  });

  $("#fGr").onsubmit = (e) => {
    e.preventDefault();
    g.nombre = $("#grNom").value.trim();
    g.obligatorio = $("#grObl").checked;
    g.max = g.tipo === "varias" ? Number($("#grMax").value) || 0 : 0;
    g.opciones = g.opciones.map((o) => ({ ...o, n: o.n.trim() })).filter((o) => o.n);
    if (!g.nombre) return toast("Poné un nombre al grupo", "error");
    if (!g.opciones.length) return toast("Agregá al menos una opción", "error");
    if (nuevo) g.id = nid();
    const lista = grupos().filter((x) => x.id !== g.id);
    const pos = grupos().findIndex((x) => x.id === g.id);
    lista.splice(pos < 0 ? lista.length : pos, 0, g);
    guardarGrupos(lista);
    // Productos: agregar o sacar el grupo
    const ops = [];
    for (const p of S.productos) {
      const tiene = (p.grupos || []).includes(g.id);
      if (usan.has(p.id) && !tiene) ops.push({ op: "update", col: "productos", id: p.id, data: { grupos: [...(p.grupos || []), g.id] } });
      if (!usan.has(p.id) && tiene) ops.push({ op: "update", col: "productos", id: p.id, data: { grupos: (p.grupos || []).filter((x) => x !== g.id) } });
    }
    for (let i = 0; i < ops.length; i += 400) db.batch(ops.slice(i, i + 400));
    log("producto", `Opciones "${g.nombre}": ${g.opciones.map((o) => o.n).join(", ")} (${usan.size} productos)`);
    toast(nuevo ? "Grupo creado" : "Guardado");
    m.cerrar();
    setTimeout(() => alGuardar?.(), 60);
  };
  const b = m.el.querySelector('[data-a="borrar"]');
  if (b) b.onclick = async () => {
    if (!(await confirmar(`¿Borrar el grupo "${g.nombre}"?${usan.size ? ` Se quita de ${usan.size} producto${usan.size === 1 ? "" : "s"}.` : ""}`, { ok: "Borrar", peligro: true }))) return;
    guardarGrupos(grupos().filter((x) => x.id !== g.id));
    const ops = S.productos.filter((p) => (p.grupos || []).includes(g.id)).map((p) => ({ op: "update", col: "productos", id: p.id, data: { grupos: p.grupos.filter((x) => x !== g.id) } }));
    for (let i = 0; i < ops.length; i += 400) db.batch(ops.slice(i, i + 400));
    m.cerrar();
    setTimeout(() => alGuardar?.(), 60);
  };
}

// Casillas de grupos para la ficha del producto
export function htmlGruposProducto(p) {
  const gs = grupos();
  if (!gs.length) return `<div class="campo"><span>Opciones</span><p class="ayuda">Para guarnición, punto o agregados, creá los grupos en <b>Productos → Opciones</b>.</p></div>`;
  return `<div class="campo"><span>Opciones al cargarlo en la comanda</span><div class="checks">${gs.map((g) => `<label class="check"><input type="checkbox" data-grupo="${esc(g.id)}" ${(p.grupos || []).includes(g.id) ? "checked" : ""}> ${esc(g.nombre)}</label>`).join("")}</div></div>`;
}
export function leerGruposProducto(cont, p) {
  const marcados = [...cont.querySelectorAll("[data-grupo]:checked")].map((i) => i.dataset.grupo);
  // Conserva el orden previo y suma los nuevos al final
  return [...(p.grupos || []).filter((id) => marcados.includes(id)), ...marcados.filter((id) => !(p.grupos || []).includes(id))];
}
