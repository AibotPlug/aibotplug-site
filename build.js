import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Mustache from 'mustache';
import Airtable from 'airtable';

// ─────────────────────────────────────────────────────────────────────────────
// Polyfill __dirname for ES modules
// ─────────────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// 1) Airtable setup — uses env vars or fallback placeholders
// ─────────────────────────────────────────────────────────────────────────────
Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY || 'YOUR_API_KEY' });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID || 'YOUR_BASE_ID');

// ─────────────────────────────────────────────────────────────────────────────
// 2) Load shared partials (header.html, footer.html, common.css)
// ─────────────────────────────────────────────────────────────────────────────
async function loadPartials() {
  const dir = path.join(__dirname, 'templates', 'partials');
  const files = await fs.readdir(dir);
  const partials = {};
  for (const file of files) {
    const name = path.parse(file).name;
    partials[name] = await fs.readFile(path.join(dir, file), 'utf8');
  }
  return partials;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Fetch all tool records from Airtable
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTools() {
  const records = await base('Tools')
    .select({ view: 'Grid view', pageSize: 1000 })
    .all();

  return records.map(r => ({
    name:             r.get('Name'),
    slug:             r.get('slug'),
    category:         r.get('category'),
    affiliate_link:   r.get('affiliate_link'),
    cta_text:         r.get('cta_button'),
    discount_code:    r.get('discount_code'),
    offer:            r.get('offer'),
    features:         r.get('features'),
    pricing:          r.get('pricing'),
    best_for:         r.get('best_for'),
    description:      r.get('description'),
    page_title:       r.get('page_title'),
    page_description: r.get('page_description'),
    sticky_message:   r.get('sticky_message'),
    sticky_cta_link:  r.get('sticky_cta_link'),
    sticky_cta_text:  r.get('sticky_cta_text'),
    table_heading:    r.get('table_heading'),
    summary:          r.get('summary')  // Array of highlights if used
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Build one static HTML page per unique category slug
// ─────────────────────────────────────────────────────────────────────────────
async function buildCategories() {
  const buildDir = path.join(__dirname, 'build');
  await fs.mkdir(buildDir, { recursive: true });

  const partials = await loadPartials();
  const tools    = await fetchTools();

  // Unique category slugs
  const slugs = [...new Set(tools.map(t => t.category))];

  // Load the generic category template
  const tplPath = path.join(__dirname, 'templates', 'category.html');
  const template = await fs.readFile(tplPath, 'utf8');

  for (const slug of slugs) {
    const pageTools = tools.filter(t => t.category === slug);
    if (!pageTools.length) continue;

    // Page metadata from first record
    const meta = pageTools[0];

    const html = Mustache.render(
      template,
      {
        page_title:       meta.page_title,
        page_description: meta.page_description,
        sticky_message:   meta.sticky_message,
        sticky_cta_link:  meta.sticky_cta_link,
        sticky_cta_text:  meta.sticky_cta_text,
        table_heading:    meta.table_heading,
        offer:            meta.offer,
        summary:          meta.summary,
        tools:            pageTools
      },
      partials
    );

    const outPath = path.join(buildDir, `${slug}.html`);
    await fs.writeFile(outPath, html, 'utf8');
    console.log(`✔️  Built ${slug}.html`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) Execute the build
// ─────────────────────────────────────────────────────────────────────────────
buildCategories().catch(err => {
  console.error(err);
  process.exit(1);
});
