import assert from "node:assert/strict";
import test from "node:test";
import { createSessionFetch } from "../app/session-generation.server.ts";

const origin = "https://rigrcbknmsgjesqggdfb.supabase.co";
const client = "565e7c02bd2f63f9f5c424eac4ea4e20";
const header = "x-primal-luca-generation";
// Independent Python HMAC vector for the documented SQL-guard context.
const expected = "babe197d0ad6e3a593680ee72e3eefd4412a4de864a76850d479b0015358eb38";

for (const [operation, method, query, body] of [
  ["storeSession", "POST", "on_conflict=id", '{"id":"offline_primal500-dev.myshopify.com","is_online":false}'],
  ["deleteSession", "DELETE", "id=eq.offline_primal500-dev.myshopify.com", undefined],
  ["deleteSessions", "DELETE", "id=in.(offline_primal500-dev.myshopify.com,offline_aura-ai-shopping-assistant.myshopify.com)", undefined],
]) {
  test(`${operation} sends fixed proof and preserves REST request`, async () => {
    let calls = 0;
    const wrapped = createSessionFetch(origin, client, "synthetic-new-secret", async (request) => {
      calls++;
      assert.equal(request.url, `${origin}/rest/v1/shopify_sessions?${query}`);
      assert.equal(request.method, method);
      assert.equal(request.headers.get(header), expected);
      assert.equal(request.headers.get("authorization"), "Bearer synthetic-service-key");
      assert.equal(request.headers.get("prefer"), "resolution=merge-duplicates");
      assert.equal(request.redirect, "error");
      assert.equal(await request.text(), body ?? "");
      return new Response(null, { status: 204 });
    });
    const response = await wrapped(`${origin}/rest/v1/shopify_sessions?${query}`, {
      method, body,
      headers: { [header]: "caller-supplied-forgery", authorization: "Bearer synthetic-service-key", prefer: "resolution=merge-duplicates" },
    });
    assert.equal(response.status, 204);
    assert.equal(calls, 1);
  });
}

test("reads never carry generation proof", async () => {
  const wrapped = createSessionFetch(origin, client, "synthetic-new-secret", async (request) => {
    assert.equal(request.headers.get(header), null);
    return new Response("[]");
  });
  await wrapped(new Request(`${origin}/rest/v1/shopify_sessions?select=*&id=eq.synthetic`, {
    headers: { [header]: "caller-supplied-forgery" },
  }));
});

test("old secret cannot produce accepted new generation", async () => {
  const wrapped = createSessionFetch(origin, client, "synthetic-old-secret", async (request) => {
    assert.notEqual(request.headers.get(header), expected);
    return new Response(null, { status: 403 });
  });
  assert.equal((await wrapped(`${origin}/rest/v1/shopify_sessions`, { method: "DELETE" })).status, 403);
});

test("wrong project/client or missing key fails before transport", () => {
  const noTransport = () => { throw new Error("unexpected transport"); };
  for (const [url, id, key] of [
    ["https://other.supabase.co", client, "synthetic"],
    [origin, "other-client", "synthetic"], [origin, client, ""],
    [`${origin}/rest/v1`, client, "synthetic"],
    [`${origin}?redirect=other`, client, "synthetic"],
  ]) assert.throws(() => createSessionFetch(url, id, key, noTransport), /binding is invalid/);
});

test("unexpected mutation destination or method cannot receive proof", async () => {
  let calls = 0;
  const wrapped = createSessionFetch(origin, client, "synthetic-new-secret", async () => { calls++; });
  for (const [url, method] of [
    ["https://other.supabase.co/rest/v1/shopify_sessions", "POST"],
    [`${origin}/rest/v1/another_table`, "POST"],
    [`${origin}/rest/v1/rpc/session_writer`, "POST"],
    [`${origin}/rest/v1/shopify_sessions`, "PATCH"],
    [`${origin}/rest/v1/shopify_sessions#fragment`, "DELETE"],
  ]) await assert.rejects(wrapped(url, { method }), /Unexpected Luca/);
  assert.equal(calls, 0);
});
