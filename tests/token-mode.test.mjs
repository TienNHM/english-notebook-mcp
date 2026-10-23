// End to end: start the real MCP server over stdio in token mode, against a local fake API.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TOKEN = "enb_" + "Z".repeat(43);
const server = path => new URL("../server.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

async function withApi(handler, fn) {
  const seen = [];
  const srv = http.createServer((req, res) => {
    let body = ""; req.on("data", d => body += d);
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
      const [status, data] = handler(req.url, req.headers.authorization);
      res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data));
    });
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  try { return await fn(`http://127.0.0.1:${srv.address().port}`, seen); } finally { srv.close(); }
}

async function connect(env) {
  const client = new Client({ name: "test", version: "0" });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [server()], env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot ?? "", ...env },
  }));
  return client;
}
const text = r => r.content[0].text;

test("token mode: the three tools go through the API with the token", async () => {
  await withApi((url) => url.startsWith("/v1/items") ? [200, { items: [{ type: "word", text: "rollback", meaning: "quay lại" }] }] : [200, { added: ["x"], skipped: [] }],
    async (api, seen) => {
      const c = await connect({ ENGLISH_NOTEBOOK_TOKEN: TOKEN, ENGLISH_NOTEBOOK_API: api });
      try {
        assert.match(text(await c.callTool({ name: "add_sentence", arguments: { text: "Hello there", meaning: "Xin chào", expressions: [{ text: "hello", meaning: "chào" }] } })), /^Added 1/);
        assert.match(text(await c.callTool({ name: "add_vocabulary", arguments: { text: "rollback", meaning: "quay lại" } })), /^Added 1/);
        assert.equal(text(await c.callTool({ name: "list_inbox", arguments: { query: "roll" } })), "[word] rollback = quay lại");
      } finally { await c.close(); }
      assert.deepEqual(seen.map(s => s.method + " " + s.url), ["POST /v1/sentence", "POST /v1/vocabulary", "GET /v1/items?query=roll"]);
      assert.ok(seen.every(s => s.auth === "Bearer " + TOKEN));
      assert.equal(seen[0].body.expressions[0].text, "hello");
    });
});

test("token mode: a revoked token gives a clear tool error, not a crash", async () => {
  await withApi(() => [401, { error: "invalid token" }], async api => {
    const c = await connect({ ENGLISH_NOTEBOOK_TOKEN: TOKEN, ENGLISH_NOTEBOOK_API: api });
    try {
      const r = await c.callTool({ name: "add_vocabulary", arguments: { text: "a", meaning: "b" } });
      assert.equal(r.isError, true);
      assert.match(text(r), /revoked/);
      assert.ok(!text(r).includes(TOKEN));
    } finally { await c.close(); }
  });
});

test("the server refuses to start with a bad token or mixed modes", async () => {
  for (const env of [{ ENGLISH_NOTEBOOK_TOKEN: "nope" }, { ENGLISH_NOTEBOOK_TOKEN: TOKEN, ENGLISH_NOTEBOOK_UID: "u" }]) {
    await assert.rejects(() => connect(env));
  }
});
