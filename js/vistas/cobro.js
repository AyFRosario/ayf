// ============================================================
//  A&F · Cobro de una mesa
// ============================================================
// Descuento en $ o %, pago dividido entre varios medios, vuelto,
// stock descontado con incrementos y ticket no fiscal.
import { CONFIG } from "../config.js";
import { S, puede, itemsDe, vigentes, agrupar, MEDIOS, nroVenta, log, onStore } from "../store.js";
import { db, inc } from "../db.js";
import { esc, fmt, num, icon, modal, toast, beep, pedirTexto } from "../util.js";
import { imprimir, ticketVenta } from "../print.js";

export function abrirCobro(cid) {
  if (!puede("cobrar")) return toast("No tenés permiso para cobrar", "error");
  const c0 = S.comandas.find((c) => c.id === cid);
  if (!c0) return;

  const medios = (S.config.medios || Object.keys(MEDIOS)).filter((m) => MEDIOS[m]);
  const st = { descTipo: "pct", descValor: 0, pagos: [{ medio: medios[0] || "efectivo", monto: 0 }], pagaCon: 0, totalPrevio: null };

  const m = modal({
    titulo: `Cobrar ${c0.mesaNombre}`,
    clase: "modal-cobro",
    cuerpo: `
      <div id="coAviso"></div>
      <details class="co-detalle"><summary id="coResumen"></summary><div id="coItems"></div></details>
      <div class="co-fila"><span>Subtotal</span><b id="coSub"></b></div>
      <div class="co-fila co-desc">
        <span>Descuento</span>
        <div class="segmentado"><button type="button" data-dt="pct">%</button><button type="button" data-dt="monto">$</button></div>
        <input class="input chico" id="coDesc" inputmode="decimal" placeholder="0">
        <b id="coDescMonto"></b>
      </div>
      <div class="co-total"><span>Total</span><b id="coTotal"></b></div>
      <h4 class="subtitulo">Forma de pago</h4>
      <div id="coPagos"></div>
      <div class="co-acciones">
        <button type="button" class="btn chico" data-act="otro">${icon("mas")} Otro medio</button>
        <button type="button" class="btn chico" data-act="dividir">Dividir en partes iguales</button>
      </div>
      <div class="co-efectivo" id="coEf" hidden>
        <label>Paga con <input class="input chico" id="coPagaCon" inputmode="decimal" placeholder="$"></label>
        <span id="coVuelto"></span>
      </div>
      <div class="co-estado" id="coEstado"></div>`,
    pie: `<button type="button" class="btn btn-pri btn-bloque btn-grande" id="coOk">Cobrar</button>`,
    onClose: () => soltar(),
  });
  const $ = (s) => m.el.querySelector(s);

  function calcular() {
    const its = vigentes(itemsDe(cid));
    const lineas = agrupar(its);
    const subtotal = Math.round(lineas.reduce((s, l) => s + l.precio * l.cant, 0));
    let desc = 0;
    if (st.descValor > 0) desc = st.descTipo === "pct" ? Math.round(subtotal * Math.min(100, st.descValor) / 100) : Math.min(Math.round(st.descValor), subtotal);
    const total = subtotal - desc;
    const pagado = Math.round(st.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0));
    return { its, lineas, subtotal, desc, total, pagado };
  }

  function renderPagos() {
    $("#coPagos").innerHTML = st.pagos.map((p, i) => `
      <div class="co-pago">
        <select class="input" data-medio="${i}">${medios.map((x) => `<option value="${x}" ${x === p.medio ? "selected" : ""}>${MEDIOS[x]}</option>`).join("")}</select>
        <input class="input" data-monto="${i}" inputmode="decimal" value="${p.monto ? Math.round(p.monto) : ""}" placeholder="$ 0">
        ${st.pagos.length > 1 ? `<button type="button" class="btn-icono" data-quitar="${i}" aria-label="Quitar">${icon("x")}</button>` : ""}
      </div>`).join("");
  }

  function actualizar() {
    const r = calcular();
    if (!S.comandas.some((c) => c.id === cid)) { m.cerrar(); toast("La mesa ya se cerró desde otro dispositivo"); return; }
    // Si cambió el total y hay un solo pago, acompaña
    if (st.pagos.length === 1 && (st.totalPrevio === null || st.pagos[0].monto === st.totalPrevio)) {
      st.pagos[0].monto = r.total;
      const inp = m.el.querySelector('[data-monto="0"]');
      if (inp && document.activeElement !== inp) inp.value = r.total || "";
    }
    st.totalPrevio = r.total;
    const pagado = Math.round(st.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0));

    const nuevos = r.its.filter((i) => i.estado === "nuevo").length;
    $("#coAviso").innerHTML = [
      !S.jornada ? `<div class="banda rojo">${icon("alerta")} La caja está cerrada. ${puede("caja") ? `<a href="#/caja" data-cerrar>Abrir caja</a>` : "Pedile al encargado que la abra."}</div>` : "",
      nuevos ? `<div class="banda ambar">${icon("alerta")} Hay ${nuevos} ítem${nuevos > 1 ? "s" : ""} sin enviar a cocina/barra. Se cobran igual.</div>` : "",
    ].join("");
    $("#coResumen").textContent = `${r.lineas.reduce((s, l) => s + l.cant, 0)} ítems · ver detalle`;
    $("#coItems").innerHTML = r.lineas.map((l) => `<div class="co-linea"><span>${l.cant}× ${esc(l.desc)}</span><span>${fmt(l.precio * l.cant)}</span></div>`).join("");
    $("#coSub").textContent = fmt(r.subtotal);
    $("#coDescMonto").textContent = r.desc ? "− " + fmt(r.desc) : "";
    $("#coTotal").textContent = fmt(r.total);
    m.el.querySelectorAll("[data-dt]").forEach((b) => b.classList.toggle("activo", b.dataset.dt === st.descTipo));

    const ef = st.pagos.filter((p) => p.medio === "efectivo").reduce((s, p) => s + (Number(p.monto) || 0), 0);
    $("#coEf").hidden = !ef;
    const vuelto = st.pagaCon > ef && ef ? Math.round(st.pagaCon - ef) : 0;
    $("#coVuelto").innerHTML = vuelto ? `Vuelto <b>${fmt(vuelto)}</b>` : "";

    const dif = r.total - pagado;
    const est = $("#coEstado");
    if (Math.abs(dif) < 1) { est.className = "co-estado ok"; est.textContent = st.pagos.length > 1 ? "Pago dividido completo" : ""; }
    else if (dif > 0) { est.className = "co-estado falta"; est.textContent = `Falta asignar ${fmt(dif)}`; }
    else { est.className = "co-estado sobra"; est.textContent = `Hay ${fmt(-dif)} de más`; }
    const ok = $("#coOk");
    ok.disabled = !S.jornada || Math.abs(dif) >= 1 || !r.lineas.length;
    ok.textContent = `Cobrar ${fmt(r.total)}`;
  }

  // Eventos
  m.el.addEventListener("click", async (e) => {
    const dt = e.target.closest("[data-dt]");
    if (dt) { st.descTipo = dt.dataset.dt; actualizar(); return; }
    const q = e.target.closest("[data-quitar]");
    if (q) { st.pagos.splice(Number(q.dataset.quitar), 1); renderPagos(); actualizar(); return; }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const r = calcular();
    if (a.dataset.act === "otro") {
      const resto = Math.max(0, r.total - r.pagado);
      st.pagos.push({ medio: medios.find((x) => !st.pagos.some((p) => p.medio === x)) || medios[0], monto: resto });
      renderPagos(); actualizar();
    } else if (a.dataset.act === "dividir") {
      const n = parseInt(await pedirTexto("¿En cuántas partes?", { valor: String(S.comandas.find((c) => c.id === cid)?.comensales || 2), tipo: "numero" }), 10);
      if (!n || n < 2 || n > 30) return;
      const parte = Math.floor(r.total / n);
      st.pagos = Array.from({ length: n }, (_, i) => ({ medio: st.pagos[i]?.medio || medios[0], monto: i === n - 1 ? r.total - parte * (n - 1) : parte }));
      renderPagos(); actualizar();
    }
  });
  m.el.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "coDesc") st.descValor = num(t.value);
    else if (t.id === "coPagaCon") st.pagaCon = num(t.value);
    else if (t.dataset.monto !== undefined) st.pagos[Number(t.dataset.monto)].monto = num(t.value);
    actualizar();
  });
  m.el.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.medio !== undefined) { st.pagos[Number(t.dataset.medio)].medio = t.value; actualizar(); }
  });
  $("#coOk").onclick = confirmarCobro;

  const soltar = onStore((k) => { if (["items", "comandas", "jornada"].includes(k)) actualizar(); });

  renderPagos();
  actualizar();

  function confirmarCobro() {
    const j = S.jornada;
    const c = S.comandas.find((x) => x.id === cid);
    if (!j || !c) return;
    const r = calcular();
    const pagado = Math.round(st.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0));
    if (Math.abs(r.total - pagado) >= 1) return;
    const t = Date.now();
    const vid = db.newId("ventas");
    const ef = st.pagos.filter((p) => p.medio === "efectivo").reduce((s, p) => s + (Number(p.monto) || 0), 0);
    const venta = {
      nro: nroVenta(j.id), jornadaId: j.id, comandaId: cid,
      mesaId: c.mesaId, mesaNombre: c.mesaNombre, mozo: c.mozo || "", mozoUid: c.mozoUid || "",
      comensales: c.comensales || 1, abierta: c.abierta || t, ts: t,
      cobradoPor: S.perfil.nombre, cobradoUid: S.user.uid,
      items: r.lineas, subtotal: r.subtotal,
      descuento: r.desc ? { tipo: st.descTipo, valor: st.descValor, monto: r.desc } : null,
      total: r.total,
      pagos: st.pagos.filter((p) => Number(p.monto) > 0).map((p) => ({ medio: p.medio, monto: Math.round(p.monto) })),
      vuelto: st.pagaCon > ef && ef ? Math.round(st.pagaCon - ef) : 0,
      estado: "ok",
    };
    const ops = [
      { op: "set", col: "ventas", id: vid, data: venta },
      { op: "update", col: "comandas", id: cid, data: { estado: "cerrada", cerrada: t, ventaId: vid, total: r.total } },
      { op: "update", col: "mesas", id: c.mesaId, data: { comandaId: null } },
    ];
    // Ítems: lo que todavía se está preparando sigue visible en cocina hasta entregarse
    for (const i of itemsDe(cid)) {
      if (["pendiente", "preparando", "listo"].includes(i.estado)) ops.push({ op: "update", col: "items", id: i.id, data: { comandaCerrada: true } });
      else ops.push({ op: "update", col: "items", id: i.id, data: { cerrado: true, ...(i.estado === "nuevo" ? { estado: "entregado", entregadoTs: t } : {}) } });
    }
    // Stock: siempre con incrementos
    const porProd = {};
    for (const l of r.lineas) porProd[l.productoId] = (porProd[l.productoId] || 0) + l.cant;
    for (const [pid, cant] of Object.entries(porProd)) {
      const p = S.productos.find((x) => x.id === pid);
      if (p?.controlStock) ops.push({ op: "update", col: "productos", id: pid, data: { stock: inc(-cant) } });
    }
    db.batch(ops);
    log("venta", `${c.mesaNombre} cobrada ${fmt(r.total)} (${venta.pagos.map((p) => MEDIOS[p.medio]).join(" + ")})`, { ventaId: vid });
    beep("ok");
    m.cerrar();
    location.hash = "#/salon";
    cobrado({ id: vid, ...venta });
  }
}

export function cobrado(v) {
  const m = modal({
    titulo: "Cobrado",
    clase: "modal-chico",
    cuerpo: `<div class="cobrado">
      <div class="cobrado-ok">${icon("check")}</div>
      <p><b>${esc(v.mesaNombre)}</b> · ${fmt(v.total)}</p>
      <p class="ayuda">Nº ${esc(v.nro)} · ${v.pagos.map((p) => `${MEDIOS[p.medio]} ${fmt(p.monto)}`).join(" + ")}</p>
      ${v.vuelto ? `<p class="vuelto">Vuelto ${fmt(v.vuelto)}</p>` : ""}
    </div>`,
    pie: `<button class="btn" data-a="arca">${icon("externo")} Facturar en ARCA</button>
          <button class="btn" data-a="ticket">${icon("print")} Ticket</button>
          <button class="btn btn-pri" data-cerrar>Listo</button>`,
  });
  m.el.querySelector('[data-a="ticket"]').onclick = () => imprimir(ticketVenta(v));
  m.el.querySelector('[data-a="arca"]').onclick = () => window.open(CONFIG.arcaUrl, "_blank", "noopener");
}
