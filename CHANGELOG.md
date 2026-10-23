# Changelog

## 1.0.0

First release.

- MCP server with `add_vocabulary`, `add_sentence` and `list_inbox` (Firestore mode and inbox.json mode).
- English Coach skill (Claude Code skill; Cursor rule and `AGENTS.md` copies in `rules/`).
- Claude Code plugin and one-plugin marketplace (`tiennhm`).
- Copy-paste setup prompt for AI agents.

Scope of 1.0: Firestore mode needs **your own Firebase project and service account key**, so this version is meant for people who run their own copy of the app.
Planned for 2.0: a Cloudflare Worker API, so users only paste a personal token (no key file, no uid).
