// Keeps the skill honest: every tool it names exists in server.mjs, and the copies for other agents are up to date.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outputs } from "../scripts/build-agent-rules.mjs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const skill = read("skills/english-coach/SKILL.md");
const server = read("server.mjs");

test("front matter has name and description", () => {
  assert.match(skill, /^---\nname: english-coach\ndescription: .{40,}\n---\n/);
});

test("every MCP tool named in the skill is registered by the server", () => {
  const registered = new Set([...server.matchAll(/registerTool\("([a-z_]+)"/g)].map(x => x[1]));
  const used = new Set([...skill.matchAll(/`(add_[a-z]+|list_[a-z]+)`/g)].map(x => x[1]));
  assert.ok(used.size >= 3);
  for (const t of used) assert.ok(registered.has(t), `${t} is not a tool of server.mjs`);
});

test("fields the skill passes to add_sentence exist in the schema", () => {
  const block = server.slice(server.indexOf('registerTool("add_sentence"'), server.indexOf('registerTool("list_inbox"'));
  for (const f of ["text", "meaning", "original", "expressions", "tags"]) assert.match(block, new RegExp(`\\b${f}\\b`));
});

test("generated agent files match the source (run: node scripts/build-agent-rules.mjs)", () => {
  for (const [file, text] of Object.entries(outputs)) assert.equal(read(file), text, file);
});

test("no personal data in the public skill", () => {
  assert.doesNotMatch(skill, /tiennhm|@gmail|D:\\|C:\\|Users\\/i);
});
