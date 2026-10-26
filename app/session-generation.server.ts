import { createHmac } from "node:crypto";

const CLIENT_ID = "565e7c02bd2f63f9f5c424eac4ea4e20";
const ORIGIN = "https://rigrcbknmsgjesqggdfb.supabase.co";
const HEADER = "x-primal-luca-generation";
const CONTEXT =
  "primal-luca-offline-session-generation/v1\n" +
  `client=${CLIENT_ID}\n` +
  "project=rigrcbknmsgjesqggdfb\n" +
  "table=public.shopify_sessions\n" +
  "shops=aura-ai-shopping-assistant.myshopify.com,primal500-dev.myshopify.com\n";

/** Fixed server-owned proof for the post-cutover Luca session writer.
 * Activate this writer only after both offline-token CAS updates have completed.
 * The database guard independently checks the actor, OLD/NEW scope and proof digest.
 */
export function createSessionFetch(
  supabaseUrl: string,
  apiKey: string,
  apiSecret: string,
  transport: typeof fetch = fetch,
): typeof fetch {
  const invalid: string[] = [];
  if (apiKey !== CLIENT_ID) invalid.push("SHOPIFY_API_KEY");
  if (!apiSecret) invalid.push("SHOPIFY_API_SECRET");
  let configured: URL | undefined;
  try {
    configured = new URL(supabaseUrl);
  } catch {
    // Report the configuration field, never a URL that may contain credentials.
  }
  if (
    !configured ||
    configured.origin !== ORIGIN || configured.pathname !== "/" ||
    configured.username || configured.password || configured.search || configured.hash
  ) {
    invalid.push("SUPABASE_URL");
  }
  if (invalid.length) {
    // Allow module initialization, while denying every data request before transport.
    const message = `Luca session writer binding is invalid: ${invalid.join(", ")}`;
    return async () => { throw new Error(message); };
  }
  const proof = createHmac("sha256", apiSecret).update(CONTEXT, "utf8").digest("hex");
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    // Never forward a caller-provided generation proof, including on reads.
    headers.delete(HEADER);
    const mutation = request.method !== "GET" && request.method !== "HEAD";
    if (mutation) {
      if (
        url.origin !== ORIGIN || url.pathname !== "/rest/v1/shopify_sessions" ||
        url.username || url.password || url.hash ||
        !["POST", "DELETE"].includes(request.method)
      ) {
        throw new Error("Unexpected Luca session mutation destination or method");
      }
      headers.set(HEADER, proof);
    }
    return transport(new Request(request, { headers, redirect: "error" }));
  };
}
