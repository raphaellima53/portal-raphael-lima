/**
 * Cursos: catálogo e ficha do curso (Visão geral, Regras, Currículo, Grade semanal).
 * Porte de fichas.src.js (P.cursos, P.curso, crsGeral, crsRegrasTela, crsCurriculo, crsGrade) e p5-cursos.js (crsCorpo).
 */
import { agDiasTxt, agHabilitado, agHH, agOfertas, alMat, alSit, crsItens, crsRegras } from './agenda.ts';
import type { Base, CursoB } from './base.ts';

export const SIT_TOM: Record<string, string> = {
  Ativo: 'green',
  Suspenso: 'amber',
  Congelado: 'amber',
  Inadimplente: 'red',
  Cancelado: 'red',
  Inativo: 'gray',
};

export const crsAlunos = (b: Base, nome: string) =>
  b.alunos.filter((a) => alMat(a).some((e) => e.curso === nome)).length;
export const crsProfs = (b: Base, nome: string) =>
  b.professores.filter((t) => t.active && t.cursos.includes(nome)).length;

export const FIN_VALOR_PADRAO: Record<string, number> = {
  'Community live classes': 58,
  'Conexión Español': 66,
  'Alumni Black': 140,
  FAAP: 380,
  'Palmares Paulista': 420,
};
export const finValorAula = (c: CursoB) =>
  crsRegras(c).valorAula ||
  FIN_VALOR_PADRAO[c.name] ||
  (c.estrutura === 'nenhuma' ? 140 : c.estrutura === 'turmas' ? 400 : 60);

export function catalogo(b: Base) {
  return b.cursos.map((c, i) => {
    const itens = crsItens(c);
    return {
      id: c.id,
      n: i + 1,
      nome: c.name,
      cor: c.color,
      idioma: c.idioma,
      tipo: c.tipo,
      descricao: c.descricao,
      autoAgenda: c.autoAgenda,
      ativo: c.active,
      estrutura: c.estrutura,
      itens,
      profs: crsProfs(b, c.name),
      alunos: crsAlunos(b, c.name),
    };
  });
}

