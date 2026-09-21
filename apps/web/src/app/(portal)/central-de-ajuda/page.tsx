'use client';

import { ChevronRightIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { PageHead } from '@/components/ds';
import { TabelaAtalhos } from '@/components/shell/ajuda';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { useMe } from '@/lib/consultas';

type Pergunta = [string, string];

/* o que o aluno e o professor mais perguntam, com a tela do portal que resolve */
const ALUNO: Pergunta[] = [
  [
    'Onde vejo as minhas próximas aulas?',
    'Na Agenda. Cada aula mostra o dia, o horário, o curso e o professor. Clique na aula para ver os detalhes.',
  ],
  [
    'Onde vejo as aulas que já tive e a minha presença?',
    'No Histórico. Ele mostra as aulas dos últimos 30, 60 ou 90 dias, com a situação de cada uma e a sua presença. Os filtros separam as aulas executadas, as substituídas, as não finalizadas e as canceladas.',
  ],
  [
    'Faltei. Como peço a reposição?',
    'Fale com a equipe da escola. A reposição é registrada por ela, e a aula nova aparece na sua Agenda.',
  ],
  [
    'Meu professor mudou numa aula. Está certo?',
    'Quando o professor não pode dar a aula, a coordenação escolhe outro. No Histórico, essa aula aparece como substituída, com o nome de quem deu a aula.',
  ],
];

const PROFESSOR: Pergunta[] = [
  [
    'Onde vejo as minhas aulas?',
    'Na Agenda, que já abre só com as suas aulas. Clique numa aula para ver os alunos, a sala e o material.',
  ],
  [
    'Quando consigo marcar a presença?',
    'A lista de presença abre no dia da aula, na página da aula. Depois que a aula é concluída, a presença fica registrada.',
  ],
  [
    'Onde vejo as aulas que já dei?',
    'No Histórico. Ele mostra as aulas dos últimos 30, 60 ou 90 dias, inclusive aquelas em que outro professor ficou no seu lugar, e quantos alunos tinha cada turma.',
  ],
  [
    'Não vou poder dar uma aula. O que faço?',
    'Avise a coordenação pedagógica. Ela escolhe quem dá a aula, e a troca aparece na Agenda.',
  ],
];

/* atalhos que valem para quem só tem Agenda, Histórico e Central de ajuda */
/* a equipe (pirâmide de Operação): onde fica cada coisa no menu */
const EQUIPE: Pergunta[] = [
  [
    'Onde fica cada coisa no menu?',
    'Agenda: aulas e eventos. Usuários: alunos, equipe e empresas. Produtos e serviços: cursos, materiais e serviços. Atividades: o trabalho de cada setor e os relatórios. Auditoria e Configurações aparecem só para o Admin.',
  ],
  [
    'Onde está o Dashboard?',
    'No Início, o primeiro item do menu (o logo também leva a ele). Os blocos se escolhem em Personalizar e ficam salvos para você.',
  ],
  [
    'Como dou acesso ao portal para alguém?',
    'Abra a ficha da pessoa (aluno ou professor) na aba Acesso, ou o cadastro do colaborador em Equipe, e use Criar acesso. Só o Admin vê essa aba.',
  ],
  [
    'Também sou aluno. Onde vejo as minhas aulas?',
    'Use o botão Aluno, no rodapé do menu: ele mostra a sua Agenda, o Histórico de aulas e o Meu perfil como aluno.',
  ],
];

const TECLAS = ['/', '?', 'g depois a', '[', 'Esc', 'Alt + ↓', '← → na aba'];

export default function CentralPage() {
  return (
    <Suspense>
      <CentralDeAjuda />
    </Suspense>
  );
}

/** Central de ajuda do aluno e do professor: perguntas frequentes e atalhos de teclado. ?visao=aluno = a do aluno. */
function CentralDeAjuda() {
  const me = useMe();
  const comoAluno = useSearchParams().get('visao') === 'aluno';
  useEffect(() => {
    document.title = 'Central de ajuda · Portal Raphael Lima';
  }, []);
  if (!me.data) return null;
  const u = me.data.usuario;
  const perguntas = u.ehAluno || comoAluno ? ALUNO : u.tipoPerfil === 'Prestador' ? PROFESSOR : EQUIPE;
  const equipe = perguntas === EQUIPE;

  return (
    <>
      <PageHead titulo="Central de ajuda" />
      <div className="grid max-w-[880px] gap-6">
        <section aria-labelledby="ajuda-perguntas">
          <h2 id="ajuda-perguntas" className="mb-3 text-md font-bold text-texto">
            Perguntas frequentes
          </h2>
          {perguntas.map(([p, r], i) => (
            <details
              key={p}
              open={i === 0}
              className="group mb-2 overflow-hidden rounded-lg border border-borda bg-card shadow-el-1"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 font-semibold text-texto hover:bg-hover [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon
                  className="size-4 shrink-0 text-apagado transition-transform group-open:rotate-90"
                  aria-hidden
                />
                {p}
              </summary>
              <p className="px-5 pb-4 pl-[46px] text-texto-2">{r}</p>
            </details>
          ))}
        </section>
        <Card>
          <CardHead>
            <CardTitle>Atalhos de teclado</CardTitle>
          </CardHead>
          <div className="p-5">
            <TabelaAtalhos teclas={equipe ? undefined : TECLAS} />
          </div>
        </Card>
      </div>
    </>
  );
}
