#!/usr/bin/env node
// Product Aura CLI: one product photo → a complete set of listing images, from the terminal or an AI agent.
// Zero dependencies, Node 20+. Talks to the public API (https://productaura.co/api/v1) with an API key.
// Every command takes --json for machine-readable output.
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const VERSION = '0.1.1';
const BASE = (process.env.PRODUCTAURA_URL || 'https://productaura.co').replace(/\/+$/, '');
const CONFIG = path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'productaura', 'config.json');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const HELP = `productaura ${VERSION}: listing images for Amazon, Etsy, Shopify, TikTok Shop and social ads from one product photo.

Usage
  productaura login [--key pa_…]            Save an API key (create one at ${BASE}/app/settings?tab=api)
  productaura logout                        Forget the saved key
  productaura credits                       Show your credit balance (1 credit = one 2K image)
  productaura buy [--pack pack_s|pack_m|pack_l]  Buy credits with a card, no account needed (opens the payment page)
  productaura packs                         List platform packs, their images and credit costs
  productaura generate <photo> [more photos] [key=value …] [options]
                                            Make a listing image set and download it. Optional product facts
                                            (printed word for word), e.g. dimensions="12 x 8 x 4 in (30 x 20 x 10 cm)"
      --url <link>      a product page (Amazon, Etsy, Shopify…) instead of photos: its photos and text are used
      --description <t> what the product is, in your words (guides the analysis)
      --pack <id>       amazon (default), amazon-aplus, etsy, shopify, tiktok-shop, social; more formats: instagram-grid
                        (9 organic posts), storyboard (a video storyboard sheet)
      --brand <id|none> brand kit for the text and colours (default: your default kit, if any)
      --aplus-format    amazon-aplus: basic (970 x 600 and 970 x 300, default) or premium (1464 x 600 modules,
                        only for brands Amazon approved for Premium A+)
      --aplus-text      amazon-aplus: image (text on the images, default) or fields (empty copy zones; the text is
                        saved as aplus-text.txt to paste into Amazon's A+ text fields)
      --lang <code>     language of text on the images: en (default), de, fr, es, it, nl, ja, …
      --keep-facts      print the product facts exactly as saved (default: translated into --lang, numbers kept)
      --rounds <1-5>    versions of each image to make, to pick the best on the set page (cost multiplies)
      --also <de,fr>    also make the set in these languages, automatically once it is done (images with text
                        cost 1 credit each per language; others are copied free)
      --shots <a,b>     only these shots (keys from 'packs'); default: the pack's default shots
      --note-all <text> your own wish for every image, e.g. --note-all "autumn mood, warm wood" (no extra cost)
      --note <key=text> your own wish for one image, e.g. --note "social-in-use=a beagle eating from a red bowl"
                        (shapes the scene, never the product; no extra cost)
      --name <text>     product name (default: from the photo)
      --out <dir>       where to save the images (default: ./productaura)
      --yes             do not ask before spending credits
      --no-wait         start and return; use 'status' and 'download' later
  productaura facts <product-id> key=value …  Save product facts for later sets (free; an empty value removes one)
  productaura product delete <product-id>   Delete a product and its image sets from your account (free)
  productaura look [options]                Show or change your store look, used by every Shopify set (free)
      --backdrop <hex>  backdrop colour, e.g. "#EDEDED"
      --backdrop-type   seamless, textured or scene
      --accent <hex>    accent colour for small props and type ("none" removes it)
      --light <mood>    soft-studio, hard-flash or natural-daylight
      --ratio <shape>   auto (square, 4:5 for clothing), 1:1, 4:5, 3:4 or 5:6
      --models <text>   how models look; --skin <text> skin tones; --faces show|crop
      --reference <photo>  a photo from your store to match; --no-reference removes it
      --brand <id>      the look of that brand kit (default: your account's look)
  productaura brand                         List your brand kits (colours, fonts, logo, voice; free)
  productaura brand import <website> [--default]   Make a brand kit from a website: name, colours, fonts, logo
  productaura brand set <id> [options]      Change a brand kit (free); only the options given change
      --name <text>     brand name; --voice <text> how it sounds, e.g. "warm, playful"
      --colors <hexes>  e.g. "#1A1A1A,#E8DCC8" (main colour first; "none" removes them)
      --heading <font>  Google Fonts family for headlines; --body <font> for small text ("none" removes)
      --logo <file>     PNG, JPG, WebP or SVG; --use-logo on|off puts it on the poster and grid name card
      --font-sample <file>  a picture of a paragraph in your font (for fonts not on Google Fonts)
      --default         use this kit for new sets by default
  productaura brand delete <id>             Delete a brand kit
  productaura localize <set-id> <de,fr,…>  The same set in other languages: only the text on the images is
                                            translated (1 credit per image with text per language; others free)
  productaura colours <set-id> "Navy #1F3A5F, Sage"
                                            The set's main image in other product colours (1 credit per color);
                                            --all for every image (1 credit per image with the product per color);
                                            a hex code is optional
  productaura add <set-id> [keys]           Add kinds of images a set does not have yet (lists them without keys;
                                            1 credit each)
  productaura history                       Your latest credit changes: spent, refunded, bought (free)
  productaura redo <image-id> --reason product|text --note "<what is wrong>"
                                            A free new version when the product or the text came out wrong
  productaura cancel <set-id>               Stop a set's images that are still waiting (refunded in full)
  productaura status <set-id>               Progress of an image set
  productaura download <set-id> [--out d]   Download the finished images of a set
  productaura edit <image-id> "<change>"    Change one image with a sentence (new version; 1 image's credits)
  productaura regenerate <image-id>         Make one image again (new version; 1 image's credits)
  productaura autotopup [on|off] [options]  Show or change auto top-up (off by default; buys a pack when low)
      --pack <id>       pack_s (50), pack_m (150) or pack_l (500 credits)
      --below <n>       top up when the balance falls below n credits: 5, 10, 20, 50, 100
      --max <n>         at most n top-ups a month: 1, 2, 3, 5, 10
  productaura feedback "<message>"          Tell the team what to improve
  productaura mcp                           Run as a local MCP server (stdio) for AI assistants

Global: --json (machine-readable output), --help, --version
Environment: PRODUCTAURA_API_KEY (instead of login), PRODUCTAURA_URL`;

