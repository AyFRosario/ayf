// ============================================================
//  A&F · Carta pública (la que abre el cliente con el QR)
// ============================================================
// No usa el SDK de Firebase: lee un solo documento por la API REST
// de Firestore (más liviano para un celular con datos móviles).
// Guarda la última carta en el teléfono: si no hay señal, muestra esa.
import { CONFIG } from "./config.js";
import { buscar } from "./buscar.js";

const params = new URLSearchParams(location.search);
const DEMO = !CONFIG.firebase || params.has("demo");
const CACHE = "af_carta_publica";
const raiz = document.getElementById("carta");
let carta = null;
let q = "";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const precio = (n) => "$ " + nf.format(n);

async function obtener() {
  if (DEMO) {
    const d = JSON.parse(localStorage.getItem("af_demo_v1") || "null");
    const j = d?.publico?.carta?.json;
    if (!j) throw new Error("sin-publicar");
    return { carta: JSON.parse(j), ts: d.publico.carta.ts };
  }
  const f = CONFIG.firebase;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(f.projectId)}/databases/(default)/documents/negocios/${encodeURIComponent(CONFIG.negocioId)}/publico/carta?key=${encodeURIComponent(f.apiKey)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (r.status === 404) throw new Error("sin-publicar");
  if (!r.ok) throw new Error("http-" + r.status);
  const doc = await r.json();
  return { carta: JSON.parse(doc.fields.json.stringValue), ts: Number(doc.fields.ts?.integerValue) || 0 };
}

// El número ya viene normalizado desde la app (campo "wa"); el resto es por compatibilidad
function waLink(c, texto = "") {
  let d = c.wa || "";
  if (!d) {
    d = String(c.whatsapp || "").replace(/\D+/g, "").replace(/^0+/, "");
    if (!d) return "";
    if (!d.startsWith("54")) d = "549" + d;
  }
  return "https://wa.me/" + d + (texto ? "?text=" + encodeURIComponent(texto) : "");
}

const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// Reserva: arma el mensaje y abre WhatsApp. No guarda nada: la confirma el bar.
function abrirReserva() {
  const fondo = document.createElement("div");
  fondo.className = "hoja-fondo";
  fondo.innerHTML = `<form class="hoja" role="dialog" aria-modal="true" aria-label="Reservar mesa">
    <h2>Reservar mesa</h2>
    <label>Nombre<input name="nombre" required autocomplete="name"></label>
    <div class="dos"><label>Día<input name="dia" type="date" min="${hoyStr()}" value="${hoyStr()}" required></label>
      <label>Hora<input name="hora" type="time" value="21:00" required></label></div>
    <label>Personas<select name="pers">${Array.from({ length: 12 }, (_, i) => `<option ${i === 1 ? "selected" : ""}>${i + 1}</option>`).join("")}<option value="más de 12">Más de 12</option></select></label>
    <label>Comentario (opcional)<input name="nota" placeholder="Cumpleaños, silla para bebé…"></label>
    <button class="btn-wa">Enviar por WhatsApp</button>
    <button type="button" class="btn-sec" data-cerrar>Cancelar</button>
    <p class="nota">Te contestamos por WhatsApp para confirmar.</p>
  </form>`;
  document.body.appendChild(fondo);
  const cerrar = () => fondo.remove();
  fondo.addEventListener("click", (e) => { if (e.target === fondo || e.target.closest("[data-cerrar]")) cerrar(); });
  const f = fondo.querySelector("form");
  f.nombre.focus();
  f.onsubmit = (e) => {
    e.preventDefault();
    const [y, m, d] = f.dia.value.split("-").map(Number);
    const dia = new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    const txt = `¡Hola! Quiero reservar una mesa para ${f.pers.value} persona${f.pers.value === "1" ? "" : "s"} el ${dia} a las ${f.hora.value} h, a nombre de ${f.nombre.value.trim()}.${f.nota.value.trim() ? ` ${f.nota.value.trim()}.` : ""}`;
    window.open(waLink(carta, txt), "_blank", "noopener");
    cerrar();
  };
}

