import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTags, INBOX_STATUS } from "../lib/card-fields.mjs";

test("tags are lowercased, trimmed, de-hashed and de-duplicated", () => {
  assert.deepEqual(normalizeTags(["#Git", " git ", "Meeting", "#", "", null]), ["git", "meeting"]);
});
test("tags: missing input, length and count caps", () => {
  assert.deepEqual(normalizeTags(undefined), []);
  assert.equal(normalizeTags(["a".repeat(50)])[0].length, 40);
  assert.equal(normalizeTags(Array.from({ length: 15 }, (_, i) => "t" + i)).length, 10);
});
test("agent saves are inbox cards", () => assert.equal(INBOX_STATUS, "inbox"));
