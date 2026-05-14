import { getExpoExtraString } from './expoExtra';

const requiredKeys = [
  'firebaseApiKey',
  'firebaseAuthDomain',
  'firebaseProjectId',
  'firebaseStorageBucket',
  'firebaseMessagingSenderId',
  'firebaseAppId',
] as const;

export function getMissingRuntimeKeys() {
  return requiredKeys.filter((key) => !getExpoExtraString(key));
}
