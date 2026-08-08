/**
 * Citation display formatting (render-only).
 *
 * The RAG engine forces verbose inline citations on every claim, e.g.
 * "...for MCH [Common_Labs.pdf, p.1]." That is great for groundedness checks
 * but reads as clutter. This converts those markers into compact, deduped
 * superscript references plus a single "Sources" footnote line.
 *
 * IMPORTANT: this is for DISPLAY only. The original message content must keep
 * the raw markers so source/chunk alignment elsewhere keeps working.
 */

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
}

export function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPT_DIGITS[d] ?? d)
    .join("")
}

// Matches a bracketed citation that contains either a known document extension
// or a page reference (", p.N"). This deliberately avoids matching markdown
// links like [text](url) or numeric arrays like [1, 2].
const CITATION_MARKER =
  /\s*\[([^\]\n]*?(?:\.(?:pdf|docx?|docm|odt|rtf|epub|pptx?|pps|odp|xlsx?|xlsm|xlsb|ods|csv|tsv|txt)|,\s*p\.?\s*\d+)[^\]\n]*?)\]/gi

const keyOf = (label: string): string => label.trim().toLowerCase().replace(/\s+/g, " ")

/**
 * Replace inline `[Filename, p.N]` markers with compact superscript references
 * and append a deduped "Sources" line. Returns the input unchanged when no
 * citation markers are present.
 */
export function formatCitationsForDisplay(content: string): string {
  if (!content) return content

  // Pass 1 — collect unique citations in order of first appearance.
  const order: string[] = []
  const labels = new Map<string, string>()
  for (const match of content.matchAll(CITATION_MARKER)) {
    const label = match[1].trim()
    const key = keyOf(label)
    if (!labels.has(key)) {
      labels.set(key, label)
      order.push(key)
    }
  }
  if (order.length === 0) return content

  const numberOf = new Map(order.map((key, index) => [key, index + 1]))

  // Pass 2 — replace each marker with its superscript number, then tidy spacing.
  const body = content
    .replace(CITATION_MARKER, (_full, inner: string) => toSuperscript(numberOf.get(keyOf(inner)) ?? 0))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim()

  const sources = order.map((key, index) => `${toSuperscript(index + 1)} ${labels.get(key)}`).join("  ·  ")

  return `${body}\n\n**Sources:** ${sources}`
}
