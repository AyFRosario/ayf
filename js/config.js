// ============================================================
//  A&F · Configuración
// ============================================================
// Si `firebase` queda en null, la app arranca en MODO DEMO:
// los datos se guardan solo en este navegador.
//
// Aunque haya configuración, abriendo la app con ?demo en la
// dirección se fuerza el modo demo.
//
// No agregar acá ningún `import` ni `initializeApp`: de eso se
// encarga js/db-firebase.js.

export const CONFIG = {
  version: "0.1.0",
  negocioId: "af",                       // id del negocio en Firestore (negocios/af)
  arcaUrl: "https://www.arca.gob.ar/",   // botón "Facturar en ARCA"
  firebase: {
    apiKey: "AIzaSyCtkT0ZaCEglGuZ-tWUqNFU5vLcYZdWSg8",
    authDomain: "ayfrosario.firebaseapp.com",
    projectId: "ayfrosario",
    storageBucket: "ayfrosario.firebasestorage.app",
    messagingSenderId: "757276598234",
    appId: "1:757276598234:web:d4be0f3b3880b5df7b2ae3"
  },
};
