import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { errorMessage } from '@/lib/api';
import { useUpload } from '@/lib/queries';

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface PickedImage {
  base64: string;
  mimeType: ImageMime;
  /** Local preview URI (file:, blob: or data:). */
  uri: string;
}

function normaliseMime(mime: string | null | undefined, uri: string): ImageMime {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/png' || /\.png($|\?)/i.test(uri)) return 'image/png';
  if (m === 'image/webp' || /\.webp($|\?)/i.test(uri)) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Opens the photo library and returns the chosen image as base64 (quality ~0.5 to keep uploads
 * small). Resolves `null` when the user cancels. Works on native and web (file chooser).
 */
export async function pickImage(options: { square?: boolean } = {}): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true,
    quality: 0.5,
    allowsEditing: Boolean(options.square),
    aspect: options.square ? [1, 1] : undefined,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0]!;
  let base64 = asset.base64 ?? null;
  let mime = asset.mimeType ?? null;
  const dataUri = /^data:([^;]+);base64,(.*)$/.exec(asset.uri);
  if (dataUri) {
    mime ??= dataUri[1] ?? null;
    base64 ??= dataUri[2] ?? null;
  }
  if (!base64) throw new Error("Couldn't read that photo. Try another one.");
  return { base64, mimeType: normaliseMime(mime, asset.uri), uri: asset.uri };
}

/**
 * Pick a photo and upload it (`POST /uploads`). `pickAndUpload()` resolves to the stored path
 * (render with `assetUrl`) or `null` if cancelled; failures land in `error`.
 */
export function usePhotoUpload() {
  const upload = useUpload();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndUpload = async (options?: { square?: boolean }): Promise<string | null> => {
    setError(null);
    try {
      const picked = await pickImage(options);
      if (!picked) return null;
      setBusy(true);
      const { url } = await upload.mutateAsync({
        base64: picked.base64,
        mimeType: picked.mimeType,
      });
      return url;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { pickAndUpload, busy, error, clearError: () => setError(null) };
}
