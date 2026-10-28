// Builds public/us-cities/{STATE}.json from the U.S. Census Gazetteer places file.
//
// Download the national places file (public domain) and pass its .txt path:
//   https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip
//   node scripts/build-us-cities.mjs path/to/2024_Gaz_place_national.txt
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/build-us-cities.mjs <2024_Gaz_place_national.txt>');
  process.exit(1);
}

const STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
// Census names end with the legal/statistical area type ("Santa Cruz city", "Aptos CDP").
const SUFFIX = / (?:unified government|consolidated government|metro government|metropolitan government|urban county|city and borough|zona urbana|comunidad|CDP|city|town|village|borough|township|municipality|corporation|government|county)$/;

const cleanName = raw => {
  const balance = raw.endsWith(' (balance)');
  const name = raw.replace(/ \(balance\)$/, '').replace(SUFFIX, '').trim();
  const names = [];
  // "El Paso de Robles (Paso Robles)" is listed under both names.
  const alias = name.match(/^(.*?) \(([^)]+)\)$/);
  if (alias) names.push(alias[1], alias[2]);
  else names.push(name);
  // "Nashville-Davidson metropolitan government (balance)" is searched as "Nashville".
  if (balance && /[-/]/.test(name)) names.push(name.split(/[-/]/)[0].trim());
  return names.filter(Boolean);
};

const byState = new Map();
const lines = readFileSync(source, 'utf8').split(/\r?\n/).slice(1);
for (const line of lines) {
  const [state, , , rawName] = line.split('\t');
  if (!STATES.has(state) || !rawName) continue;
  if (!byState.has(state)) byState.set(state, new Set());
  for (const name of cleanName(rawName.trim())) byState.get(state).add(name);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'us-cities');
mkdirSync(outDir, { recursive: true });
let total = 0;
for (const [state, names] of byState) {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  total += sorted.length;
  writeFileSync(join(outDir, `${state}.json`), JSON.stringify(sorted));
}
console.log(`Wrote ${byState.size} state files with ${total} place names to ${outDir}`);
