import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

WebBrowser.maybeCompleteAuthSession();

type AuthExtra = {
  googleWebClientId: string;
  googleAndroidClientId: string;
};

const authExtra = (Constants.expoConfig?.extra ?? {}) as Partial<AuthExtra>;

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
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'newmyapp' });
  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };

  const request = new AuthSession.AuthRequest({
    clientId: authExtra.googleAndroidClientId || authExtra.googleWebClientId || '',
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    extraParams: { nonce: 'nonce' },
  });

  await request.makeAuthUrlAsync(discovery);
  const response = await request.promptAsync(discovery);

  if (response.type !== 'success') throw new Error('Google sign-in cancelled');

  const idToken = response.params.id_token;
  if (!idToken) throw new Error('Google token missing');

  const credential = GoogleAuthProvider.credential(idToken);
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
