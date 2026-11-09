export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Quick checks in the browser, so the admin gets an answer at once. The server
 * checks the file's real content again: these checks can be bypassed.
 */
export function checkImageFile(file: File): string | undefined {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type))
    return 'Choose a JPEG, PNG or WebP image.'
  if (file.size > MAX_BYTES)
    return 'This image is larger than 5 MB. Please choose a smaller one.'
  return undefined
}
