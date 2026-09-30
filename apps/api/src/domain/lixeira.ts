/**
 * Lixeira (24/09/2026): o Admin exclui qualquer registro. Antes de apagar, guarda a cópia do registro e de tudo que
 * depende dele (filhos por chave estrangeira, na ordem de inserção) e os vínculos que o banco solta (SetNull), para
 * restaurar com os mesmos códigos. Referências por nome (ex.: Matricula.modulo, Professor.cursos) ficam como estão:
 * voltam a bater quando o registro é restaurado.
 */
import { prisma } from '../db.ts';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
/** um nível da árvore: o modelo, o campo que aponta para o pai e o que vai junto */
type No = {
  modelo: string;
  fk?: string;
  filhos?: No[];
  /** campos de outros modelos que apontam para este e que o banco zera (SetNull): voltam na restauração */
  religa?: { modelo: string; fk: string }[];
  /** apaga junto mas não guarda (ex.: sessões de login) */
  semCopia?: boolean;
  /** filtro a mais nas linhas deste nível (ex.: só o login de persona do aluno) */
  onde?: Record<string, unknown>;
};
export type TipoLixeira = {
  rotulo: string;
  raiz: No;
  /** chave primária da raiz (padrão id) */
  pk?: string;
  idTexto?: boolean;
};

/* árvores reaproveitadas */
const MATRICULA: No = {
  modelo: 'matricula',
  fk: 'alunoId',
  filhos: [
    { modelo: 'nivelamento', fk: 'matriculaId' },
    { modelo: 'relatorioMatricula', fk: 'matriculaId' },
  ],
};
const matriculasDoCurso: No = { ...MATRICULA, fk: 'cursoId' };
const MODULO_FILHOS: No[] = [{ modelo: 'moduloHorario', fk: 'moduloId' }];
const EXTRATO: No = {
  modelo: 'extratoProfessor',
  fk: 'professorId',
  filhos: [{ modelo: 'lancamentoExtrato', fk: 'extratoId' }],
};

const USUARIO_FILHOS: No[] = [
  { modelo: 'usuarioEmail', fk: 'usuarioId' },
  { modelo: 'usuarioTelefone', fk: 'usuarioId' },
  { modelo: 'usuarioEndereco', fk: 'usuarioId' },
  { modelo: 'notificacao', fk: 'usuarioId' },
  { modelo: 'dashboardConfig', fk: 'usuarioId' },
  { modelo: 'preferencia', fk: 'usuarioId' },
  { modelo: 'sessao', fk: 'usuarioId', semCopia: true },
];

