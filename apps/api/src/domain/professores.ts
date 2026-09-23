/**
 * Professores: lista e ficha (Perfil, Log, Cursos = habilitação, Disponibilidade, Agenda, Feedbacks).
 * Porte de fichas.src.js (P.professores, prHabilitacao, habCurso, habItem, prAgenda, prHistorico) e
 * fichas-abas.src.js (prPerfil, fbProf, prFeedbacks).
 */
import { fmt } from '../lib/fmt.ts';
import {
  type Aula,
  agAulasEntre,
  agHM,
  agRotulo,
  crsItens,
  dispConflitos,
  FX_ESTADO,
  fxPresenca,
  type Oferta,
  prDisp,
} from './agenda.ts';
import { fxHora, fxPassadas, fxProximas } from './alunos.ts';
import { fxHash } from './aulas.ts';
import type { Base, CursoB, ProfessorB } from './base.ts';

export const prOfertas = (ofs: Oferta[], t: ProfessorB) => ofs.filter((o) => o.prof === t.name);
export const agNum = (n: number) => n.toFixed(1).replace('.', ',');
const cor = (b: Base, c: string) => b.corCurso[c] || '#1a4fd6';

export function prResumo(b: Base, t: ProfessorB, ofs: Oferta[]) {
  const meus = prOfertas(ofs, t);
  return {
    horarios: meus.length,
    aulas: meus.reduce((s, o) => s + o.dias.length, 0),
    alunos: new Set(meus.flatMap((o) => o.alunos)).size,
    fora: dispConflitos(prDisp(b, t, ofs), meus).length,
  };
}

export function linhaProfessor(b: Base, t: ProfessorB, ofs: Oferta[]) {
  const aulas = prOfertas(ofs, t).reduce((s, o) => s + o.dias.length, 0);
  return {
    id: t.id,
    nome: t.name,
    email: t.email,
    cursos: t.cursos.map((c) => ({ nome: c, cor: cor(b, c) })),
    aulas,
    teto: t.teto,
    acimaTeto: aulas > t.teto,
    ativo: t.active,
  };
}

/* ---------------- avaliações dos alunos ---------------- */
const FB_COMENT: Record<number, string[]> = {
  5: [
    'Aula muito dinâmica, saí falando mais.',
    'Explica com paciência e dá exemplo real.',
    'Melhor aula do módulo até agora.',
  ],
  4: [
    'Boa aula, só achei curta a parte de conversação.',
    'Gostei dos exercícios; poderia corrigir mais a pronúncia.',
    'Clara e organizada.',
  ],
  3: [
    'Aula ok, mas repetiu o conteúdo da semana passada.',
    'Faltou tempo para tirar dúvidas.',
    'Ritmo um pouco lento.',
  ],
  2: ['Começou atrasada e ficou corrida.', 'Pouca prática de fala, muito slide.'],
  1: ['A aula não começou no horário combinado.'],
};
export const FB_NOTAS = ['', 'muito ruim', 'ruim', 'regular', 'boa', 'excelente'];
export type Avaliacao = {
  quando: Date;
  aluno: string;
  curso: string;
  aula: string;
  nota: number;
  texto: string;
  registrada?: boolean;
};

/** aulas que o professor deu no período (executadas ou substituídas por ele) */
export const fxDadas = (b: Base, nome: string, dias: number, ofs: Oferta[], agora = new Date()) =>
  fxPassadas(b, (x) => x.prof === nome && ['executada', 'substituida'].includes(x.estado), dias, ofs, agora);

/** uma avaliação por aluno presente, quando ele responde (estável por aula e aluno), mais as registradas no portal */
export function fbProf(
  b: Base,
  t: ProfessorB,
  dias: number,
  ofs: Oferta[],
  registradas: Avaliacao[] = [],
  agora = new Date(),
): Avaliacao[] {
  const ini = new Date(agora);
  ini.setDate(ini.getDate() - dias);
  const dadas = agAulasEntre(b, ini, agora, agora, ofs).filter(
    (x) => x.quando < agora && x.prof === t.name && ['executada', 'substituida'].includes(x.estado),
  );
  const gerados = dadas.flatMap((x) =>
    x.alunos
      .filter((n) => fxPresenca(b, n, x) === 'presente' && fxHash(`${n}@${x.quando.getTime()}`) % 4 === 0)
      .map((n) => {
        const h = fxHash(`${t.name}@${n}@${x.quando.getTime()}`);
        const nota = h % 23 === 0 ? 1 : h % 11 === 0 ? 2 : h % 5 === 0 ? 3 : h % 2 ? 5 : 4;
        const cs = FB_COMENT[nota];
        return {
          quando: new Date(x.quando.getTime() + (x.duracao || 50) * 6e4 + (h % 240) * 6e4),
          aluno: n,
          curso: x.prod,
          aula: agRotulo(x),
          nota,
          texto: cs[h % cs.length],
        };
      }),
  );
  return [...registradas.filter((x) => x.quando >= ini), ...gerados].sort((x, y) => +y.quando - +x.quando);
}

