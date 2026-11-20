// ============================================================
//  A&F · Implementación con Firebase (Firestore + Auth)
// ============================================================
// Todo vive bajo negocios/{negocioId}/… para que el mismo sistema
// pueda usarse en varios bares sin mezclar datos.

const V = "10.12.0";
const BASE = `https://www.gstatic.com/firebasejs/${V}/`;

let F, A, AppMod, app, fdb, fauth, cfg, nid, onErr;

export async function init(config, reportarError) {
  cfg = config;
  nid = config.negocioId;
  onErr = reportarError;
  [AppMod, F, A] = await Promise.all([
    import(BASE + "firebase-app.js"),
    import(BASE + "firebase-firestore.js"),
    import(BASE + "firebase-auth.js"),
  ]);
  app = AppMod.initializeApp(config.firebase);
  try {
    // Caché local persistente: la app sigue funcionando sin wifi y
    // las escrituras quedan en cola hasta que vuelva la conexión.
    fdb = F.initializeFirestore(app, {
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.warn("Sin caché persistente, uso memoria", e);
    fdb = F.getFirestore(app);
  }
  fauth = A.getAuth(app);
}

function ref(col, id) {
  if (col === "_negocio") return F.doc(fdb, "negocios", nid);
  return F.doc(fdb, "negocios", nid, col, id);
}
const colRef = (col) => F.collection(fdb, "negocios", nid, col);

function conv(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v && typeof v === "object" && v.__op === "inc") out[k] = F.increment(v.n);
    else if (v && typeof v === "object" && v.__op === "del") out[k] = F.deleteField();
    else out[k] = v;
  }
  return out;
}

export function listen(col, opts, cb) {
  const onE = (e) => onErr(e, "leer " + col);
  if (opts.id) {
    return F.onSnapshot(
      ref(col, opts.id),
      { includeMetadataChanges: !!opts.meta },
      (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null, { fromCache: s.metadata.fromCache }),
      onE
    );
  }
  const cons = [];
  for (const [campo, op, valor] of opts.where || []) cons.push(F.where(campo, op, valor));
  if (opts.orderBy) cons.push(F.orderBy(opts.orderBy[0], opts.orderBy[1] || "asc"));
  if (opts.limit) cons.push(F.limit(opts.limit));
  return F.onSnapshot(
    F.query(colRef(col), ...cons),
    { includeMetadataChanges: !!opts.meta },
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })), { fromCache: s.metadata.fromCache }),
    onE
  );
}

export async function get(col, id) {
  const s = await F.getDoc(ref(col, id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export const newId = (col) => F.doc(colRef(col)).id;

export function batch(ops) {
  const b = F.writeBatch(fdb);
  for (const o of ops) {
    const r = ref(o.col, o.id);
    if (o.op === "set") b.set(r, conv(o.data));
    else if (o.op === "merge") b.set(r, conv(o.data), { merge: true });
    else if (o.op === "update") b.update(r, conv(o.data));
    else if (o.op === "delete") b.delete(r);
  }
  return b.commit().catch((e) => onErr(e, "guardar"));
}

// ── Autenticación ──
export function onUser(cb) {
  return A.onAuthStateChanged(fauth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
}
export async function login(email, pass) {
  await A.signInWithEmailAndPassword(fauth, email, pass);
}
export async function logout() {
  await A.signOut(fauth);
}
// Crea la cuenta de un empleado con una segunda instancia de Firebase,
// así el dueño no pierde su propia sesión (técnica de JPSoft Tienda).
export async function crearCuenta(email, pass) {
  const app2 = AppMod.initializeApp(cfg.firebase, "alta-" + Date.now());
  const a2 = A.initializeAuth(app2, { persistence: A.inMemoryPersistence });
  try {
    const c = await A.createUserWithEmailAndPassword(a2, email, pass);
    return c.user.uid;
  } finally {
    await A.signOut(a2).catch(() => {});
    await AppMod.deleteApp(app2).catch(() => {});
  }
}
