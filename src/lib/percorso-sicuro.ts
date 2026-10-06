/**
 * Percorso interno sicuro verso cui rimandare dopo il login, o "/".
 *
 * Solo path assoluti interni. Oltre a `//evil.com` e `https://evil.com`, vanno
 * scartati backslash e caratteri di controllo: i browser trattano `\` come `/`
 * e ignorano tab e a capo negli URL, quindi `/\evil.com` o `/\t/evil.com`
 * diventerebbero `//evil.com`, cioè un open redirect.
 */
export function percorsoInternoSicuro(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}
