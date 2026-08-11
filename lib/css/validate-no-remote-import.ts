export function validateNoRemoteImport(css: string): boolean {
  const importPattern = /@import\s+(url\(|["'])/i
  return !importPattern.test(css)
}
