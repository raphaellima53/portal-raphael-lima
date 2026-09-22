/**
 * Empresas: contas B2B e B2B2C (porte de empresas.src.js — empDados, empAlertas, empSit, empCobranca).
 * O contrato vem do banco; alunos vinculados, consumo e presença são lidos da base viva (matrículas e agenda).
 */
import { fmt } from '../lib/fmt.ts';
import { type Aula, agAulasEntre, alMat, alSit, crsRegras, fxPresenca, type Oferta } from './agenda.ts';
import type { AlunoB, Base } from './base.ts';

export type EmpresaB = {
  id: string;
  nome: string;
  cnpj: string;
  segmento: string;
  modelo: 'B2B' | 'B2B2C';
  gerente: string;
  rhNome: string;
  rhEmail: string;
  inicio: Date;
  fim: Date;
  licencas: number;
  aulas: number;
  valor: number;
  subsidio: number;
  desconto: number;
  renovaAuto: boolean;
  turmaCurso: string | null;
  cursos: string[];
  relEm: Date | null;
  /* adequação ao Portal Alumni */
  representante: string;
  funcionarios: number | null;
  rhDepartamento: string;
  rhTelefone: string;
  endereco: unknown;
};

/** coluna @db.Date chega como meia-noite UTC: ancora na meia-noite local */
export const diaLocal = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export const diaUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);
const hoje0 = (agora = new Date()) => {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const empDias = (e: EmpresaB, agora = new Date()) => Math.round((+e.fim - +hoje0(agora)) / 864e5);
export const empSit = (e: EmpresaB, agora = new Date()): [string, string] => {
  const d = empDias(e, agora);
  return d < 0 ? ['Encerrado', 'gray'] : d <= 60 ? ['Renovação', 'amber'] : ['Ativo', 'green'];
};
export const empCobranca = (e: EmpresaB) =>
  e.modelo === 'B2B'
    ? e.turmaCurso
      ? 'turma dedicada · a empresa paga o contrato das turmas'
      : 'a empresa paga 100% das licenças'
    : (e.subsidio ? `a empresa paga ${e.subsidio}% e o colaborador ${100 - e.subsidio}%` : 'o colaborador paga 100%') +
      (e.desconto ? ` · ${e.desconto}% de desconto` : '');
export const empPaga = (e: EmpresaB) =>
  e.modelo === 'B2B' ? 'Empresa' : e.subsidio ? `Empresa ${e.subsidio}% · aluno ${100 - e.subsidio}%` : 'Aluno';

export type EmpDados = {
  turma: boolean;
  alunos: AlunoB[];
  ativos: number;
  licUsadas: number;
  licContr: number;
  consumo: number;
  contratadas: number;
  presenca: number | null;
  presencaRot: string;
  receitaEmpresa: number;
  receitaAluno: number;
  inad: number;
};

/** aulas dos últimos 30 dias até agora (a mesma leitura serve para todas as contas) */
export const aulas30 = (b: Base, ofs: Oferta[], agora = new Date()) => {
  const ini = hoje0(agora);
  ini.setDate(ini.getDate() - 30);
  return agAulasEntre(b, ini, agora, agora, ofs).filter((a) => a.quando <= agora);
};

/** os números da conta, lidos da base */
export function empDados(b: Base, e: EmpresaB, ps: Aula[]): EmpDados {
  const crs = e.turmaCurso ? b.cursos.find((c) => c.name === e.turmaCurso) : undefined;
  if (crs) {
    const rg = crsRegras(crs);
    const ts = crs.turmas;
    const aulas = ps.filter((a) => a.prod === crs.name);
    const canc = aulas.filter((a) => a.estado === 'cancelada').length;
    const feitas = aulas.filter((a) => ['executada', 'substituida'].includes(a.estado)).length;
    const vagas = ts.reduce((s, t) => s + (t.vagas || 0), 0);
    const ocup = ts.reduce((s, t) => s + (t.ocupadas || 0), 0);
    const consumo = ts.reduce((s, t, i) => {
      const m = b.alunos.map((a) => alMat(a).find((x) => x.curso === crs.name && x.modulo === t.name)).find(Boolean);
      return s + Math.round(rg.pacote * (m ? (m.usadas || 0) / (m.total || 1) : (i % 5) / 5));
    }, 0);
    return {
      turma: true,
      alunos: [],
      ativos: ocup,
      licUsadas: ocup,
      licContr: vagas,
      consumo,
      contratadas: ts.length * rg.pacote,
      presenca: aulas.length - canc ? Math.round((feitas / (aulas.length - canc)) * 100) : null,
      presencaRot: 'aulas realizadas em 30 dias',
      receitaEmpresa: 0,
      receitaAluno: 0,
      inad: 0,
    };
  }
  const al = b.alunos.filter((a) => a.empresa === e.nome);
  const nomes = new Set(al.map((a) => a.name));
  const ativos = al.filter((a) => alSit(a) === 'Ativo' && alMat(a).length);
  let p = 0;
  let f = 0;
  for (const a of ps)
    for (const n of a.alunos) {
      if (!nomes.has(n)) continue;
      const r = fxPresenca(b, n, a);
      if (r === 'presente') p++;
      else if (r === 'falta') f++;
    }
  const consumo = al.reduce((s, a) => s + alMat(a).reduce((t, m) => t + (m.usadas || 0), 0), 0);
  const base = e.modelo === 'B2B' ? e.licencas * e.valor : ativos.length * e.valor * (1 - (e.desconto || 0) / 100);
  return {
    turma: false,
    alunos: al,
    ativos: ativos.length,
    licUsadas: ativos.length,
    licContr: e.licencas,
    consumo,
    contratadas: e.aulas,
    presenca: p + f ? Math.round((p / (p + f)) * 100) : null,
    presencaRot: 'presença em 30 dias',
    receitaEmpresa: Math.round(e.modelo === 'B2B' ? base : (base * (e.subsidio || 0)) / 100),
    receitaAluno: Math.round(e.modelo === 'B2B' ? 0 : base * (1 - (e.subsidio || 0) / 100)),
    inad: al.filter((a) => alSit(a) === 'Inadimplente').length,
  };
}

export function empAlertas(e: EmpresaB, d: EmpDados, agora = new Date()): [string, string][] {
  const out: [string, string][] = [];
  const dias = empDias(e, agora);
  if (dias < 0) out.push([`Contrato encerrado há ${-dias} dias`, 'gray']);
  else if (dias <= 60)
    out.push([
      `Vence em ${dias}${dias === 1 ? ' dia' : ' dias'}${e.renovaAuto ? ' · renova sozinho' : ' · sem renovação automática'}`,
      dias <= 30 ? 'red' : 'amber',
    ]);
  if (!d.turma && d.licUsadas > d.licContr) out.push([`${d.licUsadas - d.licContr} acima das licenças`, 'red']);
  if (d.contratadas && d.consumo / d.contratadas >= 0.85)
    out.push([`Consumo em ${Math.round((d.consumo / d.contratadas) * 100)}% das aulas`, 'amber']);
  if (d.presenca != null && d.presenca < 80)
    out.push([`${d.turma ? 'Realização' : 'Presença'} em ${d.presenca}%`, 'amber']);
  if (d.inad) out.push([`${d.inad}${d.inad === 1 ? ' aluno inadimplente' : ' alunos inadimplentes'}`, 'red']);
  return out;
}

/** presença de um aluno nos últimos 30 dias */
export const presencaDe = (b: Base, nome: string, ps: Aula[]) => {
  let p = 0;
  let f = 0;
  for (const a of ps) {
    if (!a.alunos.includes(nome)) continue;
    const r = fxPresenca(b, nome, a);
    if (r === 'presente') p++;
    else if (r === 'falta') f++;
  }
  return p + f ? `${Math.round((p / (p + f)) * 100)}%` : '—';
};

export const moeda = (n: number) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
export const dataTxt = (d: Date) => fmt.data(d);
