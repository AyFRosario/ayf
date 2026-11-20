// ============================================================
//  A&F · Productos, stock e ingreso de mercadería por escáner
// ============================================================
import { S, categorias, productoPorCodigo, SECTORES, log } from "../store.js";
import { db, inc } from "../db.js";
import { esc, fmt, num, icon, modal, toast, confirmar } from "../util.js";
import { buscar } from "../buscar.js";
import { abrirEscaner, escucharLectorUSB, precargarEscaner } from "../scanner.js";
import { menuExcel, abrirImportador, descargarPlantilla, precargarExcel } from "../importar.js";

export function mount(root) {
  let q = "";
  let filtro = "Todas";

  root.innerHTML = `
    <div class="productos">
      <div class="prod-barra">
        <div class="input-icono">${icon("buscar")}<input id="pBusq" class="input" type="search" placeholder="Buscar producto o código…" autocomplete="off"></div>
        <div class="prod-botones">
          <button class="btn" data-act="ingreso">${icon("scan")} Ingreso de mercadería</button>
          <button class="btn" data-act="tanda">${icon("dinero")} Precios en tanda</button>
          <button class="btn" data-act="excel">${icon("tabla")} Excel</button>
          <button class="btn btn-pri" data-act="nuevo">${icon("mas")} Producto</button>
        </div>
      </div>
      <div class="chips desliza" id="pCats"></div>
      <div id="pLista"></div>
    </div>`;
  precargarEscaner();
  if (!S.productos.length) precargarExcel();

  function render() {
    const cats = categorias();
    const bajos = S.productos.filter((p) => p.controlStock && (Number(p.stock) || 0) <= (Number(p.stockMin) || 0));
    root.querySelector("#pCats").innerHTML = ["Todas", ...cats, ...(bajos.length ? ["Stock bajo"] : [])]
      .map((c) => `<button class="chip ${c === filtro ? "activo" : ""} ${c === "Stock bajo" ? "alerta" : ""}" data-filtro="${esc(c)}">${esc(c)}${c === "Stock bajo" ? ` (${bajos.length})` : ""}</button>`).join("");

    let lista = S.productos;
    if (q) lista = buscar(lista, q, (p) => `${p.nombre} ${p.categoria || ""}`);
    else if (filtro === "Stock bajo") lista = bajos;
    else if (filtro !== "Todas") lista = lista.filter((p) => (p.categoria || "Otros") === filtro);

    root.querySelector("#pLista").innerHTML = lista.length ? `<div class="tabla-prod">
      ${lista.map((p) => {
        const bajo = p.controlStock && (Number(p.stock) || 0) <= (Number(p.stockMin) || 0);
        return `<button class="fila-prod ${p.activo === false ? "inactivo" : ""}" data-editar="${esc(p.id)}">
          <span class="fp-nom"><b>${esc(p.nombre)}</b><small>${esc(p.categoria || "Otros")} · ${esc(SECTORES[p.sector] || "Cocina")}${p.codigo ? ` · ${icon("scan", "mini")} ${esc(p.codigo)}` : ""}${p.activo === false ? " · desactivado" : ""}</small></span>
          <span class="fp-stock ${bajo ? "bajo" : ""}">${p.controlStock ? `${fmtCant(p.stock)} u.` : ""}</span>
          <b class="fp-precio">${fmt(p.precio)}</b>
        </button>`;
      }).join("")}</div>`
      : q || S.productos.length
        ? `<div class="vacio">${icon("productos")}<p>${q ? `No encontré "${esc(q)}".` : "No hay productos en este filtro."}</p></div>`
        : `<div class="vacio inicio-carta">${icon("productos")}
            <p><b>Todavía no hay productos.</b><br>Cargá la carta desde un Excel o de a uno.</p>
            <div class="fila-botones">
              <button class="btn btn-pri" data-act="importar">${icon("subir")} Importar desde Excel</button>
              <button class="btn" data-act="plantilla">${icon("bajar")} Descargar plantilla</button>
              <button class="btn" data-act="nuevo">${icon("mas")} Cargar a mano</button>
            </div></div>`;
  }

  // ── Alta / edición ──
  function editar(p = null, codigoInicial = "") {
    const cats = categorias();
    const nuevo = !p;
    p = p || { nombre: "", categoria: cats[0] || "", precio: "", sector: codigoInicial ? "ninguno" : "cocina", codigo: codigoInicial, controlStock: !!codigoInicial, stock: 0, stockMin: 0, activo: true, enCarta: true, descripcion: "" };
    const m = modal({
      titulo: nuevo ? "Nuevo producto" : "Editar producto",
      cuerpo: `<form class="form" id="fProd">
        <label class="campo"><span>Nombre</span><input class="input" id="eNom" value="${esc(p.nombre)}" required ${nuevo && !codigoInicial ? "autofocus" : ""}></label>
        <div class="dos-col">
          <label class="campo"><span>Categoría</span><input class="input" id="eCat" list="eCats" value="${esc(p.categoria || "")}"><datalist id="eCats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
          <label class="campo"><span>Precio</span><input class="input" id="ePre" inputmode="decimal" value="${p.precio === "" ? "" : Math.round(p.precio)}" required ${codigoInicial ? "autofocus" : ""}></label>
        </div>
        <label class="campo"><span>Descripción para la carta QR (opcional)</span><textarea class="input" id="eDesc" rows="2" maxlength="160" placeholder="Ej: con salsa pomodoro y albahaca">${esc(p.descripcion || "")}</textarea></label>
        <div class="campo"><span>¿Quién lo prepara?</span>
          <div class="segmentado ancho" id="eSec">${Object.entries(SECTORES).map(([k, v]) => `<button type="button" data-sec="${k}" class="${(p.sector || "cocina") === k ? "activo" : ""}">${v}</button>`).join("")}</div>
          <small class="ayuda">"Lo sirve el mozo": latas, botellas o agua que no pasan por cocina ni barra.</small>
        </div>
        <label class="campo"><span>Código de barras</span>
          <div class="input-boton"><input class="input" id="eCod" inputmode="numeric" value="${esc(p.codigo || "")}" placeholder="Opcional"><button type="button" class="btn" data-act="scanCod">${icon("scan")}</button></div>
        </label>
        <label class="switch"><input type="checkbox" id="eCtl" ${p.controlStock ? "checked" : ""}><span>Controlar stock</span></label>
        <div class="dos-col" id="eStockWrap" ${p.controlStock ? "" : "hidden"}>
          <label class="campo"><span>Stock actual</span><input class="input" id="eStock" inputmode="decimal" value="${fmtCant(p.stock)}"></label>
          <label class="campo"><span>Avisar con menos de</span><input class="input" id="eMin" inputmode="decimal" value="${fmtCant(p.stockMin)}"></label>
        </div>
        <label class="switch"><input type="checkbox" id="eAct" ${p.activo !== false ? "checked" : ""}><span>Activo (lo pueden cargar los mozos)</span></label>
        <label class="switch"><input type="checkbox" id="eCarta" ${p.enCarta !== false ? "checked" : ""}><span>Mostrar en la carta QR de los clientes</span></label>
      </form>`,
      pie: `${nuevo ? "" : `<button class="btn btn-peligro" data-act="borrar">${icon("basura")}</button>`}<button type="submit" form="fProd" class="btn btn-pri">${nuevo ? "Crear" : "Guardar"}</button>`,
    });
    const $ = (s) => m.el.querySelector(s);
    let sector = p.sector || "cocina";
    $("#eSec").onclick = (e) => {
      const b = e.target.closest("[data-sec]");
      if (!b) return;
      sector = b.dataset.sec;
      m.el.querySelectorAll("[data-sec]").forEach((x) => x.classList.toggle("activo", x === b));
    };
    $("#eCtl").onchange = () => { $("#eStockWrap").hidden = !$("#eCtl").checked; };
    m.el.querySelector('[data-act="scanCod"]').onclick = async () => {
      const c = await abrirEscaner({ titulo: "Código del producto" });
      if (c) $("#eCod").value = c;
    };
    const borrar = m.el.querySelector('[data-act="borrar"]');
    if (borrar) borrar.onclick = async () => {
      if (!(await confirmar(`¿Borrar "${p.nombre}"? Las ventas pasadas no se modifican. Si lo vas a volver a usar, mejor desactivalo.`, { ok: "Borrar", peligro: true }))) return;
      db.remove("productos", p.id);
      log("producto", `Producto borrado: ${p.nombre}`);
      m.cerrar();
    };
    $("#fProd").onsubmit = (e) => {
      e.preventDefault();
      const codigo = $("#eCod").value.trim();
      const otro = codigo && productoPorCodigo(codigo);
      if (otro && otro.id !== p.id) return toast(`Ese código ya es de "${otro.nombre}"`, "error");
      const datos = {
        nombre: $("#eNom").value.trim(),
        categoria: $("#eCat").value.trim() || "Otros",
        precio: Math.round(num($("#ePre").value)),
        sector, codigo,
        controlStock: $("#eCtl").checked,
        stockMin: num($("#eMin").value),
        activo: $("#eAct").checked,
        enCarta: $("#eCarta").checked,
        descripcion: $("#eDesc").value.trim(),
      };
      if (!datos.nombre) return toast("Falta el nombre", "error");
      const stockNuevo = num($("#eStock").value);
      if (nuevo) {
        const orden = Math.max(0, ...S.productos.map((x) => Number(x.orden) || 0)) + 1;
        db.add("productos", { ...datos, stock: stockNuevo, orden });
        log("producto", `Producto creado: ${datos.nombre} ${fmt(datos.precio)}`);
      } else {
        // El stock solo se pisa si alguien lo cambió a mano (ajuste por conteo)
        if (datos.controlStock && stockNuevo !== (Number(p.stock) || 0)) {
          datos.stock = stockNuevo;
          log("stock", `Ajuste de stock ${datos.nombre}: ${fmtCant(p.stock)} → ${fmtCant(stockNuevo)}`);
        }
        if (datos.precio !== p.precio) log("precio", `${datos.nombre}: ${fmt(p.precio)} → ${fmt(datos.precio)}`);
        db.update("productos", p.id, datos);
      }
      m.cerrar();
      toast(nuevo ? "Producto creado" : "Guardado");
    };
  }

  // ── Ingreso de mercadería con el celular ──
  function ingreso() {
    let cantidad = Number(localStorage.getItem("af_ingreso_cant")) || 1;
    const sesion = new Map(); // id → cantidad sumada
    const desconocidos = new Set();
    const chips = [1, 6, 12, 24];
    const promesa = abrirEscaner({
      titulo: "Ingreso de mercadería",
      continuo: true,
      extraHtml: `<div class="esc-cantidad"><span>Suma por cada escaneo:</span>${chips.map((n) => `<button type="button" class="chip claro" data-cant="${n}">${n}</button>`).join("")}<button type="button" class="chip claro" data-cant="otra">Otra</button></div>`,
      onCodigo(codigo) {
        const p = productoPorCodigo(codigo);
        if (!p) { desconocidos.add(codigo); return { ok: false, texto: `${codigo}: no está cargado. Lo das de alta al terminar.` }; }
        db.update("productos", p.id, { controlStock: true, stock: inc(cantidad) });
        sesion.set(p.id, (sesion.get(p.id) || 0) + cantidad);
        return { ok: true, texto: `+${cantidad} ${p.nombre} · ahora ${fmtCant((Number(p.stock) || 0) + cantidad)}` };
      },
    });
    const esc_ = document.querySelector(".escaner");
    const marcar = () => esc_?.querySelectorAll("[data-cant]").forEach((b) => b.classList.toggle("activo", Number(b.dataset.cant) === cantidad));
    esc_?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cant]");
      if (!b) return;
      if (b.dataset.cant === "otra") {
        const n = Math.round(num(prompt("¿Cuántas unidades por escaneo?", String(cantidad))));
        if (n > 0) cantidad = n;
      } else cantidad = Number(b.dataset.cant);
      localStorage.setItem("af_ingreso_cant", String(cantidad));
      marcar();
    });
    marcar();

    promesa.then(() => {
      if (!sesion.size && !desconocidos.size) return;
      const filas = [...sesion.entries()].map(([id, n]) => ({ p: S.productos.find((x) => x.id === id), n })).filter((x) => x.p);
      if (filas.length) log("stock", `Ingreso de mercadería: ${filas.map((f) => `${f.p.nombre} +${f.n}`).join(", ")}`);
      const m = modal({
        titulo: "Ingreso de mercadería",
        cuerpo: `
          ${filas.length ? `<div class="lista">${filas.map((f) => `<div class="fila-lista"><div><b>${esc(f.p.nombre)}</b><small>stock actual ${fmtCant(f.p.stock)}</small></div><span class="pos">+${f.n}</span><button class="btn chico" data-deshacer="${esc(f.p.id)}" data-n="${f.n}">Deshacer</button></div>`).join("")}</div>` : ""}
          ${desconocidos.size ? `<h4 class="subtitulo">Códigos sin cargar</h4><div class="lista">${[...desconocidos].map((c) => `<div class="fila-lista"><div><b>${esc(c)}</b></div><button class="btn chico btn-pri" data-alta="${esc(c)}">Dar de alta</button></div>`).join("")}</div>` : ""}`,
        pie: `<button class="btn btn-pri" data-cerrar>Listo</button>`,
      });
      m.el.addEventListener("click", (e) => {
        const d = e.target.closest("[data-deshacer]");
        if (d) {
          db.update("productos", d.dataset.deshacer, { stock: inc(-Number(d.dataset.n)) });
          d.closest(".fila-lista").remove();
          toast("Ingreso deshecho");
          return;
        }
        const a = e.target.closest("[data-alta]");
        if (a) { a.closest(".fila-lista").remove(); editar(null, a.dataset.alta); }
      });
    });
  }

  // ── Precios en tanda (de Dairus) ──
  function tanda() {
    const cats = categorias();
    const m = modal({
      titulo: "Actualizar precios en tanda",
      cuerpo: `<form class="form" id="fTanda">
        <label class="campo"><span>¿Qué productos?</span><select class="input" id="tAlc"><option value="">Todos</option>${cats.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        <div class="dos-col">
          <label class="campo"><span>Porcentaje</span><input class="input" id="tPct" inputmode="decimal" placeholder="Ej: 10 o -5" required></label>
          <label class="campo"><span>Redondear a</span><select class="input" id="tRed"><option value="1">Sin redondeo</option><option value="10">$ 10</option><option value="50">$ 50</option><option value="100" selected>$ 100</option><option value="500">$ 500</option></select></label>
        </div>
        <div id="tPrev" class="ayuda"></div>
      </form>`,
      pie: `<button type="submit" form="fTanda" class="btn btn-pri btn-bloque">Aplicar</button>`,
    });
    const $ = (s) => m.el.querySelector(s);
    const calc = () => {
      const pct = num($("#tPct").value), red = Number($("#tRed").value), alc = $("#tAlc").value;
      const ps = S.productos.filter((p) => !alc || (p.categoria || "Otros") === alc);
      return { pct, ps: ps.map((p) => ({ p, nuevo: Math.max(0, Math.round((p.precio * (1 + pct / 100)) / red) * red) })) };
    };
    const prev = () => {
      const { pct, ps } = calc();
      $("#tPrev").innerHTML = pct ? `${ps.length} productos. Ej: ${ps.slice(0, 3).map((x) => `${esc(x.p.nombre)} ${fmt(x.p.precio)} → <b>${fmt(x.nuevo)}</b>`).join(" · ")}` : "";
    };
    m.el.addEventListener("input", prev);
    m.el.addEventListener("change", prev);
    $("#fTanda").onsubmit = async (e) => {
      e.preventDefault();
      const { pct, ps } = calc();
      if (!pct) return;
      if (!(await confirmar(`¿Cambiar el precio de ${ps.length} productos (${pct > 0 ? "+" : ""}${pct}%)?`))) return;
      const ops = ps.filter((x) => x.nuevo !== x.p.precio).map((x) => ({ op: "update", col: "productos", id: x.p.id, data: { precio: x.nuevo } }));
      for (let i = 0; i < ops.length; i += 400) db.batch(ops.slice(i, i + 400));
      log("precio", `Precios en tanda ${pct > 0 ? "+" : ""}${pct}% (${$("#tAlc").value || "todos"}): ${ops.length} productos`);
      toast(`${ops.length} precios actualizados`);
      m.cerrar();
    };
  }

  // ── Eventos ──
  root.addEventListener("click", (e) => {
    const f = e.target.closest("[data-filtro]");
    if (f) { filtro = f.dataset.filtro; q = ""; root.querySelector("#pBusq").value = ""; render(); return; }
    const ed = e.target.closest("[data-editar]");
    if (ed) { const p = S.productos.find((x) => x.id === ed.dataset.editar); if (p) editar(p); return; }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    if (a.dataset.act === "nuevo") editar();
    else if (a.dataset.act === "ingreso") ingreso();
    else if (a.dataset.act === "tanda") tanda();
    else if (a.dataset.act === "excel") menuExcel();
    else if (a.dataset.act === "importar") abrirImportador();
    else if (a.dataset.act === "plantilla") descargarPlantilla();
  });
  const busq = root.querySelector("#pBusq");
  busq.addEventListener("input", () => { q = busq.value.trim(); render(); });
  const soltar = escucharLectorUSB((codigo) => {
    if (document.querySelector(".modal-fondo")) return;
    const p = productoPorCodigo(codigo);
    if (p) editar(p);
    else editar(null, codigo);
  });

  render();
  return {
    update(claves) { if (claves.includes("productos")) render(); },
    unmount() { soltar(); },
  };
}

function fmtCant(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}
