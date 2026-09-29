/**
 * Community Flow: créditos de aula particular (1 a cada 5 presenças nos níveis) e o agendamento pelo próprio aluno
 * nos horários livres da grade do módulo. A equipe com acesso à alocação vê e agenda pelo aluno (alunoId).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { podeAcao } from '../domain/acesso.ts';
import { agAulasEntre, agOfertas, crsRegras, MOD_FLOW } from '../domain/agenda.ts';
import { type AlunoB, base, invalidaBase } from '../domain/base.ts';
import { FLOW_A_CADA, FLOW_JANELA, flowDiaTxt, flowHorarios, flowResumo } from '../domain/flow.ts';
import { podeChave } from '../domain/mapa.ts';
import { fmt } from '../lib/fmt.ts';
import { registra } from '../lib/log.ts';

/** o aluno da consulta: o próprio (aluno ou colaborador que também estuda) ou, para a equipe, o `alunoId` */
async function alunoDa(req: FastifyRequest, rep: FastifyReply, alunoId: number | undefined, escreve: boolean) {
  const u = req.usuario;
  if (!u) {
    rep.code(401).send({ erro: 'Sessão expirada. Entre de novo.' });
    return null;
  }
  const b = await base();
  const proprio = alunoId == null || alunoId === u.alunoId;
  if (!proprio && (u.ehAluno || !podeChave(u, 'aluno.alocacao') || (escreve && !podeAcao(u.nivel, 'criar')))) {
    rep.code(403).send({ erro: 'Sem acesso ao Community Flow deste aluno.' });
    return null;
  }
  const id = proprio ? u.alunoId : alunoId;
  const a = id != null ? b.alunos.find((x) => x.id === id) : undefined;
  if (!a) {
    rep.code(404).send({ erro: 'Aluno não encontrado.' });
    return null;
  }
  return { b, a, u, proprio };
}

const resumoJson = (r: NonNullable<ReturnType<typeof flowResumo>>) => ({
  curso: r.curso.name,
  modulo: MOD_FLOW,
  aCada: FLOW_A_CADA,
  desde: r.desdeTxt,
  presencas: r.presencas,
  ganhos: r.ganhos,
  usados: r.usados,
  saldo: r.saldo,
  faltam: r.faltam,
  agendadas: r.agendadas,
  regras: r.regras,
});
export type FlowResumoJson = ReturnType<typeof resumoJson>;
export const flowJson = (b: Awaited<ReturnType<typeof base>>, a: AlunoB, ofs = agOfertas(b)) => {
  const r = flowResumo(b, a, ofs);
  return r ? resumoJson(r) : null;
};

