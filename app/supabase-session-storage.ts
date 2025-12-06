import { Session } from "@shopify/shopify-api";
import { SessionStorage } from "@shopify/shopify-app-session-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-based session storage for Shopify OAuth tokens.
 *
 * This adapter stores Shopify OAuth sessions in Supabase's shopify_sessions table,
 * allowing the main aura-shopify backend (Railway) to read tokens for Admin API calls.
 *
 * Table schema (managed by aura-shopify migrations):
 * - id: TEXT PRIMARY KEY (Shopify session ID)
 * - shop: TEXT NOT NULL (shop domain)
 * - state: TEXT (OAuth state for CSRF)
 * - is_online: BOOLEAN (online vs offline session)
 * - scope: TEXT (granted OAuth scopes)
 * - expires_at: TIMESTAMPTZ (token expiration)
 * - access_token: TEXT (the OAuth token, nullable during OAuth begin phase)
 * - tenant_id: UUID (for multi-tenant support)
 */
export class SupabaseSessionStorage implements SessionStorage {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async storeSession(session: Session): Promise<boolean> {
    const sessionData = {
      id: session.id,
      shop: session.shop,
      state: session.state,
      is_online: session.isOnline,
      scope: session.scope,
      expires_at: session.expires
        ? new Date(session.expires).toISOString()
        : null,
      access_token: session.accessToken,
    };

    console.log(`[SupabaseSessionStorage] Storing session:`, {
      id: session.id,
      shop: session.shop,
      hasToken: !!session.accessToken,
      isOnline: session.isOnline,
      scope: session.scope,
    });

    const { error } = await this.supabase
      .from("shopify_sessions")
      .upsert(sessionData, { onConflict: "id" });

    if (error) {
      console.error("[SupabaseSessionStorage] Failed to store session:", error);
      console.error("[SupabaseSessionStorage] Session data attempted:", {
        id: session.id,
        shop: session.shop,
        hasToken: !!session.accessToken,
      });
      return false;
    }

    console.log(`[SupabaseSessionStorage] Successfully stored session for shop: ${session.shop}, id: ${session.id}`);
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const { data, error } = await this.supabase
      .from("shopify_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      if (error && error.code !== "PGRST116") {
        // PGRST116 = "No rows returned" - not an error, just not found
        console.error("[SupabaseSessionStorage] Failed to load session:", error);
      }
      return undefined;
    }

    return new Session({
      id: data.id,
      shop: data.shop,
      state: data.state,
      isOnline: data.is_online,
      scope: data.scope,
      expires: data.expires_at ? new Date(data.expires_at) : undefined,
      accessToken: data.access_token,
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("shopify_sessions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[SupabaseSessionStorage] Failed to delete session:", error);
      return false;
    }
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;

    const { error } = await this.supabase
      .from("shopify_sessions")
      .delete()
      .in("id", ids);

    if (error) {
      console.error("[SupabaseSessionStorage] Failed to delete sessions:", error);
      return false;
    }
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const { data, error } = await this.supabase
      .from("shopify_sessions")
      .select("*")
      .eq("shop", shop);

    if (error) {
      console.error("[SupabaseSessionStorage] Failed to find sessions:", error);
      return [];
    }

    if (!data) return [];

    return data.map(
      (row) =>
        new Session({
          id: row.id,
          shop: row.shop,
          state: row.state,
          isOnline: row.is_online,
          scope: row.scope,
          expires: row.expires_at ? new Date(row.expires_at) : undefined,
          accessToken: row.access_token,
        })
    );
  }
}
