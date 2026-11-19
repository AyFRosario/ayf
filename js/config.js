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
  // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtkT0ZaCEglGuZ-tWUqNFU5vLcYZdWSg8",
  authDomain: "ayfrosario.firebaseapp.com",
  projectId: "ayfrosario",
  storageBucket: "ayfrosario.firebasestorage.app",
  messagingSenderId: "757276598234",
  appId: "1:757276598234:web:d4be0f3b3880b5df7b2ae3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);,
};
