# Product Aura

Product Aura turns one product photo into a complete set of listing and ad images for Amazon, Etsy, Shopify,
TikTok Shop and social ads. This repository holds the public parts: the **MCP server** connection details, the
**CLI** (`npx productaura`) and the **agent skill**. The web app is at [productaura.co](https://productaura.co).

1 credit makes one 2K image. New accounts get 12 free credits, no card needed.

## MCP server

Connect any MCP client to the remote server and sign in with your Product Aura account (OAuth 2.1, dynamic client
registration):

```json
{ "mcpServers": { "productaura": { "url": "https://productaura.co/api/mcp/account" } } }
```

With an API key instead (Settings → API keys), use `https://productaura.co/api/mcp` with the header
`Authorization: Bearer pa_…`. For clients without remote MCP support, run it locally over stdio:

```json
{ "mcpServers": { "productaura": { "command": "npx", "args": ["-y", "productaura", "mcp"], "env": { "PRODUCTAURA_API_KEY": "pa_…" } } } }
```

Claude Code: `claude mcp add --transport http productaura https://productaura.co/api/mcp/account`, then `/mcp` to
sign in. Setup for Claude, ChatGPT, Cursor and VS Code: [productaura.co/mcp](https://productaura.co/mcp).

Example prompts:

- Here's a photo of my soy candle. Make a full Etsy image set for it.
- Make Amazon listing images for this water bottle, with the text in German.
- Make the lifestyle shot warmer and put the mug on a marble counter.
- Check my Amazon images against Amazon's image rules before I upload them.

The server is listed in the [Official MCP Registry](https://registry.modelcontextprotocol.io) as
`co.productaura/productaura` ([server.json](server.json)).

## CLI

```bash
npx productaura login                 # paste an API key from https://productaura.co/app/settings?tab=api
npx productaura generate mug.jpg      # an Amazon set, saved to ./productaura
npx productaura generate mug.jpg --pack etsy --lang de
```

Every command, option and its credit cost: [cli/README.md](cli/README.md). npm:
[productaura](https://www.npmjs.com/package/productaura).

## Agent skill

[skills/productaura/SKILL.md](skills/productaura/SKILL.md) teaches an agent (Claude Code, OpenClaw, Hermes and
others) when and how to use the CLI and MCP server: which pack to pick, what each step costs, and to ask before
spending credits.

## Links

- Website: [productaura.co](https://productaura.co) · API: [productaura.co/api](https://productaura.co/api) ·
  Pricing: [productaura.co/pricing](https://productaura.co/pricing)
- Privacy: [productaura.co/legal/privacy](https://productaura.co/legal/privacy) · Terms:
  [productaura.co/legal/terms](https://productaura.co/legal/terms)
- Support: info@productaura.co

This repository is copied automatically from the Product Aura source on each CLI release; please open issues here.

## License

MIT, see [LICENSE](LICENSE). The CLI and skill are MIT; the Product Aura service has its own
[terms](https://productaura.co/legal/terms).
