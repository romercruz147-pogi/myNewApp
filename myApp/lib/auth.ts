import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getFirebaseConfig } from './firebase';

export type User = { uid: string; name: string; email: string; photoURL?: string };

const FIREBASE_AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1';

function parseUrlFragment(url: string) {
  const fragment = url.split('#')[1] ?? '';
  const pairs = fragment.split('&').filter(Boolean).map((p) => p.split('='));
  return Object.fromEntries(pairs.map(([k, v]) => [decodeURIComponent(k), decodeURIComponent(v ?? '')]));
}

async function ensureUserInFirestore(user: User, idToken: string) {
  const { projectId } = getFirebaseConfig();
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${user.uid}`;

  const getRes = await fetch(`${base}?access_token=${idToken}`);
  if (getRes.status === 404) {
    const body = {
      fields: {
        name: { stringValue: user.name },
        email: { stringValue: user.email },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    };
    const createRes = await fetch(`${base}?access_token=${idToken}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!createRes.ok) throw new Error('Failed creating Firestore user profile.');
  } else if (!getRes.ok) {
    throw new Error('Failed checking Firestore user profile.');
  }
}

export async function loginWithGoogle() {
  const { apiKey, googleClientId } = getFirebaseConfig();
  const redirectUri = Linking.createURL('oauthredirect');
  const nonce = Math.random().toString(36).slice(2);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(googleClientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    '&response_type=id_token' +
    '&scope=openid%20email%20profile' +
    `&nonce=${encodeURIComponent(nonce)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !result.url) {
    return { ok: false, message: result.type === 'cancel' ? 'Google sign-in canceled.' : 'Google sign-in failed.' };
  }

  const params = parseUrlFragment(result.url);
  const idToken = params.id_token;
  if (!idToken) return { ok: false, message: 'Google did not return an ID token.' };

  const signInRes = await fetch(`${FIREBASE_AUTH_BASE}/accounts:signInWithIdp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestUri: redirectUri,
      postBody: `id_token=${idToken}&providerId=google.com`,
      returnSecureToken: true,
      returnIdpCredential: true,
    }),
  });

  const signInData = await signInRes.json();
  if (!signInRes.ok) return { ok: false, message: signInData?.error?.message ?? 'Firebase Google sign-in failed.' };

  const user: User = {
    uid: signInData.localId,
    name: signInData.displayName || 'Google User',
    email: signInData.email,
    photoURL: signInData.photoUrl,
  };

  await ensureUserInFirestore(user, signInData.idToken);
  return { ok: true, user };
}

export async function registerUser(name: string, email: string, password: string) {
  const { apiKey } = getFirebaseConfig();
  const res = await fetch(`${FIREBASE_AUTH_BASE}/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, message: data?.error?.message ?? 'Registration failed' };

  const profileRes = await fetch(`${FIREBASE_AUTH_BASE}/accounts:update?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: data.idToken, displayName: name.trim(), returnSecureToken: true }),
  });
  if (!profileRes.ok) return { ok: false, message: 'Failed to update profile.' };

  await ensureUserInFirestore({ uid: data.localId, name: name.trim(), email: email.trim().toLowerCase() }, data.idToken);
  return { ok: true };
}

export async function loginUser(email: string, password: string) {
  const { apiKey } = getFirebaseConfig();
  const res = await fetch(`${FIREBASE_AUTH_BASE}/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, message: data?.error?.message ?? 'Login failed' };

  const user = {
    uid: data.localId,
    name: data.displayName || 'User',
    email: data.email,
    photoURL: data.photoUrl,
  };
  await ensureUserInFirestore(user, data.idToken);
  return { ok: true, user };
}
