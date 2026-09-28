const MAX_EDGE = 2400;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  ext: 'jpg' | 'png' | 'webp';
}

/**
 * Reads an image file, corrects its orientation, and scales it down so the
 * longest edge is at most 2400px. Everything is saved as a high-quality JPEG
 * (PNGs with transparency keep PNG).
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error(`${file.name}: use a JPG, PNG or WebP file.`);
  }
  if (file.size > 40 * 1024 * 1024) {
    throw new Error(`${file.name}: this file is over 40 MB.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name}: this image couldn't be read. Try exporting it as a JPG.`);
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  ctx.imageSmoothingQuality = 'high';

  const keepPng = file.type === 'image/png';
  if (!keepPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const type = keepPng ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.9));
  if (!blob) throw new Error('Your browser could not process this image.');

  return { blob, width, height, ext: keepPng ? 'png' : 'jpg' };
}

/** "Kitchen_Morning-2025.jpg" -> "Kitchen Morning 2025" */
export function titleFromFilename(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}
