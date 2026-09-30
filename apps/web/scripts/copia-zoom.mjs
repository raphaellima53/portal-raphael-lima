// Copia o Meeting SDK do Zoom (versão ES5, autocontida) para public/zoom — a sala abre em /zoom/sala.html, num iframe
// da página da aula, isolada do React do portal. Roda antes do dev e do build; o arquivo não vai para o git.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const req = createRequire(import.meta.url);
const pasta = dirname(req.resolve('@zoom/meetingsdk/package.json'));
const origem = join(pasta, 'dist', 'zoom-meeting-embedded-ES5.min.js');
const destino = join(process.cwd(), 'public', 'zoom', 'zoom-meeting-embedded-ES5.min.js');
if (!existsSync(origem)) throw new Error(`Meeting SDK não encontrado em ${origem}`);
mkdirSync(dirname(destino), { recursive: true });
copyFileSync(origem, destino);
console.log('Zoom Meeting SDK copiado para public/zoom');