export const TIPOS: Record<string, TipoLixeira> = {
  usuario: {
    rotulo: 'Usuário',
    raiz: { modelo: 'usuario', filhos: USUARIO_FILHOS },
  },
  aluno: {
    rotulo: 'Aluno',
    raiz: {
      modelo: 'aluno',
      religa: [{ modelo: 'usuario', fk: 'alunoId' }],
      filhos: [
        MATRICULA,
        { modelo: 'feedbackAluno', fk: 'alunoId', filhos: [{ modelo: 'anexo', fk: 'feedbackId' }] },
        { modelo: 'dataBloqueada', fk: 'alunoId' },
        { modelo: 'feedbackAula', fk: 'alunoId' },
        { modelo: 'bolsa', fk: 'alunoId' },
        /* 30/09/2026: aluno de persona de teste leva o login junto (volta junto na restauração) */
        { modelo: 'usuario', fk: 'alunoId', onde: { personaLetra: { not: null } }, filhos: USUARIO_FILHOS },
      ],
    },
  },
  professor: {
    rotulo: 'Professor',
    idTexto: true,
    raiz: {
      modelo: 'professor',
      religa: [{ modelo: 'turma', fk: 'professorId' }],
      filhos: [
        { modelo: 'ausenciaProfessor', fk: 'professorId' },
        { modelo: 'pedidoCancelamentoAlocacao', fk: 'professorId' },
        { modelo: 'sessaoPedagogica', fk: 'professorId' },
        EXTRATO,
        { modelo: 'avaliacaoProfessor', fk: 'professorId' },
      ],
    },
  },
  colaborador: { rotulo: 'Colaborador', raiz: { modelo: 'colaborador' } },
  empresa: {
    rotulo: 'Empresa',
    idTexto: true,
    raiz: {
      modelo: 'empresa',
      religa: [
        { modelo: 'aluno', fk: 'empresaId' },
        { modelo: 'turma', fk: 'empresaId' },
      ],
    },
  },
  curso: {
    rotulo: 'Curso',
    raiz: {
      modelo: 'curso',
      religa: [{ modelo: 'servico', fk: 'cursoId' }],
      filhos: [
        { modelo: 'modulo', fk: 'cursoId', filhos: MODULO_FILHOS },
        { modelo: 'turma', fk: 'cursoId' },
        { modelo: 'cursoAlocacao', fk: 'cursoId' },
        { modelo: 'cicloAprendizagem', fk: 'cursoId' },
        matriculasDoCurso,
        { modelo: 'oferta', fk: 'cursoId', religa: [{ modelo: 'matricula', fk: 'ofertaId' }] },
        { modelo: 'aulaAvulsa', fk: 'cursoId' },
      ],
    },
  },
  modulo: { rotulo: 'Módulo', raiz: { modelo: 'modulo', filhos: MODULO_FILHOS } },
  turma: { rotulo: 'Turma', raiz: { modelo: 'turma' } },
  oferta: {
    rotulo: 'Proposta',
    idTexto: true,
    raiz: { modelo: 'oferta', religa: [{ modelo: 'matricula', fk: 'ofertaId' }] },
  },
  curriculo: { rotulo: 'Currículo', idTexto: true, raiz: { modelo: 'curriculo' } },
  evento: { rotulo: 'Evento ou reunião', idTexto: true, raiz: { modelo: 'evento' } },
  atividade: { rotulo: 'Atividade', raiz: { modelo: 'atividade' } },
  atividadeModelo: {
    rotulo: 'Atividade do catálogo',
    raiz: { modelo: 'atividadeModelo', religa: [{ modelo: 'atividade', fk: 'modeloId' }] },
  },
  lead: { rotulo: 'Lead', idTexto: true, raiz: { modelo: 'lead' } },
  pedido: { rotulo: 'Pedido', raiz: { modelo: 'pedido', filhos: [{ modelo: 'parcelaPedido', fk: 'pedidoId' }] } },
  contrato: { rotulo: 'Contrato', raiz: { modelo: 'contratoEmpresa' } },
  ofertaPadrao: { rotulo: 'Oferta', raiz: { modelo: 'ofertaPadrao' } },
  cupom: { rotulo: 'Cupom', pk: 'codigo', idTexto: true, raiz: { modelo: 'cupom' } },
  bolsa: { rotulo: 'Bolsa', raiz: { modelo: 'bolsa' } },
  ordemFaturamento: { rotulo: 'Ordem de faturamento', raiz: { modelo: 'ordemFaturamento' } },
  notaFiscal: { rotulo: 'Nota fiscal', raiz: { modelo: 'notaFiscal' } },
  importacaoVindi: { rotulo: 'Importação Vindi', idTexto: true, raiz: { modelo: 'importacaoVindi' } },
  aulaAvulsa: { rotulo: 'Aula avulsa', idTexto: true, raiz: { modelo: 'aulaAvulsa' } },
  departamento: { rotulo: 'Departamento', raiz: { modelo: 'departamento' } },
  cargo: { rotulo: 'Cargo', raiz: { modelo: 'cargo' } },
  catalogo: { rotulo: 'Item de catálogo', raiz: { modelo: 'catalogo' } },
  sala: { rotulo: 'Sala', raiz: { modelo: 'sala' } },
  feriado: { rotulo: 'Feriado', raiz: { modelo: 'feriado' } },
  /* cadastros do motor genérico (domain/cadastros.ts) */
  dataBloqueada: { rotulo: 'Data bloqueada', raiz: { modelo: 'dataBloqueada' } },
  nivelamento: { rotulo: 'Nivelamento', raiz: { modelo: 'nivelamento' } },
  feedbackAula: { rotulo: 'Feedback de aula', raiz: { modelo: 'feedbackAula' } },
  ausenciaProfessor: { rotulo: 'Ausência', raiz: { modelo: 'ausenciaProfessor' } },
  pedidoCancelamentoAlocacao: { rotulo: 'Pedido de cancelamento', raiz: { modelo: 'pedidoCancelamentoAlocacao' } },
  sessaoPedagogica: { rotulo: 'Sessão pedagógica', raiz: { modelo: 'sessaoPedagogica' } },
  usuarioEmail: { rotulo: 'E-mail', raiz: { modelo: 'usuarioEmail' } },
  usuarioTelefone: { rotulo: 'Telefone', raiz: { modelo: 'usuarioTelefone' } },
  usuarioEndereco: { rotulo: 'Endereço', raiz: { modelo: 'usuarioEndereco' } },
  servico: { rotulo: 'Serviço', raiz: { modelo: 'servico' } },
  conteudo: { rotulo: 'Material', raiz: { modelo: 'conteudo' } },
  calendario: {
    rotulo: 'Calendário',
    raiz: { modelo: 'calendario', religa: [{ modelo: 'cicloAprendizagem', fk: 'calendarioId' }] },
  },
  cicloAprendizagem: { rotulo: 'Ciclo de aprendizagem', raiz: { modelo: 'cicloAprendizagem' } },
  relatorioMatricula: { rotulo: 'Relatório de matrícula', raiz: { modelo: 'relatorioMatricula' } },
  extratoProfessor: { rotulo: 'Extrato', raiz: { ...EXTRATO, fk: undefined } },
  lancamentoExtrato: { rotulo: 'Lançamento', raiz: { modelo: 'lancamentoExtrato' } },
};