/* ---------------- Perfil ---------------- */
export function prPerfil(
  b: Base,
  t: ProfessorB,
  ofs: Oferta[],
  hist: number,
  avs: Avaliacao[],
  ultima: { quando: Date; acao: string } | null,
  agora = new Date(),
) {
  const r = prResumo(b, t, ofs);
  const media = avs.length ? avs.reduce((s, x) => s + x.nota, 0) / avs.length : null;
  return {
    blocos: [
      {
        titulo: 'Identificação',
        itens: [
          { k: 'Nome', v: t.name },
          { k: 'E-mail', v: t.email },
          { k: 'Situação', v: t.active ? 'Ativo' : 'Inativo', tom: t.active ? 'green' : 'gray' },
          { k: 'Código', v: t.id },
        ],
      },
      {
        titulo: 'Escala',
        itens: [
          { k: 'Teto semanal', v: `${t.teto} aulas` },
          {
            k: 'Aulas por semana',
            v: `${r.aulas}${r.aulas > t.teto ? ' · acima do teto' : ''}`,
            tom: r.aulas > t.teto ? 'amber' : undefined,
          },
          { k: 'Horários na grade', v: String(r.horarios) },
          { k: 'Alunos na grade', v: String(r.alunos) },
          {
            k: 'Fora da disponibilidade',
            v: r.fora ? `${r.fora} ${r.fora === 1 ? 'aula' : 'aulas'}` : 'nenhuma aula',
            tom: r.fora ? 'red' : undefined,
          },
        ],
      },
      {
        titulo: 'Cursos e avaliação',
        itens: [
          { k: 'Cursos habilitados', v: t.cursos.length ? t.cursos.join(', ') : null },
          { k: 'Aulas dadas', v: `${fxDadas(b, t.name, hist, ofs, agora).length} nos últimos ${hist} dias` },
          {
            k: 'Nota média',
            v:
              media == null
                ? null
                : `${agNum(media)} de 5 · ${avs.length}${avs.length === 1 ? ' avaliação' : ' avaliações'}`,
          },
          {
            k: 'Última alteração',
            v: ultima ? `${fmt.dataHora(ultima.quando, true)} · ${ultima.acao}` : 'nenhuma registrada',
          },
        ],
      },
    ],
  };
}

/* ---------------- Cursos: habilitação ---------------- */
export const permDe = (t: ProfessorB, c: CursoB) =>
  t.cursos.includes(c.name) ? (t.habil?.[c.name] ?? crsItens(c)) : [];
export const titularDe = (t: ProfessorB, c: CursoB) =>
  c.estrutura === 'turmas' ? c.turmas.filter((x) => x.professor === t.name).map((x) => x.name) : [];

export function prHabilitacao(b: Base, t: ProfessorB, ofs: Oferta[]) {
  return b.cursos.map((c) => {
    const on = t.cursos.includes(c.name);
    const itens = crsItens(c);
    const eTurma = c.estrutura === 'turmas';
    const perm = permDe(t, c);
    const titular = titularDe(t, c);
    const naGrade = ofs.filter((o) => o.prod === c.name && o.prof === t.name).length;
    return {
      id: c.id,
      curso: c.name,
      cor: cor(b, c.name),
      ativo: c.active !== false,
      on,
      eTurma,
      resumo: `${
        on
          ? itens.length
            ? `habilitado em ${perm.length} de ${itens.length} ${eTurma ? 'turmas' : 'módulos'}`
            : 'habilitado nas aulas particulares'
          : 'não habilitado — não é escalado neste curso'
      } · ${naGrade} ${naGrade === 1 ? 'horário' : 'horários'} na grade${titular.length ? ` · titular de ${titular.join(', ')}` : ''}`,
      itens: on ? itens.map((x) => ({ nome: x, on: perm.includes(x), titular: titular.includes(x) })) : [],
    };
  });
}

