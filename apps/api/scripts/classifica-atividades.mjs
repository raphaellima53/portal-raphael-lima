/*
 * Catálogo de atividades (lista do usuário de 23/09/2026: atividade · descrição · cadência) → atividades-catalogo.json.
 * A lista não traz o setor nem o tipo: saem das regras abaixo (a primeira que casa vence) e dos acertos por nome.
 * Sem cadência = projeto (tarefa única). Rodar: node scripts/classifica-atividades.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('../src/domain/dados/', import.meta.url);
const linhas = readFileSync(new URL('atividades-catalogo.tsv', DIR), 'utf8').trim().split(/\r?\n/).slice(1);

const n = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/* acertos por nome (trecho do nome → setor), para o que as regras erram */
const ACERTOS = [
  ['consultoria de retencao por videoconferencia', 'CX'],
  ['ligacao de audio prioritaria', 'Comercial'],
  ['videochamada comercial', 'Comercial'],
  ['negociacao b2b por video', 'Comercial'],
  ['dar continuidade aos atendimentos comerciais', 'Comercial'],
  ['auditoria de qualidade de atendimento cx', 'CX'],
  ['cronograma mensal de plantao', 'CX'],
  ['funil seletivo de professores', 'Pedagógico'],
  ['alinhamento de novos procedimentos pedagogicos', 'Pedagógico'],
  ['mapeamento de demandas de melhoria de conteudos', 'Pedagógico'],
  ['programa de desenvolvimento de', 'Pedagógico'],
  ['capital humano alumni', 'Pedagógico'],
  ['solicitar emissao de nf', 'Comercial'],
  ['registrar vendas na planilha', 'Comercial'],
  ['validar integridade do fluxo de vendas', 'Comercial'],
  ['gerar e acompanhar contratos de venda', 'Comercial'],
  ['emitir fatura avulsa', 'Financeiro/Fiscal'],
  ['cobranca mensal de pagamentos b2b', 'Financeiro/Fiscal'],
  ['cobranca ativa', 'Financeiro/Fiscal'],
  ['bloqueio de contato', 'Financeiro/Fiscal'],
  ['mobilizar marketing para divulgacao de processo seletivo', 'Pedagógico'],
  ['elaborar roteiro de video marketing para cliente b2b', 'Marketing'],
  ['gravar videos de marketing para clientes b2b', 'Marketing'],
  ['formatar artes para acoes comerciais b2b', 'Marketing'],
  ['formatar artes para landing pages b2b2c', 'Marketing'],
  ['campanhas mensais de desconto para parceiros b2b2c', 'Comercial'],
  ['prospectar parcerias de divulgacao com radios', 'Marketing'],
  ['relacionamento com radios parceiras', 'Marketing'],
  ['elaboracao de campanhas tematicas e estrategias de reativacao', 'Comercial'],
  ['revisao academica de artigos', 'Pedagógico'],
  ['produzir materiais didaticos personalizados para clientes b2b', 'Pedagógico'],
  ['relatorio mensal personalizado para rh', 'Comercial'],
  ['reativacao de colaboradores em parcerias b2b2c', 'Comercial'],
  ['recuperar alunos b2b inativos', 'Comercial'],
  ['envio de mensagem de boas-vindas', 'CX'],
  ['atendimento pedagogico individual', 'Pedagógico'],
  ['consultoria private pos-matricula', 'CX'],
  ['consultoria private alumni black', 'CX'],
  ['agendar consultoria private', 'CX'],
  ['fechar relatorio mensal de retencao', 'CX'],
  ['consolidar e publicar relatorio mensal de marketing', 'Marketing'],
  ['monitoramento de turmas e cobertura emergencial', 'Acadêmico'],
  ['conferir disponibilidade e links das salas zoom', 'Acadêmico'],
  ['verificar disponibilidade e navegacao do portal do aluno', 'Acadêmico'],
  ['conferir presenca de alunos agendados', 'Acadêmico'],
  ['validar integridade do dashboard pedagogico', 'Pedagógico'],
  ['conferir registro de faltas e presencas de professores', 'Acadêmico'],
  ['calcular folha de pagamento de professores', 'Financeiro/Fiscal'],
  ['processar pagamento mensal de professores', 'Financeiro/Fiscal'],
  ['suporte operacional a professores', 'Acadêmico'],
  ['acompanhamento da satisfacao', 'CX'],
  ['acompanhamento diario de entrada de leads', 'Comercial'],
  ['acompanhamento diario de numeros do b2c', 'Comercial'],
  ['acompanhamento diario de remarketing', 'Marketing'],
  ['atendimento a clientes em outras etapas do funil', 'Comercial'],
  ['centralizacao de dados de alunos', 'Acadêmico'],
  ['elaboracao e envio de relatorio geral da operacao', 'Administrativo'],
  ['envio e acompanhamento do fluxo de e-mails de cancelamento', 'CX'],
  ['supervisao da alocacao de aulas dos alunos alumni black', 'Acadêmico'],
  ['acompanhamento da jornada inicial do aluno', 'CX'],
  ['acompanhamento do status de matriculas', 'Acadêmico'],
  ['alinhamento com coordenacao, diretoria e financeiro', 'Administrativo'],
  ['analise de feedbacks e reporte de melhorias', 'CX'],
  ['automacao de processos internos', 'Administrativo'],
  ['cadastro no portal e ll', 'Acadêmico'],
  ['manutencao de planilhas', 'Administrativo'],
  ['producao e personalizacao de comunicacoes comerciais', 'Comercial'],
  ['configuracoes na meta da producao', 'Marketing'],
  ['realizacao da consultoria de retencao', 'CX'],
  ['reativacao de alunos - apos pagamento', 'CX'],
  ['migracao dos alunos de private', 'Acadêmico'],
  ['formulacao do processo de vendas', 'Comercial'],
  ['elaboracao do treinamento de vendas', 'Comercial'],
  ['elaboracao do branding book', 'Marketing'],
  ['gravacao do video inicial de campanha', 'Marketing'],
  ['lancamento da campanha de divulgacao', 'Marketing'],
  ['elaborar documento de design de produto', 'Administrativo'],
  ['mapa de jornada do cliente', 'CX'],
  ['organizar processo de cliente oculto', 'CX'],
  ['construcao da funcao concierge', 'CX'],
  ['ativar telefone concierge', 'CX'],
  ['atender solicitacoes de alunos black', 'CX'],
  ['criar modelos de mensagem por semana de jornada', 'CX'],
  ['montar agenda de agendamento de consultorias', 'CX'],
  ['padronizar script da consultoria', 'CX'],
  ['realizar contato ativo semanal com alunos black', 'CX'],
  ['layout da consultoria de retencao', 'CX'],
  ['elabora camada de inteligencia do radar', 'CX'],
  ['estrategia e selecao de depoimentos de professores', 'Marketing'],
  ['edicao dos videos de depoimentos', 'Marketing'],
  ['publicacao e acompanhamento das midias de depoimentos', 'Marketing'],
  ['proposta de reativacao do linkedin', 'Marketing'],
  ['validacao da proposta de reativacao do linkedin', 'Marketing'],
  ['suporte audio visual', 'Marketing'],
  ['compilacao de dados de prestadores', 'Administrativo'],
  ['fluxo de gestao de dados de prestadores', 'Administrativo'],
  ['criacao de dashboards e aplicacoes', 'Administrativo'],
  ['validar integridade de dados em sistemas', 'Administrativo'],
  ['gestao de tickets criticos', 'CX'],
  ['suporte em eventos institucionais', 'Marketing'],
  ['analisar as funcionalidades do dashboard de alunos', 'Acadêmico'],
  ['prestar suporte e treinamento do clint', 'Administrativo'],
  ['resolver casos pendentes de ex-alunos', 'CX'],
  ['gravacao de telas do sistema', 'Marketing'],
  ['onboarding alumni black', 'Marketing'],
  ['onboarding community', 'Marketing'],
  ['edicao de todos os videos de onboarding', 'Marketing'],
  ['elaboracao dos processos vinculados a realizacao dos onboardings', 'CX'],
  ['roteiros para gravacao dos videos de onboarding', 'CX'],
  ['correcoes dos roteiros de onboarding', 'CX'],
  ['edicao dos roteiros de onboarding', 'CX'],
];

