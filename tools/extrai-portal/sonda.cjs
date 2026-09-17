// Roda uma expressão no portal (Edge headless) e imprime o resultado JSON.
// Uso: node sonda.js "expr" [arquivo-saida]   (expr pode ser um caminho de arquivo .js)
const fs = require('fs'),
  path = require('path'),
  { execFileSync } = require('child_process');
const PORTAL =
  process.env.PORTAL_HTML ||
  path.join(process.env.USERPROFILE || '', '.claude', 'tools', 'portal-alumni', 'out', '01. Portal Raphael Lima.html');
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find(fs.existsSync);
const html = fs.readFileSync(PORTAL, 'utf8');
const BOOT = "renderNav(); go('inicio');";
const expr = fs.existsSync(process.argv[2]) ? fs.readFileSync(process.argv[2], 'utf8') : process.argv[2];
const f = path.join(__dirname, 'sonda.html');
fs.writeFileSync(
  f,
  html.replace(
    BOOT,
    `window.SEM_LOGIN=1;renderNav();go('inicio');
window.addEventListener('load',()=>{let r;try{const v=(function(){return eval(${JSON.stringify(expr)})})();
 r=JSON.stringify(v,function(k,x){return x instanceof Date?{$date:x.toISOString()}:x})}catch(e){r='ERRO '+e.message+' '+e.stack}
 document.body.innerHTML='';const p=document.createElement('pre');p.id='out';p.textContent=r;document.body.appendChild(p);});`,
  ),
  'utf8',
);
const dom = execFileSync(
  EDGE,
  [
    '--headless',
    '--disable-gpu',
    '--window-size=' + (process.env.JANELA || '1440,900'),
    '--virtual-time-budget=6000',
    '--dump-dom',
    'file:///' + f.replace(/\\/g, '/'),
  ],
  { maxBuffer: 1 << 29 },
).toString();
const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
const txt = m
  ? m[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
  : 'SEM SAIDA';
if (process.argv[3]) {
  fs.writeFileSync(process.argv[3], txt, 'utf8');
  console.log('gravado', process.argv[3], txt.length);
} else process.stdout.write(txt);
