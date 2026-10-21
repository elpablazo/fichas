// Resize and re-encode locally: strip metadata and avoid sending the full camera image.
export async function preparePhoto(file: File, longEdge = 1280, quality = 0.78): Promise<string> {
  if (file.size > 20_000_000 || !file.type.startsWith('image/')) throw new Error('Invalid photo.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, longEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    if (!jpeg || jpeg.length > 1_500_000) throw new Error('Photo too large.');
    return jpeg;
  } finally {
    URL.revokeObjectURL(url);
  }
}
