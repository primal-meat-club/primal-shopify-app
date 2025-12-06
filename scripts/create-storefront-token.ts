// scripts/create-storefront-token.ts
// One-time script to create a Storefront Access Token via the Admin API
// Run with: npx tsx scripts/create-storefront-token.ts

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SHOP_DOMAIN = "primal500-dev.myshopify.com";

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
    console.error("Set them in your shell before running this script");
    process.exit(1);
  }

  console.log("Connecting to Supabase...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Get Admin API token from shopify_sessions
  console.log(`Looking for offline session for shop: ${SHOP_DOMAIN}`);
  const { data, error } = await supabase
    .from("shopify_sessions")
    .select("access_token")
    .eq("shop", SHOP_DOMAIN)
    .eq("is_online", false)
    .single();

  if (error || !data) {
    console.error("Failed to get session:", error);
    process.exit(1);
  }

  const adminToken = data.access_token;
  console.log("Found Admin API token in Supabase");

  // Create Storefront Access Token via Admin API
  const mutation = `
    mutation {
      storefrontAccessTokenCreate(input: {title: "Footer Menus Token"}) {
        storefrontAccessToken {
          accessToken
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  console.log("Creating Storefront Access Token via Admin API...");
  const response = await fetch(
    `https://${SHOP_DOMAIN}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": adminToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: mutation }),
    }
  );

  const result = await response.json();

  if (result.errors) {
    console.error("API Errors:", result.errors);
    process.exit(1);
  }

  if (result.data?.storefrontAccessTokenCreate?.userErrors?.length > 0) {
    console.error("User Errors:", result.data.storefrontAccessTokenCreate.userErrors);
    process.exit(1);
  }

  const storefrontToken = result.data.storefrontAccessTokenCreate.storefrontAccessToken.accessToken;
  const title = result.data.storefrontAccessTokenCreate.storefrontAccessToken.title;

  console.log("\n========================================");
  console.log(`Created Storefront Access Token: "${title}"`);
  console.log("========================================\n");
  console.log(`Token: ${storefrontToken}`);
  console.log("\n========================================");
  console.log("Next Steps:");
  console.log("1. Go to Vercel > aura-shopify frontend project");
  console.log("2. Settings > Environment Variables");
  console.log("3. Add SHOPIFY_STOREFRONT_ACCESS_TOKEN with the token above");
  console.log("4. Redeploy the frontend");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
