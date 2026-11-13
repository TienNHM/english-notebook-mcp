#!/usr/bin/env node
// Quick installer:  npx github:TienNHM/english-notebook-mcp   (then follow the prompt)
// Also the way the MCP server is started:  npx -y github:TienNHM/english-notebook-mcp serve
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isToken, claudeAddArgs, mergeMcpJson, upsertBlock, removeBlock, ALWAYS_ON, parseArgs, SERVER_NAME } from "../lib/installer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HELP = `English Notebook quick installer

  npx github:TienNHM/english-notebook-mcp [setup] [options]
  npx github:TienNHM/english-notebook-mcp uninstall [--agent claude|cursor|all]

Options:
  --token enb_...     personal token (app: Profile > Kết nối AI agent). Or set ENGLISH_NOTEBOOK_TOKEN. Asked if missing.
  --agent <name>      claude (default), cursor, or all
  --always-on         Claude Code: also add a short rule to ~/.claude/CLAUDE.md so the coach runs on every reply
  --scope <scope>     Claude Code MCP scope: user (default), local or project
  --dry-run           show what would happen, change nothing
  -h, --help          this text
`;

const log = m => console.log(m);
const read = async p => (existsSync(p) ? readFile(p, "utf8") : "");
async function put(p, text, dry) {
  if (dry) return log(`  [dry-run] would write ${p}`);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, text);
}
function run(cmd, args, dry) {
  if (dry) { log(`  [dry-run] ${cmd} ${args.map(a => a.startsWith("ENGLISH_NOTEBOOK_TOKEN=") ? "ENGLISH_NOTEBOOK_TOKEN=***" : a).join(" ")}`); return { status: 0 }; }
  return spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", shell: process.platform === "win32" });
}

async function askToken() {
  if (!process.stdin.isTTY) throw new Error("No token. Pass --token enb_... or set ENGLISH_NOTEBOOK_TOKEN.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question("Paste your token (app: Profile > Kết nối AI agent > Tạo token): ")).trim(); }
  finally { rl.close(); }
}

async function setupClaude(o, token) {
  log("\nClaude Code:");
  const have = run("claude", ["--version"], o.dryRun);
  if (have.status !== 0) { log("  ✗ `claude` command not found. Install Claude Code first, then run this again."); return false; }
  run("claude", ["mcp", "remove", SERVER_NAME, "-s", o.scope], o.dryRun); // ignore "not found"
  const r = run("claude", claudeAddArgs(token, o.scope), o.dryRun);
  if (r.status !== 0) { log(`  ✗ claude mcp add failed:\n${(r.stderr || r.stdout || "").trim()}`); return false; }
  log(`  ✓ MCP server "${SERVER_NAME}" added (scope: ${o.scope})`);
  // the coach skill, so Claude knows how to correct English and when to save
  const dest = path.join(homedir(), ".claude", "skills", "english-coach", "SKILL.md");
  const src = path.join(root, "skills", "english-coach", "SKILL.md");
  const before = await read(dest), want = await readFile(src, "utf8");
  if (before.replace(/\r\n/g, "\n") === want.replace(/\r\n/g, "\n")) log("  ✓ skill english-coach already up to date");
  else {
    if (before && !o.dryRun) await copyFile(dest, dest + ".bak");
    await put(dest, want, o.dryRun);
    log(`  ✓ skill english-coach installed${before ? " (old copy saved as SKILL.md.bak)" : ""}`);
  }
  if (o.alwaysOn) {
    const f = path.join(homedir(), ".claude", "CLAUDE.md");
    await put(f, upsertBlock(await read(f), ALWAYS_ON), o.dryRun);
    log("  ✓ always-on rule added to ~/.claude/CLAUDE.md");
  }
  return true;
}

async function setupCursor(o, token) {
  log("\nCursor:");
  const mcp = path.join(homedir(), ".cursor", "mcp.json");
  await put(mcp, mergeMcpJson(await read(mcp), token), o.dryRun);
  log(`  ✓ MCP server added to ${mcp}`);
  const rule = path.join(process.cwd(), ".cursor", "rules", "english-coach.mdc");
  await put(rule, await readFile(path.join(root, "rules", "cursor", "english-coach.mdc"), "utf8"), o.dryRun);
  log(`  ✓ rule written to ${rule} (this project only; run in another project to add it there)`);
  return true;
}

async function uninstall(o) {
  const agents = o.agent === "all" ? ["claude", "cursor"] : [o.agent];
  if (agents.includes("claude")) {
    run("claude", ["mcp", "remove", SERVER_NAME, "-s", o.scope], o.dryRun);
    const f = path.join(homedir(), ".claude", "CLAUDE.md");
    if (existsSync(f)) await put(f, removeBlock(await read(f)), o.dryRun);
    log("Claude Code: MCP server and always-on rule removed (the skill folder ~/.claude/skills/english-coach is left; delete it by hand if you want).");
  }
  if (agents.includes("cursor")) {
    const mcp = path.join(homedir(), ".cursor", "mcp.json");
    if (existsSync(mcp)) {
      const obj = JSON.parse(await read(mcp)); delete obj.mcpServers?.[SERVER_NAME];
      await put(mcp, JSON.stringify(obj, null, 2) + "\n", o.dryRun);
    }
    log("Cursor: MCP server removed from ~/.cursor/mcp.json (project rule files are left).");
  }
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) return log(HELP);
  if (o.cmd === "serve") { await import("../server.mjs"); return; }
  if (o.cmd === "uninstall") return uninstall(o);
  const token = (o.token || process.env.ENGLISH_NOTEBOOK_TOKEN || (await askToken())).trim();
  if (!isToken(token)) throw new Error("That does not look like a token (it starts with enb_). Create one in the app: Profile > Kết nối AI agent.");
  const ok = [];
  if (o.agent !== "cursor") ok.push(await setupClaude(o, token));
  if (o.agent !== "claude") ok.push(await setupCursor(o, token));
  log(ok.every(Boolean) ? "\nDone. Restart your agent, then write a request in Vietnamese. New cards appear in the app." : "\nFinished with problems (see above).");
  process.exitCode = ok.every(Boolean) ? 0 : 1;
}
main().catch(e => { console.error("Error:", e.message); process.exit(1); });
