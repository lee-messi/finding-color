export const uuidToId = (uuid: string) => {
  if (!uuid) {
    console.warn('uuidToId received an undefined or null uuid');
    return '';
  }
  return uuid.replace(/-/g, '');
}