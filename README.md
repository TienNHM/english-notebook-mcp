# english-notebook-mcp

Small MCP server (stdio) so Claude Code can save vocabulary and sentences into
[English Notebook](https://github.com/TienNHM/english-notebook).

## Tools

- `add_vocabulary`: word or phrase + Vietnamese meaning, optional example, note, tags.
- `add_sentence`: natural sentence + meaning, optional original sentence and `expressions[]` (each becomes a linked card).
- `list_inbox`: list saved items (use it to avoid duplicates). Duplicates by English text are skipped.

## Two storage modes

| Mode | When | Where items go | Works on |
|---|---|---|---|
| **Firestore** (recommended) | `ENGLISH_NOTEBOOK_SERVICE_ACCOUNT` and `ENGLISH_NOTEBOOK_UID` are set | `users/<uid>/items` in Firestore | the hosted site, your phone, localhost: everywhere you are signed in |
| **inbox.json** (default) | neither variable is set | `../english-notebook/inbox.json` | only the app served from that folder on the same PC (`localhost`) |

Set both variables or neither. If only one is set, the server exits with an error.

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

## Tip: tell Claude when to save

Add to your CLAUDE.md, for example:

> When I ask for help in Vietnamese, after answering call `add_sentence` with the natural English version
> and 2-3 useful expressions (tag: work). Do not save things I did not ask about.
