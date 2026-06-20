import { db } from '../server/db';
import { vgieRecommendations } from '../shared/schema';

async function main() {
  const recs = await db.select().from(vgieRecommendations);
  console.log('Total recommendations:', recs.length);
  recs.forEach(r => {
    console.log(`ID: ${r.id}, status: "${r.status}", priority: "${r.priority}", type: ${r.entityType}`);
  });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
