import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { gunzipSync, gzipSync } from "node:zlib";

export const PageKind = Object.freeze({ Loaded: "loaded", Failed: "failed" });

const toIsoDate = (timeMs) => {
  const dateLength = "YYYY-MM-DD".length;
  return new Date(timeMs).toISOString().slice(0, dateLength);
};

const readCached = async ({ file, maxAgeMs }) => {
  try {
    const { mtimeMs } = await stat(file);
    if (Date.now() - mtimeMs > maxAgeMs) {
      return undefined;
    }
    return { html: gunzipSync(await readFile(file)).toString("utf8"), retrievedDate: toIsoDate(mtimeMs) };
  } catch (cause) {
    if (cause?.code === "ENOENT") {
      return undefined;
    }
    throw new Error(`Could not read cached page ${file}`, { cause });
  }
};

const download = async ({ url, userAgent, timeoutMs }) => {
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return { kind: PageKind.Failed, url, reason: `HTTP ${response.status}` };
    }
    return { kind: PageKind.Loaded, url, html: await response.text(), retrievedDate: toIsoDate(Date.now()) };
  } catch (cause) {
    return { kind: PageKind.Failed, url, reason: `request failed: ${cause?.cause?.code ?? cause?.name ?? "unknown"}`, cause };
  }
};

// Cached pages make a re-run cheap and keep the load on the sources low; the delay
// applies only when a request actually goes out.
export const loadPage = async ({ url, cacheDir, http }) => {
  const file = join(cacheDir, `${createHash("sha256").update(url).digest("hex")}.html.gz`);
  const cached = await readCached({ file, maxAgeMs: http.cacheMaxAgeMs });
  if (cached !== undefined) {
    return { kind: PageKind.Loaded, url, ...cached };
  }
  await wait(http.delayMs);
  const page = await download({ url, userAgent: http.userAgent, timeoutMs: http.timeoutMs });
  if (page.kind === PageKind.Loaded) {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, gzipSync(page.html));
  }
  return page;
};
