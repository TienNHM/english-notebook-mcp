# english-notebook-mcp

Small MCP server (stdio) so Claude Code can save vocabulary and sentences into English Notebook.

It writes to `../english-notebook/inbox.json`. The app reads that file when it opens (and when you return to the tab)
and imports new items. Each item is imported once, even if you delete it later.

## Tools

- `add_vocabulary` – word or phrase + Vietnamese meaning, optional example, note, tags.
- `add_sentence` – natural sentence + meaning, optional original sentence and `expressions[]` (each becomes a linked card).
- `list_inbox` – see what was already added (avoid duplicates). Duplicates by English text are skipped.

## Register in Claude Code

```bash
claude mcp add english-notebook --scope user -- node D:\TienNHM\english-notebook-mcp\server.mjs
```

Optional: set `ENGLISH_NOTEBOOK_INBOX` to use another inbox path.

## Tip: tell Claude when to save

Add to your CLAUDE.md, for example:

> When I ask for help in Vietnamese, after answering call `add_sentence` with the natural English version
> and 2-3 useful expressions (tag: work). Do not save things I did not ask about.

## Limits

- The app must be served from the `english-notebook` folder on the same machine (`python -m http.server`).
  A phone or hosted copy will not see `inbox.json`.
- Search only covers the inbox, not items you typed in the app (those live in the browser or Firestore).
