/**
 * Planilhas (30/09/2026): exportar em CSV, baixar o modelo e importar o modelo preenchido — alunos, professores,
 * colaboradores e (02/10/2026) currículos, uma linha por lição. O CSV usa ; e BOM (o Excel em pt-BR abre certo) e aceita , na importação. Datas em dd/mm/aaaa;
 * listas (cursos do professor) separadas por |.
 *
 * A importação grava cada linha pela mesma rota do cadastro da tela (POST /alunos, /professores,
 * /config/colaboradores) com a sessão de quem importa: mesmas validações, permissões e log. Antes de gravar, a
 * prévia confere obrigatórios, formatos e repetidos (no arquivo e no banco).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { AL_SIT, crsItens } from '../domain/agenda.ts';
import { base } from '../domain/base.ts';
import { podeChave } from '../domain/mapa.ts';
import { dataUTC, GENEROS } from '../lib/pessoa.ts';
import { exigeCfg } from './config-acessos.ts';

type Linha = Record<string, string>;
type Col = {
  k: string;
  t: string;
  /** obrigatório no cadastro novo; função quando depende da linha */
  req?: boolean | ((l: Linha) => boolean);
  ex: string;
  tipo?: 'cpf' | 'cnpj' | 'email' | 'data' | 'tel' | 'num' | 'cep';
  opcoes?: string[];
};

const ENDERECO: Col[] = [
  { k: 'cep', t: 'CEP', ex: '01310-100', tipo: 'cep' },
  { k: 'rua', t: 'Rua', ex: 'Av. Paulista' },
  { k: 'numero', t: 'Número', ex: '1000' },
  { k: 'complemento', t: 'Complemento', ex: 'Sala 12' },
  { k: 'bairro', t: 'Bairro', ex: 'Bela Vista' },
  { k: 'cidade', t: 'Cidade', ex: 'São Paulo' },
  { k: 'uf', t: 'UF', ex: 'SP' },
];
const PESSOA: Col[] = [
  { k: 'emailSecundario', t: 'E-mail secundário', ex: '', tipo: 'email' },
  { k: 'nascimento', t: 'Nascimento', ex: '15/03/1990', tipo: 'data' },
  { k: 'genero', t: 'Gênero', ex: 'Feminino', opcoes: GENEROS },
];