// ---- small helpers ---------------------------------------------------------------------------------------------
function parse(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      if (v !== undefined) flags[k] = v;
      else if (
        i + 1 < argv.length &&
        !argv[i + 1].startsWith('--') &&
        ![
          'yes',
          'json',
          'no-wait',
          'help',
          'version',
          'no-reference',
          'default',
          'keep-facts',
          'all',
          'new-card',
        ].includes(k)
      )
        flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { flags, pos };
}
const { flags, pos } = parse(process.argv.slice(2));
const asJson = Boolean(flags.json);
const say = (msg) => {
  if (!asJson) process.stderr.write(`${msg}\n`);
};
const print = (data, human) => {
  if (asJson) process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  else process.stdout.write(`${human ?? JSON.stringify(data, null, 2)}\n`);
};
class CliError extends Error {}
const die = (msg, code = 1) => {
  if (asJson) process.stdout.write(`${JSON.stringify({ error: msg })}\n`);
  else process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
};

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG, 'utf8'));
  } catch {
    return {};
  }
}
function apiKey() {
  const k = process.env.PRODUCTAURA_API_KEY || readConfig().apiKey;
  if (!k)
    throw new CliError(
      `no API key. Run 'productaura login' (keys: ${BASE}/app/settings?tab=api), set PRODUCTAURA_API_KEY, or buy credits without an account: 'productaura buy'.`,
    );
  return k;
}

