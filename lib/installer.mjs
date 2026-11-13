// Pure helpers for the quick installer (bin/cli.mjs). No process or network access here, so they are easy to test.

export const SERVER_NAME = "english-notebook";
export const NPX_SPEC = "github:TienNHM/english-notebook-mcp";
const BLOCK_START = "<!-- english-notebook: start -->";
const BLOCK_END = "<!-- english-notebook: end -->";

// Tokens made by the app look like enb_ + 43 URL-safe characters.
export const isToken = t => typeof t === "string" && /^enb_[A-Za-z0-9_-]{20,}$/.test(t.trim());

// What `claude mcp add` should run (arguments only, no shell).
export function claudeAddArgs(token, scope = "user") {
  const launch = process.platform === "win32" ? ["cmd", "/c", "npx"] : ["npx"]; // native Windows cannot start npx directly
  return ["mcp", "add", SERVER_NAME, "-s", scope, "-e", `ENGLISH_NOTEBOOK_TOKEN=${token}`, "--", ...launch, "-y", NPX_SPEC, "serve"];
}

// Entry for Cursor-style mcp.json files ({ mcpServers: { ... } }).
export function mcpEntry(token) {
  const win = process.platform === "win32";
  return {
    command: win ? "cmd" : "npx",
    args: win ? ["/c", "npx", "-y", NPX_SPEC, "serve"] : ["-y", NPX_SPEC, "serve"],
    env: { ENGLISH_NOTEBOOK_TOKEN: token },
  };
}

// Adds or replaces our server in the text of an mcp.json file; keeps every other server and setting.
export function mergeMcpJson(text, token) {
  let obj = {};
  if (text && text.trim()) {
    try { obj = JSON.parse(text); } catch { throw new Error("mcp.json is not valid JSON; fix or remove it, then run again"); }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("mcp.json must contain a JSON object");
  }
  obj.mcpServers = { ...(obj.mcpServers || {}), [SERVER_NAME]: mcpEntry(token) };
  return JSON.stringify(obj, null, 2) + "\n";
}

// Adds or replaces a marked block in a markdown file (idempotent: running twice gives the same text).
export function upsertBlock(text, body) {
  const block = `${BLOCK_START}\n${body.trim()}\n${BLOCK_END}`;
  const src = (text || "").replace(/\r\n/g, "\n");
  const a = src.indexOf(BLOCK_START), b = src.indexOf(BLOCK_END);
  if (a !== -1 && b > a) return src.slice(0, a) + block + src.slice(b + BLOCK_END.length);
  return src.trimEnd() ? `${src.trimEnd()}\n\n${block}\n` : `${block}\n`;
}

export function removeBlock(text) {
  const src = (text || "").replace(/\r\n/g, "\n");
  const a = src.indexOf(BLOCK_START), b = src.indexOf(BLOCK_END);
  if (a === -1 || b < a) return src;
  return (src.slice(0, a).trimEnd() + "\n" + src.slice(b + BLOCK_END.length).trimStart()).trim() + "\n";
}

// Short "always on" instruction for ~/.claude/CLAUDE.md. The full lesson rules stay in the skill.
export const ALWAYS_ON = `## English Notebook
For every chat reply, follow the \`english-coach\` skill (correct my English, answer in simple English plus Vietnamese).
When I ask in Vietnamese, save the natural English sentence with the \`english-notebook\` tools (\`add_sentence\`, \`add_vocabulary\`).
If I type "skip coach", skip the coaching and the saving for that message.`;

export function parseArgs(argv) {
  const out = { cmd: "setup", token: "", agent: "claude", scope: "user", alwaysOn: false, dryRun: false, yes: false, help: false };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("-")) out.cmd = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === "--token") out.token = rest.shift() || "";
    else if (a.startsWith("--token=")) out.token = a.slice(8);
    else if (a === "--agent") out.agent = rest.shift() || "";
    else if (a.startsWith("--agent=")) out.agent = a.slice(8);
    else if (a === "--scope") out.scope = rest.shift() || "";
    else if (a === "--always-on") out.alwaysOn = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  if (!["setup", "serve", "uninstall"].includes(out.cmd)) throw new Error(`Unknown command: ${out.cmd}`);
  if (!["claude", "cursor", "all"].includes(out.agent)) throw new Error("--agent must be claude, cursor or all");
  if (!["user", "local", "project"].includes(out.scope)) throw new Error("--scope must be user, local or project");
  return out;
}
