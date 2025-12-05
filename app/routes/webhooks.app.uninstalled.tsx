import type { ActionFunctionArgs } from "react-router";
import { authenticate, sessionStorage } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    // Delete all sessions for this shop using our Supabase session storage
    const sessions = await sessionStorage.findSessionsByShop(shop);
    for (const s of sessions) {
      await sessionStorage.deleteSession(s.id);
    }
    console.log(`Deleted ${sessions.length} sessions for ${shop}`);
  }

  return new Response();
};
