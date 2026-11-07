---
name: productaura
description: Makes marketplace listing and ad images (Amazon main image, Amazon A+, Etsy, Shopify, social ads) from one product photo with Product Aura, through its MCP tools or the `npx productaura` CLI. Use when someone wants product listing photos, a white-background main image, infographics, lifestyle shots or ad creatives for an online store, wants to edit or redo such an image, or asks about their Product Aura credits.
compatibility: Needs internet access and either the Product Aura MCP server (https://productaura.co/api/mcp/account) or Node.js 20+ for `npx productaura`. Account tools need a Product Aura account or a PRODUCTAURA_API_KEY.
---

# Product Aura: listing images from one product photo

Product Aura turns one product photo into a complete set of listing and ad images for Amazon, Etsy, Shopify and
social ads. Images take about 1–3 minutes per set.

## Credits (read before spending anything)

- 1 credit = one 2K image. Each shot's cost is in the plan (most cost 1). `edit_image` and `regenerate_image`
  cost the same as the original image (usually 1).
- Free, no account: `list_packs`, `check_marketplace_spec` (any image against Amazon's main image rules).
- Other languages: `localize_image_set` makes a finished set in more languages (only the text changes; 1 credit per
  image with text per language). Call it with `dry_run: true` first and tell the person the cost.
- Free: `list_packs`, `create_product`, `answer_facts`, `store_look`, `list_brand_kits`, `save_brand_kit`, `plan_image_set`, `get_image_set`, `check_image_set`, `rate_image`,
  folders, `get_credit_balance`, `send_feedback`. Only `generate_image_set`, `edit_image` and `regenerate_image` spend.
- Paid plans start at $19/month; credit packs: `pack_s` 50,
  `pack_m` 150, `pack_l` 500.
- **Always tell the person the shots and the credit cost and wait for a clear yes before generating.** Never pass
  `--yes` to the CLI unless the person agreed to that exact cost.
- Images that fail are refunded automatically. Never pay on the person's behalf: `buy_credits` only returns a link
  the person opens and pays.

## Connect

- MCP with sign-in (Claude, ChatGPT, other connector apps): `https://productaura.co/api/mcp/account`.
- MCP with an API key: `https://productaura.co/api/mcp`, header `Authorization: Bearer pa_…` (keys:
  https://productaura.co/app/settings?tab=api). Without a key only `list_packs` works.
- Local stdio: `npx -y productaura mcp` with `PRODUCTAURA_API_KEY` set.
- CLI: `npx productaura login --key pa_…`, or set `PRODUCTAURA_API_KEY`.

If a tool answers that it needs an account, pass that message on: sign-up is free at https://productaura.co.

## Workflow with MCP tools

1. **Ask for the photo and the platform.** One clear photo of the real product (JPG, PNG or WebP, up to 15 MB).
   Packs: `amazon` (default), `amazon-aplus`, `etsy`, `shopify`, `tiktok-shop`, `social`. Ask for the language of text on the
   images if the store is not in English (`locale`: `de`, `fr`, `es`, `it`, `nl`, `ja`, …).
2. `list_packs` (only if the person wants to compare packs or shots).
3. `create_product` with `image_base64` (and `name` if given). It analyses the photo and returns `product_id`,
   the category `recipe` (the Amazon shot list) and up to 5 `missingFacts`, each with a question and an example.
   Optional: ask the person those questions (dimensions, pack count, key ingredients…) and save the answers with
   `answer_facts` (free). Never make values up; if they skip, shots that need numbers are made without them.
   For `shopify`: the images follow the product type (clothing, beauty, food…) and the person's **store look**.
   Once per store, ask for the backdrop colour, light and image shape (or a photo from their store) and save them
   with `store_look` (free); call it without arguments to see the current look.
   Brands: if the person has a brand (website, colours, fonts), save it once with `save_brand_kit` (free; with
   `website` it is read from the site; show them what was found). The default kit is used by every new set; pass
   `brand_kit_id` (or `"none"`) to `plan_image_set` to choose. More formats: `instagram-grid` (9 organic posts,
   posted from 9 to 1) and `storyboard` (a video storyboard sheet).
   For `amazon-aplus`: the modules follow the product's Amazon recipe. Ask whether they use Premium A+ (default,
   `aplus_format: premium`) or Basic (`basic`), and whether they want the text on the images (default) or typed into
   Amazon's A+ text fields (`aplus_text: fields`: each image keeps an empty copy zone and `get_image_set` returns
   each image's `copy` to paste in).
4. `plan_image_set` with `product_id`, `pack`, `locale`. Returns `image_set_id`, the shots with their credit costs
   and the balance. Show the shots and the total; mention optional shots if relevant.
5. After the person agrees: `generate_image_set` with `image_set_id` (and `shots` if they picked some). All or
   nothing: if the balance is too low nothing is charged; offer `buy_credits` or fewer shots.
6. `get_image_set` every 20–30 seconds until `done` is true. Show the previews and the `download_url`s (valid
   15 minutes; call again for fresh links) and the `page` link. Images with text are read back and checked:
   `text_check` is `passed`, `retried` (a free retry with a better text model fixed it), `differs` (tell the person
   the text may differ slightly; offer `edit_image` with the exact wording) or `not-checked`. The newest finished
   version per shot is the one to use.
7. `check_image_set` before the person uploads: it checks the platform's image rules (Amazon main image on white,
   sizes, Etsy's 1 MB warning, Shopify limits). Report any `warn` lines.
8. Improve single images:
   - `edit_image` with `generation_id` and a short instruction ("warmer light, add a marble counter",
     "make the headline say Leak-proof"). Keeps the product the same; makes a new version.
   - `regenerate_image` with `generation_id` makes the same shot again. Not for the Amazon main image on white
     (it is a cut-out of the photo); use `edit_image` for that.
   - Say the cost (usually 1 credit) before either, then poll `get_image_set` again.
9. `rate_image` on images the person likes (1) or dislikes (-1), with reasons when known: `product-changed`,
   `wrong-text`, `not-realistic`, `bad-composition`, `wrong-style`, `low-quality`.

Shortcut: the MCP prompt `make_listing_images` (args `platform`, `language`) runs steps 1–6.

## Organising

- `list_products` lists products (newest first) with their image sets.
- `list_folders`, `create_folder` (`name`, optional `parent_id`), `move_product` (`product_id`, `folder_id`; leave
  `folder_id` out to take it out of every folder). Useful per store, platform or client.
- `edit_product` (`product_id` plus any of `name`, `category`, `features`, `facts`, `setting`) corrects what was
  read from the product; later sets use it. Free.
- `delete_product` (`product_id`) removes a product and its image sets from the account. Free; ask the person first.

## Credits and payment

- `get_credit_balance` shows the balance.
- `buy_credits` with `pack` (`pack_s`, `pack_m`, `pack_l`) or `plan` (`creator`, `pro`, `business`) and `interval`
  (`month`, `year`) returns a Stripe link. Give the link to the person; nothing is charged by the tool.
- No account or key yet: `buy_credits` (works without sign-in) or `npx productaura buy` returns card links at
  https://productaura.co/buy. After paying, the person sees an API key once; use it with `login --key` or as
  `Authorization: Bearer pa_…`. A paid API call without a key answers 402 with the same links.

## Workflow with the CLI (`--json`)

Every command takes `--json` (result on stdout, progress on stderr; errors as `{"error": "…"}`).

```bash
npx productaura packs --json                      # free: packs, shots, credit cost per shot
npx productaura credits --json                    # balance
npx productaura look --backdrop "#EDEDED" --light soft-studio --ratio auto --json   # free: Shopify store look
# After the person agreed to the cost shown by 'packs' for the chosen shots:
npx productaura generate photo.jpg --pack etsy --lang de --shots main-white,lifestyle --out ./images --yes --json
npx productaura status <set-id> --json            # image ids and status
npx productaura download <set-id> --out ./images --json
npx productaura edit <image-id> "warmer light" --json      # 1 image's credits, new version
npx productaura regenerate <image-id> --json               # 1 image's credits, new version
npx productaura feedback "what worked, what did not" --json
```

- `generate` without `--yes` asks on a terminal and refuses when not interactive, so an agent must get the person's
  OK first and then pass `--yes`. Its JSON holds `imageSetId`, the saved `files`, any `failed` shots and `page`.
- `--no-wait` returns at once with `imageSetId`; use `status` and `download` later.
- Shot keys come from `packs`. Without `--shots` the pack's default shots are made.
- A+ sets: `--aplus-format basic` for Basic A+, `--aplus-text fields` to get `aplus-text.txt` instead of text on the
  images.
- Checking, rating and folders are MCP-only; edits and re-runs work in both.

## Good to tell sellers

- The Amazon main image is the real photo cut out on pure white; other shots are AI scenes. Ask the person to
  check product details and any text on the images before publishing.
- Images with realistic people (for example a hand) may need Amazon's AI-generated label.
- Pass on what the person liked or disliked with `rate_image` or `send_feedback`.