const ENT = {
  alunos: {
    titulo: 'alunos',
    chave: 'alunos',
    rota: '/alunos',
    cols: [
      { k: 'nome', t: 'Nome', req: true, ex: 'Maria Souza' },
      { k: 'cpf', t: 'CPF', req: true, ex: '123.456.789-09', tipo: 'cpf' },
      { k: 'email', t: 'E-mail', req: true, ex: 'maria.souza@email.com', tipo: 'email' },
      { k: 'telefone', t: 'Contato', req: true, ex: '+55 (11) 99999-0000', tipo: 'tel' },
      ...PESSOA,
      { k: 'empresa', t: 'Empresa', ex: '' },
      { k: 'status', t: 'Situação', ex: 'Ativo', opcoes: AL_SIT },
      ...ENDERECO,
    ] as Col[],
  },
  professores: {
    titulo: 'professores',
    chave: 'professores',
    rota: '/professores',
    cols: [
      { k: 'nome', t: 'Nome', req: true, ex: 'João Lima' },
      { k: 'cpf', t: 'CPF', req: true, ex: '987.654.321-00', tipo: 'cpf' },
      { k: 'cnpj', t: 'CNPJ', req: true, ex: '12.345.678/0001-90', tipo: 'cnpj' },
      { k: 'email', t: 'E-mail', req: true, ex: 'joao.lima@email.com', tipo: 'email' },
      { k: 'telefone', t: 'Contato', req: true, ex: '+55 (11) 98888-0000', tipo: 'tel' },
      ...PESSOA,
      { k: 'admissao', t: 'Admissão', ex: '01/02/2026', tipo: 'data' },
      { k: 'teto', t: 'Teto semanal de aulas', ex: '24', tipo: 'num' },
      { k: 'cursos', t: 'Cursos (separados por |)', ex: 'Community live classes' },
      { k: 'ativo', t: 'Situação', ex: 'Ativo', opcoes: ['Ativo', 'Inativo'] },
      ...ENDERECO,
    ] as Col[],
  },
  colaboradores: {
    titulo: 'colaboradores',
    chave: 'config',
    rota: '/config/colaboradores',
    cols: [
      { k: 'nome', t: 'Nome', req: true, ex: 'Ana Castro' },
      { k: 'vinculo', t: 'Vínculo', ex: 'Colaborador', opcoes: ['Colaborador', 'Prestador'] },
      { k: 'cpf', t: 'CPF', req: true, ex: '111.222.333-44', tipo: 'cpf' },
      {
        k: 'cnpj',
        t: 'CNPJ (obrigatório para Prestador)',
        req: (l) => l.vinculo === 'Prestador',
        ex: '',
        tipo: 'cnpj',
      },
      { k: 'email', t: 'E-mail', req: true, ex: 'ana.castro@email.com', tipo: 'email' },
      { k: 'telefone', t: 'Contato', req: true, ex: '+55 (11) 97777-0000', tipo: 'tel' },
      { k: 'admissao', t: 'Admissão', req: true, ex: '10/01/2026', tipo: 'data' },
      /* o departamento sai do cargo (Usuários › Cargos) */
      { k: 'cargo', t: 'Cargo', ex: 'Coordenadora pedagógica' },
      ...PESSOA,
      { k: 'ativo', t: 'Situação', ex: 'Ativo', opcoes: ['Ativo', 'Inativo'] },
      ...ENDERECO,
    ] as Col[],
  },
} as const;
type Ent = keyof typeof ENT;

/* ---------------- CSV ---------------- */
const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (linhas: unknown[][]) => `﻿${linhas.map((l) => l.map(esc).join(';')).join('\r\n')}\r\n`;

/** lê CSV com ; ou , (o que aparecer mais no cabeçalho), aspas e quebras de linha dentro de aspas */
export function leCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const cab = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (cab.match(/;/g)?.length ?? 0) >= (cab.match(/,/g)?.length ?? 0) ? ';' : ',';
  const out: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo);
      out.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    out.push(linha);
  }
  return out.filter((l) => l.some((x) => x.trim()));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\(.*\)/, '')
    .replace(/\*/g, '')
    .trim();
const dig = (s: string) => s.replace(/\D/g, '');
/** dd/mm/aaaa (ou aaaa-mm-dd) → aaaa-mm-dd; '' se vazio; null se inválida */
const dataIso = (s: string) => {
  const v = s.trim();
  if (!v) return '';
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  const iso = br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(+d) || d.toISOString().slice(0, 10) !== iso ? null : iso;
};

/* ---------------- exportar ---------------- */
const endCols = (e: unknown) => {
  const x = (e ?? {}) as Record<string, string>;
  return ENDERECO.map((c) => x[c.k] ?? '');
};

