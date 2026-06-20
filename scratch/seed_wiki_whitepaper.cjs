const { db } = require('../server/db');
const { sql } = require('drizzle-orm');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const htmlPath = path.join(__dirname, 'white_paper.html');
    const body = fs.readFileSync(htmlPath, 'utf8');

    // Get max sort order
    const maxOrderRes = await db.execute(sql`SELECT MAX(sort_order) as max_order FROM wiki_pages`);
    const nextOrder = (maxOrderRes.rows[0].max_order || 0) + 1;

    // Check if it already exists
    const existing = await db.execute(sql`SELECT id FROM wiki_pages WHERE slug = 'vaxplan-white-paper-2026'`);
    if (existing.rows.length > 0) {
      console.log('Updating existing white paper in wiki');
      await db.execute(sql`
        UPDATE wiki_pages
        SET body = ${body}, title = 'VaxPlan White Paper'
        WHERE slug = 'vaxplan-white-paper-2026'
      `);
    } else {
      console.log('Inserting new white paper in wiki');
      await db.execute(sql`
        INSERT INTO wiki_pages (slug, title, body, sort_order, is_published)
        VALUES ('vaxplan-white-paper-2026', 'VaxPlan White Paper', ${body}, ${nextOrder}, true)
      `);
    }
    console.log('Successfully added VaxPlan White Paper to wiki_pages!');
  } catch (err) {
    console.error('Error seeding white paper to wiki:', err);
  } finally {
    process.exit(0);
  }
}

run();
