import "server-only";
import { site } from "@/lib/site";

export async function submitIndexNow(paths: string[]) {
  const key = process.env.INDEXNOW_KEY;
  if (!key || !paths.length) return { skipped: true };

  const urls = paths.map(path => new URL(path, site.url).toString());

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(site.url).host,
        key,
        keyLocation: site.url + "/indexnow-key.txt",
        urlList: urls
      }),
      signal: AbortSignal.timeout(10000)
    });

    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.error("IndexNow submit failed", error);
    return { ok: false };
  }
}
