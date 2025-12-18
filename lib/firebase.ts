import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let app: App | undefined;
let firestore: Firestore | undefined;
let storage: Storage | undefined;

function getApp(): App {
  if (!app) {
    if (!getApps().length) {
      app = initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      app = getApps()[0];
    }
  }
  return app;
}

function getDb(): Firestore {
  if (!firestore) {
    getApp(); // Ensure app is initialized
    firestore = getFirestore();
  }
  return firestore;
}

function getStorageInstance(): Storage {
  if (!storage) {
    getApp(); // Ensure app is initialized
    storage = getStorage();
  }
  return storage;
}

// Export a proxy that lazily initializes on first access
export const db = new Proxy({} as Firestore, {
  get(_, prop) {
    const instance = getDb();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

// Export storage bucket for file uploads
export const storageBucket = {
  get bucket() {
    return getStorageInstance().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  }
};
