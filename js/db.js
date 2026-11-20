// ============================================================
//  A&F · Capa de datos
// ============================================================
// Toda la app habla con esta capa, nunca con Firebase directo.
// Así el mismo código funciona en modo demo (localStorage) y con
// Firestore real.
//
// Reglas de la casa:
//  · Las escrituras NO se esperan (no usar await): Firestore las
//    encola si no hay conexión y la pantalla sigue respondiendo.
//  · Toda cantidad que cambia (stock, totales) se escribe con inc(),
//    nunca como un número calculado en el dispositivo. Así dos
//    celulares que venden a la vez no se pisan.

import { CONFIG } from "./config.js";

const params = new URLSearchParams(location.search);
export const MODO = !CONFIG.firebase || params.has("demo") ? "demo" : "firebase";

export const inc = (n) => ({ __op: "inc", n: Number(n) || 0 });
export const borrarCampo = () => ({ __op: "del" });

let impl = null;
const manejadores = [];
export const onError = (fn) => manejadores.push(fn);
export function reportarError(e, ctx) {
  console.error("[A&F]", ctx, e);
  manejadores.forEach((f) => { try { f(e, ctx); } catch {} });
}

export async function initDB() {
  impl = MODO === "demo" ? await import("./db-demo.js") : await import("./db-firebase.js");
  await impl.init(CONFIG, reportarError);
}

export const db = {
  // opts: { id } para un documento · { where:[[campo,op,valor]], orderBy:[campo,'asc'|'desc'], limit, meta }
  listen: (col, opts, cb) => impl.listen(col, opts || {}, cb),
  get: (col, id) => impl.get(col, id),
  // Lectura de una sola vez (reportes): mismas opciones que listen, sin quedar escuchando
  query: (col, opts) => impl.query(col, opts || {}),
  newId: (col) => impl.newId(col),
  add(col, data) {
    const id = impl.newId(col);
    impl.batch([{ op: "set", col, id, data }]);
    return id;
  },
  set: (col, id, data) => impl.batch([{ op: "set", col, id, data }]),
  merge: (col, id, data) => impl.batch([{ op: "merge", col, id, data }]),
  update: (col, id, data) => impl.batch([{ op: "update", col, id, data }]),
  remove: (col, id) => impl.batch([{ op: "delete", col, id }]),
  // Varias escrituras que se aplican juntas o no se aplica ninguna.
  batch: (ops) => impl.batch(ops),
};

export const auth = {
  onUser: (cb) => impl.onUser(cb),
  login: (a, b) => impl.login(a, b),
  logout: () => impl.logout(),
  crearCuenta: (email, pass) => impl.crearCuenta(email, pass),
  demoUsuarios: () => impl.demoUsuarios?.() || [],
  demoReset: () => impl.reset?.(),
};
