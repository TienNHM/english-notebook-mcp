# Changelog

## 2.0.0

- **Token mode:** the plugin and server need only a personal token (`ENGLISH_NOTEBOOK_TOKEN`) created in the app. No Firebase key or uid. The server talks to the English Notebook agent API (Cloudflare Worker).
- The plugin now asks for one setting (the token) instead of key path + uid.
- Key mode (service account + uid) and inbox mode still work for self-hosters, started manually with `claude mcp add`.
- New tests: API client and an end-to-end test of the MCP server in token mode.

## 1.0.0

First release.

- MCP server with `add_vocabulary`, `add_sentence` and `list_inbox` (Firestore mode and inbox.json mode).
- English Coach skill (Claude Code skill; Cursor rule and `AGENTS.md` copies in `rules/`).
- Claude Code plugin and one-plugin marketplace (`tiennhm`).
- Copy-paste setup prompt for AI agents.

Scope of 1.0: Firestore mode needs **your own Firebase project and service account key**, so this version is meant for people who run their own copy of the app.
Planned for 2.0: a Cloudflare Worker API, so users only paste a personal token (no key file, no uid).