function render() {
  const c = carta;
  const mesa = params.get("m") ? c.mesas?.[params.get("m")] : "";
  const conDatos = c.cats.reduce((s, x) => s + x.p.length, 0);
  raiz.innerHTML = `
    <header class="cab">
      <img src="img/logo.svg" alt="${esc(c.nombre)}" class="logo">
      ${c.lema ? `<p class="lema">${esc(c.lema)}</p>` : ""}
      ${mesa ? `<p class="mesa">${esc(mesa)}</p>` : ""}
      ${!mesa && c.reservas !== false && waLink(c) ? `<p><button class="btn-reservar" id="btnRes">Reservar mesa</button></p>` : ""}
    </header>
    ${conDatos ? `
    <div class="barra">
      <input id="busq" type="search" placeholder="Buscar en la carta…" autocomplete="off" value="${esc(q)}" aria-label="Buscar en la carta">
      <nav class="cats" id="cats">${c.cats.map((x, i) => `<a href="#cat${i}" data-i="${i}">${esc(x.n)}</a>`).join("")}</nav>
    </div>
    <div id="lista"></div>` : `<p class="estado">La carta se está preparando. ¡Volvé a mirar en un rato!</p>`}
    <footer class="pie">
      ${c.direccion ? `<p>${esc(c.direccion)}</p>` : ""}
      ${c.horario ? `<p>${esc(c.horario)}</p>` : ""}
      <p class="redes">
        ${c.instagram ? `<a href="https://instagram.com/${esc(c.instagram.replace(/^@/, ""))}" target="_blank" rel="noopener">Instagram @${esc(c.instagram.replace(/^@/, ""))}</a>` : ""}
        ${waLink(c) ? `<a href="${waLink(c)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      </p>
      <p class="nota">Precios en pesos argentinos.</p>
    </footer>`;
  document.getElementById("btnRes")?.addEventListener("click", abrirReserva);
  if (!conDatos) return;
  renderLista();
  const busq = document.getElementById("busq");
  busq.addEventListener("input", () => { q = busq.value.trim(); renderLista(); });
  observarCategorias();
}

function renderLista() {
  const lista = document.getElementById("lista");
  if (!q) {
    lista.innerHTML = carta.cats.map((x, i) => `
      <section class="cat" id="cat${i}">
        <h2>${esc(x.n)}</h2>
        ${x.p.map(item).join("")}
      </section>`).join("");
    document.getElementById("cats").hidden = false;
    return;
  }
  const todos = carta.cats.flatMap((x) => x.p.map((p) => ({ ...p, nombre: p.n, cat: x.n })));
  const res = buscar(todos, q, (p) => `${p.n} ${p.d || ""} ${p.cat}`);
  document.getElementById("cats").hidden = true;
  lista.innerHTML = res.length
    ? `<section class="cat">${res.map(item).join("")}</section>`
    : `<p class="estado">No encontramos "${esc(q)}".</p>`;
}

function item(p) {
  return `<article class="item ${p.a ? "agotado" : ""}">
    <div class="item-linea"><h3>${esc(p.n)}</h3><span class="puntos"></span><span class="precio">${p.a ? "Agotado" : precio(p.p)}</span></div>
    ${p.d ? `<p class="desc">${esc(p.d)}</p>` : ""}
  </article>`;
}

// Marca en el menú de categorías la que se está viendo
let obs = null;
function observarCategorias() {
  obs?.disconnect();
  const links = [...document.querySelectorAll("#cats a")];
  obs = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      const i = e.target.id.replace("cat", "");
      links.forEach((a) => a.classList.toggle("activo", a.dataset.i === i));
      const activo = links[Number(i)];
      activo?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }, { rootMargin: "-120px 0px -70% 0px" });
  document.querySelectorAll(".cat[id]").forEach((s) => obs.observe(s));
}

async function iniciar() {
  let guardada = null;
  try { guardada = JSON.parse(localStorage.getItem(CACHE) || "null"); } catch {}
  if (guardada?.carta) { carta = guardada.carta; render(); }
  try {
    const r = await obtener();
    try { localStorage.setItem(CACHE, JSON.stringify(r)); } catch {}
    if (JSON.stringify(r.carta) !== JSON.stringify(carta)) { carta = r.carta; render(); }
  } catch (e) {
    if (carta) return; // se queda con la guardada
    raiz.innerHTML = e.message === "sin-publicar"
      ? `<p class="estado">La carta todavía no está publicada.</p>`
      : `<p class="estado">No pudimos cargar la carta. Revisá la conexión.</p><p class="estado"><button onclick="location.reload()">Reintentar</button></p>`;
  }
  document.title = `Carta · ${carta?.nombre || "A&F"}`;
}

iniciar();
