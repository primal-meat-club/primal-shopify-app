# Footer Architecture

## Overview

The Primal 500 ecosystem has two frontend surfaces that need a consistent footer:

| Site | URL | Technology |
|------|-----|------------|
| Main Store | primal500.com | Shopify Theme (Liquid) |
| Members Portal | members.primal500.com | Next.js (Vercel) |

Both sites need to display the same footer links, and those links should be configurable from a single place.

## Why We Don't Use an App Embed for the Footer

We initially attempted to create a unified footer using a Shopify app embed block (`unified-footer-embed.liquid`). This approach **failed** due to a Shopify platform limitation:

> **Shopify app embed blocks are sandboxed and cannot access `linklists`** (the Liquid object for navigation menus).

This is by design. App embeds run in a restricted context with access to:
- `shop` object (basic shop info)
- `block.settings` (block configuration)
- `app` object (app metadata)

But they **cannot** access:
- `linklists` (navigation menus)
- `collections`
- `products`
- Most other theme Liquid objects

### What Happened

1. We created `extensions/unified-footer/blocks/unified-footer-embed.liquid`
2. The Liquid code tried to read menus: `{% assign links = linklists['footer-quick-links'] %}`
3. This returned empty because `linklists` is undefined in app embeds
4. The footer fell back to hardcoded URLs, which were incorrect
5. We diagnosed this as "menus not configured" but the real issue was platform limitation

### Decision

We deleted the `unified-footer` extension entirely on December 9, 2025 after confirming this limitation through investigation of Shopify's documentation and testing.

## Current Architecture: Data-Layer Unification

Instead of unifying the code, we unify the data source. Both sites read from the **same Shopify Navigation menus**:

```
┌─────────────────────────────────────────────────────────┐
│              Shopify Admin → Navigation                  │
│                                                          │
│   footer-quick-links    footer-shop    footer-help      │
│   footer-legal                                           │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────┐
│   primal500.com     │           │ members.primal500.com│
│                     │           │                     │
│  primal-footer.liquid│          │  ShopifyFooter.tsx  │
│                     │           │                     │
│  Reads via Liquid:  │           │  Reads via API:     │
│  linklists['...']   │           │  Storefront GraphQL │
└─────────────────────┘           └─────────────────────┘
```

### How Each Site Reads Menus

| Site | Implementation | Method |
|------|---------------|--------|
| primal500.com | `primal-theme/sections/primal-footer.liquid` | Liquid `linklists['footer-quick-links']` |
| members.primal500.com | `aura-shopify/frontend/components/ShopifyFooter.tsx` | Storefront API GraphQL |

### Menu Configuration

Configure these menus in **Shopify Admin → Navigation**:

| Menu Handle | Purpose | Example Links |
|-------------|---------|---------------|
| `footer-quick-links` | Primary footer links | About, Membership, Shop, Contact |
| `footer-shop` | Product categories | Burningwood, Private Chefs, Spices, Sauces, Knives |
| `footer-help` | Support links | FAQ, Shipping, Returns, Support |
| `footer-legal` | Legal pages | Privacy, Terms, Refunds, Cookies |

**Changes to these menus automatically update both sites.**

## File Reference

### Shopify Theme (primal-theme)
- **Footer Section**: `sections/primal-footer.liquid`
- **Footer Group**: `sections/footer-group.json`

### Members Portal (aura-shopify)
- **Footer Component**: `frontend/components/ShopifyFooter.tsx`
- **Menu API**: `frontend/app/api/shopify/footer-menus/route.ts`

## Updating Footer Links

1. Go to **Shopify Admin** → **Online Store** → **Navigation**
2. Click on the menu you want to edit (e.g., `footer-quick-links`)
3. Add, remove, or reorder links
4. Click **Save**
5. Both sites will reflect the changes (members portal fetches fresh data on each page load)

## Troubleshooting

### Footer shows wrong links on primal500.com
- Check that the theme section is using the correct menu handles
- Verify menus exist in Shopify Admin → Navigation

### Footer shows wrong links on members.primal500.com
- The API caches menu data briefly; try a hard refresh
- Check `/api/shopify/footer-menus` endpoint is returning correct data
- Verify Storefront API token has `unauthenticated_read_content` scope

### App embed still showing (duplicate footer)
1. Go to Shopify Admin → Online Store → Themes
2. Click **Customize** on the active theme
3. Click **App embeds** in the left sidebar
4. Toggle **OFF** "Luca AI Shopping Assistant" unified-footer-embed
5. Save

## History

- **Initial Attempt**: Created `unified-footer-embed.liquid` app extension
- **Problem Discovered**: App embeds cannot access `linklists` (Shopify sandboxing)
- **Solution**: Data-layer unification with two implementations reading same menus
- **Cleanup**: Deleted `extensions/unified-footer/` directory, closed PR #1
- **Date**: December 9, 2025
