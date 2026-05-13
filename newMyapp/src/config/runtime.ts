import Constants from 'expo-constants';

const requiredKeys = [
  'firebaseApiKey',
  'firebaseAuthDomain',
  'firebaseProjectId',
  'firebaseStorageBucket',
  'firebaseMessagingSenderId',
  'firebaseAppId',
] as const;

export function getMissingRuntimeKeys() {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return requiredKeys.filter((key) => !extra[key]);
}
