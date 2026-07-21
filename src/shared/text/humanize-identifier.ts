export function humanizeIdentifier(value: string): string {
  const words = value.replace(/[_:-]+/g, " ");
  return words.replace(/^./, (character) => character.toUpperCase());
}

export function humanizeIdentifierTitleCase(value: string): string {
  return value
    .replace(/[_:-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
