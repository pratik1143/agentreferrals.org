import fs from 'fs';

async function extractTeam() {
  const res = await fetch('https://demo.codeandchill.store/fernly/');
  const html = await res.text();
  const start = html.indexOf('data-view="team"');
  const end = html.indexOf('data-view="settings"', start);
  const teamHtml = html.slice(start - 15, end - 15);
  fs.writeFileSync('fernly-team.html', teamHtml);
  console.log('Written fernly-team.html, length:', teamHtml.length);
  console.log(teamHtml.slice(0, 3000));
}

extractTeam().catch(console.error);
