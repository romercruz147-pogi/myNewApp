import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  createUserWithEmailAndPassword,
  signInWithCredential,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export async function emailLogin(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', cred.user.uid), { lastLogin: serverTimestamp() }, { merge: true });
  return cred.user;
}

export async function emailRegister(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    name,
    email,
    provider: 'password',
    role: 'user',
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
  });
  return cred.user;
}

export async function loginWithGoogle() {
  const result = await GoogleSignin.signIn();
  const token = result.data?.idToken;
  if (!token) throw new Error('Google token missing');
  const credential = GoogleAuthProvider.credential(token);
  const cred = await signInWithCredential(auth, credential);
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email: cred.user.email,
    name: cred.user.displayName,
    provider: 'google',
    role: 'user',
    lastLogin: serverTimestamp(),
  }, { merge: true });
  return cred.user;
}

export const logout = () => signOut(auth);
