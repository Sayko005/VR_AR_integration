// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, // ...appspot.com
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Логи для отладки (видно в консоли при старте)
if (import.meta.env.DEV) {
  console.log("VITE env snapshot:", {
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  });
}

export const envOk = Boolean(firebaseConfig?.projectId);

let appInit = null;
let dbInit = null;

try {
  if (!envOk) {
    console.error("ENV variables are missing:", firebaseConfig);
  } else {
    appInit = initializeApp(firebaseConfig);
    dbInit = getFirestore(appInit);
  }
} catch (e) {
  console.error("Firebase init error:", e);
}

export const app = appInit;
export const db = dbInit;

// Удобно смотреть конфиг из консоли:
if (import.meta.env.DEV) {
  window.__FIREBASE_CFG__ = firebaseConfig;
}
