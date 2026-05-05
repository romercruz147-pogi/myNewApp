import { Platform } from 'react-native';
import { getFirebaseConfig } from './firebase';

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (options: Record<string, unknown>) => void;
      prompt: () => void;
      renderButton?: (...args: unknown[]) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

export type User = { uid: string; name: string; email: string; photoURL?: string };
const FIREBASE_AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1';

async function loadGoogleIdentityScript() {
  if (Platform.OS !== 'web') throw new Error('Google Sign-In currently supported on web in this build.');
  if (window.google?.accounts?.id) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity="1"]');
    if (existing) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity script.'));
    document.head.appendChild(script);
  });
}

async function requestGoogleIdToken(clientId: string) {
  await loadGoogleIdentityScript();
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Google sign-in timed out.')), 30000);
    window.google?.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential?: string }) => {
        clearTimeout(timeout);
        if (!response?.credential) return reject(new Error('Google did not return credential token.'));
        resolve(response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google?.accounts.id.prompt();
  });
}

async function ensureUserInFirestore(user: User, idToken: string) {
  const { projectId } = getFirebaseConfig();
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${user.uid}`;
  const getRes = await fetch(`${base}?access_token=${idToken}`);
  if (getRes.status === 404) {
    const createRes = await fetch(`${base}?access_token=${idToken}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { name: { stringValue: user.name }, email: { stringValue: user.email }, createdAt: { timestampValue: new Date().toISOString() } } }),
    });
    if (!createRes.ok) throw new Error('Failed creating Firestore user profile.');
  } else if (!getRes.ok) throw new Error('Failed checking Firestore user profile.');
}

export async function loginWithGoogle() {
  try {
    const { apiKey, googleClientId, projectId } = getFirebaseConfig();
    const googleIdToken = await requestGoogleIdToken(googleClientId);

    const signInRes = await fetch(`${FIREBASE_AUTH_BASE}/accounts:signInWithIdp?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri: `https://${projectId}.firebaseapp.com/__/auth/handler`,
        postBody: `id_token=${googleIdToken}&providerId=google.com`,
        returnSecureToken: true,
        returnIdpCredential: true,
      }),
    });
    const signInData = await signInRes.json();
    if (!signInRes.ok) return { ok: false, message: signInData?.error?.message ?? 'Firebase Google sign-in failed.' };

    const user: User = { uid: signInData.localId, name: signInData.displayName || 'Google User', email: signInData.email, photoURL: signInData.photoUrl };
    await ensureUserInFirestore(user, signInData.idToken);
    return { ok: true, user };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Google login failed.' };
  }
}

export async function registerUser(name: string, email: string, password: string) { /* unchanged */
  const { apiKey } = getFirebaseConfig();
  const res = await fetch(`${FIREBASE_AUTH_BASE}/accounts:signUp?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }) });
  const data = await res.json();
  if (!res.ok) return { ok: false, message: data?.error?.message ?? 'Registration failed' };
  const profileRes = await fetch(`${FIREBASE_AUTH_BASE}/accounts:update?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: data.idToken, displayName: name.trim(), returnSecureToken: true }) });
  if (!profileRes.ok) return { ok: false, message: 'Failed to update profile.' };
  await ensureUserInFirestore({ uid: data.localId, name: name.trim(), email: email.trim().toLowerCase() }, data.idToken);
  return { ok: true };
}

export async function loginUser(email: string, password: string) {
  const { apiKey } = getFirebaseConfig();
  const res = await fetch(`${FIREBASE_AUTH_BASE}/accounts:signInWithPassword?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }) });
  const data = await res.json();
  if (!res.ok) return { ok: false, message: data?.error?.message ?? 'Login failed' };
  const user = { uid: data.localId, name: data.displayName || 'User', email: data.email, photoURL: data.photoUrl };
  await ensureUserInFirestore(user, data.idToken);
  return { ok: true, user };
}