/* ---------------- Agenda: próximas e passadas ---------------- */
const aulaCor = (b: Base, x: Aula) => (x.mod && b.corModulo[x.mod]) || b.corCurso[x.prod] || '#1e46c8';
export function prAgenda(b: Base, t: ProfessorB, dias: number, ofs: Oferta[], agora = new Date()) {
  const ls = fxProximas(b, (x) => x.prof === t.name, dias, ofs, agora);
  return {
    dias,
    aulas: ls.map((x) => ({
      k: x.k,
      data: fmt.semana(x.quando),
      horario: fxHora(x),
      rotulo: agRotulo(x),
      cor: aulaCor(b, x),
      prod: x.prod,
      quem: x.quem,
      alunoId: x.vagas === 1 ? (b.alunos.find((a) => a.name === x.quem)?.id ?? null) : null,
      sala: x.sala,
      alunos: `${x.n}/${x.vagas}`,
      estadoTag: FX_ESTADO[x.estado],
    })),
  };
}
export function prHistorico(b: Base, t: ProfessorB, dias: number, ofs: Oferta[], agora = new Date()) {
  const todas = fxPassadas(b, (x) => x.prof === t.name || x.sub === t.name, dias, ofs, agora);
  return {
    dias,
    stats: [
      {
        valor: String(todas.filter((x) => x.prof === t.name && ['executada', 'substituida'].includes(x.estado)).length),
        rotulo: 'aulas dadas',
        tom: 'green',
      },
      { valor: String(todas.filter((x) => x.sub === t.name).length), rotulo: 'substituído por outro' },
      { valor: String(todas.filter((x) => x.prof === t.name && x.sub).length), rotulo: 'deu no lugar de outro' },
      {
        valor: String(todas.filter((x) => x.estado === 'naoFinalizada').length),
        rotulo: 'não finalizadas',
        tom: 'amber',
      },
      { valor: String(todas.filter((x) => x.estado === 'cancelada').length), rotulo: 'canceladas' },
    ],
    aulas: todas.map((x) => ({
      k: x.k,
      data: fmt.semana(x.quando),
      horario: fxHora(x),
      rotulo: agRotulo(x),
      cor: aulaCor(b, x),
      prod: x.prod,
      quem: x.quem,
      alunoId: x.vagas === 1 ? (b.alunos.find((a) => a.name === x.quem)?.id ?? null) : null,
      alunos: `${x.n}/${x.vagas}`,
      estado: x.estado,
      estadoTag:
        x.sub === t.name
          ? [`substituído por ${x.prof}`, 'purple']
          : x.sub
            ? [`deu no lugar de ${x.sub}`, 'purple']
            : FX_ESTADO[x.estado],
    })),
  };
}

/* ---------------- Feedbacks ---------------- */
export function prFeedbacks(avs: Avaliacao[], dias: number) {
  const media = avs.length ? avs.reduce((s, x) => s + x.nota, 0) / avs.length : 0;
  const baixas = avs.filter((x) => x.nota <= 2).length;
  return {
    dias,
    stats: [
      { valor: String(avs.length), rotulo: 'avaliações no período' },
      {
        valor: avs.length ? agNum(media) : '—',
        rotulo: 'nota média, de 5',
        tom: avs.length && media < 3.5 ? 'amber' : undefined,
      },
      {
        valor: avs.length ? `${Math.round((avs.filter((x) => x.nota >= 4).length / avs.length) * 100)}%` : '—',
        rotulo: 'notas 4 e 5',
      },
      { valor: String(baixas), rotulo: 'notas 1 e 2', tom: baixas ? 'red' : undefined },
      { valor: String(new Set(avs.map((x) => x.aluno)).size), rotulo: 'alunos que avaliaram' },
    ],
    lista: avs.map((x) => ({
      quando: `${fmt.data(x.quando)} · ${agHM(x.quando)}`,
      aluno: x.aluno,
      curso: x.curso,
      aula: x.aula,
      nota: x.nota,
      texto: x.texto,
      registrada: !!x.registrada,
    })),
    porCurso: [...new Set(avs.map((x) => x.curso))].map((c) => {
      const xs = avs.filter((x) => x.curso === c);
      return { curso: c, n: xs.length, media: agNum(xs.reduce((s, x) => s + x.nota, 0) / xs.length) };
    }),
  };
}

/* ---------------- Log ---------------- */
export const prLogBase = (t: ProfessorB) => ({
  acao: 'Cadastro na base',
  quem: 'importação',
  detalhe: `${t.cursos.length} cursos habilitados · teto de ${t.teto || 24} aulas por semana`,
});
