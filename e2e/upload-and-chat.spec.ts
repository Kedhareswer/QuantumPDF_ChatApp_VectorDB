import { expect, test, type Page, type Route } from "@playwright/test"

/**
 * Full browser flow against the production build: configure a provider,
 * upload a two-page PDF through the real liteparse route, ask a question,
 * check the answer, its page citation and its fact-check badge, then reload
 * and check that documents and chat history were restored from IndexedDB.
 *
 * The AI provider (Groq) is stubbed at the network layer — no key, no cost —
 * so this verifies the app's own wiring, not a provider's live behaviour.
 */

/** Minimal valid PDF with one text line per page. */
function buildPdf(pages: string[]): Buffer {
  const objs: string[] = []
  const pageIds = pages.map((_, i) => 4 + i * 2)
  objs.push("<< /Type /Catalog /Pages 2 0 R >>")
  objs.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} /MediaBox [0 0 612 200] >>`)
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  pages.forEach((text, i) => {
    const stream = `BT /F1 11 Tf 20 150 Td (${text}) Tj ET`
    objs.push(`<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`)
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`
  pdf += `trailer\n<< /Root 1 0 R /Size ${objs.length + 1} >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, "latin1")
}

const PAGE_1 = "Shipping is free for orders above fifty euros within the European Union."
const PAGE_2 = "The product warranty lasts 24 months from the date of purchase and covers manufacturing defects."

/** Stub Groq's chat-completions endpoint; returns the prompts it saw. */
async function stubGroq(page: Page) {
  const prompts: string[] = []
  await page.route("https://api.groq.com/**", async (route: Route) => {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "POST, OPTIONS",
    }
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors })
    const body = route.request().postDataJSON() as { messages: Array<{ role: string; content: string }>; stream?: boolean }
    const system = body.messages[0]?.content ?? ""
    const user = body.messages[body.messages.length - 1]?.content ?? ""
    prompts.push(user)
    let content = "OK"
    if (system.includes("fact-checker")) {
      content = JSON.stringify({ claims: [{ claim: "The warranty lasts 24 months", supported: true }], verdict: "pass" })
    } else if (user.includes("<sources>")) {
      content = "The warranty lasts 24 months from purchase [e2e-handbook.pdf, p.2]."
    }
    await route.fulfill({
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }),
    })
  })
  return prompts
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e-seeded")) return // keep state across the reload step
    sessionStorage.setItem("e2e-seeded", "1")
    localStorage.setItem("quantum-pdf-tour-completed", "true")
    localStorage.setItem(
      "quantum-pdf-store",
      JSON.stringify({
        state: {
          aiConfig: { provider: "groq", apiKey: "", model: "openai/gpt-oss-120b", baseUrl: "https://api.groq.com/openai/v1" },
          vectorDBConfig: { provider: "local", dimension: 1536 },
          activeTab: "settings",
          fastMode: false,
          rememberSession: true,
        },
        version: 3,
      }),
    )
  })
})

test("upload a PDF, ask a question, get a page-cited, fact-checked answer that survives a reload", async ({ page }) => {
  const prompts = await stubGroq(page)
  await page.goto("/")

  // Configure the provider: entering a key triggers (debounced) engine initialization.
  await page.getByPlaceholder("Enter your API key").first().fill("gsk_e2e_test_key")
  await expect.poll(() => prompts.some((p) => p.includes("Reply with OK")), { timeout: 30_000 }).toBe(true)

  // Upload through the real /api/pdf/extract route.
  await page.locator('[data-tour="tab-documents"]').first().click()
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-handbook.pdf",
    mimeType: "application/pdf",
    buffer: buildPdf([PAGE_1, PAGE_2]),
  })
  await page.getByRole("button", { name: "Process Document" }).click()
  await expect(page.getByText("Document Added").first()).toBeVisible({ timeout: 60_000 })

  // Ask.
  const input = page.locator("#chat-input")
  await expect(input).toBeEnabled()
  await input.fill("How long does the product warranty last?")
  await page.getByRole("button", { name: "Send message" }).click()

  await expect(page.getByText("The warranty lasts 24 months from purchase").first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/Grounded: 100%/).first()).toBeVisible()

  // The answering prompt labelled the chunk with the pages it spans: both pages
  // are short, so the chunker merges them, and the warranty text is on page 2.
  const answerPrompt = prompts.find((p) => p.includes("<sources>")) ?? ""
  expect(answerPrompt).toContain("[SOURCE: e2e-handbook.pdf | Pages 1–2]")
  expect(answerPrompt).toMatch(/Pages 1–2\][\s\S]*warranty/)

  // Reload: documents and chat history come back from IndexedDB.
  await page.waitForTimeout(1_000) // let the debounced message save run
  await page.reload()
  await expect(page.getByText("How long does the product warranty last?").first()).toBeVisible()
  await page.locator('[data-tour="tab-documents"]').first().click()
  await expect(page.getByText("e2e-handbook.pdf").first()).toBeVisible()
})
