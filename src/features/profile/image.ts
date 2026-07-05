/**
 * Client-side avatar preprocessing: take any user-picked image file and produce
 * a small, square JPEG *data URL* suitable for storing inline on the profile
 * row (Storage is bypassed — see migration 0006). Keeps the stored value to
 * ~15–30 KB and gives every avatar a stable shape. Browser-only (canvas);
 * no deps.
 */

const AVATAR_SIZE = 256
const JPEG_QUALITY = 0.85
/** Max size of the picked file, before resizing. Mirrors the old bucket cap. */
const MAX_INPUT_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Validate (image type, ≤ 5 MB), center-crop to a square, downscale to
 * 256×256, and return a JPEG `data:` URL. Rejects if the file isn't an
 * acceptable, decodable image.
 */
export async function resizeAvatarToDataUrl(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG, or WebP image.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('That image is over 5 MB — please choose a smaller one.')
  }

  const bitmap = await loadBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process the image (no canvas context).')
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } finally {
    bitmap.close()
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new Error('That image could not be read — try a different file.')
  }
}
