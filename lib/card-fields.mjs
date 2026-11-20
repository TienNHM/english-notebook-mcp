// Shared rules for cards saved by an AI agent (inbox.json and Firestore modes; the Worker has its own copy).
export const INBOX_STATUS = "inbox"; // agent saves wait in the app's "Mới" inbox until the user keeps them
const MAX_TAGS = 10, MAX_TAG_LEN = 40;

// Lowercase, trim, drop a leading "#", de-duplicate, cap the count and length.
export function normalizeTags(t) {
  const out = [];
  for (const x of Array.isArray(t) ? t : []) {
    const s = String(x ?? "").trim().replace(/^#+/, "").trim().toLowerCase().slice(0, MAX_TAG_LEN);
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, MAX_TAGS);
}
