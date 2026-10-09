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
  pageEnd?: number
  section?: string
}

export const CITE_HREF_PREFIX = "#cite-"

// Matches a bracketed citation that contains either a known document extension
// or a page reference (", p.N"). This deliberately avoids matching markdown
// links like [text](url) or numeric arrays like [1, 2].
const CITATION_MARKER =
  /\s*\[([^\]\n]*?(?:\.(?:pdf|docx?|docm|odt|rtf|epub|pptx?|pps|odp|xlsx?|xlsm|xlsb|ods|csv|tsv|txt)|,\s*p\.?\s*\d+)[^\]\n]*?)\](?!\()/gi

// ", p.4" / ", p.4–5" / ", pages 4-5" at the end of a label (en dash or hyphen)
const PAGE_SUFFIX = /,\s*p(?:ages?|\.)?\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*$/i

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, "")

// A chunk's source reads "file · p.4" or "file · Section"; the file name is the part before " · ".
const fileOf = (c: CitableChunk): string => norm(c.documentName || (c.source || "").split(" · ")[0])

/**
 * 0-based index of the chunk a citation label points at, or -1. Labels are
 * `File`, `File, p.N`, `File, p.N–M` or `File, Section`. File names can
 * themselves contain commas, so the file is matched as a prefix of the label
 * rather than split off at the first comma.
 */
export function findCitedChunk(label: string, chunks: CitableChunk[]): number {
  const pageMatch = label.match(PAGE_SUFFIX)
  const start = pageMatch ? Number(pageMatch[1]) : undefined
  const end = pageMatch?.[2] ? Number(pageMatch[2]) : start
  const key = norm(label)
  const keyFile = norm(label.replace(PAGE_SUFFIX, ""))
  if (!keyFile) return -1

  const sameFile = (c: CitableChunk) => {
    const name = fileOf(c)
    return !!name && (key.startsWith(name) || name.includes(keyFile) || keyFile.includes(name))
  }

  if (start !== undefined) {
    // Exact range first, then any chunk whose pages contain the cited start page.
    const exact = chunks.findIndex((c) => sameFile(c) && c.page === start && (c.pageEnd ?? c.page) === end)
    if (exact !== -1) return exact
    const covering = chunks.findIndex(
      (c) => sameFile(c) && c.page !== undefined && c.page <= start && start <= (c.pageEnd ?? c.page),
    )
    if (covering !== -1) return covering
  } else {
    // "File, Section": whatever follows the file name (and its comma) is the section.
    const bySection = chunks.findIndex((c) => {
      const name = fileOf(c)
      return !!c.section && !!name && key.startsWith(name) && key.slice(name.length).replace(/^,/, "") === norm(c.section)
    })
    if (bySection !== -1) return bySection
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
