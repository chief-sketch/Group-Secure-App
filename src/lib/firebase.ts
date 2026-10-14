import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable offline persistence with multiple tab manager support
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
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
