// ============================================================
//  A&F · Clientes con cuenta corriente (fiado)
// ============================================================
// En el cobro aparece el medio "Cuenta corriente": la venta se
// carga al saldo del cliente. Cuando paga, se registra el pago
// (si es en efectivo con la caja abierta, entra al arqueo).
// Todo saldo se mueve con incrementos, nunca pisando el número.
import { S, MEDIOS, puede, waLink, log } from "../store.js";
import { db, inc } from "../db.js";
import { esc, fmt, num, fechaHora, icon, modal, toast } from "../util.js";
import { buscar } from "../buscar.js";

export function mount(root) {
  let q = "";
  let soloDeuda = false;
  root.innerHTML = `
    <div class="clientes">
      <div class="prod-barra">
        <div class="input-icono">${icon("buscar")}<input id="cBusq" class="input" type="search" placeholder="Buscar cliente…" autocomplete="off"></div>
        <div class="prod-botones"><button class="btn btn-pri" data-act="nuevo">${icon("mas")} Cliente</button></div>
      </div>
      <div class="kpis dos" id="cKpis"></div>
      <div class="chips"><button class="chip" data-f="todos">Todos</button><button class="chip" data-f="deuda">Con deuda</button></div>
      <div id="cLista" style="margin-top:10px"></div>
    </div>`;

  function render() {
    const conDeuda = S.clientes.filter((c) => (Number(c.saldo) || 0) > 0);
    const total = conDeuda.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
    root.querySelector("#cKpis").innerHTML = `
      <div class="kpi"><small>Te deben</small><b>${fmt(total)}</b><span>${conDeuda.length} cliente${conDeuda.length === 1 ? "" : "s"}</span></div>
      <div class="kpi"><small>Clientes</small><b>${S.clientes.length}</b><span>con cuenta</span></div>`;
    root.querySelectorAll("[data-f]").forEach((b) => b.classList.toggle("activo", (b.dataset.f === "deuda") === soloDeuda));
    let l = soloDeuda ? conDeuda : S.clientes;
    if (q) l = buscar(l, q, (c) => `${c.nombre} ${c.telefono || ""}`);
    root.querySelector("#cLista").innerHTML = l.length ? `<div class="tabla-prod">${l.map((c) => {
      const saldo = Number(c.saldo) || 0;
      return `<button class="fila-prod" data-cli="${esc(c.id)}">
        <span class="fp-nom"><b>${esc(c.nombre)}</b><small>${esc(c.telefono || "Sin teléfono")}${c.nota ? ` · ${esc(c.nota)}` : ""}</small></span>
        <span></span>
        <b class="fp-precio ${saldo > 0 ? "neg" : saldo < 0 ? "pos" : ""}">${saldo > 0 ? `Debe ${fmt(saldo)}` : saldo < 0 ? `A favor ${fmt(-saldo)}` : "Al día"}</b>
      </button>`;
    }).join("")}</div>` : `<div class="vacio">${icon("libreta")}<p>${S.clientes.length ? "No hay clientes en este filtro." : "Todavía no hay clientes con cuenta corriente.<br>Sirve para habitués, empleados o la cuenta de la casa."}</p></div>`;
  }

  root.addEventListener("click", (e) => {
    const f = e.target.closest("[data-f]");
    if (f) { soloDeuda = f.dataset.f === "deuda"; render(); return; }
    if (e.target.closest('[data-act="nuevo"]')) return editarCliente();
    const c = e.target.closest("[data-cli]");
    if (c) verCliente(S.clientes.find((x) => x.id === c.dataset.cli));
  });
  const busq = root.querySelector("#cBusq");
  busq.addEventListener("input", () => { q = busq.value.trim(); render(); });
  render();
  return { update(claves) { if (claves.includes("clientes")) render(); } };
}

