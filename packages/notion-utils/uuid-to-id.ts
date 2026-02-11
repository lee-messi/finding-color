export const uuidToId = (uuid: string) => {
  if (!uuid) return '' 
  return uuid.replace(/-/g, '')
}