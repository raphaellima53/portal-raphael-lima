/**
 * Os feedbacks de exemplo de cada aluno nascem na primeira leitura (fbAluno do portal) e ficam no banco.
 */
import { z } from 'zod';
import { prisma } from '../db.ts';
import { comExemplos } from '../lib/exemplos.ts';
import { registra } from '../lib/log.ts';
import { agOfertas, type Oferta } from './agenda.ts';
import { FB_AREAS, FB_MAX, FB_TIPOS, fbGera } from './alunos.ts';
import type { AlunoB, Base } from './base.ts';

export async function garantirFeedbacks(b: Base, alunos: AlunoB[], ofs: Oferta[] = agOfertas(b)) {
  if (!(await comExemplos())) return;
  const ids = alunos.map((a) => a.id);
  const falta = await prisma.aluno.findMany({ where: { id: { in: ids }, fbGerado: false }, select: { id: true } });
  if (!falta.length) return;
  /* cada aluno é reservado antes de gerar: duas leituras ao mesmo tempo não geram em dobro */
  const reservados: number[] = [];
  for (const { id } of falta) {
    const r = await prisma.aluno.updateMany({ where: { id, fbGerado: false }, data: { fbGerado: true } });
    if (r.count) reservados.push(id);
  }
  if (!reservados.length) return;
  const por = new Set(reservados);
  const dados = alunos
    .filter((a) => por.has(a.id))
    .flatMap((a) => fbGera(a, ofs).map((f) => ({ ...f, alunoId: a.id, por: 'CX · atendimento' })));
  if (dados.length) await prisma.feedbackAluno.createMany({ data: dados });
}

export const AnexoIn = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().max(120).default('application/octet-stream'),
  base64: z.string(),
});
const ANEXO_TIPOS =
  /^(image\/|application\/pdf$|application\/msword$|application\/vnd\.openxmlformats|application\/vnd\.ms-excel$|text\/csv$|text\/plain$)/;
export function lerAnexos(lista: z.infer<typeof AnexoIn>[]) {
  const out: { nome: string; tipo: string; tam: number; dados: Uint8Array<ArrayBuffer> }[] = [];
  for (const x of lista) {
    const dados = new Uint8Array(Buffer.from(x.base64, 'base64'));
    if (dados.length > FB_MAX) return { erro: `${x.nome} passa de 10 MB.` };
    if (!ANEXO_TIPOS.test(x.tipo)) return { erro: `${x.nome}: envie imagem, PDF, Word, Excel, CSV ou texto.` };
    out.push({ nome: x.nome, tipo: x.tipo, tam: dados.length, dados });
  }
  return { anexos: out };
}

export const FeedbackIn = z.object({
  tipo: z.enum(FB_TIPOS.map((x) => x[0]) as [string, ...string[]], { message: 'Escolha o tipo.' }),
  area: z.enum(FB_AREAS as [string, ...string[]], { message: 'Escolha a área responsável.' }),
  curso: z.string().max(120).default(''),
  canal: z.string().max(80).default(''),
  texto: z.string().trim().min(1, 'Escreva o relato.').max(4000),
  anexos: z.array(AnexoIn).max(5, 'Envie até 5 arquivos por vez.').default([]),
});

const logaAluno = (autor: string, a: AlunoB, acao: string, detalhe: string) =>
  registra({ tipo: 'aluno', id: String(a.id), nome: a.name, acao, detalhe, autor });

/** Novo feedback ou ocorrência de qualidade, com anexos (Alunos › Feedbacks e Ações › Atendimentos) */
export async function criaFeedback(b: Base, a: AlunoB, autor: string, v: z.infer<typeof FeedbackIn>) {
  await garantirFeedbacks(b, [a]);
  const r = lerAnexos(v.anexos);
  if ('erro' in r) return { erro: r.erro! };
  await prisma.feedbackAluno.create({
    data: {
      alunoId: a.id,
      quando: new Date(),
      tipo: v.tipo,
      area: v.area,
      curso: v.curso || '—',
      canal: v.canal || '—',
      texto: v.texto,
      status: 'Aberto',
      por: autor,
      anexos: { create: r.anexos },
    },
  });
  const n = r.anexos!.length;
  const qual = v.tipo === 'Qualidade';
  await logaAluno(
    autor,
    a,
    qual ? 'Ocorrência de qualidade registrada' : 'Feedback registrado',
    `${v.tipo} · ${v.area}${n ? ` · ${n} ${n === 1 ? 'anexo' : 'anexos'}` : ''}`,
  );
  return {
    msg: `${qual ? 'Ocorrência de qualidade' : v.tipo} registrada para ${a.name}${n ? ` com ${n} ${n === 1 ? 'anexo' : 'anexos'}` : ''}. Fica aberta até alguém iniciar a tratativa.`,
  };
}

/** Iniciar tratativa ou Concluir */
export async function avancaFeedback(
  a: AlunoB,
  f: { id: number; status: string; tipo: string; area: string },
  autor: string,
) {
  if (f.status === 'Concluído') return { erro: 'Este registro já está concluído.' };
  const status = f.status === 'Aberto' ? 'Em tratativa' : 'Concluído';
  await prisma.feedbackAluno.update({ where: { id: f.id }, data: { status } });
  const q = f.tipo === 'Qualidade';
  await logaAluno(
    autor,
    a,
    status === 'Concluído'
      ? q
        ? 'Ocorrência concluída'
        : 'Feedback concluído'
      : q
        ? 'Ocorrência em tratativa'
        : 'Feedback em tratativa',
    `${f.tipo} · ${f.area}`,
  );
  return { msg: `${f.tipo} de ${f.area.toLowerCase()} agora está ${status.toLowerCase()}.` };
}
