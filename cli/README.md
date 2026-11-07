# productaura

Turn one product photo into a complete set of listing images for Amazon, Etsy, Shopify and social ads, from your
terminal or an AI assistant. 1 credit = one 2K image.

```bash
npx productaura login                 # paste an API key from https://productaura.co/app/settings?tab=api
npx productaura generate mug.jpg      # Amazon set, text in English, saved to ./productaura
```

## Commands

| Command | What it does |
| --- | --- |
| `login [--key pa_…]` | Saves your API key (or set `PRODUCTAURA_API_KEY`). |
| `credits` | Shows your credit balance. |
| `buy [--pack pack_s\|pack_m\|pack_l]` | Opens the card payment page for credits, no account needed. The page after payment shows an API key for `login --key`. |
| `packs` | Lists platform packs, their images and the credit cost of each. Free, no key needed. |
| `generate <photo> [more photos] [key=value …]` | Analyses the photo, lists the product facts worth adding, shows the plan and its cost, asks before spending, makes the images and downloads them. Facts given as `key=value` are printed word for word, e.g. `dimensions="12 x 8 x 4 in (30 x 20 x 10 cm)"`. |
| `facts <product-id> key=value …` | Saves product facts (keys from the list `generate` prints, e.g. `pack-count`, `key-ingredients`) for every later set. Free; an empty value removes one. |
| `look [options]` | Shows or saves your store look, used by every Shopify set so the whole catalogue matches: `--backdrop "#EDEDED" --light soft-studio --ratio 4:5 --faces crop --reference store-photo.jpg`. Free. |
| `brand [import <website> \| set <id> \| delete <id>]` | Lists or saves brand kits: colours, fonts, logo and voice. `brand import https://example.com` reads them from the brand's website; `brand set <id> --colors "#1A1A1A,#E8DCC8" --heading "Playfair Display" --use-logo on` changes one. Text on images is set in the kit's fonts, designed images take its colours. `generate --brand <id\|none>` picks a kit (default: your default kit). Free. |
| `colours <set-id> "Navy #1F3A5F, Sage"` | Makes the set in other colours of the product: the same images with only the product's colour changed. A hex code per colour is optional. Shows the cost, asks, then starts one new set per colour. 1 credit per image with the product per colour; images without it are copied free. |
| `add <set-id> [keys]` | Lists the kinds of images a finished set does not have yet (other angles, another scene, close-up…), or makes the ones you name in the same set. 1 credit each. |
| `localize <set-id> <de,fr,…>` | Makes the set in other languages: the same images with only the text translated (numbers, units and your product unchanged). Shows the cost, asks, then starts one new set per language. 1 credit per image with text per language; images without text are copied free. |
| `status <set-id>` | Progress of an image set, with each image's id and its text check (`passed`, `retried`, `differs`, `not-checked`). Free. |
| `download <set-id>` | Downloads the finished images of a set (the version shown for each shot) and names any whose text may still differ. Free. |
| `edit <image-id> "<change>"` | Changes one image with a sentence, e.g. `"warmer light"`. Makes a new version; costs one image's credits. |
| `regenerate <image-id>` | Makes one image again with the same prompt. New version; costs one image's credits. |
| `autotopup [on\|off]` | Shows or changes auto top-up (off by default): buys a pack with the card saved for auto top-up when the balance falls below a level. `--pack pack_m --below 20 --max 3`; `--new-card` returns a link to replace the card. Free; each top-up is a normal pack purchase. |
| `feedback "<text>"` | Sends feedback to the team. |
| `mcp` | Runs a local MCP server over stdio for assistants without remote MCP support. |

`generate` options: `--pack amazon|amazon-aplus|etsy|shopify|tiktok-shop|social` (default `amazon`), `--lang de` (language of
text on the images), `--shots main-white,lifestyle`, `--name "Soy candle"`, `--out ./images`, `--yes` (no
confirmation, for scripts and agents), `--no-wait`. For `amazon-aplus`: `--aplus-format basic|premium` (970 × 600
and 970 × 300, the default; or 1464 × 600 modules for brands approved for Premium A+) and `--aplus-text image|fields` (`fields` leaves an empty copy zone on each module
and saves the text as `aplus-text.txt` for Amazon's A+ text fields).

Every command accepts `--json` for machine-readable output on stdout; progress goes to stderr.

## Examples

```bash
npx productaura generate candle.jpg --pack etsy
npx productaura generate bins.jpg dimensions="12 x 8 x 4 in (30 x 20 x 10 cm)" pack-count="6 bins" --yes
npx productaura generate bottle.png --pack amazon --lang de --out ./amazon-de --yes --json
npx productaura look --backdrop "#E8E2DA" --ratio 4:5    # once per store, before Shopify sets
for f in photos/*.jpg; do npx productaura generate "$f" --pack shopify --yes; done
```

## Use with AI assistants (MCP)

Remote with sign-in (Claude, ChatGPT and other connector-capable apps): add `https://productaura.co/api/mcp/account`
and sign in when asked. Remote with an API key: `https://productaura.co/api/mcp` with the header
`Authorization: Bearer pa_…`.
Local stdio, for clients that only run commands:

```json
{ "mcpServers": { "productaura": { "command": "npx", "args": ["-y", "productaura", "mcp"], "env": { "PRODUCTAURA_API_KEY": "pa_…" } } } }
```

API reference: https://productaura.co/api
