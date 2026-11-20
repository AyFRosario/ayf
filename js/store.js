// ============================================================
//  A&F · Estado compartido, roles y datos del dispositivo
// ============================================================
import { db } from "./db.js";

export const CONFIG_DEF = {
  nombre: "A&F",
  lema: "Comé como en casa",
  pieTicket: "¡Gracias por venir!",
  mozoCobra: false,
  medios: ["efectivo", "mp", "debito", "credito", "transferencia"],
  direccion: "",
  horario: "",
  instagram: "",
  whatsapp: "",
};

export const S = {
  user: null,      // { uid, email }
  perfil: null,    // documento usuarios/{uid}
  rol: null,
  config: { ...CONFIG_DEF },
  mesas: [],
  productos: [],
  comandas: [],    // abiertas o con cuenta pedida
  items: [],       // ítems de comandas sin cobrar (cerrado == false)
  jornada: null,   // caja abierta
  usuarios: [],
  cargados: new Set(), // colecciones que ya respondió el servidor
};

const subs = new Set();
export const onStore = (fn) => (subs.add(fn), () => subs.delete(fn));
export function emit(clave) {
  subs.forEach((fn) => { try { fn(clave); } catch (e) { console.error(e); } });
}

export const ROLES = { dueno: "Dueño", encargado: "Encargado", mozo: "Mozo", cocina: "Cocina" };
export const MEDIOS = { efectivo: "Efectivo", mp: "Mercado Pago", debito: "Débito", credito: "Crédito", transferencia: "Transferencia" };
export const SECTORES = { cocina: "Cocina", barra: "Barra", ninguno: "Lo sirve el mozo" };
export const ESTADOS_ITEM = { nuevo: "Sin enviar", pendiente: "Pendiente", preparando: "En preparación", listo: "Listo", entregado: "Entregado", anulado: "Anulado" };

const PERMISOS = {
  dueno: ["salon", "mesa", "cocina", "caja", "reportes", "productos", "usuarios", "ajustes", "ajustesNegocio", "anular"],
  encargado: ["salon", "mesa", "cocina", "caja", "reportes", "productos", "ajustes", "ajustesNegocio", "anular"],
  mozo: ["salon", "mesa", "ajustes"],
  cocina: ["cocina", "ajustes"],
};
export function puede(accion) {
  if (accion === "cobrar") return ["dueno", "encargado"].includes(S.rol) || (S.rol === "mozo" && !!S.config.mozoCobra);
  return (PERMISOS[S.rol] || []).includes(accion);
}

// ── Derivados ──
export const itemsDe = (cid) => S.items.filter((i) => i.comandaId === cid);
export const vigentes = (its) => its.filter((i) => i.estado !== "anulado");
export const totalItems = (its) => vigentes(its).reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cant) || 0), 0);
// Junta renglones iguales (mismo producto y precio) para tickets y cobro
export function agrupar(its) {
  const m = new Map();
  for (const i of its) {
    const k = `${i.productoId}|${i.precio}|${i.desc}`;
    if (m.has(k)) m.get(k).cant += Number(i.cant) || 0;
    else m.set(k, { productoId: i.productoId, desc: i.desc, precio: Number(i.precio) || 0, cant: Number(i.cant) || 0 });
  }
  return [...m.values()];
}
export const comandaDeMesa = (m) => (m?.comandaId ? S.comandas.find((c) => c.id === m.comandaId) || null : null);

// UPC-A (12 dígitos) y EAN-13 con 0 adelante son el mismo producto
export function productoPorCodigo(codigo) {
  const c = String(codigo || "").trim();
  if (!c) return null;
  const variantes = [c];
  if (c.length === 12) variantes.push("0" + c);
  if (c.length === 13 && c[0] === "0") variantes.push(c.slice(1));
  return S.productos.find((p) => p.codigo && variantes.includes(String(p.codigo).trim())) || null;
}

export function categorias() {
  const orden = new Map();
  for (const p of S.productos) {
    const c = p.categoria || "Otros";
    const o = Number(p.orden) || 0;
    if (!orden.has(c) || o < orden.get(c)) orden.set(c, o);
  }
  return [...orden.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map((x) => x[0]);
}

export function sectoresMesas() {
  const out = [];
  for (const m of S.mesas) if (!out.includes(m.sector || "Salón")) out.push(m.sector || "Salón");
  return out;
}

// ── Este dispositivo (se guarda en el navegador, no en la nube) ──
const DISP_KEY = "af_dispositivo";
const DISP_DEF = {
  codigo: "",
  impresora: { modo: "sistema", ancho: 80, cortar: true, sinAcentos: false, alEnviar: false, btNombre: "" },
  cocina: { sector: "cocina", auto: false, sonido: true },
};
export function dispositivo() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DISP_KEY)); } catch {}
  d = {
    ...DISP_DEF, ...(d || {}),
    impresora: { ...DISP_DEF.impresora, ...(d?.impresora || {}) },
    cocina: { ...DISP_DEF.cocina, ...(d?.cocina || {}) },
  };
  if (!d.codigo) {
    d.codigo = "C" + Math.floor(10 + Math.random() * 89);
    try { localStorage.setItem(DISP_KEY, JSON.stringify(d)); } catch {}
  }
  return d;
}
export function guardarDispositivo(cambios) {
  const d = dispositivo();
  const n = {
    ...d, ...cambios,
    impresora: { ...d.impresora, ...(cambios.impresora || {}) },
    cocina: { ...d.cocina, ...(cambios.cocina || {}) },
  };
  try { localStorage.setItem(DISP_KEY, JSON.stringify(n)); } catch {}
  return n;
}

// Nº de venta: código del dispositivo + correlativo por jornada.
// Nunca choca entre dispositivos y funciona sin conexión.
export function nroVenta(jornadaId) {
  const k = "af_seq_" + jornadaId;
  let n = 0;
  try { n = parseInt(localStorage.getItem(k), 10) || 0; } catch {}
  n += 1;
  try { localStorage.setItem(k, String(n)); } catch {}
  return `${dispositivo().codigo}-${String(n).padStart(4, "0")}`;
}

// ── Registro de actividad ──
export function log(tipo, desc, extra = {}) {
  db.add("logs", { tipo, desc, ...extra, ts: Date.now(), uid: S.user?.uid || "", usuario: S.perfil?.nombre || "" });
}
