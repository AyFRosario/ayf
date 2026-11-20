// ============================================================
//  A&F · Modo demo (sin Firebase)
// ============================================================
// Guarda todo en localStorage de este navegador. Varias pestañas
// abiertas se sincronizan entre sí (por ejemplo: una pestaña como
// mozo y otra como cocina), así se puede probar el circuito completo.

const KEY = "af_demo_v1";
let data = null;
const subs = new Set();

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
const esObj = (v) => v && typeof v === "object" && !Array.isArray(v) && !v.__op;

function cargar() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn("demo: no se pudo guardar", e); }
}

export async function init() {
  data = cargar() || semilla();
  guardar();
  // Otras pestañas cambiaron datos → recargar y avisar
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    if (e.newValue === null) { location.reload(); return; }
    data = cargar() || data;
    notificar();
  });
}

export function reset() {
  localStorage.removeItem(KEY);
  Object.keys(localStorage).filter((k) => k.startsWith("af_seq_")).forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem("af_demo_uid");
  location.reload();
}

// ── Consultas ──
const valor = (d, campo) => campo.split(".").reduce((o, k) => (o == null ? undefined : o[k]), d);
function cumple(v, op, x) {
  switch (op) {
    case "==": return v === x;
    case "!=": return v !== undefined && v !== x;
    case "in": return x.includes(v);
    case "not-in": return v !== undefined && !x.includes(v);
    case "array-contains": return Array.isArray(v) && v.includes(x);
    case "<": return v < x;
    case "<=": return v <= x;
    case ">": return v > x;
    case ">=": return v >= x;
    default: return false;
  }
}
function correr({ col, opts }) {
  if (opts.id) {
    const d = data[col]?.[opts.id];
    return d ? { id: opts.id, ...clone(d) } : null;
  }
  let arr = Object.entries(data[col] || {}).map(([id, d]) => ({ id, ...clone(d) }));
  for (const [campo, op, x] of opts.where || []) arr = arr.filter((d) => cumple(valor(d, campo), op, x));
  if (opts.orderBy) {
    const [campo, dir] = opts.orderBy;
    const s = dir === "desc" ? -1 : 1;
    arr.sort((a, b) => {
      const va = valor(a, campo), vb = valor(b, campo);
      return (va > vb ? 1 : va < vb ? -1 : 0) * s;
    });
  }
  if (opts.limit) arr = arr.slice(0, opts.limit);
  return arr;
}
function notificar(cols) {
  for (const s of subs) {
    if (cols && !cols.includes(s.col)) continue;
    const r = correr(s);
    const j = JSON.stringify(r);
    if (j === s.ultimo) continue;
    s.ultimo = j;
    setTimeout(() => s.activo && s.cb(r, { fromCache: false }), 0);
  }
}

export function listen(col, opts, cb) {
  const s = { col, opts, cb, activo: true, ultimo: null };
  subs.add(s);
  const r = correr(s);
  s.ultimo = JSON.stringify(r);
  setTimeout(() => s.activo && cb(r, { fromCache: false }), 0);
  return () => { s.activo = false; subs.delete(s); };
}

export async function query(col, opts) {
  return correr({ col, opts });
}

export async function get(col, id) {
  return correr({ col, opts: { id } });
}

export const newId = () => rid();

function aplicar(doc, vals, { profundo = false, puntos = false } = {}) {
  const out = clone(doc) || {};
  for (const [k, v] of Object.entries(vals || {})) {
    const claves = puntos ? k.split(".") : [k];
    let t = out;
    for (let i = 0; i < claves.length - 1; i++) {
      if (!esObj(t[claves[i]])) t[claves[i]] = {};
      t = t[claves[i]];
    }
    const ult = claves[claves.length - 1];
    if (v && v.__op === "inc") t[ult] = (Number(t[ult]) || 0) + v.n;
    else if (v && v.__op === "del") delete t[ult];
    else if (profundo && esObj(v) && esObj(t[ult])) t[ult] = aplicar(t[ult], v, { profundo: true });
    else t[ult] = clone(v);
  }
  return out;
}

export function batch(ops) {
  const cols = new Set();
  for (const o of ops) {
    const c = (data[o.col] ||= {});
    if (o.op === "set") c[o.id] = aplicar({}, o.data);
    else if (o.op === "merge") c[o.id] = aplicar(c[o.id] || {}, o.data, { profundo: true });
    else if (o.op === "update") {
      if (!c[o.id]) { console.warn("demo: update sobre documento inexistente", o.col, o.id); continue; }
      c[o.id] = aplicar(c[o.id], o.data, { puntos: true });
    } else if (o.op === "delete") delete c[o.id];
    cols.add(o.col);
  }
  guardar();
  notificar([...cols]);
  return Promise.resolve();
}

// ── Usuarios de prueba ──
let userCb = null;
export function demoUsuarios() {
  return Object.entries(data.usuarios || {})
    .map(([id, u]) => ({ id, ...u }))
    .filter((u) => u.activo !== false);
}
export function onUser(cb) {
  userCb = cb;
  const uid = sessionStorage.getItem("af_demo_uid");
  setTimeout(() => cb(uid && data.usuarios?.[uid] ? { uid, email: data.usuarios[uid].email || "" } : null), 0);
  return () => {};
}
export async function login(uid) {
  sessionStorage.setItem("af_demo_uid", uid);
  userCb?.({ uid, email: data.usuarios?.[uid]?.email || "" });
}
export async function logout() {
  sessionStorage.removeItem("af_demo_uid");
  userCb?.(null);
}
export async function crearCuenta() {
  return "u_" + rid();
}

