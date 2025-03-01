const SPECIAL_CHARS_MAP = {
  '\\': '__BSLASH__',
  '%': '__PERCENT__',
  '~': '__TILDE__',
  '#': '__HASH__',
  '?': '__QMARK__',
  '/': '__FSLASH__',
  ':': '__COLON__'
}

export function encodeString(str: string) {
  if (!str) return ''

  // Replace special characters with safe tokens
  const safeString = str.replace(/[\\%~#?/:]/g, char => SPECIAL_CHARS_MAP[char])

  // could convert to Base64 encode as final safety net, but its nice to read the url
  // return btoa(safeString)
  return safeString
}

export function decodeString(str: string) {
  if (!str) return ''

  // Decode Base64
  // const decoded = atob(str)

  // Replace tokens back with special characters
  //return decoded.replace(
  return str.replace(
    /__BSLASH__|__PERCENT__|__TILDE__|__HASH__|__QMARK__|__FSLASH__|__COLON__/g,
    match => Object.entries(SPECIAL_CHARS_MAP).find(([_, v]) => v === match)?.[0] || match
  )
}

// Helper function that combines URL decoding with our custom decoding e.g.: for pretty printing
export function decodeFullUrl(url: string) {
  return decodeURIComponent(decodeString(url))
}
