// ============================================================
//  A&F · Buscador tolerante (adaptado de Dietética Josué)
// ============================================================
// Encuentra "milanesa" aunque escriban "milaneza", "sorentinos" o
// "nioquis". Nunca corrige números (un código o "473" se busca tal cual).
import { normalizar } from "./util.js";

// Fonética rioplatense simplificada: s/z/c suenan igual, ll=y, v=b, h muda…
export function sonido(w) {
  return w
    .replace(/h/g, "")
    .replace(/qu/g, "k")
    .replace(/c([ei])/g, "s$1")
    .replace(/z/g, "s")
    .replace(/c/g, "k")
    .replace(/ll/g, "y")
    .replace(/v/g, "b")
    .replace(/g([ei])/g, "j$1")
    .replace(/x/g, "ks")
    .replace(/(.)\1+/g, "$1");
}

// Distancia Damerau-Levenshtein (transposiciones simples)
export function distancia(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

const palabras = (s) => normalizar(s).split(/[^a-z0-9]+/).filter(Boolean);

function puntaje(t, w) {
  if (w.startsWith(t)) return 4;
  if (w.includes(t)) return 3;
  if (/\d/.test(t) || t.length < 3) return 0;
  const tol = t.length >= 7 ? 2 : 1;
  if (distancia(t, w) <= tol) return 2;
  if (w.length > t.length && distancia(t, w.slice(0, t.length)) <= tol) return 2;
  const st = sonido(t), sw = sonido(w);
  if (st.length >= 3 && (sw.startsWith(st) || distancia(st, sw) <= 1)) return 1;
  return 0;
}

// lista: productos · campo: función que devuelve el texto a comparar
export function buscar(lista, q, campo = (p) => p.nombre) {
  const toks = palabras(q);
  if (!toks.length) return lista;
  const qd = String(q).trim();
  const res = [];
  for (const p of lista) {
    if (/^\d{6,}$/.test(qd) && p.codigo && String(p.codigo).includes(qd)) { res.push([100, p]); continue; }
    const ws = palabras(campo(p));
    let total = 0, ok = true;
    for (const t of toks) {
      let mejor = 0;
      for (const w of ws) { mejor = Math.max(mejor, puntaje(t, w)); if (mejor === 4) break; }
      if (!mejor) { ok = false; break; }
      total += mejor;
    }
    if (ok) res.push([total, p]);
  }
  return res.sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}