async function api(method, p, body, headers = {}, key = apiKey()) {
  let res;
  try {
    res = await fetch(`${BASE}/api/v1${p}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        'User-Agent': `productaura-cli/${VERSION}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new CliError(`could not reach ${BASE} (${e.message})`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CliError(data.message || `request failed (${res.status})`);
  return data;
}

const slug = (s) =>
  String(s || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'product';

async function confirm(question) {
  if (!process.stdin.isTTY)
    throw new CliError('this spends credits: pass --yes to confirm when not running interactively');
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const a = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  return a === 'y' || a === 'yes';
}

async function waitForSet(id) {
  let last = '';
  for (;;) {
    const r = await api('GET', `/image-sets/${id}`);
    // A free text retry joins the count only once it is finished (it replaces nothing until then).
    const gens = r.imageSet.generations.filter((g) => !g.textRetryOf || g.status === 'done');
    const ready = gens.filter((g) => g.status === 'done').length;
    const line = `  ${ready}/${gens.length} ready`;
    if (line !== last) say(line);
    last = line;
    if (r.done) return r.imageSet;
    await new Promise((res) => setTimeout(res, 4000));
  }
}

async function downloadSet(set, outDir) {
  const order = new Map(set.plan.shots.map((s, i) => [s.key, i]));
  const dir = path.join(outDir, slug(set.product?.name), set.pack);
  mkdirSync(dir, { recursive: true });
  const files = [];
  // Oldest first, so when a shot has several versions (edits, re-rolls) the newest finished one is the file kept.
  for (const g of set.generations.filter((x) => x.status === 'done' && x.imageUrl)) {
    const res = await fetch(g.imageUrl);
    if (!res.ok) continue;
    const ext = new URL(g.imageUrl).pathname.split('.').pop() || 'jpg';
    const n = String((order.get(g.shotKey) ?? 0) + 1).padStart(2, '0');
    const file = path.join(dir, `${n}-${g.shotKey}.${ext}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    files.push(file);
  }
  // A+: the text for Amazon's A+ text fields (all of it with --aplus-text fields, else what did not fit an image).
  const fields = set.plan.aplus?.text === 'fields';
  const blocks = set.generations
    .filter((g) => g.status === 'done' && g.copy?.length)
    .map((g) => ({ g, lines: g.copy.filter((l) => fields || l.role === 'body') }))
    .filter((b) => b.lines.length)
    .map(({ g, lines }) => [`${g.shotKey}:`, ...lines.map((l) => `  ${l.role}: ${l.text}`)].join('\n'));
  if (blocks.length) {
    const file = path.join(dir, 'aplus-text.txt');
    writeFileSync(file, `Text for Amazon's A+ text fields, per module:\n\n${[...new Set(blocks)].join('\n\n')}\n`);
    files.push(file);
  }
  return {
    dir,
    files,
    failed: set.generations
      .filter((x) => x.status === 'failed' && !x.textRetryOf)
      .map((x) => ({ shot: x.shotKey, error: x.error })),
    // The version kept per shot is the last finished one (the order the API returns).
    textDiffers: [...new Map(set.generations.filter((x) => x.status === 'done').map((x) => [x.shotKey, x])).values()]
      .filter((x) => x.textCheck?.status === 'differs')
      .map((x) => x.shotKey),
  };
}

/** key=value arguments → { key: value } (product facts; keys from missingFacts, e.g. dimensions, pack-count). */
function factArgs(args) {
  const out = {};
  for (const a of args) {
    const i = a.indexOf('=');
    if (i < 1) throw new CliError(`expected key=value, got '${a}'`);
    out[a.slice(0, i).trim().toLowerCase()] = a.slice(i + 1).trim();
  }
  return out;
}

// ---- commands ---------------------------------------------------------------------------------------------------
const commands = {
  async login() {
    let key = typeof flags.key === 'string' ? flags.key : '';
    if (!key) {
      if (!process.stdin.isTTY)
        throw new CliError('pass --key pa_… (create a key at ' + `${BASE}/app/settings?tab=api)`);
      const rl = createInterface({ input: process.stdin, output: process.stderr });
      key = (await rl.question(`API key (create one at ${BASE}/app/settings?tab=api): `)).trim();
      rl.close();
    }
    if (!key.startsWith('pa_')) throw new CliError('that does not look like a Product Aura key (pa_…)');
    const me = await api('GET', '/me', undefined, {}, key);
    mkdirSync(path.dirname(CONFIG), { recursive: true });
    writeFileSync(CONFIG, JSON.stringify({ apiKey: key }, null, 2));
    try {
      chmodSync(CONFIG, 0o600);
    } catch {
      /* Windows */
    }
    print({ ok: true, email: me.email, balance: me.balance }, `Signed in as ${me.email} · ${me.balance} credits`);
  },
  async logout() {
    if (existsSync(CONFIG)) rmSync(CONFIG);
    print({ ok: true }, 'Key removed from this computer. Revoke it in Settings if it may have leaked.');
  },
  async credits() {
    const me = await api('GET', '/me');
    print(me, `${me.balance} credits (${me.email}) · 1 credit = one 2K image`);
  },
  /** Credits without an account: opens /buy for a pack (the page after payment shows a key for 'login --key'). */
  async buy() {
    const res = await fetch(`${BASE}/api/v1/catalog`).catch((e) => {
      throw new CliError(`could not reach ${BASE} (${e.message})`);
    });
    const offer = (await res.json()).buyWithoutAccount ?? { buyUrl: `${BASE}/buy`, packs: [] };
    const wanted = typeof flags.pack === 'string' ? flags.pack : null;
    const pick = wanted ? offer.packs.find((p) => p.pack === wanted) : null;
    if (wanted && !pick) throw new CliError(`unknown pack '${wanted}'; use pack_s, pack_m or pack_l`);
    const url = pick?.url ?? offer.buyUrl;
    if (!flags.json && process.stdout.isTTY) {
      const opener =
        process.platform === 'win32'
          ? ['cmd', ['/c', 'start', '', url]]
          : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
      try {
        spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
      } catch {
        // no browser: the link is printed below
      }
    }
    print(
      { url, packs: offer.packs },
      [
        ...offer.packs.map((p) => `${p.pack.padEnd(8)} ${String(p.credits).padStart(4)} credits  $${p.usd}  ${p.url}`),
        '',
        `Pay at: ${url}`,
        'The page after payment shows your API key once. Then: productaura login --key pa_…',
      ].join('\n'),
    );
  },
  async packs() {
    const res = await fetch(`${BASE}/api/v1/catalog`);
    const c = await res.json();
    print(
      c,
      c.packs
        .map(
          (p) =>
            `${p.id}  ${p.label}\n` +
            p.shots
              .map(
                (s) =>
                  `   ${s.default ? '•' : '◦'} ${s.key.padEnd(22)} ${s.credits} credit${s.credits === 1 ? '' : 's'}  ${s.label}`,
              )
              .join('\n'),
        )
        .join('\n\n') + '\n\n• default shot  ◦ optional (use --shots)',
    );
  },
  async facts() {
    const id = pos[1];
    const facts = factArgs(pos.slice(2));
    if (!id || !Object.keys(facts).length)
      throw new CliError(
        'productaura facts <product-id> dimensions="12 x 8 x 4 in (30 x 20 x 10 cm)" pack-count="6 bins"',
      );
    const { product } = await api('POST', `/products/${id}/facts`, { facts });
    const left = product.profile.missingFacts ?? [];
    print(
      { product },
      [
        `Saved. ${product.profile.facts.length} facts on ${product.name}.`,
        ...(left.length
          ? ['Still worth adding:', ...left.map((f) => `  ${f.key}  ${f.question} (e.g. ${f.example})`)]
          : []),
      ].join('\n'),
    );
  },
  async look() {
    const str = (k) => (typeof flags[k] === 'string' ? flags[k] : undefined);
    const change = {
      ...(str('backdrop') ? { backdropColor: str('backdrop') } : {}),
      ...(str('backdrop-type') ? { backdropType: str('backdrop-type') } : {}),
      ...(str('accent') ? { accentColor: str('accent') === 'none' ? null : str('accent') } : {}),
      ...(str('light') ? { light: str('light') } : {}),
      ...(str('ratio') ? { ratio: str('ratio') } : {}),
      ...(str('models') !== undefined ? { modelLook: str('models') } : {}),
      ...(str('skin') !== undefined ? { skinTones: str('skin') } : {}),
      ...(str('faces') ? { faces: str('faces') } : {}),
      ...(flags['no-reference'] ? { removeReference: true } : {}),
    };
    const ref = str('reference');
    if (ref) {
      const mime = MIME[path.extname(ref).toLowerCase()];
      if (!mime) throw new CliError('use a .jpg, .png or .webp photo for --reference');
      const bytes = readFileSync(ref);
      if (bytes.length > 15 * 1024 * 1024) throw new CliError('photos can be up to 15 MB');
      const up = await api('POST', '/uploads', { contentType: mime, size: bytes.length });
      const put = await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: bytes });
      if (!put.ok) throw new CliError(`the reference photo did not upload (${put.status})`);
      change.referenceUploadId = up.uploadId;
    }
    const brand = str('brand');
    const r = Object.keys(change).length
      ? await api('POST', '/store-look', { ...change, ...(brand ? { brandKitId: brand } : {}) })
      : await api('GET', `/store-look${brand ? `?brandKitId=${encodeURIComponent(brand)}` : ''}`);
    const l = r.storeLook;
    print(
      r,
      [
        `Store look${Object.keys(change).length ? ' saved' : ''} (used by every Shopify set):`,
        `  Backdrop: ${l.backdropColor}, ${l.backdropType}${l.accentColor ? ` · accent ${l.accentColor}` : ''}`,
        `  Light: ${l.light} · shape: ${l.ratio === 'auto' ? 'square, 4:5 for clothing' : l.ratio}`,
        `  Models: ${l.modelLook || 'natural, relaxed'} · skin tones: ${l.skinTones || 'a mix'} · faces: ${l.faces}`,
        `  Reference photo: ${l.hasReference ? 'yes' : 'none'}`,
      ].join('\n'),
    );
  },
  async product() {
    if (pos[1] !== 'delete' || !pos[2]) throw new CliError('productaura product delete <product-id>');
    const r = await api('DELETE', `/products/${pos[2]}`);
    return print(r, 'Product deleted, with its image sets.');
  },
  async brand() {
    const sub = pos[1];
    const str = (k) => (typeof flags[k] === 'string' ? flags[k] : undefined);
    const show = (k) =>
      [
        `${k.name}${k.isDefault ? ' (default)' : ''}  ${k.id}`,
        `  Colours: ${k.palette.join(' ') || 'none'} · fonts: ${[k.headingFont, k.bodyFont].filter(Boolean).join(' + ') || 'none'}${k.hasCustomFontSample ? ' (own sample)' : ''}`,
        `  Logo: ${k.logoUrl ? (k.useLogo ? 'yes, used on the poster and grid' : 'saved, not used') : 'none'}${k.voice ? ` · voice: ${k.voice}` : ''}`,
      ].join('\n');
    if (!sub || sub === 'list') {
      const r = await api('GET', '/brand-kits');
      return print(
        r,
        r.brandKits.length
          ? r.brandKits.map(show).join('\n')
          : 'No brand kits yet. Try: productaura brand import <website>',
      );
    }
    if (sub === 'delete') {
      if (!pos[2]) throw new CliError('which kit? productaura brand delete <id>');
      const r = await api('DELETE', `/brand-kits/${pos[2]}`);
      return print(r, 'Brand kit deleted.');
    }
    const picture = async (file, field) => {
      const ext = path.extname(file).toLowerCase();
      const bytes = readFileSync(file);
      if (bytes.length > 15 * 1024 * 1024) throw new CliError('pictures can be up to 15 MB');
      if (ext === '.svg') return { [`${field}ImageBase64`]: bytes.toString('base64') };
      const mime = MIME[ext];
      if (!mime) throw new CliError(`use a .png, .jpg, .webp${field === 'logo' ? ' or .svg' : ''} file`);
      const up = await api('POST', '/uploads', { contentType: mime, size: bytes.length });
      const put = await fetch(up.uploadUrl, { method: 'PUT', headers: up.headers, body: bytes });
      if (!put.ok) throw new CliError(`the picture did not upload (${put.status})`);
      return { [`${field}UploadId`]: up.uploadId };
    };
    const fonts = (v) => (v === 'none' ? null : v);
    const change = {
      ...(str('name') ? { name: str('name') } : {}),
      ...(str('voice') !== undefined ? { voice: str('voice') } : {}),
      ...(str('colors')
        ? {
            palette:
              str('colors') === 'none'
                ? []
                : str('colors')
                    .split(/[\s,]+/)
                    .filter(Boolean),
          }
        : {}),
      ...(str('heading') ? { headingFont: fonts(str('heading')) } : {}),
      ...(str('body') ? { bodyFont: fonts(str('body')) } : {}),
      ...(str('use-logo') ? { useLogo: str('use-logo') === 'on' } : {}),
      ...(flags.default ? { isDefault: true } : {}),
      ...(str('logo') ? await picture(str('logo'), 'logo') : {}),
      ...(str('font-sample') ? await picture(str('font-sample'), 'fontSample') : {}),
    };
    if (sub === 'import') {
      if (!pos[2]) throw new CliError('which website? productaura brand import https://example.com');
      say('Reading the website…');
      const r = await api('POST', '/brand-kits', { website: pos[2], ...change });
      const found = r.imported?.found?.length
        ? r.imported.found.join(', ')
        : 'nothing usable; fill it in with brand set';
      return print(
        r,
        `${show(r.brandKit)}\n  Found: ${found}. Check it, and change anything with: productaura brand set ${r.brandKit.id} …`,
      );
    }
    if (sub === 'set') {
      if (!pos[2]) throw new CliError('which kit? productaura brand set <id> --colors "#1A1A1A,#E8DCC8"');
      const r = await api('POST', `/brand-kits/${pos[2]}`, change);
      return print(r, `Saved.\n${show(r.brandKit)}`);
    }
    if (sub === 'new') {
      const r = await api('POST', '/brand-kits', change);
      return print(r, `Saved.\n${show(r.brandKit)}`);
    }
    throw new CliError('productaura brand [list | import <website> | new | set <id> | delete <id>]');
  },
  async generate() {
    // Photos: every argument that is an image file (other angles of the same product, the first one main); the
    // rest are facts (key=value). Or --url <product page> instead of photos.
    const photos = pos.slice(1).filter((a) => MIME[path.extname(a).toLowerCase()] && existsSync(a));
    const url = typeof flags.url === 'string' ? flags.url : '';
    if (!photos.length && !url)
      throw new CliError('which photo? productaura generate <photo.jpg> [more angles…] (or --url <product page>)');
    const images = photos.slice(0, 6).map((file) => {
      const bytes = readFileSync(file);
      if (bytes.length > 15 * 1024 * 1024) throw new CliError(`${file}: photos can be up to 15 MB`);
      return bytes.toString('base64');
    });
    const pack = typeof flags.pack === 'string' ? flags.pack : 'amazon';
    const locale = typeof flags.lang === 'string' ? flags.lang : 'en';
    say(
      url
        ? 'Reading the product page…'
        : `Reading your product (${images.length} photo${images.length === 1 ? '' : 's'})…`,
    );
    const { product } = await api('POST', '/products', {
      ...(url ? { url } : { imageBase64: images[0], extraImagesBase64: images.slice(1) }),
      ...(typeof flags.name === 'string' ? { name: flags.name } : {}),
      ...(typeof flags.description === 'string' ? { description: flags.description } : {}),
    });
    say(`  ${product.name}`);
    const given = factArgs(pos.slice(1).filter((a) => !photos.includes(a)));
    if (Object.keys(given).length) await api('POST', `/products/${product.id}/facts`, { facts: given });
    const aplus = {
      ...(typeof flags['aplus-format'] === 'string' ? { format: flags['aplus-format'] } : {}),
      ...(typeof flags['aplus-text'] === 'string' ? { text: flags['aplus-text'] } : {}),
    };
    const plan = await api('POST', '/image-sets', {
      productId: product.id,
      pack,
      locale,
      ...(pack === 'amazon-aplus' ? { aplus } : {}),
      ...(typeof flags.brand === 'string' ? { brandKitId: flags.brand === 'none' ? null : flags.brand } : {}),
    });
    if (plan.plan?.brand) say(`  Brand: ${plan.plan.brand.name}`);
    // The pack's own questions: a Shopify set asks about its product type (shade, fit, flavour…).
    const missing = plan.missingFacts ?? [];
    if (missing.length) {
      say('Details that make these images sell (optional; shots that need them are made without numbers):');
      for (const f of missing) say(`  ${f.key}="…"  ${f.question} e.g. ${f.example}`);
      say(`  Add them with: productaura facts ${product.id} key="value" …`);
    }
    const wanted =
      typeof flags.shots === 'string'
        ? flags.shots
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
    const shots = plan.plan.shots.filter((s) => (wanted ? wanted.includes(s.key) : s.enabled));
    if (!shots.length) throw new CliError(`none of those shots exist in ${pack}; see 'productaura packs'`);
    const cost = shots.reduce((n, s) => n + s.credits, 0);
    say(`${pack}: ${shots.map((s) => s.label).join(', ')}`);
    say(`Cost: ${cost} credits · balance ${plan.balance}`);
    if (cost > plan.balance)
      throw new CliError(
        `not enough credits (${plan.balance}); buy more with 'productaura buy' or at ${BASE}/app/billing`,
      );
    if (!flags.yes && !(await confirm(`Spend ${cost} credits?`))) throw new CliError('cancelled; nothing was charged');
    const gen = await api(
      'POST',
      `/image-sets/${plan.imageSetId}/generate`,
      {
        shots: shots.map((s) => s.key),
        ...(flags['keep-facts'] ? { translateFacts: false } : {}),
        ...(typeof flags.also === 'string' ? { alsoLocales: flags.also.split(/[\s,]+/).filter(Boolean) } : {}),
        ...(typeof flags.rounds === 'string' ? { rounds: Number(flags.rounds) } : {}),
        ...(typeof flags['note-all'] === 'string' ? { note: flags['note-all'] } : {}),
        ...(typeof flags.note === 'string' && flags.note.includes('=')
          ? {
              notes: {
                [flags.note.slice(0, flags.note.indexOf('=')).trim()]: flags.note
                  .slice(flags.note.indexOf('=') + 1)
                  .trim(),
              },
            }
          : {}),
      },
      { 'Idempotency-Key': randomUUID() },
    );
    say(`Making ${gen.generationIds.length} images (about 1–3 minutes)…`);
    if (flags['no-wait']) {
      print(
        { imageSetId: plan.imageSetId, generationIds: gen.generationIds, balance: gen.balance },
        `Started. Check with: productaura status ${plan.imageSetId}`,
      );
      return;
    }
    const set = await waitForSet(plan.imageSetId);
    const out = await downloadSet(set, typeof flags.out === 'string' ? flags.out : 'productaura');
    print(
      { imageSetId: set.id, product: set.product?.name, pack: set.pack, ...out, page: `${BASE}/app/sets/${set.id}` },
      `Saved ${out.files.length} images to ${out.dir}${out.failed.length ? `\n${out.failed.length} failed (credits refunded)` : ''}` +
        `${out.textDiffers.length ? `\nText may differ slightly on: ${out.textDiffers.join(', ')} (edit or regenerate)` : ''}` +
        `\nView: ${BASE}/app/sets/${set.id}`,
    );
  },
  async localize() {
    const [, id, langs] = pos;
    if (!id || !langs) throw new CliError('productaura localize <set-id> de,fr');
    const locales = langs.split(/[\s,]+/).filter(Boolean);
    const q = await api('POST', `/image-sets/${id}/localize`, { locales, dryRun: true });
    say(
      `${q.withText} image${q.withText === 1 ? '' : 's'} with text are translated, ${q.copied} copied free: ` +
        `${q.credits} credits for ${q.languages.join(', ')}.`,
    );
    if (q.credits && !flags.yes && !(await confirm(`Spend ${q.credits} credits?`)))
      throw new CliError('cancelled; nothing was charged');
    const r = await api('POST', `/image-sets/${id}/localize`, { locales }, { 'Idempotency-Key': randomUUID() });
    print(
      r,
      ['Started:', ...r.sets.map((s) => `  ${s.locale}: productaura download ${s.imageSetId}  (when done)`)].join('\n'),
    );
  },
  async colours() {
    const [, id, ...rest] = pos;
    const list = rest.join(' ');
    if (!id || !list.trim()) throw new CliError('productaura colours <set-id> "Navy #1F3A5F, Sage"');
    const colours = list
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const hex = c.match(/#[0-9a-f]{6}\b/i)?.[0];
        return { name: c.replace(hex ?? '', '').trim() || hex, ...(hex ? { hex } : {}) };
      });
    const all = flags.all === true ? { allImages: true } : {};
    const q = await api('POST', `/image-sets/${id}/recolour`, { colours, ...all, dryRun: true });
    say(
      `${q.recoloured} image${q.recoloured === 1 ? '' : 's'} with the product are recoloured, ${q.copied} copied free: ` +
        `${q.credits} credits for ${q.colours.join(', ')}.`,
    );
    if (q.credits && !flags.yes && !(await confirm(`Spend ${q.credits} credits?`)))
      throw new CliError('cancelled; nothing was charged');
    const r = await api('POST', `/image-sets/${id}/recolour`, { colours, ...all }, { 'Idempotency-Key': randomUUID() });
    print(
      r,
      ['Started:', ...r.sets.map((s) => `  ${s.colour}: productaura download ${s.imageSetId}  (when done)`)].join('\n'),
    );
  },
  async add() {
    const [, id, keys] = pos;
    if (!id) throw new CliError('productaura add <set-id> [key,key]');
    const { imageSet } = await api('GET', `/image-sets/${id}`);
    const more = imageSet.moreShots ?? [];
    if (!keys) {
      return print(
        { moreShots: more },
        more.length
          ? [
              'Images this set can add:',
              ...more.map((s) => `  ${s.key}  ${s.label} (${s.credits} credit)`),
              `Add them: productaura add ${id} ${more[0].key}`,
            ].join('\n')
          : 'This set already has every kind of image.',
      );
    }
    const shots = keys.split(/[\s,]+/).filter(Boolean);
    const cost = more.filter((s) => shots.includes(s.key)).reduce((n, s) => n + s.credits, 0);
    if (!flags.yes && !(await confirm(`Spend ${cost} credits?`))) throw new CliError('cancelled; nothing was charged');
    const r = await api('POST', `/image-sets/${id}/generate`, { shots }, { 'Idempotency-Key': randomUUID() });
    print(r, `Making ${r.generationIds.length} images. Download when done: productaura download ${id}`);
  },
  async history() {
    const r = await api('GET', '/credits/history?limit=30');
    print(
      r,
      r.entries.length
        ? r.entries
            .map((e) => `${e.at.slice(0, 16).replace('T', ' ')}  ${e.change > 0 ? '+' : ''}${e.change}  ${e.reason}`)
            .join('\n')
        : 'No credit changes yet.',
    );
  },
  async redo() {
    const id = pos[1];
    const reason = flags.reason === 'text' ? 'wrong-text' : flags.reason === 'product' ? 'product-changed' : '';
    const note = typeof flags.note === 'string' ? flags.note : '';
    if (!id || !reason || note.length < 10)
      throw new CliError('productaura redo <image-id> --reason product|text --note "what is wrong (10+ characters)"');
    const r = await api('POST', `/generations/${id}/redo`, { reason, note });
    print(r, `Free redo started (${r.leftForImage} left for this image). Check it with: productaura status <set-id>`);
  },
  async cancel() {
    const id = pos[1];
    if (!id) throw new CliError('productaura cancel <set-id>');
    const r = await api('POST', `/image-sets/${id}/cancel`, {});
    print(
      r,
      `Cancelled ${r.cancelled} waiting image${r.cancelled === 1 ? '' : 's'}, ${r.refunded} credits refunded` +
        (r.running ? `; ${r.running} already being made will finish.` : '.'),
    );
  },
  async status() {
    const id = pos[1];
    if (!id) throw new CliError('which set? productaura status <set-id>');
    const r = await api('GET', `/image-sets/${id}`);
    print(
      {
        done: r.done,
        pending: r.pending,
        images: r.imageSet.generations.map((g) => ({
          id: g.id,
          shot: g.shotKey,
          status: g.status,
          error: g.error,
          text: g.textCheck?.status ?? null,
        })),
      },
      r.imageSet.generations
        .map(
          (g) =>
            `${g.status.padEnd(10)} ${String(g.shotKey).padEnd(22)} ${g.id}` +
            `${g.textCheck ? `  text: ${g.textCheck.status}${g.textRetryOf ? ' (free retry)' : ''}` : ''}` +
            `${g.error ? `  (${g.error})` : ''}`,
        )
        .join('\n'),
    );
  },
  async download() {
    const id = pos[1];
    if (!id) throw new CliError('which set? productaura download <set-id>');
    const r = await api('GET', `/image-sets/${id}`);
    const out = await downloadSet(r.imageSet, typeof flags.out === 'string' ? flags.out : 'productaura');
    print(out, `Saved ${out.files.length} images to ${out.dir}`);
  },
  async edit() {
    const id = pos[1];
    const instruction = pos.slice(2).join(' ').trim();
    if (!id || !instruction) throw new CliError('productaura edit <image-id> "warmer light, add a marble counter"');
    const r = await api('POST', `/generations/${id}/edit`, { instruction }, { 'Idempotency-Key': randomUUID() });
    print(
      r,
      `Editing (${r.cost} credit${r.cost === 1 ? '' : 's'}, balance ${r.balance}). Check with: productaura status ${r.imageSetId}`,
    );
  },
  async regenerate() {
    const id = pos[1];
    if (!id) throw new CliError('which image? productaura regenerate <image-id> (ids: productaura status <set-id>)');
    const r = await api('POST', `/generations/${id}/regenerate`, {}, { 'Idempotency-Key': randomUUID() });
    print(
      r,
      `Making it again (${r.cost} credit${r.cost === 1 ? '' : 's'}, balance ${r.balance}). Check with: productaura status ${r.imageSetId}`,
    );
  },
  async autotopup() {
    const action = pos[1];
    if (action && action !== 'on' && action !== 'off')
      throw new CliError('productaura autotopup [on|off] [--pack pack_m] [--below 20] [--max 3] [--new-card]');
    const change = {
      ...(action ? { enabled: action === 'on' } : {}),
      ...(typeof flags.pack === 'string' ? { pack: flags.pack } : {}),
      ...(flags.below !== undefined ? { threshold: Number(flags.below) } : {}),
      ...(flags.max !== undefined ? { monthlyMax: Number(flags.max) } : {}),
      ...(flags['new-card'] ? { enabled: action !== 'off', newCard: true } : {}),
    };
    const r = Object.keys(change).length ? await api('POST', '/auto-topup', change) : await api('GET', '/auto-topup');
    const t = r.autoTopUp;
    const price = (t.priceCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const lines = [
      `Auto top-up: ${t.enabled ? 'on' : 'off'}`,
      `Buys ${t.pack} (${price}) when the balance falls below ${t.threshold} credits, at most ${t.monthlyMax} times a month (${t.usedThisMonth} so far).`,
      t.card ? `Card: ${t.card.brand} ending ${t.card.last4}` : 'No card saved yet.',
      ...(t.error ? [`Last problem: ${t.error}`] : []),
      ...(r.cardSetupUrl ? [`Save a card to switch it on (nothing is charged now): ${r.cardSetupUrl}`] : []),
    ];
    print(r, lines.join('\n'));
  },
  async feedback() {
    const message = pos.slice(1).join(' ').trim();
    if (!message) throw new CliError('productaura feedback "what should we improve?"');
    await api('POST', '/feedback', { message });
    print({ ok: true }, 'Thanks! We read every message.');
  },
  /** stdio MCP bridge: JSON-RPC lines on stdin → the remote MCP endpoint → responses on stdout. */
  async mcp() {
    const key = process.env.PRODUCTAURA_API_KEY || readConfig().apiKey;
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      try {
        const res = await fetch(`${BASE}/api/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
          body: JSON.stringify(msg),
        });
        if (res.status === 202 || msg.id === undefined) continue; // notifications have no response
        const text = await res.text();
        const payloads = text.includes('data:')
          ? text
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim())
          : [text];
        for (const p of payloads) if (p) process.stdout.write(`${p}\n`);
      } catch (e) {
        if (msg.id !== undefined)
          process.stdout.write(
            `${JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: `Product Aura unreachable: ${e.message}` } })}\n`,
          );
      }
    }
  },
};

const cmd = pos[0];
if (flags.version) {
  process.stdout.write(`${VERSION}\n`);
} else if (!cmd || flags.help || cmd === 'help') {
  process.stdout.write(`${HELP}\n`);
} else if (!commands[cmd]) {
  die(`unknown command '${cmd}'. Run 'productaura --help'.`);
} else {
  commands[cmd]().catch((e) => die(e instanceof CliError ? e.message : `unexpected error: ${e.message}`));
}
