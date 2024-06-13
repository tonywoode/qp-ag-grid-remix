export function encodeString(str: string) {
  let replacedString = str?.replace(/\\/g, '~') // replace backslashes with ~
  let encodedString = encodeURIComponent(replacedString)
  return encodedString
}
export function decodeString(str: string) {
  let decodedString = decodeURIComponent(str)?.replace(/~/g, '\\')
  return decodedString
}
