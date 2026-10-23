# english-notebook-mcp

Small MCP server (stdio) so Claude Code can save vocabulary and sentences into
[English Notebook](https://github.com/TienNHM/english-notebook).

> **Version 2.0:** you only need a **personal token** from the app. No Firebase key, no uid. Self-hosters can still use the key mode (see "Set up Firestore mode"). See [CHANGELOG](CHANGELOG.md).

## Install as a Claude Code plugin (easiest for Claude Code)

This repo is also a Claude Code plugin and a one-plugin marketplace. It installs the MCP server **and** the English Coach skill together:

```bash
claude plugin marketplace add TienNHM/english-notebook-mcp
claude plugin install english-notebook@tiennhm
```

Or, inside Claude Code (version 2.1.275 or later): `/plugin install english-notebook --marketplace TienNHM/english-notebook-mcp`.
Claude Code asks for one value: your **token**. Get it in the app: sign in, open **Library → 🤖 Kết nối AI agent → Tạo token**, copy it (it is shown once).
To change it later: `/plugin configure english-notebook@tiennhm`. Restart Claude Code after installing. The skill is then available as `english-notebook:english-coach` and also starts by itself on your messages.
Lost the token or leaked it? Revoke it in the same screen and create a new one.

## Quick start: let your AI agent set everything up

Copy this prompt into your AI agent (Claude Code, Cursor, Codex, Copilot, Windsurf...) and answer its questions. It installs the MCP server **and** the English Coach skill for that agent.

````text
Set up English Notebook for me, step by step. Ask me only when you need an answer.

1. Check that Node.js 18+ and git are installed. If not, tell me how to install them and stop.
2. Ask me where to put the project (suggest a folder next to my other projects), then run:
   git clone https://github.com/TienNHM/english-notebook-mcp.git <folder>
   cd <folder> && npm install
3. Ask me for my English Notebook agent token (starts with enb_). Tell me how to get it: sign in to the app,
   Library -> "Kết nối AI agent" -> create a token. If I use my own Firebase project instead, ask for the service account
   FILE PATH and my uid (never open, print, copy or commit the key file) and use the key mode.
4. Register the MCP server named "english-notebook" for the agent you are running in, with `node <folder>/server.mjs`
   and the env var ENGLISH_NOTEBOOK_TOKEN (or ENGLISH_NOTEBOOK_SERVICE_ACCOUNT + ENGLISH_NOTEBOOK_UID in key mode; set both or neither):
   - Claude Code: claude mcp add --scope user --env ENGLISH_NOTEBOOK_TOKEN=<token> english-notebook -- node <folder>/server.mjs
   - Cursor: ~/.cursor/mcp.json   - other agents: that agent's MCP config file (JSON "mcpServers").
5. Install the English Coach skill for this agent, copying from <folder>:
   - Claude Code: skills/english-coach -> ~/.claude/skills/english-coach
   - Cursor: rules/cursor/english-coach.mdc -> .cursor/rules/english-coach.mdc in my project
   - others: append rules/AGENTS.snippet.md to my AGENTS.md (or the agent's rules file)
   Do not overwrite an existing file without asking me.
6. Tell me to restart the agent (MCP servers load at start), then how to test:
   ask "lưu từ rollback (quay lại bản cũ)" and check the word appears in the app.
7. At the end, list what you changed (paths) and remind me to keep the key file secret.
````

Prefer to do it by hand? Follow the sections below.

## Tools

- `add_vocabulary`: word or phrase + Vietnamese meaning, optional example, note, tags.
- `add_sentence`: natural sentence + meaning, optional original sentence and `expressions[]` (each becomes a linked card).
- `list_inbox`: list saved items (use it to avoid duplicates). Duplicates by English text are skipped.

## Storage modes

| Mode | When | Where items go | Works on |
|---|---|---|---|
| **Token** (recommended, v2) | `ENGLISH_NOTEBOOK_TOKEN` is set | the English Notebook agent API saves to your account | everywhere you are signed in; no key on your machine |
| **Firestore** (recommended) | `ENGLISH_NOTEBOOK_SERVICE_ACCOUNT` and `ENGLISH_NOTEBOOK_UID` are set | `users/<uid>/items` in Firestore | the hosted site, your phone, localhost: everywhere you are signed in |
| **inbox.json** (default) | neither variable is set | `../english-notebook/inbox.json` | only the app served from that folder on the same PC (`localhost`) |

For the two key modes: set both variables or neither (one alone is an error). Do not mix the token with the key variables. `ENGLISH_NOTEBOOK_API` overrides the API address (for a self-hosted Worker).

## Set up Firestore mode

1. Firebase console → Project settings → **Service accounts** → **Generate new private key**.
   Save the JSON file **outside any git repo** and outside synced folders if you can.
   It gives full admin access to the project: never commit it, never paste it in chat.
2. Find your user id: Firebase console → Authentication → Users, or
   `npx firebase-tools auth:export users.json --project <project-id>` and read `localId`.
3. Register the server in Claude Code:

```bash
claude mcp add --scope user --env ENGLISH_NOTEBOOK_SERVICE_ACCOUNT="C:\path\to\key.json" --env ENGLISH_NOTEBOOK_UID="<your uid>" english-notebook -- node D:\TienNHM\english-notebook-mcp\server.mjs
```

4. Restart Claude Code and run `claude mcp list` to check it is connected.

The server uses the Admin SDK, so it bypasses the Firestore security rules. It only ever writes to the one uid you give it.

## Set up inbox.json mode (no key needed)

```bash
claude mcp add --scope user english-notebook -- node D:\TienNHM\english-notebook-mcp\server.mjs
```

Optional: set `ENGLISH_NOTEBOOK_INBOX` to use another inbox path. The app imports new items when it opens (each item once).

## Check that it works

1. `claude mcp list` shows `english-notebook` as connected.
2. In Claude Code ask: "Save the word `rollback` (quay lại bản cũ) to my notebook." Claude should call `add_vocabulary`.
3. Open the app. In Firestore mode the item appears right away (also on the hosted site). In inbox mode, open the app on `localhost`.
4. Ask for the same word again. The tool answers "skipped 1 duplicate".

## Troubleshooting

| Problem | Fix |
|---|---|
| `Set BOTH ENGLISH_NOTEBOOK_SERVICE_ACCOUNT and ENGLISH_NOTEBOOK_UID...` | You set only one of the two variables. Set both, or neither. |
| Server shows as failed in `claude mcp list` | Run `node server.mjs` in this folder to see the error. Check the key path (Windows paths need to be quoted) and that `npm install` was run. |
| `PERMISSION_DENIED` or `Cloud Firestore API has not been used` | Create the Firestore database in the Firebase console first. Check that the key belongs to the same project. |
| Items do not show in the app | Check that the uid is the one you sign in with (Authentication → Users). A different uid writes to a different user's data. |
| Items show only on `localhost` | You are in inbox mode. Set both variables to use Firestore mode. |
| Claude never calls the tool | Install the English Coach skill (section above), or ask directly ("save this to my notebook"). |
| Changed the env variables but nothing changed | Remove and add the server again (`claude mcp remove english-notebook`), then restart Claude Code. |

## Install the English Coach skill (needed to use the app with an AI agent)

The MCP server only gives the agent the *tools*. The **skill** tells it *when and how* to use them: it corrects your English,
answers in simple English + Vietnamese, then saves the sentence and 2-3 expressions to your notebook after each Vietnamese request.
The skill lives in [`skills/english-coach/SKILL.md`](skills/english-coach/SKILL.md) (the single source). Install it for your agent:

| Agent | Install |
|---|---|
| **Claude Code** | Copy the folder `skills/english-coach` to `~/.claude/skills/english-coach` (Windows: `%USERPROFILE%\.claude\skills\english-coach`). Use `.claude/skills/` inside a project to limit it to that project. |
| **Claude Desktop / claude.ai** | Zip the folder `english-coach` (with `SKILL.md` inside) and upload it in Settings → Capabilities → Skills. |
| **Cursor** | Copy [`rules/cursor/english-coach.mdc`](rules/cursor/english-coach.mdc) to `<your project>/.cursor/rules/english-coach.mdc` (it is set to always apply). |
| **Codex, Copilot, Windsurf, Gemini CLI and others** | Paste [`rules/AGENTS.snippet.md`](rules/AGENTS.snippet.md) into your `AGENTS.md` (or the agent's rules / instructions file). |

Then connect the MCP server to the same agent. Claude Code uses the `claude mcp add` command above. Other agents use a JSON config
(Cursor: `~/.cursor/mcp.json`; check your agent's docs for the file):

```json
{
  "mcpServers": {
    "english-notebook": {
      "command": "node",
      "args": ["D:/path/to/english-notebook-mcp/server.mjs"],
      "env": {
        "ENGLISH_NOTEBOOK_SERVICE_ACCOUNT": "D:/path/to/key.json",
        "ENGLISH_NOTEBOOK_UID": "<your uid>"
      }
    }
  }
}
```

Without the skill the agent can still save when you ask directly ("save this to my notebook"), but it will not coach you or save by itself.
Without the MCP server the skill still coaches you, and skips the saving.

Say **"skip coach"** in a message to turn the coaching and the saving off for that turn.

The Cursor and `AGENTS.md` files are generated from `SKILL.md`. After editing the skill run `npm run build:agents`, and `npm test` checks that
the copies are up to date and that every tool the skill names exists in `server.mjs`.
