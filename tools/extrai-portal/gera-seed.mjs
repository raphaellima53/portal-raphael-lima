// Gera apps/api/prisma/seed-data/base.json a partir do portal rodando.
// 1) node sonda.cjs snapshot.expr.js snapshot.json   (abre o portal no Edge headless e lê as bases em memória)
// 2) node gera-seed.mjs                               (normaliza para o formato do seed)
// Datas que o portal calcula a partir de "hoje" (fim de contrato, vigência das empresas, leads) viram offsets em dias,
// para o seed recalcular no dia em que roda — como o portal faz a cada abertura.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(readFileSync(join(DIR, 'snapshot.json'), 'utf8'));
const DESTINO = join(DIR, '..', '..', 'apps', 'api', 'prisma', 'seed-data', 'base.json');

const ref = new Date(s.geradoEm);
const refDia = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
/* "2027-07-21" ou ISO com hora local → dias a partir da extração */
const dias = (v) => {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - refDia) / 864e5);
};
const minutos = (v) => (v ? Math.round((new Date(v).getTime() - ref.getTime()) / 6e4) : null);
const C = s.CAD;

const catalogos = [
  ...C.courseTypes.map((t, i) => ({
    tipo: 'courseTypes',
    nome: t.name,
    ativo: t.active !== false,
    ordem: i,
    dados: { format: t.format, allowsModules: t.allowsModules },
  })),
  ...['languages', 'skills', 'roomTypes', 'genders', 'finResp'].flatMap((tipo) =>
    C[tipo].map((nome, i) => ({ tipo, nome, ativo: true, ordem: i, dados: null })),
  ),
];

const cursos = C.courses.map((c, i) => ({
  nome: c.name,
  cor: s.CURSOS[c.name].color,
  estrutura: c.estrutura,
  formato: c.formato,
  tipo: c.tipo,
  idioma: c.idioma,
  ativo: c.active !== false,
  autoAgenda: !!c.autoAgenda,
  descricao: c.descricao || '',
  regras: c.regras,
  ordem: i,
  modulos: (c.modulos || []).map((m, k) => ({
    nome: m,
    cor: (s.MODULOS[m] || { color: s.CURSOS[c.name].color }).color,
    ordem: k,
  })),
  turmas: (c.turmas || []).map((t, k) => ({
    nome: t.name,
    grupo: t.grupo,
    professor: t.professor || null,
    grade: t.grade,
    vagas: t.vagas,
    ocupadas: t.ocupadas,
    sala: t.sala,
    modalidade: t.modalidade,
    periodo: t.periodo,
    curriculo: t.curriculo,
    ordem: k,
  })),
}));

const professores = C.teachers.map((t, i) => ({
  id: t.id,
  nome: t.name,
  email: t.email,
  cursos: t.cursos || [],
  habilitacao: t.habil || null,
  carga: t.carga ?? 3,
  teto: t.teto ?? 24,
  ativo: t.active !== false,
  valorHora: t.valorHora ?? null,
  ordem: i,
}));

const empresas = s.EMP.map((e, i) => {
  const cad = C.companies.find((x) => x.name === e.nome);
  return {
    id: e.id,
    nome: e.nome,
    cnpj: e.cnpj,
    segmento: e.segmento,
    modelo: e.modelo,
    gerente: e.gerente,
    representante: cad ? cad.rep : null,
    rhNome: e.rh[0],
    rhEmail: e.rh[1],
    inicioDias: dias(e.inicio),
    fimDias: dias(e.fim),
    licencas: e.licencas,
    aulas: e.aulas,
    valor: e.valor,
    subsidio: e.subsidio,
    desconto: e.desconto,
    renovaAuto: !!e.renovaAuto,
    turmaCurso: e.turmaCurso,
    cursos: e.cursos,
    ativo: cad ? cad.active !== false : true,
    ordem: i,
  };
});

const alunos = s.alunos.map((a) => ({
  id: a.id,
  nome: a.name,
  email: a.email,
  cpf: a.cpf,
  emailPlaceholder: !!a.emailPlaceholder,
  status: a.effectiveStatus || a.status,
  desativadoDias: dias(a.deactivatedAt),
  empresa: a.company,
  contratoFimDias: dias(a.contractEndDate),
  matriculas: a.enrollments.map((e, k) => ({
    curso: e.course,
    modulo: e.currentModule,
    usadas: e.usedLessons,
    total: e.totalLessons,
    modalidade: e.modalidade || 'Online',
    desativadoDias: dias(e.deactivatedAt),
    alocacao: e.aloc || null,
    ordem: k,
  })),
}));

