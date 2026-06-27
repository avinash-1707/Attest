// Client-side image downscaler. Decodes via the browser's built-in image pipeline,
// draws to a canvas capped at maxDim (aspect-preserved), and exports as webp.
// Keeps the payload small before the multipart upload without any server resize.

export async function downscaleImage(file: File, maxDim = 512): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image');
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Could not decode image');
  });

  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null'));
        }
      },
      'image/webp',
      0.9,
    );
  });
}
