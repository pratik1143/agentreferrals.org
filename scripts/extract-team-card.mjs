import fs from 'fs';

async function extractTeamCard() {
  const res = await fetch('https://demo.codeandchill.store/fernly/assets/index-BTm4rkAH.js');
  const js = await res.text();
  const peopleIdx = js.indexOf('person__');
  if (peopleIdx !== -1) {
    console.log('--- PERSON CARD JS TEMPLATE ---');
    console.log(js.slice(peopleIdx - 200, peopleIdx + 2000));
  } else {
    console.log('Not found person__, searching for person:');
    const pIdx = js.indexOf('person');
    console.log(js.slice(pIdx, pIdx + 500));
  }
}

extractTeamCard().catch(console.error);