export default async function rotasFlow(app: FastifyInstance) {
  app.get('/flow', async (req, rep) => {
    const q = z.object({ alunoId: z.coerce.number().int().optional() }).safeParse(req.query);
    if (!q.success) return rep.code(400).send({ erro: 'Aluno inválido.' });
    const x = await alunoDa(req, rep, q.data.alunoId, false);
    if (!x) return;
    const ofs = agOfertas(x.b);
    const r = flowResumo(x.b, x.a, ofs);
    if (!r) return { adesao: false as const };
    /* os dias com horário com vaga, agrupados; quem já agendou não aparece, só as vagas que sobram */
    const dias: { data: string; txt: string; horas: { hora: string; prof: string; vagas: number; total: number }[] }[] =
      [];
    for (const h of flowHorarios(x.b, r.curso, x.a, ofs)) {
      let d = dias.find((y) => y.data === h.data);
      if (!d) {
        d = { data: h.data, txt: flowDiaTxt(h.data), horas: [] };
        dias.push(d);
      }
      d.horas.push({ hora: h.hora, prof: h.prof, vagas: h.vagas, total: h.total });
    }
    return { adesao: true as const, ...resumoJson(r), janela: FLOW_JANELA, duracao: crsRegras(r.curso).duracao, dias };
  });

  app.post('/flow/agendar', async (req, rep) => {
    const f = z
      .object({
        alunoId: z.number().int().optional(),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha o dia.'),
        hora: z.string().regex(/^\d{2}:\d{2}$/, 'Escolha o horário.'),
      })
      .safeParse(req.body);
    if (!f.success) return rep.code(400).send({ erro: f.error.issues[0].message });
    const x = await alunoDa(req, rep, f.data.alunoId, true);
    if (!x) return;
    const { b, a, u } = x;
    const ofs = agOfertas(b);
    const r = flowResumo(b, a, ofs);
    if (!r) return rep.code(400).send({ erro: `${a.name} não tem matrícula no ${MOD_FLOW}.` });
    if (r.saldo < 1)
      return rep.code(400).send({
        erro: `Sem crédito do ${MOD_FLOW}: faltam ${r.faltam} ${r.faltam === 1 ? 'presença' : 'presenças'} nas aulas dos níveis para o próximo.`,
      });
    const h = flowHorarios(b, r.curso, a, ofs).find((y) => y.data === f.data.data && y.hora === f.data.hora);
    if (!h) return rep.code(409).send({ erro: 'Esse horário não tem mais vaga. Escolha outro.' });
    const prof = b.professores.find((t) => t.name === h.prof)!;
    const inicio = new Date(`${h.data}T${h.hora}:00`);
    const fim = new Date(+inicio + crsRegras(r.curso).duracao * 6e4);
    let id = h.avulsa;
    if (id) {
      /* horário já marcado por outro aluno: entra na mesma aula, se ainda houver vaga no banco */
      const v = await prisma.aulaAvulsa.findUnique({ where: { id } });
      const antes = b.avulsas.find((y) => y.id === id)?.alunos.length;
      if (!v || v.alunos.includes(a.name) || v.alunos.length !== antes || h.vagas < 1)
        return rep.code(409).send({ erro: 'Esse horário não tem mais vaga. Escolha outro.' });
      await prisma.aulaAvulsa.update({ where: { id }, data: { alunos: [...v.alunos, a.name] } });
    } else {
      /* confere de novo o professor no instante da gravação (outra pessoa pode ter agendado) */
      const choque = agAulasEntre(b, inicio, inicio, new Date(), ofs).some(
        (y) =>
          y.prof === prof.name && y.estado !== 'cancelada' && y.quando < fim && +y.quando + y.duracao * 6e4 > +inicio,
      );
      if (choque) return rep.code(409).send({ erro: 'Esse horário não tem mais vaga. Escolha outro.' });
      id = `av-${crypto.randomUUID().slice(0, 12)}`;
      await prisma.aulaAvulsa.create({
        data: {
          id,
          cursoId: r.curso.id,
          modulo: MOD_FLOW,
          topico: 'Aula particular Community Flow',
          professorId: prof.id,
          inicio,
          fim,
          local: '',
          descricao: `Crédito do ${MOD_FLOW} (1 a cada ${FLOW_A_CADA} presenças)`,
          alunos: [a.name],
          criadoPor: u.nome,
        },
      });
    }
    invalidaBase();
    const hora = inicio.getHours() + inicio.getMinutes() / 60;
    const k = [r.curso.name, MOD_FLOW, `Aula avulsa ${id}`, h.data, hora].join('|');
    await registra({
      tipo: 'aula',
      id: k,
      acao: 'Aula Community Flow agendada',
      detalhe: `${a.name} · crédito ${r.usados + 1} de ${r.ganhos}`,
      nome: `${r.curso.name} · ${MOD_FLOW} · ${fmt.data(inicio)} ${h.hora}`,
      autor: u.nome,
    });
    return {
      msg: `Aula Community Flow agendada: ${fmt.semana(inicio)} às ${h.hora} com ${prof.name}.`,
      k,
      data: h.data,
    };
  });
}
