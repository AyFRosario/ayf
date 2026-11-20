// ============================================================
//  A&F · Firma del desarrollador y contactos del negocio
// ============================================================
// Igual que en Dairus Rosario y Dietética Josué: "Desarrollado por
// Joaquín Pedemonte" + WhatsApp, como enlace directo a un chat.
// La usan la app (inicio, menú, Ajustes) y la carta QR.

export const AUTOR = { nombre: "Joaquín Pedemonte", whatsapp: "+54 9 3436 61-5390", wa: "5493436615390" };

const escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const iconoContacto = (k, tam = 21) => `<img src="img/contacto-${k}.png" alt="" width="${tam}" height="${tam}" loading="lazy">`;

export function firmaHTML(clase = "") {
  return `<div class="firma ${clase}"><span>Desarrollado por ${escH(AUTOR.nombre)}</span>
    <a href="https://wa.me/${AUTOR.wa}" target="_blank" rel="noopener">${iconoContacto("whatsapp", 16)}<span>${AUTOR.whatsapp}</span></a></div>`;
}

// WhatsApp de Argentina para wa.me: 549 + área + número, sin 0 ni 15
export function waNumero(numero) {
  let d = String(numero || "").replace(/\D+/g, "").replace(/^0+/, "");
  if (!d) return "";
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.length === 12) {
    if (d.startsWith("11") && d.slice(2, 4) === "15") d = "11" + d.slice(4);
    else if (d.slice(3, 5) === "15") d = d.slice(0, 3) + d.slice(5);
    else if (d.slice(4, 6) === "15") d = d.slice(0, 4) + d.slice(6);
  }
  return d.length >= 10 ? "549" + d : "";
}

// "@ayf.rosario", "ayf.rosario" o el enlace completo → "ayf.rosario"
export const usuarioRed = (v) => String(v || "").trim().replace(/^@/, "").replace(/^.*\/([^/?#]+)\/?(?:[?#].*)?$/, "$1");
export const urlInstagram = (v) => (usuarioRed(v) ? `https://www.instagram.com/${encodeURIComponent(usuarioRed(v))}/` : "");
export const urlFacebook = (v) => {
  const s = String(v || "").trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (!usuarioRed(s)) return "";
  // Un nombre con espacios no es un usuario de Facebook: se busca la página
  return /\s/.test(usuarioRed(s)) ? `https://www.facebook.com/search/top?q=${encodeURIComponent(s.replace(/^@/, ""))}` : `https://www.facebook.com/${encodeURIComponent(usuarioRed(s))}`;
};
export const urlMapa = (direccion, mapa) => (/^https?:\/\//i.test(String(mapa || "").trim()) ? String(mapa).trim()
  : direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(/rosario/i.test(direccion) ? direccion : `${direccion}, Rosario, Santa Fe`)}` : "");

// Renglones de contacto (cada uno es un enlace directo), como en la carta de Dairus
export function contactoHTML(c) {
  const fila = (href, k, txt) => (href ? `<a href="${escH(href)}" target="_blank" rel="noopener">${iconoContacto(k)}<span>${escH(txt)}</span></a>` : "");
  const wa = waNumero(c.whatsapp);
  const ig = usuarioRed(c.instagram);
  const fb = String(c.facebook || "").trim();
  const filas = [
    wa ? fila(`https://wa.me/${wa}`, "whatsapp", `WhatsApp ${c.whatsapp}`) : "",
    ig ? fila(urlInstagram(ig), "instagram", `Instagram @${ig}`) : "",
    fb ? fila(urlFacebook(fb), "facebook", `Facebook ${/^https?:/i.test(fb) ? usuarioRed(fb) : fb.replace(/^@/, "")}`) : "",
    c.direccion ? fila(urlMapa(c.direccion, c.mapa), "mapa", c.direccion) : "",
  ].join("");
  return filas ? `<div class="contacto">${filas}</div>` : "";
}
