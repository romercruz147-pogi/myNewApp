import Constants from 'expo-constants';

type ExpoManifestLike = {
  extra?: Record<string, unknown>;
};

function readManifestExtra(): Record<string, unknown> {
  const expoConfigExtra = (Constants.expoConfig as ExpoManifestLike | null)?.extra;
  if (expoConfigExtra) return expoConfigExtra;

  const manifest2Extra = ((Constants as any).manifest2?.extra?.expoClient as ExpoManifestLike | undefined)?.extra
    ?? ((Constants as any).manifest2?.extra as Record<string, unknown> | undefined);
  if (manifest2Extra) return manifest2Extra;

  const legacyManifestExtra = ((Constants as any).manifest as ExpoManifestLike | null)?.extra;
  if (legacyManifestExtra) return legacyManifestExtra;

  return {};
}

export function getExpoExtra(): Record<string, unknown> {
  return readManifestExtra();
}

export function getExpoExtraString(key: string): string | undefined {
  const value = getExpoExtra()[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