async function linhasExport(ent: Ent): Promise<unknown[][]> {
  if (ent === 'alunos') {
    const xs = await prisma.aluno.findMany({
      orderBy: { nome: 'asc' },
      include: { empresa: { select: { nome: true } } },
    });
    return xs.map((a) => [
      a.nome,
      a.cpf,
      a.emailPlaceholder ? '' : a.email,
      a.telefone ?? '',
      a.emailSecundario ?? '',
      dataUTC(a.nascimento),
      a.genero ?? '',
      a.empresa?.nome ?? '',
      a.status,
      ...endCols(a.endereco),
    ]);
  }
  if (ent === 'professores') {
    const xs = await prisma.professor.findMany({ orderBy: { nome: 'asc' } });
    return xs.map((p) => [
      p.nome,
      p.cpf ?? '',
      p.cnpj ?? '',
      p.email === '—' ? '' : p.email,
      p.telefone ?? '',
      p.emailSecundario ?? '',
      dataUTC(p.nascimento),
      p.genero ?? '',
      dataUTC(p.admissao),
      p.teto,
      p.cursos.join(' | '),
      p.ativo ? 'Ativo' : 'Inativo',
      ...endCols(p.endereco),
    ]);
  }
  const xs = await prisma.colaborador.findMany({ orderBy: { nome: 'asc' } });
  return xs.map((c) => [
    c.nome,
    c.vinculo ?? 'Colaborador',
    c.cpf ?? '',
    c.cnpj ?? '',
    c.email,
    c.telefone ?? '',
    dataUTC(c.admissao),
    c.cargo ?? '',
    c.emailSecundario ?? '',
    dataUTC(c.nascimento),
    c.genero ?? '',
    c.ativo ? 'Ativo' : 'Inativo',
    ...endCols(c.endereco),
  ]);
}

/* ---------------- importar: prévia ---------------- */
/** as linhas abaixo do cabeçalho com o número delas no arquivo; a de exemplo ("Exemplo…") fica de fora */
const corpoDe = (tab: string[][]) =>
  tab
    .slice(1)
    .map((l, i) => ({ l, n: i + 2 }))
    .filter(({ l }) => !/^exemplo/i.test((l[0] ?? '').trim()));

type Previa = { linha: number; nome: string; erros: string[]; dados: Linha };

async function existentes(ent: Ent) {
  const xs =
    ent === 'alunos'
      ? await prisma.aluno.findMany({ select: { nome: true, email: true, cpf: true } })
      : ent === 'professores'
        ? await prisma.professor.findMany({ select: { nome: true, email: true, cpf: true } })
        : await prisma.colaborador.findMany({ select: { nome: true, email: true, cpf: true } });
  return {
    email: new Set(xs.map((x) => (x.email ?? '').toLowerCase()).filter((e) => e && e !== '—')),
    cpf: new Set(xs.map((x) => dig(x.cpf ?? '')).filter(Boolean)),
    nome: new Set(xs.map((x) => x.nome.toLowerCase())),
  };
}