/** Visão geral: módulos ou turmas e quem está em cada um (crsCorpo + professores habilitados) */
export function cursoGeral(b: Base, c: CursoB, curriculos: { id: string; nome: string }[]) {
  const i = b.cursos.indexOf(c);
  const mats = b.alunos.flatMap((a) =>
    alMat(a)
      .filter((e) => e.curso === c.name)
      .map((e) => ({ a, e })),
  );
  const curLink = (nome: string) => {
    const x = curriculos.find((y) => y.nome === nome);
    return x ? { id: x.id, nome } : null;
  };
  const aluno = ({ a, e }: (typeof mats)[number]) => ({
    alunoId: a.id,
    nome: a.name,
    usadas: e.usadas,
    total: e.total,
    modalidade: e.modalidade,
    situacao: alSit(a),
    modulo: e.modulo,
  });
  const presenciais = mats.filter((x) => x.e.modalidade === 'Presencial').length;
  const profs = b.professores
    .filter((t) => agHabilitado(t, c.name, null))
    .map((t) => ({
      id: t.id,
      nome: t.name,
      recorte: t.habil?.[c.name] ? `${t.habil[c.name].length} de ${crsItens(c).length}` : null,
    }));

  if (c.estrutura === 'turmas' && c.turmas.length) {
    const vagas = c.turmas.reduce((q, x) => q + x.vagas, 0);
    const ocup = c.turmas.reduce((q, x) => q + x.ocupadas, 0);
    return {
      estrutura: 'turmas' as const,
      stats: [
        { valor: String(c.turmas.length), rotulo: 'turmas' },
        { valor: `${ocup}/${vagas}`, rotulo: 'vagas contratadas ocupadas' },
        { valor: String(crsProfs(b, c.name)), rotulo: 'professores' },
        { valor: String(c.turmas.filter((x) => x.modalidade === 'Presencial').length), rotulo: 'turmas presenciais' },
        { valor: mats.length.toLocaleString('pt-BR'), rotulo: 'alunos com matrícula no portal' },
      ],
      turmas: c.turmas.map((t, j) => ({
        n: `${i + 1}.1.${j + 1}`,
        nome: t.name,
        grupo: t.grupo,
        professor: t.professor ?? '—',
        grade: t.grade,
        sala: t.sala,
        modalidade: t.modalidade,
        vagas: t.vagas,
        ocupadas: t.ocupadas,
        periodo: t.periodo,
        curriculo: curLink(t.curriculo),
        curriculoNome: t.curriculo,
        alunos: mats.filter((x) => x.e.modulo === t.name).map(aluno),
      })),
      profs,
    };
  }
  if (c.estrutura === 'modulos' && c.modulos.length) {
    return {
      estrutura: 'modulos' as const,
      stats: [
        { valor: String(c.modulos.length), rotulo: 'módulos' },
        { valor: mats.length.toLocaleString('pt-BR'), rotulo: 'matrículas ativas' },
        { valor: String(crsProfs(b, c.name)), rotulo: 'professores' },
        { valor: presenciais.toLocaleString('pt-BR'), rotulo: 'presenciais' },
        { valor: (mats.length - presenciais).toLocaleString('pt-BR'), rotulo: 'online' },
      ],
      modulos: c.modulos.map((m, j) => {
        const qs = mats.filter((x) => x.e.modulo === m);
        return {
          n: `${i + 1}.${j + 1}`,
          nome: m,
          cor: b.corModulo[m] || c.color,
          alunos: qs.length,
          presenciais: qs.filter((x) => x.e.modalidade === 'Presencial').length,
          curriculo: curLink(`${c.name} · ${m}`),
          curriculoNome: `${c.name} · ${m}`,
        };
      }),
      alunos: mats.map(aluno),
      profs,
    };
  }
  const tot = mats.reduce((q, x) => q + (x.e.total || 0), 0);
  const us = mats.reduce((q, x) => q + (x.e.usadas || 0), 0);
  return {
    estrutura: 'nenhuma' as const,
    stats: [
      { valor: mats.length.toLocaleString('pt-BR'), rotulo: 'matrículas ativas' },
      { valor: String(crsProfs(b, c.name)), rotulo: 'professores' },
      { valor: tot.toLocaleString('pt-BR'), rotulo: 'aulas contratadas' },
      { valor: tot ? `${Math.round((us / tot) * 100)}%` : '—', rotulo: 'do pacote consumido' },
      { valor: presenciais.toLocaleString('pt-BR'), rotulo: 'presenciais' },
    ],
    curriculo: curLink(`${c.name} · Trilha particular`),
    curriculoNome: `${c.name} · Trilha particular`,
    alunos: mats.map(aluno),
    profs,
  };
}

export function cursoRegras(b: Base, c: CursoB) {
  const rg = crsRegras(c);
  return {
    estrutura: c.estrutura,
    estruturaTxt:
      {
        modulos: `Módulos — ${c.modulos.length} níveis`,
        turmas: `Turmas — ${c.turmas.length} turmas de contrato`,
        nenhuma: 'Sem subdivisão — cada matrícula é um contrato particular',
      }[c.estrutura] ?? '—',
    tipoIdioma: [c.tipo, c.idioma].filter((x) => x && x !== '—').join(' · ') || '—',
    vagas: rg.vagas,
    duracao: rg.duracao,
    modalidades: rg.modalidades,
    pacote: rg.pacote,
    cancelamento: rg.cancelamento,
    autoAgenda: c.autoAgenda,
    exigeDisp: !!rg.exigeDisp,
    valorAula: finValorAula(c),
    horarios: agOfertas(b).filter((o) => o.prod === c.name).length,
  };
}

