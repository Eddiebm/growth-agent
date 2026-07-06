import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "../../../../docs");

const DOC_FILES: Record<string, string> = {
  ICP: "ICP.md",
  OFFER: "OFFER.md",
  VOICE: "VOICE.md",
  PLAYBOOK: "PLAYBOOK.md",
  RATE_CARD: "RATE_CARD.md",
};

export async function loadDocs(
  keys: string[],
  productSlug?: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const productDir = productSlug ? join(DOCS_DIR, "products", productSlug) : null;

  for (const key of keys) {
    const filename = DOC_FILES[key];
    if (!filename) continue;

    let content = "";
    if (productDir) {
      try {
        content = await readFile(join(productDir, filename), "utf-8");
      } catch {
        // fall through to global
      }
    }
    if (!content) {
      try {
        content = await readFile(join(DOCS_DIR, filename), "utf-8");
      } catch {
        content = "";
      }
    }
    result[key] = content;
  }

  return result;
}
