import { Platform } from 'react-native';
import {
  GoogleAuthProvider,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { Timestamp, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';

export type User = { uid: string; name: string; email: string; photoURL?: string };
export type UserProfile = { name: string; email: string; createdAt?: Timestamp };

type NativeGoogleSignin = {
  configure: (options: { webClientId: string; offlineAccess?: boolean }) => void;
  hasPlayServices: () => Promise<void>;
  signIn: () => Promise<{ data?: { idToken?: string | null } }>;
  signOut: () => Promise<void>;
};

async function getNativeGoogleSignin(): Promise<NativeGoogleSignin | null> {
  if (Platform.OS === 'web') return null;
  try {
    const req = eval('require');
    const module = req('@react-native-google-signin/google-signin');
    return module.GoogleSignin as NativeGoogleSignin;
  } catch {
    return null;
  }
}

function mapUser(user: FirebaseUser): User {
  return {
    uid: user.uid,
    name: user.displayName || 'Google User',
    email: user.email || '',
    photoURL: user.photoURL || undefined,
  };
}

export async function ensureUserInFirestore(user: UserProfile & { uid: string }) {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, {
      name: user.name,
      email: user.email,
      createdAt: serverTimestamp(),
    });
  }
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

export async function registerWithEmail(name: string, email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', result.user.uid), {
    name,
    email,
    createdAt: serverTimestamp(),
  });
  return { user: mapUser(result.user) };
}

export async function loginWithEmail(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(result.user.uid);
  return {
    user: mapUser(result.user),
    profile,
  };
}

export async function loginWithGoogle() {
  try {
    if (Platform.OS === 'web') {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = mapUser(result.user);
      await ensureUserInFirestore({ ...user, name: user.name || 'Google User' });
      return { ok: true as const, user };
    }

    const GoogleSignin = await getNativeGoogleSignin();
    if (!GoogleSignin) {
      return {
        ok: false as const,
        message:
          'Google Sign-In native module is missing. Install @react-native-google-signin/google-signin and rebuild the app (Expo dev build) to use Google login on Android/iOS.',
      };
    }

    GoogleSignin.configure({ webClientId: firebaseConfig.webClientId, offlineAccess: false });
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;
    if (!idToken) return { ok: false as const, message: 'Google sign-in did not return an ID token.' };

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    const user = mapUser(result.user);
    await ensureUserInFirestore({ ...user, name: user.name || 'Google User' });
    return { ok: true as const, user };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Google login failed.' };
  }
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, (firebaseUser) => callback(firebaseUser ? mapUser(firebaseUser) : null));
}

export async function logoutUser() {
  const GoogleSignin = await getNativeGoogleSignin();
  if (GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch {}
  }
  await signOut(auth);
}
