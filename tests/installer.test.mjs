import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { isToken, claudeAddArgs, mergeMcpJson, upsertBlock, removeBlock, ALWAYS_ON, parseArgs, NPX_SPEC } from "../lib/installer.mjs";

const TOKEN = "enb_" + "Z".repeat(43);

test("isToken accepts app tokens and rejects junk", () => {
  assert.equal(isToken(TOKEN), true);
  assert.equal(isToken(" " + TOKEN + " "), true);
  for (const bad of ["", "enb_", "enb_short", "abc" + "Z".repeat(43), null, undefined, 5]) assert.equal(isToken(bad), false);
});
test("claude add args put the token in env and start the server through npx", () => {
  const a = claudeAddArgs(TOKEN);
  assert.deepEqual(a.slice(0, 5), ["mcp", "add", "english-notebook", "-s", "user"]);
  assert.ok(a.includes("ENGLISH_NOTEBOOK_TOKEN=" + TOKEN));
  assert.deepEqual(a.slice(a.indexOf("--") + 1).slice(-3), ["-y", NPX_SPEC, "serve"]);
});
test("mergeMcpJson keeps other servers and replaces ours", () => {
  const old = JSON.stringify({ theme: "x", mcpServers: { other: { command: "o" }, "english-notebook": { command: "old" } } });
  const out = JSON.parse(mergeMcpJson(old, TOKEN));
  assert.equal(out.theme, "x");
  assert.equal(out.mcpServers.other.command, "o");
  assert.equal(out.mcpServers["english-notebook"].env.ENGLISH_NOTEBOOK_TOKEN, TOKEN);
  assert.notEqual(out.mcpServers["english-notebook"].command, "old");
});
test("mergeMcpJson on empty text, and on bad JSON", () => {
  assert.ok(JSON.parse(mergeMcpJson("", TOKEN)).mcpServers["english-notebook"]);
  assert.throws(() => mergeMcpJson("{oops", TOKEN), /not valid JSON/);
  assert.throws(() => mergeMcpJson("[1]", TOKEN), /JSON object/);
});
test("upsertBlock is idempotent and keeps the rest of the file", () => {
  const base = "# Mine\n\nkeep this\n";
  const once = upsertBlock(base, ALWAYS_ON);
  assert.equal(upsertBlock(once, ALWAYS_ON), once);
  assert.ok(once.startsWith(base.trimEnd()));
  assert.equal((once.match(/english-notebook: start/g) || []).length, 1);
  const changed = upsertBlock(once, "new text");
  assert.ok(changed.includes("new text") && !changed.includes("skip coach") && changed.includes("keep this"));
});
test("removeBlock takes our block out and nothing else", () => {
  const text = upsertBlock("# Mine\n\nkeep this\n", ALWAYS_ON);
  const back = removeBlock(text);
  assert.ok(back.includes("keep this") && !back.includes("english-notebook"));
  assert.equal(removeBlock("no block here\n"), "no block here\n");
});
test("parseArgs: defaults, options and errors", () => {
  assert.deepEqual(parseArgs([]), { cmd: "setup", token: "", agent: "claude", scope: "user", alwaysOn: false, dryRun: false, yes: false, help: false });
  const o = parseArgs(["setup", "--token", TOKEN, "--agent=all", "--always-on", "--dry-run"]);
  assert.equal(o.token, TOKEN); assert.equal(o.agent, "all"); assert.equal(o.alwaysOn, true); assert.equal(o.dryRun, true);
  assert.equal(parseArgs(["--token", TOKEN]).cmd, "setup");
  assert.equal(parseArgs(["uninstall"]).cmd, "uninstall");
  assert.throws(() => parseArgs(["--wat"]), /Unknown option/);
  assert.throws(() => parseArgs(["fly"]), /Unknown command/);
  assert.throws(() => parseArgs(["--agent", "vim"]), /--agent/);
});
test("CLI dry run changes nothing and never prints the token", () => {
  const cli = new URL("../bin/cli.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const r = spawnSync(process.execPath, [cli, "--token", TOKEN, "--agent", "cursor", "--dry-run"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /dry-run/);
  assert.ok(!r.stdout.includes(TOKEN) && !r.stderr.includes(TOKEN));
});
test("CLI rejects a bad token before touching anything", () => {
  const cli = new URL("../bin/cli.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const r = spawnSync(process.execPath, [cli, "--token", "nope", "--dry-run"], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /does not look like a token/);
});
