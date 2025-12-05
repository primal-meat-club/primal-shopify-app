import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const config = {
    hasApiKey: !!process.env.SHOPIFY_API_KEY,
    hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
    hasAppUrl: !!process.env.SHOPIFY_APP_URL,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    appUrl: process.env.SHOPIFY_APP_URL,
    apiKeyPrefix: process.env.SHOPIFY_API_KEY?.slice(0, 8),
    supabaseKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15),
  };

  return Response.json(config);
};