export function editarCliente(c = null, alCrear) {
  const nuevo = !c;
  c = c || { nombre: "", telefono: "", nota: "" };
  const m = modal({
    titulo: nuevo ? "Nuevo cliente" : "Editar cliente",
    clase: "modal-chico",
    cuerpo: `<form class="form" id="fCli">
      <label class="campo"><span>Nombre</span><input class="input" id="clNom" value="${esc(c.nombre)}" required autofocus></label>
      <label class="campo"><span>Teléfono</span><input class="input" id="clTel" inputmode="tel" value="${esc(c.telefono || "")}"></label>
      <label class="campo"><span>Nota</span><input class="input" id="clNota" value="${esc(c.nota || "")}" placeholder="Ej: empleado, cuenta de la casa"></label>
    </form>`,
    pie: `<button type="submit" form="fCli" class="btn btn-pri btn-bloque">${nuevo ? "Crear" : "Guardar"}</button>`,
  });
  m.el.querySelector("#fCli").onsubmit = (e) => {
    e.preventDefault();
    const datos = { nombre: m.el.querySelector("#clNom").value.trim(), telefono: m.el.querySelector("#clTel").value.trim(), nota: m.el.querySelector("#clNota").value.trim() };
    if (!datos.nombre) return;
    if (nuevo) {
      const id = db.add("clientes", { ...datos, saldo: 0, creado: Date.now() });
      log("cliente", `Cliente creado: ${datos.nombre}`);
      alCrear?.({ id, ...datos, saldo: 0 });
    } else db.update("clientes", c.id, datos);
    m.cerrar();
  };
}

function verCliente(c) {
  if (!c) return;
  let soltar = null;
  const m = modal({
    titulo: c.nombre,
    cuerpo: `<div id="vcCab"></div><h4 class="subtitulo">Movimientos</h4><div id="vcMovs" class="lista"><p class="ayuda">Cargando…</p></div>`,
    pie: `<button class="btn" data-a="editar">${icon("nota")} Editar</button>
      <button class="btn" data-a="wa">WhatsApp</button>
      <button class="btn btn-pri" data-a="pago">${icon("dinero")} Registrar pago</button>`,
    onClose: () => soltar?.(),
  });
  const cab = () => {
    const x = S.clientes.find((y) => y.id === c.id) || c;
    const saldo = Number(x.saldo) || 0;
    m.el.querySelector("#vcCab").innerHTML = `<div class="saldo-cli ${saldo > 0 ? "debe" : ""}"><small>${saldo > 0 ? "Debe" : saldo < 0 ? "Saldo a favor" : "Saldo"}</small><b>${fmt(Math.abs(saldo))}</b></div>
      <p class="ayuda">${esc(x.telefono || "Sin teléfono")}${x.nota ? ` · ${esc(x.nota)}` : ""}</p>`;
    return x;
  };
  cab();
  soltar = db.listen("movClientes", { where: [["clienteId", "==", c.id]] }, (a) => {
    cab();
    a.sort((p, q) => q.ts - p.ts);
    m.el.querySelector("#vcMovs").innerHTML = a.length ? a.slice(0, 60).map((mv) => `
      <div class="fila-lista"><div><b>${mv.tipo === "cargo" ? "Consumo" : mv.tipo === "pago" ? `Pago · ${esc(MEDIOS[mv.medio] || mv.medio || "")}` : "Anulación"}</b><small>${fechaHora(mv.ts)}${mv.desc ? ` · ${esc(mv.desc)}` : ""} · ${esc(mv.usuario || "")}</small></div>
        <span class="${mv.monto > 0 ? "neg" : "pos"}">${mv.monto > 0 ? "+" : "−"} ${fmt(Math.abs(mv.monto))}</span></div>`).join("") : `<p class="ayuda">Sin movimientos todavía.</p>`;
  });
  m.el.querySelector('[data-a="editar"]').onclick = () => { m.cerrar(); editarCliente(c); };
  m.el.querySelector('[data-a="wa"]').onclick = () => {
    const x = S.clientes.find((y) => y.id === c.id) || c;
    const saldo = Number(x.saldo) || 0;
    const txt = saldo > 0 ? `¡Hola ${x.nombre.split(" ")[0]}! Te escribimos de ${S.config.nombre || "A&F"}. Te recordamos que tenés un saldo pendiente de ${fmt(saldo)}. ¡Gracias!` : "";
    const url = waLink(x.telefono, txt);
    if (!url) return toast("El cliente no tiene un teléfono válido", "error");
    window.open(url, "_blank", "noopener");
  };
  m.el.querySelector('[data-a="pago"]').onclick = () => registrarPago(S.clientes.find((y) => y.id === c.id) || c);
}

