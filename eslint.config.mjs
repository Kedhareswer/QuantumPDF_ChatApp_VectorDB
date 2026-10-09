import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  // Generated / vendored output: the PDF.js worker copied by scripts/copy-pdf-worker.mjs
  // and Playwright's reports.
  { ignores: ["public/pdf.worker.min.mjs", "test-results/**", "playwright-report/**", "blob-report/**"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
