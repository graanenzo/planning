// Bundelt de app tot één zelfstandig bestand: planning.html
// Gebruik: node tools/bundel.mjs
import fs from 'fs';
import path from 'path';

const volgorde = ['config.js', 'lib.js', 'views/open.js', 'views/rooster.js', 'views/beschikbaarheid.js', 'views/uren.js', 'app.js'];
const idVan = (f) => '__' + f.replace(/\W/g, '_');
const CDN = /^import \{ createClient \} from '[^']+';\n/m;

let js = "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';\n";
for (const f of volgorde) {
  let src = fs.readFileSync(f, 'utf8').replace(CDN, '');
  const namen = [];
  src = src.replace(/^export (async function|function|const|let) (\w+)/gm, (m, soort, naam) => { namen.push(naam); return `${soort} ${naam}`; });
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?[ \t]*$/gm, (m, lijst, pad) => {
    const doel = path.posix.normalize(path.posix.join(path.posix.dirname(f), pad));
    if (!volgorde.includes(doel)) throw new Error(`Onbekende import ${pad} in ${f}`);
    return `const { ${lijst.replace(/\s+/g, ' ').trim()} } = ${idVan(doel)};`;
  });
  js += `\nconst ${idVan(f)} = (() => {\n${src}\nreturn { ${namen.join(', ')} };\n})();\n`;
}
if (js.includes('</script')) throw new Error('</script> in de code');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="styles.css">', `<style>\n${fs.readFileSync('styles.css', 'utf8')}</style>`);
html = html.replace('<script type="module" src="app.js"></script>', () => `<script type="module">\n${js}</script>`);
fs.writeFileSync('planning.html', html);
console.log('planning.html geschreven,', Math.round(html.length / 1024), 'kB');
