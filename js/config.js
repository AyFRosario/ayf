// ============================================================
//  A&F · Configuración
// ============================================================
// Si `firebase` queda en null, la app arranca en MODO DEMO:
// los datos se guardan solo en este navegador (sirve para probar
// y para mostrarle el sistema al bar antes de conectarlo).
//
// Para usar datos reales, pegá acá la configuración web de tu
// proyecto de Firebase (Consola → Configuración del proyecto →
// Tus apps → SDK). Ver LEEME.md.
//
// Aunque haya configuración, abriendo la app con ?demo en la
// dirección se fuerza el modo demo.

export const CONFIG = {
  version: "0.1.0",
  negocioId: "af",                       // id del negocio en Firestore (negocios/af)
  arcaUrl: "https://www.arca.gob.ar/",   // botón "Facturar en ARCA"
  firebase: null,
  // firebase: {
  //   apiKey: "…",
  //   authDomain: "…firebaseapp.com",
  //   projectId: "…",
  //   storageBucket: "…appspot.com",
  //   messagingSenderId: "…",
  //   appId: "…"
  // },
};
