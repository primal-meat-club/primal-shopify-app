import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

/**
 * Map a Shopify shop domain to its corresponding management URL.
 *
 * This embedded app provides the Shopify OAuth bridge, scopes, tokens,
 * webhooks, and app proxy. All actual operator UI (members, leads,
 * subscriptions, Coach Chris configuration) lives in the Luca admin
 * app keyed off the shop domain. This embedded admin only needs to
 * point the operator to the right place.
 */
function adminUrlForShop(shop: string): { label: string; url: string } {
  // Production Primal 500 install
  if (shop === "primal500-dev.myshopify.com" || shop === "primal500.myshopify.com") {
    return { label: "primal500.com/admin", url: "https://primal500.com/admin" };
  }
  // Staging dev store
  if (shop === "aura-ai-shopping-assistant.myshopify.com") {
    return {
      label: "aura-shopify-assistant.vercel.app/admin",
      url: "https://aura-shopify-assistant.vercel.app/admin",
    };
  }
  // Unknown install — fall back to the prod admin (best guess)
  return { label: "primal500.com/admin", url: "https://primal500.com/admin" };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { label, url } = adminUrlForShop(session.shop);
  return { shop: session.shop, adminLabel: label, adminUrl: url };
};

export default function Index() {
  const { shop, adminLabel, adminUrl } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Luca AI Shopping Assistant">
      <s-section heading="Manage this app">
        <s-paragraph>
          This app handles the Shopify OAuth bridge, webhooks, and app
          proxy for <s-text>{shop}</s-text>. All operator tools — members,
          leads, subscriptions, Coach Chris configuration — live in the
          Luca admin.
        </s-paragraph>
        <s-paragraph>
          <s-link href={adminUrl} target="_top">
            Manage at {adminLabel} →
          </s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
