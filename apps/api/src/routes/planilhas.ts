/**
 * Planilhas (30/09/2026): exportar em CSV, baixar o modelo e importar o modelo preenchido — alunos, professores e
 * colaboradores. O CSV usa ; e BOM (o Excel em pt-BR abre certo) e aceita , na importação. Datas em dd/mm/aaaa;
 * listas (cursos do professor) separadas por |.
 *
 * A importação grava cada linha pela mesma rota do cadastro da tela (POST /alunos, /professores,
 * /config/colaboradores) com a sessão de quem importa: mesmas validações, permissões e log. Antes de gravar, a
 * prévia confere obrigatórios, formatos e repetidos (no arquivo e no banco).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { AL_SIT } from '../domain/agenda.ts';
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
  const corpo = tab.slice(1).filter((l) => !/^exemplo/i.test((l[0] ?? '').trim()));
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
    linhas: corpo.map((l, n) => {
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
      if (email) noArquivo.email.set(email, n + 2);
      if (cpf) noArquivo.cpf.set(cpf, n + 2);
      return { linha: n + 2, nome: d.nome || '—', erros, dados: d };
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

/* ---------------- rotas ---------------- */
const EntP = z.object({ ent: z.enum(['alunos', 'professores', 'colaboradores']) });

async function exigeEnt(req: FastifyRequest, rep: FastifyReply) {
  const p = EntP.safeParse(req.params);
  if (!p.success) return rep.code(404).send({ erro: 'Planilha não encontrada.' });
  if (p.data.ent === 'colaboradores') return exigeCfg(req, rep);
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

export default async function rotasPlanilhas(app: FastifyInstance) {
  app.get('/planilhas/:ent/exportar', { preHandler: exigeEnt }, async (req, rep) => {
    const { ent } = EntP.parse(req.params);
    const cols = ENT[ent].cols;
    return anexo(rep, `${ENT[ent].titulo}-${hoje()}.csv`, csv([cols.map((c) => c.t), ...(await linhasExport(ent))]));
  });

  app.get('/planilhas/:ent/modelo', { preHandler: exigeEnt }, async (req, rep) => {
    const { ent } = EntP.parse(req.params);
    const cols = ENT[ent].cols;
    /* cabeçalho com * nos obrigatórios e uma linha de exemplo (começa com "Exemplo", a importação ignora) */
    const cab = cols.map((c) => (c.req === true ? `${c.t}*` : c.t));
    const ex = cols.map((c, i) => (i === 0 ? `Exemplo - ${c.ex}` : c.ex));
    return anexo(rep, `modelo-${ENT[ent].titulo}.csv`, csv([cab, ex]));
  });

  app.post('/planilhas/:ent/importar', { preHandler: exigeEnt, bodyLimit: 5 * 1024 * 1024 }, async (req, rep) => {
    const { ent } = EntP.parse(req.params);
    const b = z
      .object({ csv: z.string().min(1).max(5_000_000), gravar: z.boolean().default(false) })
      .safeParse(req.body);
    if (!b.success) return rep.code(400).send({ erro: 'Envie o arquivo CSV.' });
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
