import { getFirebaseConfig } from './firebase';

export type User = { uid: string; name: string; email: string; photoURL?: string };

const FIREBASE_AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1';

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
  return { ok: false, message: 'Google Sign-In requires expo-auth-session package, which is blocked in this environment.' };
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
