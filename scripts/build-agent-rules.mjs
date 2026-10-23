// Builds the copies of the skill for other agents from the single source skills/english-coach/SKILL.md.
//   node scripts/build-agent-rules.mjs          write the files
//   node scripts/build-agent-rules.mjs --check  exit 1 if a generated file is out of date
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const src = readFileSync(new URL("skills/english-coach/SKILL.md", root), "utf8").replace(/\r\n/g, "\n");
const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!m) throw new Error("SKILL.md needs front matter");
const description = m[1].match(/^description:\s*(.+)$/m)[1];
const body = m[2].trim();

export const outputs = {
  // Cursor project rule: always applied
  "agents/cursor/english-coach.mdc": `---\ndescription: ${description}\nalwaysApply: true\n---\n\n${body}\n`,
  // AGENTS.md section (Codex, Copilot, Windsurf, Gemini CLI, Zed... read AGENTS.md or a similar file)
  "agents/AGENTS.snippet.md": `<!-- english-coach: start (generated from skills/english-coach/SKILL.md) -->\n${body}\n<!-- english-coach: end -->\n`,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const [file, text] of Object.entries(outputs)) {
    const url = new URL(file, root);
    const now = existsSync(url) ? readFileSync(url, "utf8").replace(/\r\n/g, "\n") : null;
    if (now === text) continue;
    if (check) { console.error("out of date:", file); stale++; } else { writeFileSync(url, text); console.log("wrote", file); }
  }
  process.exit(stale ? 1 : 0);
}
