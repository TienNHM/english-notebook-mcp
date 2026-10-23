import test from "node:test";
import assert from "node:assert/strict";
import { createApiClient, ApiError } from "../api-client.mjs";

const TOKEN = "enb_" + "A".repeat(43);
const res = (status, data) => new Response(JSON.stringify(data), { status });
function client(handler) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, ...init }); return handler(url, init); };
  return { calls, c: createApiClient({ baseUrl: "https://api.example/", token: TOKEN, fetch }) };
}

test("rejects a token that does not look right", () => {
  for (const t of ["", undefined, "abc", "enb_short", "xnb_" + "A".repeat(43)]) assert.throws(() => createApiClient({ token: t }), ApiError);
});

test("addSentence posts to the API with the bearer token and reports what was saved", async () => {
  const { c, calls } = client(() => res(200, { added: ["s", "e1"], skipped: [] }));
  const msg = await c.addSentence({ text: "s", meaning: "m", expressions: [{ text: "e1", meaning: "x" }] });
  assert.equal(calls[0].url, "https://api.example/v1/sentence");
  assert.equal(calls[0].headers.authorization, "Bearer " + TOKEN);
  assert.match(msg, /^Added 2\. Saved to your English Notebook/);
});

test("duplicates are reported", async () => {
  const { c } = client(() => res(200, { added: [], skipped: ["rollback"] }));
  assert.match(await c.addVocabulary({ text: "rollback", meaning: "x" }), /skipped 1 duplicate\(s\): rollback.*Nothing new/);
});

test("listItems builds the query and formats rows", async () => {
  const { c, calls } = client(() => res(200, { items: [{ type: "word", text: "a", meaning: "b" }] }));
  assert.equal(await c.listItems({ query: "a b", limit: 5 }), "[word] a = b");
  assert.equal(calls[0].url, "https://api.example/v1/items?query=a+b&limit=5");
  const empty = client(() => res(200, { items: [] }));
  assert.equal(await empty.c.listItems(), "(empty)");
  assert.equal(empty.calls[0].url, "https://api.example/v1/items");
});

test("helpful errors: revoked token, limit, server problems, network", async () => {
  await assert.rejects(() => client(() => res(401, { error: "invalid token" })).c.addVocabulary({}), /revoked.*Kết nối AI agent/);
  await assert.rejects(() => client(() => res(429, {})).c.addVocabulary({}), /Daily limit/);
  await assert.rejects(() => client(() => res(400, { error: "text is required" })).c.addVocabulary({}), /text is required/);
  await assert.rejects(() => client(() => new Response("<html>", { status: 502 })).c.addVocabulary({}), /Server error \(502\)/);
  const down = createApiClient({ token: TOKEN, fetch: async () => { throw new TypeError("x"); } });
  await assert.rejects(() => down.addVocabulary({}), /Cannot reach/);
});

test("the token is never part of an error message", async () => {
  for (const status of [401, 429, 500]) {
    try { await client(() => res(status, { error: TOKEN })).c.listItems(); } catch (e) { assert.ok(e instanceof ApiError); }
  }
  const { c } = client(() => res(401, {}));
  await c.listItems().catch(e => assert.ok(!e.message.includes(TOKEN)));
});
