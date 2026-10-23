import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiClient, ApiError } from "./api-client.mjs";

// Three storage modes:
//  0) Token (when ENGLISH_NOTEBOOK_TOKEN is set): talks to the English Notebook agent API with a personal token.
//     No Firebase key on this machine. This is what the Claude Code plugin uses.
//  1) Firestore (when ENGLISH_NOTEBOOK_SERVICE_ACCOUNT and ENGLISH_NOTEBOOK_UID are set):
//     writes to users/<uid>/items, so every device and the hosted site see the items at once.
//  2) inbox.json (default): the app imports this file when it runs from the same folder on this PC.
const here = path.dirname(fileURLToPath(import.meta.url));
const INBOX = process.env.ENGLISH_NOTEBOOK_INBOX || path.resolve(here, "../english-notebook/inbox.json");
const SA = process.env.ENGLISH_NOTEBOOK_SERVICE_ACCOUNT;
const UID = process.env.ENGLISH_NOTEBOOK_UID;
const TOKEN = process.env.ENGLISH_NOTEBOOK_TOKEN;

// stdout is the MCP channel, so all logging goes to stderr.
if (TOKEN && (SA || UID)) {
  console.error("Use ENGLISH_NOTEBOOK_TOKEN alone, or the service account + uid pair, not both.");
  process.exit(1);
}
let api = null;
if (TOKEN) {
  try { api = createApiClient({ baseUrl: process.env.ENGLISH_NOTEBOOK_API || undefined, token: TOKEN }); }
  catch (e) { console.error(e.message); process.exit(1); }
}
if (!!SA !== !!UID) {
  console.error("Set BOTH ENGLISH_NOTEBOOK_SERVICE_ACCOUNT and ENGLISH_NOTEBOOK_UID for Firestore mode (or neither for inbox.json mode).");
  process.exit(1);
}

let col = null;
if (SA) {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: cert(JSON.parse(await readFile(SA, "utf8"))) });
  col = getFirestore().collection("users").doc(UID).collection("items");
}

const uid = () => Date.now().toString(36) + randomBytes(3).toString("hex");
const clean = s => String(s ?? "").trim();
const tagList = t => (t ?? []).map(x => clean(x).toLowerCase()).filter(Boolean);

async function readInbox() {
  try { return JSON.parse(await readFile(INBOX, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return []; throw e; }
}
async function writeInbox(list) {
  const tmp = INBOX + ".tmp";
  await writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await rename(tmp, INBOX);
}

const readAll = async () => col ? (await col.get()).docs.map(d => d.data()) : readInbox();

async function saveNew(entries) {
  if (col) {
    const batch = col.firestore.batch();
    for (const e of entries) batch.set(col.doc(e.id), e);
    await batch.commit();
  } else {
    await writeInbox([...(await readInbox()), ...entries]);
  }
}

const mk = (o) => ({
  id: uid(), example: "", note: "", original: "", sourceId: "", source: "claude", tags: [],
  box: 0, due: Date.now(), created: Date.now(), reviews: 0, ...o,
});

const server = new McpServer({ name: "english-notebook", version: "2.0.0" });

// Token mode: run an API call and turn API errors into a normal tool error message.
async function viaApi(fn) {
  try { return { content: [{ type: "text", text: await fn() }] }; }
  catch (e) { if (e instanceof ApiError) return { isError: true, content: [{ type: "text", text: e.message }] }; throw e; }
}

const text = z.string().min(1).describe("English text");
const meaning = z.string().min(1).describe("Vietnamese meaning");
const tags = z.array(z.string()).optional().describe("Short tags, e.g. work, git, meeting");

async function add(entries) {
  const seen = new Set((await readAll()).map(i => String(i.text).toLowerCase()));
  const added = [], skipped = [], fresh = [];
  for (const e of entries) {
    if (seen.has(e.text.toLowerCase())) { skipped.push(e.text); continue; }
    seen.add(e.text.toLowerCase());
    fresh.push(e); added.push(e.text);
  }
  if (fresh.length) await saveNew(fresh);
  const where = !fresh.length ? "Nothing new to save." : col ? "Saved to Firestore; it shows in the app right away." : "Saved to inbox.json; open the app (localhost) to import.";
  return { content: [{ type: "text", text: `Added ${added.length}${skipped.length ? `, skipped ${skipped.length} duplicate(s): ${skipped.join(", ")}` : ""}. ${where}` }] };
}

server.registerTool("add_vocabulary", {
  description: "Save an English word or phrase (with Vietnamese meaning) to the user's English Notebook.",
  inputSchema: {
    text, meaning,
    kind: z.enum(["word", "phrase"]).optional().describe("Default: word if single word, else phrase"),
    example: z.string().optional().describe("One short example sentence in English"),
    note: z.string().optional(), tags,
  },
}, async ({ text, meaning, kind, example, note, tags }) => {
  if (api) return viaApi(() => api.addVocabulary({ text, meaning, kind, example, note, tags }));
  const t = clean(text);
  return add([mk({ type: kind ?? (/\s/.test(t) ? "phrase" : "word"), text: t, meaning: clean(meaning),
    example: clean(example), note: clean(note), tags: tagList(tags) })]);
});

server.registerTool("add_sentence", {
  description: "Save a natural English sentence, optionally with the original Vietnamese sentence and expressions taken from it. Each expression becomes its own card linked to the sentence.",
  inputSchema: {
    text, meaning,
    original: z.string().optional().describe("The original sentence (e.g. Vietnamese) this English version came from"),
    expressions: z.array(z.object({ text, meaning })).optional().describe("Useful words/phrases in the sentence"),
    note: z.string().optional(), tags,
  },
}, async ({ text, meaning, original, expressions, note, tags }) => {
  if (api) return viaApi(() => api.addSentence({ text, meaning, original, expressions, note, tags }));
  const parent = mk({ type: "sentence", text: clean(text), meaning: clean(meaning),
    original: clean(original), note: clean(note), tags: tagList(tags) });
  const kids = (expressions ?? []).map(x => mk({ type: "phrase", text: clean(x.text), meaning: clean(x.meaning),
    sourceId: parent.id, tags: parent.tags }));
  return add([parent, ...kids]);
});

server.registerTool("list_inbox", {
  description: "List saved items (Firestore mode: all items in the notebook; inbox mode: items saved through this server). Use it to avoid adding duplicates.",
  inputSchema: { query: z.string().optional().describe("Filter by text or meaning"), limit: z.number().int().min(1).max(100).optional() },
}, async ({ query, limit }) => {
  if (api) return viaApi(() => api.listItems({ query, limit }));
  const q = clean(query).toLowerCase();
  const rows = (await readAll())
    .sort((a, b) => (a.created ?? 0) - (b.created ?? 0))
    .filter(i => !q || (i.text + " " + i.meaning).toLowerCase().includes(q))
    .slice(-(limit ?? 20))
    .map(i => `[${i.type}] ${i.text} = ${i.meaning}`);
  return { content: [{ type: "text", text: rows.join("\n") || "(empty)" }] };
});

await server.connect(new StdioServerTransport());