// ── Datos iniciales del demo ──
function ean13(base12) {
  const d = base12.split("").map(Number);
  const s = d.reduce((acc, n, i) => acc + n * (i % 2 ? 3 : 1), 0);
  return base12 + ((10 - (s % 10)) % 10);
}

function semilla() {
  const ahora = Date.now();
  const d = {
    _negocio: { af: { nombre: "A&F", owner: "u_dueno", creado: ahora } },
    config: {
      general: {
        nombre: "A&F",
        lema: "Comé como en casa",
        pieTicket: "¡Gracias por venir!",
        direccion: "San Martín 2920",
        whatsapp: "341 281-5624",
        mozoCobra: false,
        medios: ["efectivo", "mp", "debito", "credito", "transferencia"],
      },
    },
    usuarios: {
      u_dueno: { nombre: "Dueño", email: "dueno@demo", rol: "dueno", activo: true },
      u_laura: { nombre: "Laura", email: "laura@demo", rol: "encargado", activo: true },
      u_juan: { nombre: "Juan", email: "juan@demo", rol: "mozo", activo: true },
      u_sofi: { nombre: "Sofi", email: "sofi@demo", rol: "mozo", activo: true },
      u_cocina: { nombre: "Cocina", email: "cocina@demo", rol: "cocina", activo: true },
    },
    mesas: {},
    productos: {},
  };

  const mesas = [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ nombre: `Mesa ${n}`, sector: "Salón", capacidad: n <= 2 ? 2 : 4 })),
    ...[9, 10, 11, 12].map((n) => ({ nombre: `Mesa ${n}`, sector: "Vereda", capacidad: 4 })),
    ...[1, 2, 3].map((n) => ({ nombre: `Barra ${n}`, sector: "Barra", capacidad: 1 })),
  ];
  mesas.forEach((m, i) => (d.mesas["m" + String(i + 1).padStart(2, "0")] = { ...m, orden: i + 1, comandaId: null }));

  // [nombre, categoría, precio, sector, códigoBase|null, stock|null]
  const P = [
    ["Pinta rubia", "Cervezas", 5500, "barra"],
    ["Pinta roja", "Cervezas", 5800, "barra"],
    ["Pinta IPA", "Cervezas", 6200, "barra"],
    ["Lata cerveza rubia 473", "Cervezas", 4200, "ninguno", "779000100001", 48],
    ["Porrón 1 L", "Cervezas", 7500, "ninguno", "779000100002", 18],
    ["Fernet con cola", "Tragos", 6500, "barra"],
    ["Gin tonic", "Tragos", 7500, "barra"],
    ["Aperol spritz", "Tragos", 7800, "barra"],
    ["Campari con naranja", "Tragos", 6000, "barra"],
    ["Gaseosa 500 ml", "Sin alcohol", 2800, "ninguno", "779000200001", 36],
    ["Agua sin gas 500 ml", "Sin alcohol", 2200, "ninguno", "779000200002", 30],
    ["Agua con gas 500 ml", "Sin alcohol", 2200, "ninguno", "779000200003", 24],
    ["Limonada", "Sin alcohol", 4200, "barra"],
    ["Café", "Cafetería", 2800, "barra"],
    ["Cortado", "Cafetería", 3000, "barra"],
    ["Café con leche", "Cafetería", 3500, "barra"],
    ["Medialunas x3", "Cafetería", 3600, "barra"],
    ["Papas fritas", "Entradas", 6500, "cocina"],
    ["Papas cheddar y panceta", "Entradas", 8900, "cocina"],
    ["Rabas", "Entradas", 12500, "cocina"],
    ["Provoleta", "Entradas", 9800, "cocina"],
    ["Tabla de fiambres", "Entradas", 15000, "cocina"],
    ["Sorrentinos de jamón y queso", "Pastas", 13500, "cocina"],
    ["Ñoquis de papa", "Pastas", 11500, "cocina"],
    ["Tallarines caseros", "Pastas", 11000, "cocina"],
    ["Lasaña", "Pastas", 14000, "cocina"],
    ["Milanesa napolitana con papas", "Minutas", 15500, "cocina"],
    ["Hamburguesa A&F", "Minutas", 13900, "cocina"],
    ["Lomito completo", "Minutas", 16500, "cocina"],
    ["Pizza muzzarella", "Minutas", 12000, "cocina"],
    ["Flan con dulce de leche", "Postres", 5500, "cocina"],
    ["Tiramisú", "Postres", 6500, "cocina"],
    ["Helado 2 bochas", "Postres", 4800, "cocina"],
  ];
  P.forEach(([nombre, categoria, precio, sector, cod, stock], i) => {
    d.productos["p" + String(i + 1).padStart(3, "0")] = {
      nombre, categoria, precio, sector,
      codigo: cod ? ean13(cod) : "",
      controlStock: stock != null,
      stock: stock ?? 0,
      stockMin: stock != null ? 6 : 0,
      activo: true,
      orden: i + 1,
    };
  });
  return d;
}
