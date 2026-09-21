// Cores de curso, módulo e etapa vêm dos dados (e podem ser editadas). Antes de virar texto ou fundo de
// texto branco, a cor passa por corLegivel: escurece só o necessário para o contraste AA (4,5:1) contra o
// branco e contra a própria tinta clara (a mesma cor a 12%, usada nos chips).

const cache = new Map<string, string>();

const canal = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminancia = ([r, g, b]: number[]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const razao = (a: number[], b: number[]) => {
  const x = luminancia(a);
  const y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const tinta = (c: number[], alfa: number) => c.map((v) => v * alfa + 255 * (1 - alfa));
const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** A cor escurecida até ler bem com texto branco por cima e como texto sobre a tinta de 12%. */
export function corLegivel(cor: string | undefined | null): string {
  if (!cor || !/^#[0-9a-f]{6}$/i.test(cor)) return cor ?? '';
  const ja = cache.get(cor);
  if (ja) return ja;
  let c = [1, 3, 5].map((i) => Number.parseInt(cor.slice(i, i + 2), 16));
  for (let i = 0; i < 40; i++) {
    if (razao([255, 255, 255], c) >= 4.5 && razao(c, tinta(c, 0.12)) >= 4.5) break;
    c = c.map((v) => v * 0.95);
  }
  const out = hex(c);
  cache.set(cor, out);
  return out;
}

/** A cor clareada (misturada ao branco) até ler bem como texto sobre um fundo escuro. */
export function corSobreEscuro(cor: string | undefined | null, fundo = '#0f172a'): string {
  if (!cor || !/^#[0-9a-f]{6}$/i.test(cor)) return cor ?? '';
  const chave = `${cor}/${fundo}`;
  const ja = cache.get(chave);
  if (ja) return ja;
  const f = [1, 3, 5].map((i) => Number.parseInt(fundo.slice(i, i + 2), 16));
  const base = [1, 3, 5].map((i) => Number.parseInt(cor.slice(i, i + 2), 16));
  let c = base;
  for (let i = 1; i <= 20 && razao(c, f) < 4.5; i++) c = base.map((v) => v + (255 - v) * (i * 0.05));
  const out = hex(c);
  cache.set(chave, out);
  return out;
}
