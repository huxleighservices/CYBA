import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../service-account.json'), 'utf8'));

const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const snap = await db.collection('sponsored_items').get();
if (snap.empty) {
  console.log('No sponsored items found.');
  process.exit(0);
}

const batch = db.batch();
snap.docs.forEach(d => {
  console.log(`Deleting: ${d.id}  type=${d.data().type ?? 'unknown'}  owner=${d.data().ownerId ?? '?'}`);
  batch.delete(d.ref);
});
await batch.commit();
console.log(`\nDeleted ${snap.size} sponsored item(s).`);
process.exit(0);