/** o tipo da Lixeira de cada modelo do motor de cadastros */
export const tipoDoModelo = (modelo: string) => (TIPOS[modelo] ? modelo : null);

/** nomes no plural para o resumo "31 matrículas · 2 turmas" */
const PLURAL: Record<string, [string, string]> = {
  modulo: ['módulo', 'módulos'],
  moduloHorario: ['horário da grade', 'horários da grade'],
  turma: ['turma', 'turmas'],
  cursoAlocacao: ['alocação', 'alocações'],
  cicloAprendizagem: ['ciclo', 'ciclos'],
  matricula: ['matrícula', 'matrículas'],
  nivelamento: ['nivelamento', 'nivelamentos'],
  relatorioMatricula: ['relatório de matrícula', 'relatórios de matrícula'],
  oferta: ['proposta', 'propostas'],
  feedbackAluno: ['feedback', 'feedbacks'],
  anexo: ['anexo', 'anexos'],
  dataBloqueada: ['data bloqueada', 'datas bloqueadas'],
  feedbackAula: ['feedback de aula', 'feedbacks de aula'],
  bolsa: ['bolsa', 'bolsas'],
  ausenciaProfessor: ['ausência', 'ausências'],
  pedidoCancelamentoAlocacao: ['pedido de cancelamento', 'pedidos de cancelamento'],
  sessaoPedagogica: ['sessão pedagógica', 'sessões pedagógicas'],
  extratoProfessor: ['extrato', 'extratos'],
  lancamentoExtrato: ['lançamento', 'lançamentos'],
  avaliacaoProfessor: ['avaliação', 'avaliações'],
  usuario: ['login', 'logins'],
  preferencia: ['preferência', 'preferências'],
  dashboardConfig: ['painel personalizado', 'painéis personalizados'],
  usuarioEmail: ['e-mail', 'e-mails'],
  usuarioTelefone: ['telefone', 'telefones'],
  usuarioEndereco: ['endereço', 'endereços'],
  notificacao: ['notificação', 'notificações'],
  parcelaPedido: ['parcela', 'parcelas'],
  aulaAvulsa: ['aula avulsa', 'aulas avulsas'],
};

type Grupo = { modelo: string; linhas: Record<string, unknown>[] };
type Religa = { modelo: string; fk: string; pares: [unknown, unknown][] };
export type Copia = { grupos: Grupo[]; religa: Religa[] };

// biome-ignore lint/suspicious/noExplicitAny: acesso dinâmico aos modelos do Prisma pelo nome
const modelo = (tx: Tx | typeof prisma, m: string) => (tx as any)[m];

/** Date → ISO, Decimal → texto, Bytes → base64; o JSON da cópia volta pelo `revive` */
const copia = (r: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(r).map(([k, v]) => {
      if (v instanceof Date) return [k, v.toISOString()];
      if (v instanceof Uint8Array) return [k, { $b64: Buffer.from(v).toString('base64') }];
      if (v && typeof v === 'object' && (v as { constructor?: { name?: string } }).constructor?.name === 'Decimal')
        return [k, String(v)];
      return [k, v];
    }),
  );
const revive = (r: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(r)
      /* nulo volta pelo padrão da coluna (e evita o JsonNull do Prisma) */
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [
        k,
        v && typeof v === 'object' && '$b64' in (v as object) ? Buffer.from((v as { $b64: string }).$b64, 'base64') : v,
      ]),
  );

