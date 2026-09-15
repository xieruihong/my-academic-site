export const COUNTER_ENDPOINT = "https://cdn.busuanzi.cc/api.php";
export const COUNTED_PAGE = "https://xieruihong.github.io/my-academic-site/";

export type VisitCounts = { total: number; today: number };
export type VisitResult =
  | { status: "ready"; counts: VisitCounts }
  | { status: "preview" | "privacy" | "unavailable" };

type PrivacyPreference = { doNotTrack?: boolean; globalPrivacyControl?: boolean };

export function isCountedPage(href: string): boolean {
  try {
    const url = new URL(href);
    return url.origin === "https://xieruihong.github.io"
      && ["/my-academic-site", "/my-academic-site/", "/my-academic-site/index.html"].includes(url.pathname);
  } catch {
    return false;
  }
}

function countValue(value: unknown): number {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 0) throw new Error("Invalid visit count");
  return number;
}

export function parseVisitCounts(value: unknown): VisitCounts {
  if (!value || typeof value !== "object") throw new Error("Invalid counter response");
  const data = value as Record<string, unknown>;
  const counts = {
    total: countValue(data.busuanzi_site_pv),
    today: countValue(data.busuanzi_today_pv),
  };
  if (counts.today > counts.total) throw new Error("Inconsistent visit counts");
  return counts;
}

export function createVisitRecorder(fetcher: typeof fetch = fetch, timeoutMs = 10000) {
  // One request per document lifetime, including React remounts. A page reload
  // starts a new lifetime and records a new page view, not a unique visitor.
  let request: Promise<VisitResult> | undefined;

  return function recordVisit(href: string, privacy: PrivacyPreference = {}): Promise<VisitResult> {
    if (!isCountedPage(href)) return Promise.resolve({ status: "preview" });
    if (privacy.doNotTrack || privacy.globalPrivacyControl) return Promise.resolve({ status: "privacy" });
    if (request) return request;

    request = (async (): Promise<VisitResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(COUNTER_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({ url: COUNTED_PAGE, referrer: "" }),
          credentials: "omit",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Counter service unavailable");
        return { status: "ready", counts: parseVisitCounts(await response.json()) };
      } catch {
        // Do not retry a write: the server may have counted a timed-out request.
        // Missing data stays unavailable; it is never replaced by a fake zero.
        return { status: "unavailable" };
      } finally {
        clearTimeout(timer);
      }
    })();
    return request;
  };
}

export const recordPageView = createVisitRecorder();
