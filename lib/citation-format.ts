/**
 * Citation display formatting (render-only).
 *
 * The RAG engine forces verbose inline citations on every claim, e.g.
 * "...for MCH [Common_Labs.pdf, p.1]." This rewrites each marker into a
 * numbered `[n](#cite-n)` link, where n is the 1-based position of the cited
 * chunk in the list shown under "View Retrieved Chunks". The chat renderer
 * turns those links into chips that open that chunk, so the chunk panel is the
 * one and only source list — no separate "Sources" footer.
 *
 * IMPORTANT: this is for DISPLAY only. The original message content must keep
 * the raw markers so source/chunk alignment elsewhere keeps working.
 */

export interface CitableChunk {
  source?: string
  documentName?: string
  page?: number
}

export const CITE_HREF_PREFIX = "#cite-"

// Matches a bracketed citation that contains either a known document extension
// or a page reference (", p.N"). This deliberately avoids matching markdown
// links like [text](url) or numeric arrays like [1, 2].
const CITATION_MARKER =
  /\s*\[([^\]\n]*?(?:\.(?:pdf|docx?|docm|odt|rtf|epub|pptx?|pps|odp|xlsx?|xlsm|xlsb|ods|csv|tsv|txt)|,\s*p\.?\s*\d+)[^\]\n]*?)\](?!\()/gi

const PAGE_SUFFIX = /,\s*p\.?\s*(\d+)\s*$/i

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, "")

/** 0-based index of the chunk a `File.pdf, p.N` label points at, or -1. */
export function findCitedChunk(label: string, chunks: CitableChunk[]): number {
  const pageMatch = label.match(PAGE_SUFFIX)
  const page = pageMatch ? Number(pageMatch[1]) : undefined
  const file = norm(label.replace(PAGE_SUFFIX, ""))
  if (!file) return -1

  const sameFile = (c: CitableChunk) => {
    const name = norm(c.documentName || c.source || "")
    return !!name && (name.includes(file) || file.includes(name))
  }
  if (page !== undefined) {
    const exact = chunks.findIndex((c) => sameFile(c) && c.page === page)
    if (exact !== -1) return exact
  }
  return chunks.findIndex(sameFile)
}

/**
 * Replace inline `[Filename, p.N]` markers with `[n](#cite-n)` links into
 * `chunks`. A marker that matches no chunk (e.g. an old message saved without
 * its chunks) is left as written so the claim keeps its attribution.
 */
export function linkCitations(content: string, chunks: CitableChunk[]): string {
  if (!content) return content
  return content
    .replace(CITATION_MARKER, (full, inner: string) => {
      const index = findCitedChunk(inner.trim(), chunks)
      return index === -1 ? full : `[${index + 1}](${CITE_HREF_PREFIX}${index + 1})`
    })
    // "[File, p.1] [File, p.1]" on one claim → a single chip, not "1 1"
    .replace(/(\[\d+\]\(#cite-\d+\))(?:\s*\1)+/g, "$1")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
}
