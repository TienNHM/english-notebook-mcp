import test from "node:test";
import assert from "node:assert/strict";
import { createRowsCache } from "../lib/known-cache.mjs";

test("loads once within the TTL, again after it", async () => {
  let t = 0, loads = 0;
  const c = createRowsCache({ ttlMs: 1000, now: () => t });
  const load = async () => { loads++; return [{ text: "a" }]; };
  await c.get(load); t = 999; await c.get(load); assert.equal(loads, 1);
  t = 1000; await c.get(load); assert.equal(loads, 2);
});
test("add remembers new cards; reset forces a reload; add before load is ignored", async () => {
  let loads = 0;
  const c = createRowsCache();
  c.add([{ text: "x" }]);                                    // nothing loaded yet: ignored
  const load = async () => { loads++; return [{ text: "a" }]; };
  assert.deepEqual((await c.get(load)).map(r => r.text), ["a"]);
  c.add([{ text: "b" }]);
  assert.deepEqual((await c.get(load)).map(r => r.text), ["a", "b"]);
  c.reset(); await c.get(load); assert.equal(loads, 2);
});
test("a failed load is not cached", async () => {
  const c = createRowsCache();
  await assert.rejects(c.get(async () => { throw new Error("quota"); }));
  assert.deepEqual(await c.get(async () => [{ text: "ok" }]), [{ text: "ok" }]);
});