type CurLinha = {
  id: string;
  nome: string;
  grupo: string;
  aplicado: string[];
  versoes: [string, string, string, unknown[]?][];
  conteudos: { links: { in: string } }[];
};
export const curSemMat = (c: { conteudos: { links: { in: string } }[] }) =>
  c.conteudos.filter((x) => !x.links.in).length;

export function cursoCurriculo(c: CursoB, cs: CurLinha[]) {
  const itens = crsItens(c);
  const sem = itens.filter((it) => !cs.some((x) => x.aplicado.includes(it)));
  const semMat = cs.reduce((s, x) => s + curSemMat(x), 0);
  const rasc = cs.filter((x) => x.versoes[x.versoes.length - 1]?.[1] === 'Rascunho');
  return {
    stats: [
      { valor: String(cs.length), rotulo: 'currículos do curso' },
      { valor: String(cs.reduce((s, x) => s + x.conteudos.length, 0)), rotulo: 'conteúdos' },
      { valor: String(semMat), rotulo: 'conteúdos sem link de In-class', tom: semMat ? 'amber' : 'green' },
      { valor: String(rasc.length), rotulo: 'com versão em rascunho' },
      {
        valor: String(sem.length),
        rotulo: `${c.estrutura === 'turmas' ? 'turmas' : 'módulos'} sem currículo`,
        tom: sem.length ? 'red' : 'green',
      },
    ],
    lista: cs.map((x) => {
      const ult = x.versoes[x.versoes.length - 1];
      const pub = x.versoes.filter((v) => v[1] === 'Publicada').pop();
      return {
        id: x.id,
        nome: x.nome,
        aplicado: x.aplicado.join(', '),
        publicada: pub?.[0] ?? null,
        rascunho: ult?.[1] === 'Rascunho' ? ult[0] : null,
        conteudos: x.conteudos.length,
        semLink: curSemMat(x),
        publicadaEm: pub?.[2] ?? null,
      };
    }),
    emRascunho: rasc.map((x) => ({ id: x.id, nome: x.nome, versao: x.versoes[x.versoes.length - 1][0] })),
    semCurriculo: sem,
    eTurma: c.estrutura === 'turmas',
  };
}

export function cursoGrade(b: Base, c: CursoB) {
  const ofs = agOfertas(b)
    .filter((o) => o.prod === c.name)
    .sort((x, y) => String(x.mod).localeCompare(String(y.mod), 'pt-BR') || x.hora - y.hora);
  const sem = ofs.filter((o) => o.prof === '—').length;
  const faixa = (h: number, d: number) => {
    const fim = h * 60 + (d || 50);
    return `${agHH(h)}–${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`;
  };
  return {
    stats: [
      { valor: String(ofs.length), rotulo: 'horários ofertados' },
      { valor: String(ofs.reduce((s, o) => s + o.dias.length, 0)), rotulo: 'aulas por semana' },
      { valor: String(new Set(ofs.map((o) => o.prof).filter((p) => p !== '—')).size), rotulo: 'professores na grade' },
      { valor: String(sem), rotulo: 'sem professor', tom: sem ? 'red' : 'green' },
      { valor: String(new Set(ofs.flatMap((o) => o.alunos)).size), rotulo: 'alunos com aula' },
    ],
    coluna: c.estrutura === 'turmas' ? 'Turma' : c.estrutura === 'nenhuma' ? 'Trilha' : 'Módulo',
    linhas: ofs.map((o) => {
      const al = o.vagas === 1 ? b.alunos.find((a) => a.name === o.quem) : undefined;
      const prof = b.professores.find((t) => t.name === o.prof);
      return {
        item: o.mod || 'Trilha particular',
        quem: o.quem,
        alunoId: al?.id ?? null,
        dias: agDiasTxt(o),
        horario: faixa(o.hora, o.duracao),
        prof: o.prof,
        profId: prof?.id ?? null,
        sala: o.sala,
        ocupacao: `${o.ocupadas != null ? o.ocupadas : o.alunos.length}/${o.vagas}`,
      };
    }),
  };
}
