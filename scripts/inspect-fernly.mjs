async function inspect() {
  const res = await fetch('https://demo.codeandchill.store/fernly/');
  const html = await res.text();
  
  // Find data-view="team"
  const start = html.indexOf('data-view="team"');
  if (start !== -1) {
    const end = html.indexOf('data-view="settings"', start);
    console.log('--- TEAM VIEW HTML ---');
    console.log(html.slice(start - 20, end !== -1 ? end - 20 : start + 4000));
  }

  // Shell structure (nav, sidebar, header)
  const bodyStart = html.indexOf('<body');
  const viewStart = html.indexOf('<section class="view"');
  console.log('--- SHELL HEADER / NAV ---');
  console.log(html.slice(bodyStart, viewStart));

  // Also save entire css to a file so we can view and reference it directly!
  const cssRes = await fetch('https://demo.codeandchill.store/fernly/assets/index-CvK4-nsE.css');
  const css = await cssRes.text();
  import('fs').then(fs => fs.writeFileSync('fernly-style.css', css));
  console.log('Saved fernly-style.css');
}

inspect().catch(console.error);