async function previa(ent: Ent, texto: string): Promise<{ erro: string } | { linhas: Previa[] }> {
  const cols = ENT[ent].cols;
  const tab = leCsv(texto);
  if (tab.length < 2) return { erro: 'O arquivo não tem linhas preenchidas abaixo do cabeçalho.' };
  const cab = tab[0].map(norm);
  const idx = cols.map((c) => cab.indexOf(norm(c.t)));
  const faltam = cols.filter((c, i) => c.req === true && idx[i] < 0).map((c) => c.t);
  if (faltam.length) return { erro: `Faltam colunas do modelo: ${faltam.join(', ')}. Baixe o modelo e preencha nele.` };
  const corpo = corpoDe(tab);
  if (corpo.length > 300) return { erro: 'Importe até 300 linhas por arquivo.' };
  const ja = await existentes(ent);
  const cargos =
    ent === 'colaboradores'
      ? new Map((await prisma.cargo.findMany({ select: { nome: true } })).map((c) => [norm(c.nome), c.nome]))
      : null;
  const empresas =
    ent === 'alunos'
      ? new Map((await prisma.empresa.findMany({ select: { nome: true } })).map((e) => [norm(e.nome), e.nome]))
      : null;
  const noArquivo = { email: new Map<string, number>(), cpf: new Map<string, number>() };
  return {
    linhas: corpo.map(({ l, n }) => {
      const d: Linha = {};
      cols.forEach((c, i) => {
        d[c.k] = idx[i] >= 0 ? (l[idx[i]] ?? '').trim() : '';
      });
      const erros: string[] = [];
      for (const c of cols) {
        const v = d[c.k];
        const req = typeof c.req === 'function' ? c.req(d) : c.req;
        if (!v) {
          if (req) erros.push(`${c.t.replace(/ \(.*\)/, '')} é obrigatório.`);
          continue;
        }
        if (c.tipo === 'cpf' && dig(v).length !== 11) erros.push('CPF precisa de 11 dígitos.');
        if (c.tipo === 'cnpj' && dig(v).length !== 14) erros.push('CNPJ precisa de 14 dígitos.');
        if (c.tipo === 'email' && !z.string().email().safeParse(v).success) erros.push(`${c.t} inválido.`);
        if (c.tipo === 'tel' && dig(v).length < 10) erros.push('Contato com DDD: pelo menos 10 dígitos.');
        if (c.tipo === 'cep' && dig(v).length !== 8) erros.push('CEP inválido.');
        if (c.tipo === 'num' && !(Number(v) >= 1 && Number(v) <= 80)) erros.push(`${c.t}: de 1 a 80.`);
        if (c.tipo === 'data') {
          const iso = dataIso(v);
          if (iso === null) erros.push(`${c.t}: use dd/mm/aaaa.`);
          else d[c.k] = iso;
        }
        if (c.opcoes && !c.opcoes.some((o) => norm(o) === norm(v))) erros.push(`${c.t}: use ${c.opcoes.join(', ')}.`);
        else if (c.opcoes) d[c.k] = c.opcoes.find((o) => norm(o) === norm(v)) ?? v;
      }
      if (cargos && d.cargo) {
        const c = cargos.get(norm(d.cargo));
        if (c) d.cargo = c;
        else erros.push(`Cargo "${d.cargo}" não existe em Usuários › Cargos.`);
      }
      if (empresas && d.empresa) {
        const e = empresas.get(norm(d.empresa));
        if (e) d.empresa = e;
        else erros.push(`Empresa "${d.empresa}" não está cadastrada.`);
      }
      const email = d.email.toLowerCase();
      const cpf = dig(d.cpf ?? '');
      if (email && ja.email.has(email)) erros.push('Já existe cadastro com este e-mail.');
      if (cpf && ja.cpf.has(cpf)) erros.push('Já existe cadastro com este CPF.');
      if (ent === 'professores' && d.nome && ja.nome.has(d.nome.toLowerCase()))
        erros.push('Já existe professor com este nome.');
      if (email && noArquivo.email.has(email)) erros.push(`E-mail repetido na linha ${noArquivo.email.get(email)}.`);
      if (cpf && noArquivo.cpf.has(cpf)) erros.push(`CPF repetido na linha ${noArquivo.cpf.get(cpf)}.`);
      if (email) noArquivo.email.set(email, n);
      if (cpf) noArquivo.cpf.set(cpf, n);
      return { linha: n, nome: d.nome || '—', erros, dados: d };
    }),
  };
}

/** a linha no formato do formulário da tela */
function corpoDoCadastro(ent: Ent, d: Linha) {
  const endereco = Object.fromEntries(ENDERECO.map((c) => [c.k, c.k === 'uf' ? d[c.k].toUpperCase() : d[c.k]]));
  const pessoa = {
    telefone: d.telefone,
    nascimento: d.nascimento,
    genero: d.genero,
    emailSecundario: d.emailSecundario,
    endereco,
  };
  if (ent === 'alunos')
    return { ...pessoa, nome: d.nome, cpf: d.cpf, email: d.email, empresa: d.empresa, status: d.status || 'Ativo' };
  if (ent === 'professores')
    return {
      ...pessoa,
      nome: d.nome,
      cpf: d.cpf,
      cnpj: d.cnpj,
      email: d.email,
      admissao: d.admissao,
      teto: d.teto || undefined,
      cursos: d.cursos
        .split('|')
        .map((x) => x.trim())
        .filter(Boolean),
      ativo: d.ativo !== 'Inativo',
    };
  return {
    ...pessoa,
    nome: d.nome,
    vinculo: d.vinculo || 'Colaborador',
    cpf: d.cpf,
    cnpj: d.cnpj,
    email: d.email,
    admissao: d.admissao,
    cargo: d.cargo,
    ativo: d.ativo !== 'Inativo',
  };
}

