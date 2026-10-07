import fs from 'fs';

async function extractIcons() {
  const res = await fetch('https://demo.codeandchill.store/fernly/');
  const html = await res.text();
  const svgStart = html.indexOf('<svg class="sr-only"');
  const svgEnd = html.indexOf('</svg>', svgStart);
  if (svgStart !== -1 && svgEnd !== -1) {
    const svgSprite = html.slice(svgStart, svgEnd + 6);
    const jsx = `export default function FernlyIcons() {
  return (
    ${svgSprite
      .replace(/class=/g, 'className=')
      .replace(/stroke-width=/g, 'strokeWidth=')
      .replace(/stroke-linecap=/g, 'strokeLinecap=')
      .replace(/stroke-linejoin=/g, 'strokeLinejoin=')}
  );
}
`;
    fs.writeFileSync('src/FernlyIcons.jsx', jsx);
    console.log('Saved src/FernlyIcons.jsx!');
  }
}

extractIcons().catch(console.error);
