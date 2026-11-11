import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Validate config presence
const missingKeys: string[] = [];
if (!firebaseConfig.apiKey) missingKeys.push('apiKey');
if (!firebaseConfig.projectId) missingKeys.push('projectId');
if (!firebaseConfig.authDomain) missingKeys.push('authDomain');

export const firebaseConfigError =
  missingKeys.length > 0 ? `Missing required Firebase configuration: ${missingKeys.join(', ')}` : null;

if (firebaseConfigError) {
  console.error(firebaseConfigError);
}

// Clean up any stale multi-tab manager entries left in localStorage from previous sessions
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (
        key &&
        (key.startsWith('firestore_clients_') ||
          key.startsWith('firestore_zombied_') ||
          key.startsWith('firestore_mutations_') ||
          key.startsWith('firestore_'))
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (_) {
    // Ignore storage quota or access errors in restricted iframe environments
  }
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with memoryLocalCache to eliminate localStorage quota failures
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache(),
    },
    firebaseConfig.firestoreDatabaseId || '(default)'
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
}

export const db = firestoreDb;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, firebaseConfig };
