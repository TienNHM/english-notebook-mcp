// Token mode: talks to the English Notebook agent API (a Cloudflare Worker) with a personal token.
// No Firebase key is needed on the user's machine.
export const DEFAULT_API_URL = "https://english-notebook-agent-api.tiennhm-it.workers.dev";

const HINT = {
  401: "The token is invalid or was revoked. In the English Notebook app open 'Kết nối AI agent', create a new token and update the plugin setting.",
  429: "Daily limit reached. Try again tomorrow.",
};

export class ApiError extends Error {}

export function createApiClient({ baseUrl = DEFAULT_API_URL, token, fetch: fetchFn = (...a) => fetch(...a) }) {
  if (!/^enb_[A-Za-z0-9_-]{43}$/.test(String(token || ""))) throw new ApiError("ENGLISH_NOTEBOOK_TOKEN does not look like an English Notebook token (it starts with enb_).");
  const root = String(baseUrl).replace(/\/+$/, "");

  async function call(method, path, body) {
    let res;
    try {
      res = await fetchFn(root + path, {
        method,
        headers: { authorization: "Bearer " + token, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw new ApiError("Cannot reach the English Notebook server. Check the network and try again."); }
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) throw new ApiError(HINT[res.status] || data?.error || `Server error (${res.status}). Try again later.`);
    return data;
  }

  const summary = ({ added, skipped }) =>
    `Added ${added.length}${skipped.length ? `, skipped ${skipped.length} duplicate(s): ${skipped.join(", ")}` : ""}. ` +
    (added.length ? "Saved to your English Notebook; it shows in the app right away." : "Nothing new to save.");

  return {
    async addVocabulary(args) { return summary(await call("POST", "/v1/vocabulary", args)); },
    async addSentence(args) { return summary(await call("POST", "/v1/sentence", args)); },
    async listItems({ query, limit } = {}) {
      const q = new URLSearchParams();
      if (query) q.set("query", query);
      if (limit) q.set("limit", String(limit));
      const { items } = await call("GET", "/v1/items" + (q.size ? "?" + q : ""));
      return items.map(i => `[${i.type}] ${i.text} = ${i.meaning}`).join("\n") || "(empty)";
    },
  };
}