/** junta a árvore: grupos na ordem de inserção (pai antes dos filhos) e os vínculos SetNull */
async function coleta(
  tx: Tx,
  no: No,
  onde: Record<string, unknown>,
  c: Copia & { apagar: { modelo: string; onde: unknown }[] },
) {
  const linhas = (await modelo(tx, no.modelo).findMany({ where: onde })) as Record<string, unknown>[];
  if (!linhas.length) return;
  c.apagar.push({ modelo: no.modelo, onde });
  if (!no.semCopia) c.grupos.push({ modelo: no.modelo, linhas: linhas.map(copia) });
  const ids = linhas.map((l) => l.id).filter((x) => x !== undefined);
  for (const r of no.religa ?? []) {
    const outros = (await modelo(tx, r.modelo).findMany({
      where: { [r.fk]: { in: ids } },
      select: { id: true, [r.fk]: true },
    })) as Record<string, unknown>[];
    if (outros.length) c.religa.push({ ...r, pares: outros.map((o) => [o.id, o[r.fk]]) });
  }
  for (const f of no.filhos ?? []) if (ids.length) await coleta(tx, f, { ...f.onde, [f.fk!]: { in: ids } }, c);
}

const ondeRaiz = (t: TipoLixeira, id: string) => ({ [t.pk ?? 'id']: t.idTexto ? id : Number(id) });
const nomeDe = (r: Record<string, unknown>, id: string) =>
  String(r.nome ?? r.titulo ?? r.topico ?? r.numero ?? r.codigo ?? r.cliente ?? r.data ?? `#${id}`).slice(0, 200);

/** o que vai junto, sem apagar nada (texto da confirmação) */
export async function previa(tipo: string, id: string) {
  const t = TIPOS[tipo];
  if (!t) return null;
  return prisma.$transaction(async (tx) => {
    const c = { grupos: [] as Grupo[], religa: [] as Religa[], apagar: [] as { modelo: string; onde: unknown }[] };
    await coleta(tx, t.raiz, ondeRaiz(t, id), c);
    if (!c.grupos.length) return null;
    return { rotulo: t.rotulo, nome: nomeDe(c.grupos[0].linhas[0], id), junto: resumo(c.grupos.slice(1)) };
  });
}

const resumo = (gs: Grupo[]) => {
  const n = new Map<string, number>();
  for (const g of gs) n.set(g.modelo, (n.get(g.modelo) ?? 0) + g.linhas.length);
  return [...n].map(([m, q]) => {
    const [um, varios] = PLURAL[m] ?? [m, m];
    return `${q} ${q === 1 ? um : varios}`;
  });
};

/** move para a Lixeira: guarda a cópia e apaga (filhos antes do pai) numa transação só */
export async function excluir(tipo: string, id: string, por: string) {
  const t = TIPOS[tipo];
  if (!t) throw new Error('Tipo sem Lixeira.');
  return prisma.$transaction(
    async (tx) => {
      const c = { grupos: [] as Grupo[], religa: [] as Religa[], apagar: [] as { modelo: string; onde: unknown }[] };
      await coleta(tx, t.raiz, ondeRaiz(t, id), c);
      if (!c.grupos.length) return null;
      const nome = nomeDe(c.grupos[0].linhas[0], id);
      const junto = resumo(c.grupos.slice(1));
      for (const a of [...c.apagar].reverse()) await modelo(tx, a.modelo).deleteMany({ where: a.onde });
      const l = await tx.lixeira.create({
        data: {
          tipo,
          registroId: id,
          nome,
          resumo: junto.join(' · '),
          dados: { grupos: c.grupos, religa: c.religa } as never,
          por,
        },
      });
      return { id: l.id, rotulo: t.rotulo, nome, junto };
    },
    { timeout: 60_000 },
  );
}

/** devolve tudo com os mesmos códigos; se algo com o mesmo nome ou código foi criado depois, recusa */
export async function restaurar(lixeiraId: number) {
  const l = await prisma.lixeira.findUnique({ where: { id: lixeiraId } });
  if (!l) return null;
  const d = l.dados as unknown as Copia;
  await prisma.$transaction(
    async (tx) => {
      for (const g of d.grupos) await modelo(tx, g.modelo).createMany({ data: g.linhas.map(revive) });
      for (const r of d.religa)
        for (const [rid, v] of r.pares)
          await modelo(tx, r.modelo).updateMany({ where: { id: rid, [r.fk]: null }, data: { [r.fk]: v } });
      await tx.lixeira.delete({ where: { id: l.id } });
    },
    { timeout: 60_000 },
  );
  return l;
}

/** erro do Prisma na restauração → texto para a tela */
export const erroRestaurar = (e: unknown) => {
  const code = (e as { code?: string }).code;
  if (code === 'P2002')
    return 'Já existe outro registro com o mesmo nome ou código. Renomeie ou exclua o outro e tente de novo.';
  if (code === 'P2003') return 'Algo de que este registro depende também foi excluído. Restaure esse outro antes.';
  return null;
};
