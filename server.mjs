import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The app (english-notebook) reads this file when it opens and imports new items.
const here = path.dirname(fileURLToPath(import.meta.url));
const INBOX = process.env.ENGLISH_NOTEBOOK_INBOX || path.resolve(here, "../english-notebook/inbox.json");

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
const mk = (o) => ({
  id: uid(), example: "", note: "", original: "", sourceId: "", source: "claude", tags: [],
  box: 0, due: Date.now(), created: Date.now(), reviews: 0, ...o,
});

const server = new McpServer({ name: "english-notebook", version: "0.1.0" });

const text = z.string().min(1).describe("English text");
const meaning = z.string().min(1).describe("Vietnamese meaning");
const tags = z.array(z.string()).optional().describe("Short tags, e.g. work, git, meeting");

async function add(entries) {
  const list = await readInbox();
  const seen = new Set(list.map(i => i.text.toLowerCase()));
  const added = [], skipped = [];
  for (const e of entries) {
    if (seen.has(e.text.toLowerCase())) { skipped.push(e.text); continue; }
    seen.add(e.text.toLowerCase());
    list.push(e); added.push(e.text);
  }
  if (added.length) await writeInbox(list);
  return { content: [{ type: "text", text: `Added ${added.length}${skipped.length ? `, skipped ${skipped.length} duplicate(s): ${skipped.join(", ")}` : ""}. Open the app to import.` }] };
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
  const parent = mk({ type: "sentence", text: clean(text), meaning: clean(meaning),
    original: clean(original), note: clean(note), tags: tagList(tags) });
  const kids = (expressions ?? []).map(x => mk({ type: "phrase", text: clean(x.text), meaning: clean(x.meaning),
    sourceId: parent.id, tags: parent.tags }));
  return add([parent, ...kids]);
});

server.registerTool("list_inbox", {
  description: "List items saved through this MCP server (use it to avoid adding duplicates).",
  inputSchema: { query: z.string().optional().describe("Filter by text or meaning"), limit: z.number().int().min(1).max(100).optional() },
}, async ({ query, limit }) => {
  const q = clean(query).toLowerCase();
  const rows = (await readInbox())
    .filter(i => !q || (i.text + " " + i.meaning).toLowerCase().includes(q))
    .slice(-(limit ?? 20))
    .map(i => `[${i.type}] ${i.text} = ${i.meaning}`);
  return { content: [{ type: "text", text: rows.join("\n") || "(empty)" }] };
});

await server.connect(new StdioServerTransport());