function registrarPago(c) {
  const saldo = Number(c.saldo) || 0;
  const medios = (S.config.medios || []).filter((x) => x !== "cuenta" && MEDIOS[x]);
  const m = modal({
    titulo: `Pago de ${c.nombre}`,
    clase: "modal-chico",
    cuerpo: `<form class="form" id="fPago">
      <label class="campo"><span>Monto</span><input class="input grande" id="pgMonto" inputmode="decimal" value="${saldo > 0 ? Math.round(saldo) : ""}" required autofocus></label>
      <label class="campo"><span>Medio</span><select class="input" id="pgMedio">${medios.map((x) => `<option value="${x}">${MEDIOS[x]}</option>`).join("")}</select></label>
      <p class="ayuda" id="pgCaja"></p>
    </form>`,
    pie: `<button type="submit" form="fPago" class="btn btn-pri btn-bloque">Registrar pago</button>`,
  });
  const avisar = () => {
    const ef = m.el.querySelector("#pgMedio").value === "efectivo";
    m.el.querySelector("#pgCaja").textContent = ef ? (S.jornada ? "Entra a la caja abierta como ingreso (cuenta en el arqueo)." : "La caja está cerrada: el efectivo no se suma a ninguna caja.") : "";
  };
  m.el.querySelector("#pgMedio").addEventListener("change", avisar);
  avisar();
  m.el.querySelector("#fPago").onsubmit = (e) => {
    e.preventDefault();
    const monto = Math.round(num(m.el.querySelector("#pgMonto").value));
    if (!(monto > 0)) return toast("Ingresá un monto", "error");
    const medio = m.el.querySelector("#pgMedio").value;
    const t = Date.now();
    const ops = [
      { op: "update", col: "clientes", id: c.id, data: { saldo: inc(-monto), ultimoMov: t } },
      { op: "set", col: "movClientes", id: db.newId("movClientes"), data: { clienteId: c.id, clienteNombre: c.nombre, tipo: "pago", monto: -monto, medio, ts: t, usuario: S.perfil.nombre, jornadaId: S.jornada?.id || "" } },
    ];
    if (medio === "efectivo" && S.jornada) ops.push({ op: "set", col: "movCaja", id: db.newId("movCaja"), data: { jornadaId: S.jornada.id, tipo: "ingreso", monto, desc: `Pago de cuenta: ${c.nombre}`, medio: "efectivo", ts: t, usuario: S.perfil.nombre } });
    db.batch(ops);
    log("cliente", `Pago de ${c.nombre}: ${fmt(monto)} (${MEDIOS[medio]})`);
    toast(`Pago registrado: ${fmt(monto)}`);
    m.cerrar();
  };
}

// Selector de cliente para el cobro (con alta rápida)
export function elegirCliente(alElegir) {
  const m = modal({
    titulo: "¿A qué cuenta?",
    cuerpo: `<div class="input-icono">${icon("buscar")}<input class="input" id="ecB" placeholder="Buscar cliente…" autocomplete="off" autofocus></div>
      <div class="lista" id="ecL"></div>`,
    pie: puede("clientes") ? `<button class="btn" data-a="nuevo">${icon("mas")} Cliente nuevo</button>` : "",
  });
  const inp = m.el.querySelector("#ecB");
  const pintar = () => {
    const q = inp.value.trim();
    const l = q ? buscar(S.clientes, q, (c) => `${c.nombre} ${c.telefono || ""}`) : S.clientes;
    m.el.querySelector("#ecL").innerHTML = l.map((c) => `<button class="fila-lista boton" data-c="${esc(c.id)}"><div><b>${esc(c.nombre)}</b><small>${(Number(c.saldo) || 0) > 0 ? `Debe ${fmt(c.saldo)}` : "Al día"}</small></div></button>`).join("") || `<p class="ayuda">No hay clientes${q ? ` para "${esc(q)}"` : ""}.</p>`;
  };
  inp.addEventListener("input", pintar);
  m.el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-c]");
    if (b) { m.cerrar(); alElegir(S.clientes.find((c) => c.id === b.dataset.c)); }
  });
  const bn = m.el.querySelector('[data-a="nuevo"]');
  if (bn) bn.onclick = () => { m.cerrar(); editarCliente(null, alElegir); };
  pintar();
}

// Operaciones de cuenta corriente al cobrar / anular (las usan cobro y caja)
export function opsCuenta(pagos, { ventaId, desc, signo = 1 }) {
  const t = Date.now();
  const ops = [];
  for (const p of pagos.filter((x) => x.medio === "cuenta" && x.clienteId)) {
    ops.push({ op: "update", col: "clientes", id: p.clienteId, data: { saldo: inc(signo * p.monto), ultimoMov: t } });
    ops.push({ op: "set", col: "movClientes", id: db.newId("movClientes"), data: { clienteId: p.clienteId, clienteNombre: p.clienteNombre || "", tipo: signo > 0 ? "cargo" : "anulacion", monto: signo * p.monto, ts: t, ventaId, desc, usuario: S.perfil.nombre } });
  }
  return ops;
}

