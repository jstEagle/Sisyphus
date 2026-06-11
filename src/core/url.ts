export function domainFromUrl(url: string | undefined): string {
  if (!url) return "unknown";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "chrome:" || parsed.protocol === "chrome-extension:") {
      return parsed.protocol.replace(":", "");
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function normalizeUrlForProtection(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

export function pairKey(left: string, right: string): string {
  return [left, right].sort().join("::");
}
