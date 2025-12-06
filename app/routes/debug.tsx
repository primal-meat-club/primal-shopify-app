import type { LoaderFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const testDb = url.searchParams.get("testDb") === "true";

  const config: Record<string, unknown> = {
    hasApiKey: !!process.env.SHOPIFY_API_KEY,
    hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
    hasAppUrl: !!process.env.SHOPIFY_APP_URL,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    appUrl: process.env.SHOPIFY_APP_URL,
    apiKeyPrefix: process.env.SHOPIFY_API_KEY?.slice(0, 8),
    supabaseUrlPrefix: process.env.SUPABASE_URL?.slice(0, 30),
    supabaseKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15),
  };

  // Test Supabase connection if requested
  if (testDb && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Try to read from shopify_sessions table
      const { data, error, count } = await supabase
        .from("shopify_sessions")
        .select("*", { count: "exact", head: true });

      if (error) {
        config.dbTest = {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        };
      } else {
        config.dbTest = {
          success: true,
          sessionCount: count,
        };

        // Try a test insert/delete
        const testId = `test_${Date.now()}`;
        const { error: insertError } = await supabase
          .from("shopify_sessions")
          .insert({
            id: testId,
            shop: "test.myshopify.com",
            is_online: false,
          });

        if (insertError) {
          config.dbTest.insertTest = {
            success: false,
            error: insertError.message,
            code: insertError.code,
          };
        } else {
          // Clean up test row
          await supabase.from("shopify_sessions").delete().eq("id", testId);
          config.dbTest.insertTest = { success: true };
        }
      }
    } catch (e) {
      config.dbTest = {
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }

  return Response.json(config);
};
