/** Compare two dotted version strings. Returns -1, 0, or 1.
 *
 * Tolerant of a leading "v" and pre-release suffixes (which are ignored for the
 * numeric comparison). This is deliberately small — plugins use simple
 * MAJOR.MINOR.PATCH versions.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => parseInt(part, 10) || 0)

  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}