/* ---------------- currículos (02/10/2026) ---------------- */
/*
 * Uma linha por lição; as linhas com o mesmo Currículo formam um currículo, na ordem do arquivo. Importar cria o
 * currículo (ou abre uma versão nova do que já existe), troca os conteúdos e publica — a versão anterior fica no
 * histórico. Uma linha sem título de lição cria o currículo vazio (sem publicar).
 */
type CurConteudo = {
  titulo: string;
  formato: string;
  gram: string;
  voc: [string, string][];
  links: { pre: string; in: string; post: string };
};
type CurVersao = [string, string, string, CurConteudo[]];

const CUR_COLS: Col[] = [
  { k: 'curriculo', t: 'Currículo', req: true, ex: 'Community live classes · Confidence' },
  { k: 'grupo', t: 'Curso ou acervo', req: true, ex: 'Community live classes' },
  { k: 'idioma', t: 'Idioma (só acervo)', ex: '', opcoes: ['Inglês', 'Espanhol'] },
  { k: 'aplicado', t: 'Aplicado em (separados por |)', ex: 'Confidence' },
  { k: 'titulo', t: 'Título da lição', ex: 'Is it going to rain?' },
  { k: 'formato', t: 'Formato', ex: 'Interativa', opcoes: ['Interativa', 'Simples'] },
  { k: 'gram', t: 'Gramática', ex: 'Present simple' },
  { k: 'voc', t: 'Vocabulário', ex: 'forecast (n); get along (v)' },
  { k: 'pre', t: 'Link Pre-class', ex: 'https://materiais.exemplo.com/aula-1/pre' },
  { k: 'in', t: 'Link In-class', ex: 'https://materiais.exemplo.com/aula-1/in' },
  { k: 'post', t: 'Link Post-class', ex: '' },
];
const LICAO = ['titulo', 'formato', 'gram', 'voc', 'pre', 'in', 'post'];
const linkOk = (u: string) => !u || /^https?:\/\/\S+$/i.test(u);

async function curExport(): Promise<unknown[][]> {
  const xs = await prisma.curriculo.findMany({ orderBy: { ordem: 'asc' } });
  return xs.flatMap((c) => {
    const vs = c.versoes as CurVersao[];
    /* a versão publicada (o que as aulas leem); sem ela, o rascunho */
    const ls = vs.filter((v) => v[1] === 'Publicada').pop()?.[3] ?? vs[vs.length - 1]?.[3] ?? [];
    const cab = [c.nome, c.grupo, c.tipo === 'acervo' ? c.idioma : '', c.aplicado.join(' | ')];
    if (!ls.length) return [[...cab, '', '', '', '', '', '', '']];
    return ls.map((x) => [
      ...cab,
      x.titulo,
      x.formato,
      x.gram,
      (x.voc ?? []).map(([p, t]) => `${p} (${t})`).join('; '),
      x.links?.pre ?? '',
      x.links?.in ?? '',
      x.links?.post ?? '',
    ]);
  });
}

type CurGrupo = { nome: string; linhas: Previa[]; existe: { id: string } | null; produto: boolean };

