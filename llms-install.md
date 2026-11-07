# Installing the Product Aura MCP server (for AI agents such as Cline)

Product Aura is a hosted service: there is nothing to clone or build. Pick one of the two setups below and add it to
the MCP settings file (for Cline: `cline_mcp_settings.json`).

## Option A: local stdio bridge with an API key (works in every client)

1. Ask the user for a Product Aura API key. They create one at https://productaura.co/app/settings?tab=api (it
   starts with `pa_`). New accounts get 12 free credits; 1 credit makes one 2K image.
2. Add this server entry (Node.js 20 or newer is needed for `npx`):

```json
{
  "mcpServers": {
    "productaura": {
      "command": "npx",
      "args": ["-y", "productaura", "mcp"],
      "env": { "PRODUCTAURA_API_KEY": "pa_..." }
    }
  }
}
```

## Option B: remote server

If the client supports remote MCP servers over Streamable HTTP:

- With sign-in (OAuth): `https://productaura.co/api/mcp/account`; the user signs in with their Product Aura account
  when asked.
- With an API key: `https://productaura.co/api/mcp` and the header `Authorization: Bearer pa_...`.

## Check it works

Call the `list_packs` tool: it lists the image packs (Amazon, Amazon A+, Etsy, Shopify, TikTok Shop, social ads)
and the credit cost of each image. It is free. Tools that make images spend credits, so always show the user the
plan and its cost and ask before generating.
