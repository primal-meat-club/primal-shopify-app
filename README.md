# Primal Shopify App

Shopify OAuth app for Primal 500 - handles merchant authentication and stores tokens in Supabase.

## Architecture

This app is the OAuth gateway for Shopify Admin API access:

```
Merchant installs app
        │
        ▼
OAuth flow (this app)
        │
        ▼
Token stored in Supabase (shopify_sessions table)
        │
        ▼
Backend (aura-shopify) reads token for Admin API calls
```

## Key Components

- **OAuth Handler**: `/auth` routes handle Shopify OAuth flow
- **Session Storage**: Tokens stored in Supabase `shopify_sessions` table
- **Theme Extension**: Unified footer for Shopify themes

## Database

This app writes to the shared Supabase database (owned by `aura-shopify` repo).

**Table**: `shopify_sessions`
- `id`: Shopify session ID
- `shop`: Store domain (e.g., primal500.myshopify.com)
- `access_token`: OAuth access token for Admin API
- `scope`: Granted permissions
- `is_online`: true=user session, false=offline token

## Development

```bash
# Install dependencies
npm install

# Run local development
npm run dev

# Deploy to Shopify
npm run deploy
```

## Environment Variables

See `.env.example` for required variables.

## Deployment

- **App**: Deployed to Vercel
- **Config**: Deployed via `shopify app deploy`

## Related Repos

- [aura-shopify](https://github.com/primal-meat-club/aura-shopify) - Main platform (owns Supabase schema)