const REGRAS = [
  ['Financeiro/Fiscal', /royalt|folha de pagamento|despesas|custos|faturamento|inadimpl|cobranca/],
  ['Administrativo', /juridic|audienc|advogad|chamados operacionais|infraestrutura/],
  [
    'Marketing',
    /marketing|campanha|influenc|redes sociais|blog|seo|artes|midia paga|trafego pago|google ads|meta|video|remarketing|marca|site|landing/,
  ],
  ['Comercial', /lead|venda|b2b|prospect|funil|renovacao|carteira|comercial|repescagem|proposta|clientes/],
  ['CX', /atendimento ao aluno|reclame|procon|retencao|churn|concierge|consultoria/],
  [
    'Pedagógico',
    /professor|teacher|pedagog|aula|materia|learning lab|framework|nivelamento|alocacao|grade|treinamento|kids|gerador|trilhas|certificacao|avaliacao/,
  ],
  ['Acadêmico', /matricul|turma|aluno/],
];

const TIPOS = [
  ['Atendimento', /^atendimento/],
  [
    'Reunião',
    /reuniao|alinhamento|1on1|videochamada|videoconferencia|negociacao|audienc|onboarding inicial de empresa/,
  ],
  ['Ligação', /ligac|telefon|cobranca ativa/],
  ['WhatsApp', /whatsapp/],
  ['E-mail', /e-?mail|disparo|mensagem de boas-vindas/],
  ['Atendimento', /atendimento|atender|suporte|consultoria|chamados|tickets|reclame/],
  ['Relatório', /relatorio|fechamento|fechar|consolid|dashboard/],
  ['Follow-up', /follow-up|continuidade|retomar|repescagem|recuperar|reativa/],
];

