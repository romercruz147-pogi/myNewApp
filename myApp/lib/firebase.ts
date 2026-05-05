export type FirebaseConfig = {
  apiKey: string;
  projectId: string;
  googleClientId: string;
};

const required = ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID'] as const;

export function getFirebaseConfig(): FirebaseConfig {
  const [apiKey, projectId, googleClientId] = required.map((k) => process.env[k] ?? '');
  if (!apiKey || !projectId || !googleClientId) {
    throw new Error('Firebase env vars missing. Set EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_GOOGLE_CLIENT_ID');
  }
  return { apiKey, projectId, googleClientId };
}