const personas = s.PERSONAS.map((p, i) => ({
  letra: p.letra,
  tipo: p.tipo,
  perfilId: p.perfilId,
  nome: p.nome,
  login: p.login,
  senha: p.senha,
  cursos: p.curso,
  modulos: p.modulo,
  objetivo: p.objetivo || null,
  agenda: p.agenda || null,
  alunoNome: p.alunoNome || null,
  ordem: i,
}));
const loginsPersona = new Set(personas.map((p) => p.login));
/* usuários da base antiga: [nome, email, perfil, escopo, status, mfa, último acesso] */
const usuarios = s.AC.usuarios
  .filter((u) => !loginsPersona.has(u[1]))
  .map((u, i) => ({
    nome: u[0],
    email: u[1],
    perfil: u[2],
    escopo: u[3],
    status: u[4],
    mfa: !!u[5],
    ultimoAcesso: u[6],
    ordem: 100 + i,
  }));

const base = {
  geradoEm: s.geradoEm,
  catalogos,
  departamentos: C.departments.map((d, i) => ({ nome: d.name, descricao: d.description || '', ordem: i })),
  cargos: C.positions.map((p, i) => ({ nome: p.name, departamento: p.dept, descricao: p.description || '', ordem: i })),
  colaboradores: C.employees.map((e, i) => ({
    nome: e.name,
    email: e.email,
    departamento: e.dept,
    cargo: e.cargo,
    ativo: e.active !== false,
    ordem: i,
  })),
  segmentos: C.segments.map((x) => x.name),
  empresas,
  cursos,
  professores,
  salas: C.rooms.map((r, i) => ({
    nome: r.name,
    atende: r.atende,
    tipo: r.tipo,
    zoom: !!r.zoom,
    ativo: r.active !== false,
    ordem: i,
  })),
  feriados: C.holidays.map((h) => ({ data: h.data.split('/').reverse().join('-'), nome: h.nome, origem: h.origem })),
  funcionamento: C.operatingHours.map((o, i) => ({ dia: i, nome: o.dia, aberto: !!o.on, inicio: o.ini, fim: o.fim })),
  alunos,
  curriculos: s.CUR.map((c, i) => ({
    id: c.id,
    nome: c.nome,
    grupo: c.grupo,
    tipo: c.tipo,
    idioma: c.idioma,
    aplicado: c.aplicado,
    versoes: c.versoes,
    conteudos: c.conteudos || [],
    ordem: i,
  })),
  personas,
  usuarios,
  historicoBase: (s.AGD.audit || []).map((r) => ({
    quando: r[0],
    autor: r[1],
    entidade: r[2],
    acao: r[3],
    detalhe: r[4],
    nome: r[5],
  })),
  leads: Array.isArray(s.LEADS)
    ? s.LEADS.map((l) => ({
        ...l,
        entrouMin: minutos(l.entrou),
        mudouMin: minutos(l.mudou),
        entrou: undefined,
        mudou: undefined,
      }))
    : [],
  eventos: (s.AG_EVENTOS || []).map((e) => ({
    ...e,
    iniMin: minutos(e.ini),
    fimMin: minutos(e.fim),
    ini: undefined,
    fim: undefined,
  })),
};

/* nada de e-mail de gente de verdade no repositório: todo domínio vira .teste (veja apps/api/scripts/anonimiza.ts) */
const PESSOAIS = new Set(['gmail', 'hotmail', 'outlook', 'yahoo', 'live', 'icloud', 'uol', 'bol', 'terra']);
const anonimiza = (t) =>
  t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (e) => {
    const [local, dominio = ''] = e.split('@');
    const rotulo = dominio.split('.')[0].toLowerCase();
    return dominio.endsWith('.teste') ? e : `${local}@${PESSOAIS.has(rotulo) ? 'pessoal' : rotulo}.teste`;
  });

mkdirSync(dirname(DESTINO), { recursive: true });
writeFileSync(DESTINO, anonimiza(`${JSON.stringify(base, null, 1)}\n`), 'utf8');
console.log(
  'gravado',
  DESTINO,
  Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v])),
);
