/**
 * Configurações › Pessoas e cargos, Regras de negócio, Alertas e Documentação › Mapa de telas.
 * Tudo grava no banco e na Auditoria (entidade Configuração); agenda e cadastros leem o que muda aqui.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { agOfertas } from '../domain/agenda.ts';
import { base, invalidaBase } from '../domain/base.ts';
import {
  ADM_PAINEL,
  ALERTA_CANAIS,
  ALERTA_GATILHOS,
  ALERTA_PARA,
  ALERTAS_PADRAO,
  type AlertasConfig,
  alertaConta,
  alertasPadrao,
  CAT,
  CAT_TIPO,
  type CatK,
  catUso,
  EXECUCOES,
  FORMATOS_CURSO,
  ferNacionais,
  normaliza,
  POLITICAS,
  polPadrao,
  type ValoresPol,
} from '../domain/configuracoes.ts';
import docInfo from '../domain/dados/doc-info.json' with { type: 'json' };
import { TELAS_MAPA } from '../domain/mapa.ts';
import { hrefProf, hrefTela } from '../domain/rotas.ts';
import { fmt } from '../lib/fmt.ts';
import { cfgLog, erro400, exigeCfg } from './config-acessos.ts';

const diaUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);
const deUTC = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lerConfig = async <T>(chave: string, padrao: () => T): Promise<T> => {
  const c = await prisma.configuracao.findUnique({ where: { chave } });
  return c ? ({ ...padrao(), ...(c.valor as object) } as T) : padrao();
};
const gravaConfig = (chave: string, valor: object, por: string) =>
  prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor: valor as never, por },
    update: { valor: valor as never, por },
  });

const Nome = z.string().trim().max(160).default('');
const ColabIn = z.object({
  nome: Nome,
  email: z.string().trim().toLowerCase().max(200).default(''),
  cargo: z.string().max(160).default(''),
  ativo: z.boolean().default(true),
});
const CatIn = z.object({
  nome: Nome,
  descricao: z.string().trim().max(400).default(''),
  departamento: z.string().max(160).default(''),
  formato: z.string().max(40).default('Grupo'),
  ativo: z.boolean().default(true),
});
const SalaIn = z.object({
  nome: Nome,
  tipo: z.string().max(160).default(''),
  atende: z.string().max(160).default(''),
  zoom: z.boolean().default(false),
  ativo: z.boolean().default(true),
});
const Just = z.string().trim().min(5, 'Escreva a justificativa (pelo menos 5 letras).').max(500);

export default async function rotasConfigRegras(app: FastifyInstance) {
  /* ================= Colaboradores ================= */
  app.get('/config/colaboradores', { preHandler: exigeCfg }, async () => {
    const [cs, cargos] = await Promise.all([
      prisma.colaborador.findMany({ orderBy: [{ ordem: 'asc' }, { id: 'asc' }] }),
      prisma.cargo.findMany({ orderBy: { ordem: 'asc' } }),
    ]);
    return {
      linhas: cs.map((c) => ({
        id: c.id,
        nome: c.nome,
        email: c.email,
        departamento: c.departamento,
        cargo: c.cargo,
        ativo: c.ativo,
      })),
      cargos: cargos.filter((c) => c.ativo).map((c) => ({ nome: c.nome, departamento: c.departamento })),
    };
  });
  const salvaColab = async (id: number | null, body: unknown, autor: Parameters<typeof cfgLog>[0]) => {
    const r = ColabIn.safeParse(body);
    if (!r.success) return { erro: r.error.issues[0].message };
    const v = r.data;
    if (!v.nome) return { erro: 'Preencha o nome completo.' };
    if (!z.string().email().safeParse(v.email).success) return { erro: 'Informe um e-mail válido.' };
    const outro = await prisma.colaborador.findUnique({ where: { email: v.email } });
    if (outro && outro.id !== id) return { erro: `${v.email} já é de ${outro.nome}.` };
    const cargo = v.cargo ? await prisma.cargo.findUnique({ where: { nome: v.cargo } }) : null;
    const data = {
      nome: v.nome,
      email: v.email,
      cargo: cargo?.nome ?? '—',
      departamento: cargo?.departamento ?? '—',
      ativo: v.ativo,
    };
    if (id) {
      if (!(await prisma.colaborador.findUnique({ where: { id } })))
        return { erro: 'Colaborador não encontrado.', cod: 404 };
      await prisma.colaborador.update({ where: { id }, data });
    } else {
      const ordem = ((await prisma.colaborador.aggregate({ _min: { ordem: true } }))._min.ordem ?? 0) - 1;
      await prisma.colaborador.create({ data: { ...data, ordem } });
    }
    await cfgLog(
      autor,
      'colaboradores',
      id ? 'Colaborador editado' : 'Colaborador criado',
      `${v.nome} · ${data.cargo}${v.ativo ? '' : ' · inativo'}`,
    );
    invalidaBase();
    return { msg: id ? `${v.nome} salvo.` : `${v.nome} cadastrado.` };
  };
  app.post('/config/colaboradores', { preHandler: exigeCfg }, async (req, rep) => {
    const r = await salvaColab(null, req.body, req.usuario!);
    return 'erro' in r ? rep.code(r.cod ?? 400).send({ erro: r.erro }) : r;
  });
  app.put('/config/colaboradores/:id', { preHandler: exigeCfg }, async (req, rep) => {
    const r = await salvaColab(Number((req.params as { id: string }).id), req.body, req.usuario!);
    return 'erro' in r ? rep.code(r.cod ?? 400).send({ erro: r.erro }) : r;
  });

  /* ================= Prestadores: todo professor é Prestador ================= */
  app.get('/config/prestadores', { preHandler: exigeCfg }, async () => {
    const b = await base();
    const ofs = agOfertas(b);
    return {
      linhas: b.professores.map((t) => ({
        id: t.id,
        nome: t.name,
        email: t.email || '—',
        cursos: t.cursos.map((c) => ({ nome: c, cor: b.corCurso[c] ?? '#1a4fd6' })),
        aulas: ofs.filter((o) => o.prof === t.name).reduce((s, o) => s + o.dias.length, 0),
        teto: t.teto || 24,
        ativo: t.active,
        href: hrefProf(t.id),
      })),
    };
  });

  /* ================= Departamentos, Cargos e os seis Catálogos ================= */
  const catK = (k: string): CatK | null => (k in CAT ? (k as CatK) : null);
  const itensCat = async (k: CatK) => {
    if (k === 'departamentos')
      return (await prisma.departamento.findMany({ orderBy: [{ ordem: 'asc' }, { id: 'asc' }] })).map((x) => ({
        id: x.id,
        nome: x.nome,
        descricao: x.descricao,
        departamento: '',
        formato: '',
        ativo: x.ativo,
      }));
    if (k === 'cargos')
      return (await prisma.cargo.findMany({ orderBy: [{ ordem: 'asc' }, { id: 'asc' }] })).map((x) => ({
        id: x.id,
        nome: x.nome,
        descricao: x.descricao,
        departamento: x.departamento,
        formato: '',
        ativo: x.ativo,
      }));
    return (
      await prisma.catalogo.findMany({ where: { tipo: CAT_TIPO[k] }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }] })
    ).map((x) => ({
      id: x.id,
      nome: x.nome,
      descricao: '',
      departamento: '',
      formato: String((x.dados as { format?: string } | null)?.format ?? ''),
      ativo: x.ativo,
    }));
  };
  const usoCtx = async () => ({
    b: await base(),
    colaboradores: await prisma.colaborador.findMany({ select: { departamento: true, cargo: true } }),
    cargos: await prisma.cargo.findMany({ select: { departamento: true } }),
  });

  app.get('/config/catalogo/:k', { preHandler: exigeCfg }, async (req, rep) => {
    const k = catK((req.params as { k: string }).k);
    if (!k) return rep.code(404).send({ erro: 'Catálogo não encontrado.' });
    const [itens, ctx, deps] = await Promise.all([
      itensCat(k),
      usoCtx(),
      prisma.departamento.findMany({ orderBy: { ordem: 'asc' } }),
    ]);
    return {
      ...CAT[k],
      k,
      linhas: itens.map((x) => ({
        ...x,
        uso: catUso(k, x.nome, ctx),
        pessoas: k === 'departamentos' ? ctx.colaboradores.filter((e) => e.departamento === x.nome).length : 0,
      })),
      departamentos: deps.map((d) => d.nome),
      formatos: FORMATOS_CURSO,
    };
  });

  app.post('/config/catalogo/:k', { preHandler: exigeCfg }, (req, rep) =>
    salvaCat(req.params, req.body, null, req.usuario!, rep),
  );
  app.put('/config/catalogo/:k/:id', { preHandler: exigeCfg }, (req, rep) =>
    salvaCat(req.params, req.body, Number((req.params as { id: string }).id), req.usuario!, rep),
  );
  async function salvaCat(
    params: unknown,
    body: unknown,
    id: number | null,
    u: Parameters<typeof cfgLog>[0],
    rep: import('fastify').FastifyReply,
  ) {
    const k = catK((params as { k: string }).k);
    if (!k) return rep.code(404).send({ erro: 'Catálogo não encontrado.' });
    const r = CatIn.safeParse(body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const c = CAT[k];
    if (!v.nome) return rep.code(400).send({ erro: 'Dê um nome.' });
    const itens = await itensCat(k);
    const x = id ? itens.find((i) => i.id === id) : null;
    if (id && !x) return rep.code(404).send({ erro: `${cap(c.um)} não encontrado.` });
    if (itens.some((i) => i.id !== id && normaliza(i.nome) === normaliza(v.nome)))
      return rep.code(400).send({ erro: `Já existe ${c.um} com esse nome.` });
    if (k === 'cargos' && !v.departamento) return rep.code(400).send({ erro: 'Escolha o departamento.' });
    const antes = x?.nome ?? '';
    if (k === 'departamentos') {
      const data = { nome: v.nome, descricao: v.descricao, ativo: v.ativo };
      if (x) await prisma.departamento.update({ where: { id: x.id }, data });
      else await prisma.departamento.create({ data: { ...data, ordem: itens.length } });
      if (x && antes !== v.nome) {
        await prisma.colaborador.updateMany({ where: { departamento: antes }, data: { departamento: v.nome } });
        await prisma.cargo.updateMany({ where: { departamento: antes }, data: { departamento: v.nome } });
      }
    } else if (k === 'cargos') {
      const data = { nome: v.nome, departamento: v.departamento, descricao: v.descricao, ativo: v.ativo };
      if (x) await prisma.cargo.update({ where: { id: x.id }, data });
      else await prisma.cargo.create({ data: { ...data, ordem: itens.length } });
      if (x && antes !== v.nome)
        await prisma.colaborador.updateMany({ where: { cargo: antes }, data: { cargo: v.nome } });
    } else {
      const dados =
        k === 'tiposcurso'
          ? { format: FORMATOS_CURSO.includes(v.formato) ? v.formato : 'Grupo', allowsModules: true }
          : undefined;
      if (x) {
        const atual = await prisma.catalogo.findUniqueOrThrow({ where: { id: x.id } });
        await prisma.catalogo.update({
          where: { id: x.id },
          data: {
            nome: v.nome,
            ativo: v.ativo,
            dados: dados ? { ...((atual.dados as object) ?? {}), format: dados.format } : undefined,
          },
        });
      } else
        await prisma.catalogo.create({
          data: { tipo: CAT_TIPO[k], nome: v.nome, ativo: v.ativo, dados, ordem: itens.length },
        });
      /* renomear leva junto quem usa */
      if (x && antes !== v.nome) {
        if (k === 'tiposala') await prisma.sala.updateMany({ where: { tipo: antes }, data: { tipo: v.nome } });
        if (k === 'idiomas') await prisma.curso.updateMany({ where: { idioma: antes }, data: { idioma: v.nome } });
      }
    }
    invalidaBase();
    await cfgLog(
      u,
      k,
      x ? (antes !== v.nome ? `${c.um} renomeado` : `${c.um} editado`) : `${c.um} criado`,
      `${antes && antes !== v.nome ? `${antes} → ` : ''}${v.nome}${v.ativo ? '' : ' · inativo'}`,
    );
    return { msg: x ? `${v.nome} salvo.` : `${v.nome} criado.` };
  }
  app.delete('/config/catalogo/:k/:id', { preHandler: exigeCfg }, async (req, rep) => {
    const { k: kk, id } = req.params as { k: string; id: string };
    const k = catK(kk);
    if (!k) return rep.code(404).send({ erro: 'Catálogo não encontrado.' });
    const x = (await itensCat(k)).find((i) => i.id === Number(id));
    if (!x) return rep.code(404).send({ erro: `${cap(CAT[k].um)} não encontrado.` });
    if (catUso(k, x.nome, await usoCtx()))
      return rep.code(400).send({ erro: 'Está em uso: inative em vez de excluir.' });
    if (k === 'departamentos') await prisma.departamento.delete({ where: { id: x.id } });
    else if (k === 'cargos') await prisma.cargo.delete({ where: { id: x.id } });
    else await prisma.catalogo.delete({ where: { id: x.id } });
    invalidaBase();
    await cfgLog(req.usuario!, k, `${CAT[k].um} excluído`, x.nome);
    return { msg: `${x.nome} excluído.` };
  });

  /* ================= Salas ================= */
  app.get('/config/salas', { preHandler: exigeCfg }, async () => {
    const [salas, tipos, cursos] = await Promise.all([
      prisma.sala.findMany({ orderBy: [{ ordem: 'asc' }, { id: 'asc' }] }),
      prisma.catalogo.findMany({ where: { tipo: { in: ['roomTypes', 'courseTypes'] } }, orderBy: { ordem: 'asc' } }),
      prisma.curso.findMany({ orderBy: { ordem: 'asc' }, select: { nome: true, cor: true } }),
    ]);
    const cor = new Map(cursos.map((c) => [c.nome, c.cor]));
    return {
      linhas: salas.map((s) => ({
        id: s.id,
        nome: s.nome,
        atende: s.atende,
        cor: cor.get(s.atende) ?? null,
        tipo: s.tipo,
        zoom: s.zoom,
        ativo: s.ativo,
      })),
      tipos: tipos.filter((t) => t.tipo === 'roomTypes' && t.ativo).map((t) => t.nome),
      alvos: [
        ...tipos.filter((t) => t.tipo === 'courseTypes').map((t) => ({ v: t.nome, l: `${t.nome} (pool do tipo)` })),
        ...cursos.map((c) => ({ v: c.nome, l: `${c.nome} (curso inteiro)` })),
      ],
    };
  });
  const salvaSala = async (id: number | null, body: unknown, u: Parameters<typeof cfgLog>[0]) => {
    const r = SalaIn.safeParse(body);
    if (!r.success) return { erro: r.error.issues[0].message };
    const v = r.data;
    if (!v.nome) return { erro: 'Dê um nome à sala.' };
    const outra = await prisma.sala.findUnique({ where: { nome: v.nome } });
    if (outra && outra.id !== id) return { erro: 'Já existe sala com esse nome.' };
    const data = { nome: v.nome, tipo: v.tipo || '—', atende: v.atende || '—', zoom: v.zoom, ativo: v.ativo };
    if (id) {
      const atual = await prisma.sala.findUnique({ where: { id } });
      if (!atual) return { erro: 'Sala não encontrada.', cod: 404 };
      await prisma.sala.update({ where: { id }, data });
    } else {
      const ordem = ((await prisma.sala.aggregate({ _min: { ordem: true } }))._min.ordem ?? 0) - 1;
      await prisma.sala.create({ data: { ...data, ordem } });
    }
    invalidaBase();
    await cfgLog(
      u,
      'salas',
      id ? 'Sala editada' : 'Sala criada',
      `${v.nome} · ${data.tipo} · ${data.atende}${v.ativo ? '' : ' · inativa'}`,
    );
    return { msg: id ? `${v.nome} salva.` : `${v.nome} criada.` };
  };
  app.post('/config/salas', { preHandler: exigeCfg }, async (req, rep) => {
    const r = await salvaSala(null, req.body, req.usuario!);
    return 'erro' in r ? rep.code(r.cod ?? 400).send({ erro: r.erro }) : r;
  });
  app.put('/config/salas/:id', { preHandler: exigeCfg }, async (req, rep) => {
    const r = await salvaSala(Number((req.params as { id: string }).id), req.body, req.usuario!);
    return 'erro' in r ? rep.code(r.cod ?? 400).send({ erro: r.erro }) : r;
  });

  /* ================= Feriados e recessos ================= */
  app.get('/config/feriados', { preHandler: exigeCfg }, async (req) => {
    const hoje = new Date().getFullYear();
    const fs = (await prisma.feriado.findMany({ orderBy: { data: 'asc' } })).map((f) => ({ ...f, dia: deUTC(f.data) }));
    const anos = [...new Set([...fs.map((f) => f.dia.getFullYear()), hoje - 1, hoje, hoje + 1])].sort();
    const q = Number((req.query as { ano?: string }).ano);
    const ano = anos.includes(q) ? q : hoje;
    const doAno = fs.filter((f) => f.dia.getFullYear() === ano);
    return {
      ano,
      anos: anos.map(String),
      nacionais: doAno.some((f) => f.origem === 'Nacional'),
      linhas: doAno.map((f) => ({
        id: f.id,
        data: fmt.data(f.dia),
        dia: cap(f.dia.toLocaleDateString('pt-BR', { weekday: 'long' })),
        nome: f.nome,
        origem: f.origem,
      })),
    };
  });
  const addFeriado = async (d: Date, nome: string, origem: string) => {
    const data = diaUTC(isoLocal(d));
    if (await prisma.feriado.findUnique({ where: { data } })) return false;
    await prisma.feriado.create({ data: { data, nome, origem } });
    return true;
  };
  app.post('/config/feriados/importar', { preHandler: exigeCfg }, async (req, rep) => {
    const r = z.object({ ano: z.number().int().min(2000).max(2100) }).safeParse(req.body);
    if (!r.success) return rep.code(400).send({ erro: 'Escolha o ano.' });
    let n = 0;
    for (const [d, nome] of ferNacionais(r.data.ano)) if (await addFeriado(d, nome, 'Nacional')) n++;
    invalidaBase();
    await cfgLog(req.usuario!, 'feriados', 'Feriados nacionais importados', `${r.data.ano} · ${n} novos`);
    return {
      msg: n
        ? `${n} feriados nacionais de ${r.data.ano} importados. A agenda não gera aula nesses dias.`
        : `Os feriados nacionais de ${r.data.ano} já estavam na lista.`,
    };
  });
  app.post('/config/feriados/recesso', { preHandler: exigeCfg }, async (req, rep) => {
    const r = z
      .object({
        nome: z.string().trim().max(160).default(''),
        ini: z.string().default(''),
        fim: z.string().default(''),
      })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    if (!v.nome) return rep.code(400).send({ erro: 'Dê um nome ao recesso.' });
    const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (!ok(v.ini) || !ok(v.fim)) return rep.code(400).send({ erro: 'Preencha o primeiro e o último dia.' });
    const ini = new Date(`${v.ini}T12:00:00`);
    const fim = new Date(`${v.fim}T12:00:00`);
    if (Number.isNaN(+ini) || Number.isNaN(+fim))
      return rep.code(400).send({ erro: 'Preencha o primeiro e o último dia.' });
    if (fim < ini) return rep.code(400).send({ erro: 'O último dia precisa ser depois do primeiro.' });
    if ((+fim - +ini) / 864e5 > 60) return rep.code(400).send({ erro: 'Um recesso vai até 60 dias.' });
    let n = 0;
    for (const d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) if (await addFeriado(d, v.nome, 'Recesso')) n++;
    invalidaBase();
    await cfgLog(req.usuario!, 'feriados', 'Recesso criado', `${v.nome} · ${fmt.data(ini)} a ${fmt.data(fim)}`);
    return { msg: `${v.nome}: ${n} ${n === 1 ? 'dia' : 'dias'} sem aula.`, ano: ini.getFullYear() };
  });
  app.delete('/config/feriados/:id', { preHandler: exigeCfg }, async (req, rep) => {
    const f = await prisma.feriado.findUnique({ where: { id: Number((req.params as { id: string }).id) } });
    if (!f) return rep.code(404).send({ erro: 'Feriado não encontrado.' });
    await prisma.feriado.delete({ where: { id: f.id } });
    invalidaBase();
    const data = fmt.data(deUTC(f.data));
    await cfgLog(req.usuario!, 'feriados', 'Feriado removido', `${data} · ${f.nome}`);
    return { msg: `${f.nome} (${data}) removido: a agenda volta a gerar aula nesse dia.` };
  });

  /* ================= Dias e horários ================= */
  app.get('/config/dias', { preHandler: exigeCfg }, async () => ({
    linhas: await prisma.funcionamento.findMany({ orderBy: { dia: 'asc' } }),
  }));
  app.put('/config/dias', { preHandler: exigeCfg }, async (req, rep) => {
    const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora em HH:MM, de 00:00 a 23:59.');
    const r = z
      .object({
        linhas: z
          .array(z.object({ dia: z.number().int().min(0).max(6), aberto: z.boolean(), inicio: hora, fim: hora }))
          .length(7),
        just: z.string().default(''),
      })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const atual = await prisma.funcionamento.findMany();
    let muda = 0;
    for (const l of r.data.linhas) {
      const a = atual.find((x) => x.dia === l.dia);
      if (!a) return rep.code(400).send({ erro: 'Dia inválido.' });
      if (l.aberto && l.inicio >= l.fim)
        return rep.code(400).send({ erro: `${a.nome}: o fim precisa ser depois do início.` });
      muda += Number(a.aberto !== l.aberto) + Number(a.inicio !== l.inicio) + Number(a.fim !== l.fim);
    }
    if (!muda) return { msg: 'Nada mudou desde o último salvamento.', muda };
    const j = Just.safeParse(r.data.just);
    if (!j.success) return erro400(rep, j.error);
    for (const l of r.data.linhas)
      await prisma.funcionamento.update({
        where: { dia: l.dia },
        data: { aberto: l.aberto, inicio: l.inicio, fim: l.fim },
      });
    await cfgLog(req.usuario!, 'dias', 'Alterações salvas', `${muda} campos · ${j.data}`);
    return { msg: `Salvo: ${muda} ${muda === 1 ? 'campo' : 'campos'} · justificativa na Auditoria.`, muda };
  });

  /* ================= Condições e vigência ================= */
  app.get('/config/politicas', { preHandler: exigeCfg }, async () => ({
    secoes: POLITICAS,
    valores: await lerConfig<ValoresPol>('politicas', polPadrao),
  }));
  app.put('/config/politicas', { preHandler: exigeCfg }, async (req, rep) => {
    const r = z
      .object({
        valores: z.record(z.string(), z.union([z.string().max(200), z.boolean()])),
        just: z.string().default(''),
      })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const atual = await lerConfig<ValoresPol>('politicas', polPadrao);
    const novo: ValoresPol = { ...atual };
    let muda = 0;
    for (const s of POLITICAS)
      for (const c of s.campos) {
        if (!(c.k in r.data.valores)) continue;
        let v = r.data.valores[c.k];
        if (c.tipo === 'chave') v = !!v;
        else {
          v = String(v).trim();
          if (c.tipo === 'radio' && !c.ops.includes(v))
            return rep.code(400).send({ erro: `${c.t}: escolha uma opção.` });
          if (c.tipo === 'texto' && c.req && !v) return rep.code(400).send({ erro: `Preencha: ${c.t}.` });
        }
        if (v !== atual[c.k]) muda++;
        novo[c.k] = v;
      }
    if (!muda) return { msg: 'Nada mudou desde o último salvamento.', muda };
    const j = Just.safeParse(r.data.just);
    if (!j.success) return erro400(rep, j.error);
    await gravaConfig('politicas', novo, req.usuario!.nome);
    await cfgLog(req.usuario!, 'politicas', 'Alterações salvas', `${muda} campos · ${j.data}`);
    return { msg: `Salvo: ${muda} ${muda === 1 ? 'campo' : 'campos'} · justificativa na Auditoria.`, muda };
  });

  /* ================= Alertas automáticos ================= */
  const lerAlertas = () => lerConfig<AlertasConfig>('alertas', alertasPadrao);
  const gatilho = (tipo: string) => ALERTA_GATILHOS.find((g) => g[0] === tipo);
  app.get('/config/alertas', { preHandler: exigeCfg }, async () => {
    const a = await lerAlertas();
    return {
      padrao: ALERTAS_PADRAO.map(([k, icone, t, d]) => ({ k, icone, t, d, on: a.on[k] !== false })),
      pers: a.pers.map((p) => ({
        id: p.id,
        nome: p.nome,
        desc: `${gatilho(p.tipo)?.[1] ?? ''} ${p.n} ${gatilho(p.tipo)?.[2] ?? ''} · para ${p.para.join(', ') || 'ninguém'} · por ${p.canal}`,
        on: p.on,
      })),
      gatilhos: ALERTA_GATILHOS.map(([v, l, u]) => ({ v, l: `${l} … ${u}` })),
      para: ALERTA_PARA,
      canais: ALERTA_CANAIS,
    };
  });
  app.put('/config/alertas/padrao/:k', { preHandler: exigeCfg }, async (req, rep) => {
    const { k } = req.params as { k: string };
    const p = ALERTAS_PADRAO.find((x) => x[0] === k);
    if (!p) return rep.code(404).send({ erro: 'Alerta não encontrado.' });
    const a = await lerAlertas();
    a.on[k] = a.on[k] === false;
    await gravaConfig('alertas', a, req.usuario!.nome);
    await cfgLog(req.usuario!, 'alertas', a.on[k] ? 'Alerta ligado' : 'Alerta desligado', p[2]);
    return { msg: `${p[2]}: ${a.on[k] ? 'ligado' : 'desligado'}.` };
  });
  app.post('/config/alertas', { preHandler: exigeCfg }, async (req, rep) => {
    const r = z
      .object({
        nome: z.string().trim().max(160).default(''),
        tipo: z.string().default(''),
        n: z.union([z.number(), z.string()]).default(''),
        para: z.array(z.string()).default([]),
        canal: z.string().default('E-mail'),
      })
      .safeParse(req.body);
    if (!r.success) return erro400(rep, r.error);
    const v = r.data;
    const n = Number.parseInt(String(v.n), 10);
    if (!v.nome) return rep.code(400).send({ erro: 'Dê um nome ao alerta.' });
    if (!gatilho(v.tipo)) return rep.code(400).send({ erro: 'Escolha quando avisar.' });
    if (!(n >= 0)) return rep.code(400).send({ erro: 'O limite precisa ser um número.' });
    const para = v.para.filter((x) => ALERTA_PARA.includes(x));
    if (!para.length) return rep.code(400).send({ erro: 'Escolha quem recebe.' });
    const a = await lerAlertas();
    a.pers.push({
      id: `al${Date.now().toString(36)}`,
      nome: v.nome,
      tipo: v.tipo,
      n,
      para,
      canal: ALERTA_CANAIS.includes(v.canal) ? v.canal : 'E-mail',
      on: true,
    });
    await gravaConfig('alertas', a, req.usuario!.nome);
    await cfgLog(req.usuario!, 'alertas', 'Alerta criado', v.nome);
    const c = alertaConta(await base(), v.tipo, n);
    return { msg: `${v.nome} criado e ligado: hoje ele geraria ${c} ${c === 1 ? 'aviso' : 'avisos'}.` };
  });
  app.put('/config/alertas/pers/:id', { preHandler: exigeCfg }, async (req, rep) => {
    const a = await lerAlertas();
    const p = a.pers.find((x) => x.id === (req.params as { id: string }).id);
    if (!p) return rep.code(404).send({ erro: 'Alerta não encontrado.' });
    p.on = !p.on;
    await gravaConfig('alertas', a, req.usuario!.nome);
    await cfgLog(req.usuario!, 'alertas', p.on ? 'Alerta ligado' : 'Alerta desligado', p.nome);
    return { msg: `${p.nome}: ${p.on ? 'ligado' : 'desligado'}.` };
  });
  app.delete('/config/alertas/pers/:id', { preHandler: exigeCfg }, async (req, rep) => {
    const a = await lerAlertas();
    const i = a.pers.findIndex((x) => x.id === (req.params as { id: string }).id);
    if (i < 0) return rep.code(404).send({ erro: 'Alerta não encontrado.' });
    const [p] = a.pers.splice(i, 1);
    await gravaConfig('alertas', a, req.usuario!.nome);
    await cfgLog(req.usuario!, 'alertas', 'Alerta excluído', p.nome);
    return { msg: `${p.nome} excluído.` };
  });
  app.post('/config/alertas/executar', { preHandler: exigeCfg }, async (req) => {
    const a = await lerAlertas();
    const b = await base();
    const res: [string, number][] = [];
    if (a.on.ocioso !== false) res.push(['Ociosidade', alertaConta(b, 'ocioso')]);
    if (a.on.contrato !== false) res.push(['Fim de contrato', alertaConta(b, 'contrato', 30)]);
    if (a.on.saldo !== false) res.push(['Saldo baixo', alertaConta(b, 'saldo', 10)]);
    if (a.on.semProf !== false) res.push(['Aula sem professor', alertaConta(b, 'semProf', 7)]);
    for (const p of a.pers.filter((x) => x.on)) res.push([p.nome, alertaConta(b, p.tipo, p.n)]);
    const tot = res.reduce((s, x) => s + x[1], 0);
    const det = res.map(([t, n]) => `${t}: ${n}`).join(' · ') || 'nenhum alerta ligado';
    await cfgLog(req.usuario!, 'alertas', 'Rotinas executadas', det);
    return { msg: `Rotinas executadas: ${tot} ${tot === 1 ? 'aviso' : 'avisos'} — ${det}.` };
  });

  /* ================= Painel administrativo e Execuções do Relógio ================= */
  app.get('/config/painel', { preHandler: exigeCfg }, async () => ADM_PAINEL);
  app.get('/config/execucoes', { preHandler: exigeCfg }, async () => ({
    linhas: EXECUCOES.map(([quando, ator, verbo, alvo, resultado, tom, critica], i) => ({
      i,
      quando,
      ator,
      verbo,
      alvo,
      resultado,
      tom,
      critica,
      payload: {
        quando,
        ator,
        verbo,
        alvo_id: Number(alvo) || alvo,
        resultado,
        critica: critica || null,
        origem: ator === 'sistema' ? 'rotina' : 'portal',
        versao_regras: '2026.09',
      },
    })),
  }));

  /* ================= Currículos e acervos ================= */
  app.get('/config/curriculos', { preHandler: exigeCfg }, async () => {
    const [cs, cursos] = await Promise.all([
      prisma.curriculo.findMany({ orderBy: { ordem: 'asc' } }),
      prisma.curso.findMany({ select: { nome: true, cor: true } }),
    ]);
    const cor = new Map(cursos.map((c) => [c.nome, c.cor]));
    return {
      linhas: cs.map((c) => {
        const vs = c.versoes as [string, string, string][];
        const ult = vs[vs.length - 1];
        const pub = vs.filter((v) => v[1] === 'Publicada').pop();
        const cont = c.conteudos as { links: { in: string } }[];
        return {
          id: c.id,
          nome: c.nome,
          grupo: c.grupo,
          tipo: c.tipo,
          cor: cor.get(c.grupo) ?? null,
          aplicado: c.aplicado.join(', '),
          publicada: pub?.[0] ?? null,
          rascunho: ult?.[1] === 'Rascunho' ? ult[0] : null,
          conteudos: cont.length,
          semLink: cont.filter((x) => !x.links.in).length,
          publicadaEm: pub?.[2] ?? null,
        };
      }),
    };
  });

  /* ================= Documentação › Mapa de telas ================= */
  type Info = {
    tipo?: string;
    mostra?: string;
    acoes?: string[];
    det?: [string, string, string][];
    vai?: string[];
    sub?: string[];
  };
  const INFO = docInfo as unknown as Record<string, Info>;
  const DOC_TIPO: Record<string, string> = {
    painel: 'painel',
    lista: 'lista',
    form: 'formulário',
    calendario: 'calendário',
    kanban: 'kanban',
    cartoes: 'cartões',
    ficha: 'ficha',
    matriz: 'matriz',
    split: 'lista + detalhe',
  };
  const FICHA_LISTA: Record<string, string> = {
    curso: '/cursos',
    alunoFicha: '/alunos',
    professorFicha: '/professores',
  };
  const PRONTOS = new Set([
    'inicio',
    'agenda',
    'cursos',
    'alunos',
    'empresas',
    'professores',
    'acoes',
    'auditoria',
    'relatorios',
    'config',
  ]);
  const docTitulo = (t: string) => {
    const n = TELAS_MAPA.find((x) => x.tela === t);
    if (n) return n.label;
    for (const i of Object.values(INFO)) {
      const d = (i.det ?? []).find((x) => x[0] === t);
      if (d) return d[1];
    }
    return t;
  };
  app.get('/config/telas', { preHandler: exigeCfg }, async () => {
    const nos = [
      {
        id: 'inicio',
        tela: 'dashboard',
        label: 'Dashboard',
        menu: 'inicio',
        menuLabel: 'Tela inicial',
        etapa: 'Dashboard',
        pai: null as string | null,
        aba: undefined as string | undefined,
      },
      ...TELAS_MAPA,
    ];
    const linhas = nos.map((n) => {
      const inf = INFO[n.aba ? `${n.tela}.${n.aba}` : n.tela] ?? {};
      return {
        id: n.id,
        label: n.label,
        area: n.menuLabel,
        caminho: [n.etapa !== n.label ? n.etapa : null, n.pai].filter(Boolean).join(' › '),
        sit: PRONTOS.has(n.menu) ? 'ok' : 'con',
        tipo: DOC_TIPO[inf.tipo ?? ''] ?? 'lista',
        mostra: inf.mostra ?? '',
        acoes: inf.acoes ?? [],
        det: (inf.det ?? []).map((d) => ({ t: d[1], d: d[2] })),
        vai: (inf.vai ?? []).map(docTitulo),
        sub: inf.sub ?? [],
        href: n.id === 'inicio' ? '/inicio' : (FICHA_LISTA[n.tela] ?? hrefTela(n.tela)),
      };
    });
    return { linhas, areas: [...new Set(linhas.map((l) => l.area))] };
  });
}
