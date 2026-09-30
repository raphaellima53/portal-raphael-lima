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

/**
 * Fundo na cor exata do curso ou módulo (30/09/2026: "as cores na agenda devem bater" — sem escurecer) e o texto
 * branco por cima; quase preto só quando a cor é tão clara que o branco some.
 */
export function fundoCor(cor: string | undefined | null): React.CSSProperties {
  if (!cor || !/^#[0-9a-f]{6}$/i.test(cor)) return { background: cor ?? undefined };
  const c = [1, 3, 5].map((i) => Number.parseInt(cor.slice(i, i + 2), 16));
  /* 30/09/2026: texto branco como padrão (pedido do usuário); escuro só em cor quase branca, onde o branco some */
  return { background: cor, color: razao([255, 255, 255], c) >= 2 ? '#fff' : '#15151b' };
}

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

/**
 * Texto na cor do curso ou módulo (24/09/2026): leva as duas versões e a classe `texto-cor` escolhe pelo tema —
 * escurecida no claro, clareada no escuro e no Alumni Black. Uso: <b className="texto-cor" style={corDeTexto(c)}>.
 */
export const corDeTexto = (cor: string | undefined | null) =>
  ({ '--cor-claro': corLegivel(cor), '--cor-escuro': corSobreEscuro(cor, '#15151b') }) as React.CSSProperties;

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