async function curPrevia(texto: string): Promise<{ erro: string } | { grupos: CurGrupo[] }> {
  const tab = leCsv(texto);
  if (tab.length < 2) return { erro: 'O arquivo não tem linhas preenchidas abaixo do cabeçalho.' };
  const cab = tab[0].map(norm);
  const idx = CUR_COLS.map((c) => cab.indexOf(norm(c.t)));
  const faltam = CUR_COLS.filter((c, i) => (c.req === true || c.k === 'titulo') && idx[i] < 0).map((c) => c.t);
  if (faltam.length) return { erro: `Faltam colunas do modelo: ${faltam.join(', ')}. Baixe o modelo e preencha nele.` };
  const corpo = corpoDe(tab);
  if (corpo.length > 2000) return { erro: 'Importe até 2.000 linhas por arquivo.' };
  const b = await base();
  const cursos = new Map(b.cursos.map((c) => [norm(c.name), c]));
  const ja = new Map(
    (await prisma.curriculo.findMany({ select: { id: true, nome: true } })).map((c) => [c.nome.toLowerCase(), c]),
  );
  const grupos = new Map<string, CurGrupo>();
  corpo.forEach(({ l, n }) => {
    const d: Linha = {};
    CUR_COLS.forEach((c, i) => {
      d[c.k] = idx[i] >= 0 ? (l[idx[i]] ?? '').trim() : '';
    });
    const erros: string[] = [];
    for (const c of CUR_COLS) {
      const v = d[c.k];
      if (!v) {
        if (c.req === true) erros.push(`${c.t} é obrigatório.`);
        continue;
      }
      if (c.opcoes && !c.opcoes.some((o) => norm(o) === norm(v))) erros.push(`${c.t}: use ${c.opcoes.join(', ')}.`);
      else if (c.opcoes) d[c.k] = c.opcoes.find((o) => norm(o) === norm(v)) ?? v;
    }
    if (!d.titulo && LICAO.some((k) => d[k])) erros.push('Título da lição é obrigatório quando a lição tem dados.');
    for (const [k, rot] of [
      ['pre', 'Pre-class'],
      ['in', 'In-class'],
      ['post', 'Post-class'],
    ])
      if (!linkOk(d[k])) erros.push(`Link ${rot}: use um endereço completo, começando com https://.`);
    const chave = d.curriculo.toLowerCase();
    let g = grupos.get(chave);
    if (!g) {
      const curso = cursos.get(norm(d.grupo));
      g = { nome: d.curriculo, linhas: [], existe: ja.get(chave) ?? null, produto: !!curso };
      grupos.set(chave, g);
    }
    g.linhas.push({ linha: n, nome: `${d.curriculo || '—'} · ${d.titulo || 'sem lição'}`, erros, dados: d });
  });
  /* conferências do currículo inteiro: o 1º preenchimento de cada coluna vale para todas as linhas dele */
  for (const g of grupos.values()) {
    const prim = (k: string) => g.linhas.find((l) => l.dados[k])?.dados[k] ?? '';
    const erros: string[] = [];
    const grupo = prim('grupo');
    if (g.linhas.some((l) => l.dados.grupo && norm(l.dados.grupo) !== norm(grupo)))
      erros.push('O mesmo currículo aparece com cursos ou acervos diferentes.');
    const curso = cursos.get(norm(grupo));
    const aplicado = prim('aplicado')
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean);
    if (curso) {
      const itens = crsItens(curso);
      const fora = aplicado.filter((x) => !itens.some((i) => norm(i) === norm(x)));
      if (fora.length) erros.push(`${fora.join(', ')} não existe em ${curso.name}.`);
    } else if (!prim('idioma') && !g.existe) erros.push('Acervo novo: informe o Idioma (Inglês ou Espanhol).');
    if (g.linhas.filter((l) => !l.dados.titulo).length && g.linhas.some((l) => l.dados.titulo))
      erros.push('Linha sem título de lição num currículo que tem lições.');
    if (erros.length) for (const l of g.linhas) l.erros.push(...erros);
  }
  return { grupos: [...grupos.values()] };
}

/* ---------------- rotas ---------------- */
const EntP = z.object({ ent: z.enum(['alunos', 'professores', 'colaboradores', 'curriculos']) });

