export type FirebaseConfig = {
  apiKey: string;
  projectId: string;
  googleClientId: string;
};

const FALLBACKS: FirebaseConfig = {
  apiKey: 'AIzaSyCtLJvzqp1HM9hxFjumNGbJx83l2amkbJQ',
  projectId: 'esp-32-iot-39bd2',
  googleClientId: '807423195952-aoq1ge24jrfr0ic7ral9m2r2imeh14aj.apps.googleusercontent.com',
};

export function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? FALLBACKS.apiKey,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? FALLBACKS.projectId,
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? FALLBACKS.googleClientId,
  };
}
