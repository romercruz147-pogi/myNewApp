import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getExpoExtraString } from './expoExtra';

const firebaseConfig = {
  apiKey: getExpoExtraString('firebaseApiKey'),
  authDomain: getExpoExtraString('firebaseAuthDomain'),
  projectId: getExpoExtraString('firebaseProjectId'),
  storageBucket: getExpoExtraString('firebaseStorageBucket'),
  messagingSenderId: getExpoExtraString('firebaseMessagingSenderId'),
  appId: getExpoExtraString('firebaseAppId'),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