const CAD = {
  diaria: 'diaria',
  semanal: 'semanal',
  quinzenal: 'quinzenal',
  mensal: 'mensal',
  bimestral: 'bimestral',
  trimestral: 'trimestral',
  eventual: 'eventual',
  '': 'projeto',
};

const out = linhas.map((l, i) => {
  const [nome0, desc = '', cad0 = ''] = l.split('\t');
  const nome = nome0.trim().replace(/\.+$/, '');
  const k = n(nome);
  const ac = ACERTOS.find(([t]) => k.includes(t));
  const setor = ac ? ac[1] : (REGRAS.find(([, re]) => re.test(k)) ?? ['Administrativo'])[0];
  const cadencia = CAD[n(cad0.trim())];
  if (!cadencia) throw new Error(`cadência desconhecida na linha ${i + 2}: ${cad0}`);
  const tipo = cadencia === 'projeto' ? 'Projeto' : (TIPOS.find(([, re]) => re.test(k)) ?? ['Tarefa'])[0];
  return { id: i + 1, nome, descricao: desc.trim(), cadencia, setor, tipo };
});

writeFileSync(new URL('atividades-catalogo.json', DIR), `${JSON.stringify(out, null, 2)}\n`);
const conta = (k) => {
  const m = {};
  for (const x of out) m[x[k]] = (m[x[k]] ?? 0) + 1;
  return Object.entries(m);
};
console.log(out.length, 'atividades');
console.log(
  'setor',
  conta('setor')
    .map((x) => x.join(' '))
    .join(' · '),
);
console.log(
  'cadência',
  conta('cadencia')
    .map((x) => x.join(' '))
    .join(' · '),
);
console.log(
  'tipo',
  conta('tipo')
    .map((x) => x.join(' '))
    .join(' · '),
);
if (process.argv[2] === '-v')
  for (const x of out) console.log(`${x.setor.padEnd(18)} ${x.tipo.padEnd(12)} ${x.cadencia.padEnd(10)} ${x.nome}`);
