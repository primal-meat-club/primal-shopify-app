import { Session, shopifyApi, ApiVersion } from "@shopify/shopify-api";
import { SessionStorage } from "@shopify/shopify-app-session-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// GraphQL mutation to create a Storefront Access Token
const STOREFRONT_TOKEN_MUTATION = `
  mutation storefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
    storefrontAccessTokenCreate(input: $input) {
      storefrontAccessToken {
        accessToken
      }
      userErrors {
        field
        message
      }
    }
  }
`;

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
  private apiKey: string;
  private apiSecret: string;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.apiKey = process.env.SHOPIFY_API_KEY || "";
    this.apiSecret = process.env.SHOPIFY_API_SECRET || "";
  }

  /**
   * Create a Storefront Access Token using the Admin API
   */
  private async createStorefrontToken(session: Session): Promise<string | null> {
    if (!session.accessToken) {
      console.log("[SupabaseSessionStorage] No access token, skipping Storefront token creation");
      return null;
    }

    try {
      const shopify = shopifyApi({
        apiKey: this.apiKey,
        apiSecretKey: this.apiSecret,
        scopes: [],
        hostName: session.shop,
        apiVersion: ApiVersion.October25,
        isEmbeddedApp: true,
      });

      const client = new shopify.clients.Graphql({ session });

      const response = await client.request(STOREFRONT_TOKEN_MUTATION, {
        variables: {
          input: {
            title: "Aura Shopping Cart",
          },
        },
      });

      const data = response.data as {
        storefrontAccessTokenCreate: {
          storefrontAccessToken: { accessToken: string } | null;
          userErrors: Array<{ field: string; message: string }>;
        };
      };

      if (data.storefrontAccessTokenCreate.userErrors.length > 0) {
        console.error("[SupabaseSessionStorage] Storefront token creation errors:",
          data.storefrontAccessTokenCreate.userErrors);
        return null;
      }

      const token = data.storefrontAccessTokenCreate.storefrontAccessToken?.accessToken;
      if (token) {
        console.log("[SupabaseSessionStorage] Created Storefront Access Token");
        return token;
      }

      return null;
    } catch (error) {
      console.error("[SupabaseSessionStorage] Failed to create Storefront token:", error);
      return null;
    }
  }

  async storeSession(session: Session): Promise<boolean> {
    console.log(`[SupabaseSessionStorage] Storing session:`, {
      id: session.id,
      shop: session.shop,
      hasToken: !!session.accessToken,
      isOnline: session.isOnline,
      scope: session.scope,
    });

    // First, check if we already have a Storefront token for this shop
    let storefrontToken: string | null = null;

    if (session.accessToken && !session.isOnline) {
      // Only create Storefront token for offline sessions (persistent)
      const { data: existingSession } = await this.supabase
        .from("shopify_sessions")
        .select("storefront_access_token")
        .eq("shop", session.shop)
        .not("storefront_access_token", "is", null)
        .limit(1)
        .single();

      if (existingSession?.storefront_access_token) {
        console.log("[SupabaseSessionStorage] Reusing existing Storefront token");
        storefrontToken = existingSession.storefront_access_token;
      } else {
        // Create new Storefront token
        storefrontToken = await this.createStorefrontToken(session);
      }
    }

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
      storefront_access_token: storefrontToken,
    };

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

    console.log(`[SupabaseSessionStorage] Successfully stored session for shop: ${session.shop}, id: ${session.id}, hasStorefrontToken: ${!!storefrontToken}`);
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