async function exigeEnt(req: FastifyRequest, rep: FastifyReply) {
  const p = EntP.safeParse(req.params);
  if (!p.success) return rep.code(404).send({ erro: 'Planilha não encontrada.' });
  if (p.data.ent === 'colaboradores') return exigeCfg(req, rep);
  if (p.data.ent === 'curriculos') {
    const u = req.usuario;
    if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    if (u.ehAluno || !['curso.curriculo', 'cfg'].some((c) => podeChave(u, c)))
      return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
    return;
  }
  const u = req.usuario;
  if (!u) return rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
  if (u.ehAluno || !podeChave(u, ENT[p.data.ent].chave)) return rep.code(403).send({ erro: 'Sem acesso a esta tela.' });
}

const hoje = () => new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
const anexo = (rep: FastifyReply, nome: string, texto: string) =>
  rep
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${nome}"`)
    .send(texto);

/** prévia ou gravação dos currículos: cada currículo pelas rotas da tela (criar, editar, conteúdos, publicar) */
async function importaCurriculos(
  app: FastifyInstance,
  req: FastifyRequest,
  rep: FastifyReply,
  texto: string,
  gravar: boolean,
) {
  const p = await curPrevia(texto);
  if ('erro' in p) return rep.code(400).send(p);
  const todas = p.grupos.flatMap((g) => g.linhas);
  const curs = p.grupos.length;
  const ok = p.grupos.filter((g) => g.linhas.every((l) => !l.erros.length));
  if (!gravar)
    return {
      linhas: todas.map(({ linha, nome, erros }) => ({ linha, nome, erros })),
      total: todas.length,
      validas: ok.reduce((s, g) => s + g.linhas.length, 0),
      unidades: { total: curs, validas: ok.length, novos: ok.filter((g) => !g.existe).length },
    };
  const chama = async (method: 'POST' | 'PUT', url: string, corpo: unknown) => {
    const r = await app.inject({
      method,
      url,
      headers: { cookie: req.headers.cookie ?? '', 'content-type': 'application/json' },
      payload: JSON.stringify(corpo),
    });
    return { ok: r.statusCode < 300, j: r.json() as { id?: string; erro?: string } };
  };
  const out: { linha: number; nome: string; erros: string[]; ok?: boolean }[] = [];
  let feitos = 0;
  for (const g of p.grupos) {
    const marca = (erro?: string) => {
      for (const l of g.linhas)
        out.push({ linha: l.linha, nome: l.nome, erros: erro ? [erro] : l.erros, ok: !erro && !l.erros.length });
    };
    if (g.linhas.some((l) => l.erros.length)) {
      marca();
      continue;
    }
    const prim = (k: string) => g.linhas.find((l) => l.dados[k])?.dados[k] ?? '';
    const aplicado = prim('aplicado')
      ? prim('aplicado')
          .split('|')
          .map((x) => x.trim())
          .filter(Boolean)
      : undefined;
    const cab = { nome: g.nome, aplicado };
    const r = g.existe
      ? await chama('PUT', `/curriculos/${g.existe.id}`, cab)
      : await chama(
          'POST',
          '/curriculos',
          g.produto
            ? { ...cab, curso: prim('grupo') }
            : { ...cab, grupo: prim('grupo'), idioma: prim('idioma') || undefined },
        );
    const id = g.existe?.id ?? r.j.id;
    if (!r.ok || !id) {
      marca(r.j.erro ?? 'Não foi possível gravar o currículo.');
      continue;
    }
    const licoes = g.linhas.filter((l) => l.dados.titulo).map((l) => l.dados);
    if (licoes.length) {
      const c = await chama('PUT', `/curriculos/${id}/conteudos`, {
        conteudos: licoes.map((d) => ({
          titulo: d.titulo,
          formato: d.formato || 'Interativa',
          gram: d.gram,
          voc: d.voc,
          pre: d.pre,
          in: d.in,
          post: d.post,
        })),
      });
      const pub = c.ok ? await chama('POST', `/curriculos/${id}/publicar`, {}) : c;
      if (!pub.ok) {
        marca(pub.j.erro ?? 'Não foi possível gravar as lições.');
        continue;
      }
    }
    marca();
    feitos++;
  }
  return {
    linhas: out,
    total: out.length,
    criados: feitos,
    msg: `${feitos} de ${curs} ${curs === 1 ? 'currículo importado e publicado' : 'currículos importados e publicados'} (a versão anterior fica no histórico).`,
  };
}

