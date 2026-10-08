/**
 * PDF de texto (A4, Helvetica) sem dependência — decisão 3.5.3.2 (05/10/2026): visualizar e baixar o contrato e o
 * pedido em PDF. Monta título, blocos de pares "rótulo: valor" e tabelas simples, com quebra de linha e de página.
 * Texto em WinAnsi: acentos do português entram; símbolos fora dela viram o equivalente mais próximo.
 */
export type BlocoPdf =
  | { titulo: string; pares: [string, string][] }
  | { titulo: string; tabela: { colunas: string[]; larguras: number[]; linhas: string[][] } }
  | { titulo: string; texto: string };

const A4 = { w: 595, h: 842 };
const M = 48; /* margem */
const LARG = A4.w - 2 * M;

/* WinAnsi: 0x80–0x9F têm símbolos próprios; o resto do Latin-1 é igual ao Unicode */
const WIN: Record<string, number> = {
  '€': 0x80,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
};
const TROCA: Record<string, string> = { '−': '-', '→': '->', '←': '<-', '✓': 'ok', '×': 'x', '≥': '>=', '≤': '<=' };
const winAnsi = (s: string) =>
  [...s]
    .map((ch) => TROCA[ch] ?? ch)
    .join('')
    .split('')
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (WIN[ch]) return WIN[ch];
      if (c < 256) return c;
      return 63; /* ? */
    });
const literal = (s: string) =>
  `(${winAnsi(s)
    .map((c) => (c === 40 || c === 41 || c === 92 ? `\\${String.fromCharCode(c)}` : String.fromCharCode(c)))
    .join('')})`;
/* largura aproximada da Helvetica (média por classe de caractere), suficiente para quebrar a linha */
const larg = (s: string, tam: number, negrito = false) =>
  [...s].reduce(
    (w, ch) => w + (/[ilI.,:;'|!]/.test(ch) ? 0.28 : /[mwMW@]/.test(ch) ? 0.83 : /[A-Z0-9]/.test(ch) ? 0.64 : 0.52),
    0,
  ) *
  tam *
  (negrito ? 1.06 : 1);
const quebra = (s: string, max: number, tam: number, negrito = false) => {
  const out: string[] = [];
  for (const par of String(s ?? '').split('\n')) {
    let linha = '';
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const t = linha ? `${linha} ${p}` : p;
      if (larg(t, tam, negrito) <= max || !linha) linha = t;
      else {
        out.push(linha);
        linha = p;
      }
    }
    out.push(linha);
  }
  return out;
};

export function geraPdf(titulo: string, subtitulo: string, blocos: BlocoPdf[], rodape: string): Buffer {
  const paginas: string[][] = [[]];
  let y = A4.h - M;
  const pg = () => paginas[paginas.length - 1];
  const nova = () => {
    paginas.push([]);
    y = A4.h - M;
  };
  const cabe = (h: number) => {
    if (y - h < M + 24) nova();
  };
  const txt = (s: string, x: number, tam: number, negrito = false, cinza = false) =>
    pg().push(
      `BT /${negrito ? 'F2' : 'F1'} ${tam} Tf ${cinza ? '0.35 0.38 0.44 rg' : '0.06 0.09 0.16 rg'} ${x.toFixed(1)} ${y.toFixed(1)} Td ${literal(s)} Tj ET`,
    );
  const linhaH = (cor = '0.85 0.87 0.91') =>
    pg().push(`${cor} RG 0.6 w ${M} ${(y + 4).toFixed(1)} m ${A4.w - M} ${(y + 4).toFixed(1)} l S`);

  for (const l of quebra(titulo, LARG, 18, true)) {
    cabe(24);
    txt(l, M, 18, true);
    y -= 24;
  }
  for (const l of quebra(subtitulo, LARG, 10)) {
    cabe(14);
    txt(l, M, 10, false, true);
    y -= 14;
  }
  y -= 8;
  for (const b of blocos) {
    cabe(40);
    y -= 6;
    txt(b.titulo, M, 12, true);
    y -= 8;
    linhaH('0 0.2 0.53');
    y -= 12;
    if ('pares' in b) {
      const rot = 150;
      for (const [k, v] of b.pares) {
        const ls = quebra(v || '—', LARG - rot, 10);
        cabe(ls.length * 14);
        txt(k, M, 10, true, true);
        for (const l of ls) {
          txt(l, M + rot, 10);
          y -= 14;
        }
      }
    } else if ('tabela' in b) {
      const { colunas, larguras, linhas } = b.tabela;
      const soma = larguras.reduce((s, x) => s + x, 0);
      const ws = larguras.map((x) => (x / soma) * LARG);
      const xs = ws.map((_, i) => M + ws.slice(0, i).reduce((s, x) => s + x, 0));
      const cab = () => {
        cabe(18);
        for (const [i, c] of colunas.entries()) txt(c, xs[i], 9, true, true);
        y -= 6;
        linhaH();
        y -= 10;
      };
      cab();
      if (!linhas.length) {
        txt('Nenhum registro.', M, 10, false, true);
        y -= 14;
      }
      for (const r of linhas) {
        const cel = r.map((v, i) => quebra(v || '—', ws[i] - 8, 9));
        const h = Math.max(...cel.map((c) => c.length)) * 12 + 4;
        if (y - h < M + 24) {
          nova();
          cab();
        }
        const y0 = y;
        cel.forEach((c, i) => {
          y = y0;
          for (const l of c) {
            txt(l, xs[i], 9);
            y -= 12;
          }
        });
        y = y0 - h + 4;
        linhaH('0.93 0.94 0.96');
        y -= 8;
      }
    } else {
      for (const l of quebra(b.texto, LARG, 10)) {
        cabe(14);
        txt(l, M, 10);
        y -= 14;
      }
    }
    y -= 10;
  }

  /* objetos: 1 catálogo, 2 páginas, 3 e 4 fontes, depois conteúdo + página para cada página */
  const objs: string[] = [];
  const n = paginas.length;
  const kids = paginas.map((_, i) => `${5 + i * 2 + 1} 0 R`).join(' ');
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  paginas.forEach((ops, i) => {
    const pe = `BT /F1 8 Tf 0.35 0.38 0.44 rg ${M} 28 Td ${literal(`${rodape} · página ${i + 1} de ${n}`)} Tj ET`;
    const corpo = [...ops, pe].join('\n');
    objs.push(`<< /Length ${Buffer.byteLength(corpo, 'latin1')} >>\nstream\n${corpo}\nendstream`);
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    );
  });
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