export default async function rotasPlanilhas(app: FastifyInstance) {
  app.get('/planilhas/:ent/exportar', { preHandler: exigeEnt }, async (req, rep) => {
    const { ent } = EntP.parse(req.params);
    if (ent === 'curriculos')
      return anexo(rep, `curriculos-${hoje()}.csv`, csv([CUR_COLS.map((c) => c.t), ...(await curExport())]));
    const cols = ENT[ent].cols;
    return anexo(rep, `${ENT[ent].titulo}-${hoje()}.csv`, csv([cols.map((c) => c.t), ...(await linhasExport(ent))]));
  });

  app.get('/planilhas/:ent/modelo', { preHandler: exigeEnt }, async (req, rep) => {
    const { ent } = EntP.parse(req.params);
    const cols = ent === 'curriculos' ? CUR_COLS : ENT[ent].cols;
    /* cabeçalho com * nos obrigatórios e uma linha de exemplo (começa com "Exemplo", a importação ignora) */
    const cab = cols.map((c) => (c.req === true || (ent === 'curriculos' && c.k === 'titulo') ? `${c.t}*` : c.t));
    const ex = cols.map((c, i) => (i === 0 ? `Exemplo - ${c.ex}` : c.ex));
    return anexo(rep, `modelo-${ent === 'curriculos' ? 'curriculos' : ENT[ent].titulo}.csv`, csv([cab, ex]));
  });

  app.post('/planilhas/:ent/importar', { preHandler: exigeEnt, bodyLimit: 5 * 1024 * 1024 }, async (req, rep) => {
    const { ent } = EntP.parse(req.params);
    const b = z
      .object({ csv: z.string().min(1).max(5_000_000), gravar: z.boolean().default(false) })
      .safeParse(req.body);
    if (!b.success) return rep.code(400).send({ erro: 'Envie o arquivo CSV.' });
    if (ent === 'curriculos') return importaCurriculos(app, req, rep, b.data.csv, b.data.gravar);
    const p = await previa(ent, b.data.csv);
    if ('erro' in p) return rep.code(400).send(p);
    const resumo = (ls: { erros: string[] }[]) => ({
      total: ls.length,
      validas: ls.filter((l) => !l.erros.length).length,
    });
    if (!b.data.gravar)
      return { linhas: p.linhas.map(({ linha, nome, erros }) => ({ linha, nome, erros })), ...resumo(p.linhas) };
    /* grava só as válidas, uma a uma, pela rota do cadastro */
    const out: { linha: number; nome: string; erros: string[]; ok?: boolean }[] = [];
    for (const l of p.linhas) {
      if (l.erros.length) {
        out.push({ linha: l.linha, nome: l.nome, erros: l.erros });
        continue;
      }
      const r = await app.inject({
        method: 'POST',
        url: ENT[ent].rota,
        headers: { cookie: req.headers.cookie ?? '', 'content-type': 'application/json' },
        payload: JSON.stringify(corpoDoCadastro(ent, l.dados)),
      });
      const j = r.json() as { erro?: string };
      out.push(
        r.statusCode < 300
          ? { linha: l.linha, nome: l.nome, erros: [], ok: true }
          : { linha: l.linha, nome: l.nome, erros: [j.erro ?? `Erro ${r.statusCode}.`] },
      );
    }
    const criados = out.filter((x) => x.ok).length;
    return {
      linhas: out,
      total: out.length,
      criados,
      msg: `${criados} de ${out.length} ${criados === 1 ? 'cadastro criado' : 'cadastros criados'}.`,
    };
  });
}
