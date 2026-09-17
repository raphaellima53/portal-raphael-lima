'use client';

import { CopyIcon, DownloadIcon, EllipsisIcon, PencilIcon, ShieldIcon, TrashIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Segmento } from '@/components/alunos/abas-aluno';
import { CampoData, CampoHora } from '@/components/campos-data';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { Dica } from '@/components/ui/tooltip';
import { type Personas, type Telas, useAcaoCfg, useCfg } from '@/lib/config';
import { AvisoMsg, Barra, Busca, ErroQ, type Msg, normaliza, Stats, Vazio } from './comum';

/* ================= Personas de teste ================= */
export function TelaPersonas({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Personas>('/personas');
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(null);
  const d = q.data;
  const { fatia, rodape } = usePaginacao(d?.linhas ?? [], 25);
  const entrar = (letra: string) =>
    acao.mutate(
      { caminho: `/personas/${letra}/entrar` },
      {
        /* a sessão mudou de pessoa: recarrega o portal inteiro */
        onSuccess: (r) => window.location.assign(r.ir ?? '/inicio'),
        onError: (e) => setMsg({ txt: e.message, erro: true }),
      },
    );
  return (
    <>
      <PageHead titulo="Personas de teste" />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <Stats itens={d.stats} />
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-borda bg-card px-4 py-3 text-texto-2 shadow-el-1">
            <ShieldIcon className="mt-0.5 size-4 shrink-0 text-azul" />
            <span>
              Senhas à mostra porque são contas de teste. <b>Entrar como</b> troca a sessão para a persona; para voltar,
              use Sair no menu da conta e entre de novo como Admin.
            </span>
          </div>
          <Card className="overflow-hidden">
            <Table aria-label="Personas de teste">
              <THead>
                <Tr>
                  <Th>Persona</Th>
                  <Th>Tipo</Th>
                  <Th>Curso</Th>
                  <Th>Módulo</Th>
                  <Th>Objetivo</Th>
                  <Th>Nome no portal</Th>
                  <Th>Login</Th>
                  <Th>Senha</Th>
                  <Th>Nível e setores</Th>
                  <Th>
                    <span className="sr-only">Ações</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.map((p) => (
                  <Tr key={p.letra}>
                    <Td className="font-bold text-texto">{p.letra}</Td>
                    <Td>{p.tipo}</Td>
                    <Td className="whitespace-pre-line">{p.cursos.join('\n') || '—'}</Td>
                    <Td className="whitespace-pre-line">{p.modulos.join('\n') || '—'}</Td>
                    <Td>{p.objetivo}</Td>
                    <Td className="font-medium whitespace-nowrap text-texto">{p.nome}</Td>
                    <Td className="font-mono">{p.login}</Td>
                    <Td className="font-mono">{p.senha}</Td>
                    <Td className="min-w-[240px]">{p.resumo}</Td>
                    <Td className="text-right">
                      <Button size="sm" disabled={acao.isPending || !p.ativo} onClick={() => entrar(p.letra)}>
                        Entrar como
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            {rodape}
          </Card>
        </>
      )}
    </>
  );
}

/* ================= Mapa de telas ================= */
export function TelaMapaTelas({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Telas>('/telas');
  const [busca, setBusca] = useState('');
  const [sit, setSit] = useState('');
  const [area, setArea] = useState('');
  const d = q.data;
  const lista = useMemo(() => {
    const n = normaliza(busca);
    return (d?.linhas ?? []).filter(
      (l) =>
        (!sit || l.sit === sit) &&
        (!area || l.area === area) &&
        (!n || normaliza([l.label, l.caminho, l.mostra, l.acoes.join(' '), l.sub.join(' ')].join(' ')).includes(n)),
    );
  }, [d, busca, sit, area]);
  const { fatia, rodape, setPag } = usePaginacao(lista, 25);
  const f =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPag(1);
    };
  let grupo = '';
  return (
    <>
      <PageHead titulo="Mapa de telas" />
      {abas}
      <ErroQ e={q.error} />
      {d && (
        <>
          <Stats
            itens={[
              { v: d.linhas.length, t: 'telas no menu' },
              { v: d.linhas.filter((l) => l.sit === 'ok').length, t: 'existentes', tom: 'green' },
              { v: d.linhas.filter((l) => l.sit === 'con').length, t: 'a construir', tom: 'amber' },
            ]}
          />
          <Barra>
            <Busca rotulo="Buscar tela, ação ou conteúdo" valor={busca} aoMudar={f(setBusca)} />
            <Segmento
              rotulo="Situação"
              valor={sit}
              aoMudar={f(setSit)}
              opcoes={[
                ['', 'Todas'],
                ['ok', 'Existentes'],
                ['con', 'A construir'],
              ]}
            />
            <Escolha
              rotulo="Área"
              todos="todas as áreas"
              valor={area}
              aoMudar={f(setArea)}
              opcoes={d.areas.map((a) => ({ v: a, l: a }))}
              className="w-[200px]"
            />
            <span role="status" className="ml-auto text-apagado">
              {lista.length} {lista.length === 1 ? 'tela' : 'telas'}
            </span>
          </Barra>
          <Card className="overflow-hidden">
            <Table aria-label="Mapa de telas">
              <THead>
                <Tr>
                  <Th>Tela</Th>
                  <Th>Situação</Th>
                  <Th>Tipo</Th>
                  <Th>O que mostra</Th>
                  <Th>Ações</Th>
                  <Th>Leva a</Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.flatMap((l) => {
                    const cab = l.area !== grupo;
                    grupo = l.area;
                    return [
                      cab ? (
                        <Tr key={`g-${l.id}`} className="bg-bg">
                          <Td colSpan={6} className="py-2 font-bold text-apagado">
                            {l.area}
                          </Td>
                        </Tr>
                      ) : null,
                      <Tr key={l.id} className="align-top">
                        <Td className="min-w-[180px]">
                          <Link href={l.href} className="font-semibold text-azul hover:underline">
                            {l.label}
                          </Link>
                          {l.caminho && <div className="text-apagado-2">{l.caminho}</div>}
                        </Td>
                        <Td>
                          <Badge tom={l.sit === 'ok' ? 'green' : 'amber'}>
                            {l.sit === 'ok' ? 'existente' : 'a construir'}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap">{l.tipo}</Td>
                        <Td className="min-w-[300px]">
                          {l.mostra || '—'}
                          {l.sub.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {l.sub.map((s) => (
                                <Badge key={s} tom="blue">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {l.det.map((x) => (
                            <div key={x.t} className="mt-1 text-apagado">
                              detalhe · <b>{x.t}</b>: {x.d}
                            </div>
                          ))}
                        </Td>
                        <Td className="min-w-[200px]">{l.acoes.join(' · ') || '—'}</Td>
                        <Td className="min-w-[160px]">{l.vai.join(' · ') || '—'}</Td>
                      </Tr>,
                    ];
                  })
                ) : (
                  <Vazio cols={6} txt="nenhuma tela com esses filtros" />
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
        </>
      )}
    </>
  );
}

/* ================= Design system ================= */
const REGRAS: [string, string, string][] = [
  [
    'Sem borda lateral colorida',
    'Destaque por profundidade (sombra) e hover; a cor vira marcador redondo.',
    'Revisão visual e capturas de tela',
  ],
  [
    'Tudo componentizado',
    'Ajuste novo usa os componentes de components/ e os tokens do globals.css. Não se cria componente paralelo.',
    'Revisão do código',
  ],
  ['Filtros da tabela em linha', 'Busca no início, filtros e ações no fim, colados na tabela.', 'Revisão visual'],
  [
    'Paginação acima de 10 itens',
    '10, 25 ou 50 por página, com a página atual e o total.',
    'usePaginacao em toda lista',
  ],
  [
    'Identidade nos controles',
    'Dropdown, tooltip, badge, select, data-select e text-select com os mesmos tokens.',
    'components/ui e globals.css',
  ],
  [
    'Formato pelo contexto',
    'dd/mm/aaaa · HH:MM · dd/mm/aaaa HH:MM:SS · R$ 0,00 · CPF e telefone com máscara.',
    'Formatação na API (lib/fmt.ts) e conferência contra o portal',
  ],
  [
    'Acessibilidade',
    'Nome acessível, teclado, foco visível, popup com foco preso, regiões vivas e contraste AA.',
    'Testes e2e por papel e nome acessível',
  ],
  ['Respiro e hierarquia', 'Menos caixas dentro de caixas, um título por área e ações agrupadas.', 'Revisão visual'],
  ['Fonte mínima de 14px', 'Nenhum texto abaixo de 14px.', 'Tokens de tipografia'],
  [
    'Responsivo',
    'Mobile abaixo de 640px · tablet de 640 a 1023px · desktop de 1024 a 1439px · desktop-large a partir de 1440px.',
    'Capturas em 400px e 1440px',
  ],
];
const NIELSEN: [string, string, string][] = [
  [
    '1. Visibilidade do status do sistema',
    'Salvar fechava o popup sem retorno. A aba do navegador tinha sempre o mesmo título. A contagem de registros só aparecia em algumas listas.',
    'Aviso do que acabou de acontecer, título da aba com a tela atual, “Mostrando 1–10 de N” em toda tabela paginada, filtro aplicado em azul e a tela anunciada ao leitor de tela.',
  ],
  [
    '2. Correspondência entre o sistema e o mundo real',
    'Datas no formato aaaa-mm-dd em Execuções do Relógio, datas sem ano, valores sem centavos e “R$ 36,6k”, cabeçalhos em caixa alta e CPF sem máscara.',
    'dd/mm/aaaa, registros com HH:MM:SS, R$ 0,00 e “R$ 36,6 mil”, cabeçalhos em texto normal, CPF e telefone com máscara.',
  ],
  [
    '3. Controle e liberdade para o usuário',
    'Voltar do navegador saía do portal. Filtros se desfaziam um a um. Esc fechava o formulário e perdia o que foi digitado.',
    'Cada tela e filtro importante tem endereço próprio (Voltar e avançar passam pelas telas) e Descartar volta ao último salvamento.',
  ],
  [
    '4. Consistência e padronização',
    'Controles de 28, 30, 34 e 36px, fontes de 8 a 13,5px, três jeitos de paginar e filtros em posições diferentes em cada tela.',
    'Uma biblioteca só: controles de 40px, uma barra de filtros, uma paginação e uma escala de badges.',
  ],
  [
    '5. Prevenção de erros',
    'A data dependia do formato do navegador, os campos não tinham máscara e o obrigatório era só um asterisco.',
    'Data-select com máscara e calendário, hora validada, campo obrigatório marcado e confirmação antes de descartar ou excluir.',
  ],
  [
    '6. Reconhecimento em vez de memória',
    'Selects com dezenas de nomes obrigavam a rolar a lista. Ícones sem nome (salvar layout, resetar, página).',
    'Text-select com busca a partir de 12 opções. Tooltip e nome acessível em todo botão só com ícone.',
  ],
  [
    '7. Flexibilidade e eficiência de uso',
    'Linhas, cartões e dias do calendário só abriam com o mouse. Nenhum atalho.',
    'Atalhos (/ ? g+letra), Enter e Espaço em linhas e cartões, setas nas abas e 10, 25 ou 50 por página.',
  ],
  [
    '8. Estética e design minimalista',
    '9.537 textos abaixo de 14px, caixas dentro de caixas e faixas laterais coloridas.',
    'Piso de 14px, cartão dentro de cartão sem moldura e destaque por profundidade e hover.',
  ],
  [
    '9. Ajuda aos usuários a reconhecer, diagnosticar e recuperar de erros',
    'Lista vazia sem saída, erro do popup sem anúncio e data inválida aceita em silêncio.',
    'Lista vazia dizendo o filtro, erros anunciados (role=alert) e data ou hora inválida dizendo o formato esperado.',
  ],
  [
    '10. Ajuda e documentação',
    'A ajuda ficava só na Documentação do admin.',
    '“Ajuda e atalhos” na barra lateral para todos (tecla ?) e esta página.',
  ],
];
const AUDITORIA: [string, number][] = [
  ['Textos abaixo de 14px', 9537],
  ['Clicáveis sem teclado', 1020],
  ['Controles sem nome acessível', 127],
  ['Bordas laterais coloridas', 96],
  ['Tabelas com mais de 10 itens sem paginação', 19],
  ['Datas em formato ISO na tela', 10],
];
const NOMES = [
  'Alice Ferraz',
  'Amanda Reis',
  'Beatriz Nogueira',
  'Bernardo Klein',
  'Breno Carvalho',
  'Caio Fernandes',
  'Caio Nakamura',
  'Camila Duarte',
  'Clara Vieira',
  'Daniel Prates',
  'Davi Okada',
  'Eduarda Nunes',
  'Elisa Fontana',
  'Felipe Moretti',
  'Gabriela Sancho',
  'Henrique Bastos',
];

function Vitrine() {
  const [ex, setEx] = useState('');
  const [conf, setConf] = useState(false);
  const [sel, setSel] = useState('');
  const [txt, setTxt] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('09:00');
  const [busca, setBusca] = useState('');
  const agora = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const dia = `${p2(agora.getDate())}/${p2(agora.getMonth() + 1)}/${agora.getFullYear()}`;
  const hm = `${p2(agora.getHours())}:${p2(agora.getMinutes())}`;
  const itens: [string, string, string, React.ReactNode][] = [
    [
      'Botão',
      'Ação da tela ou do popup. Primário: uma ação principal por área; perigo: apaga ou desativa; fantasma: ação secundária em barra.',
      '<Button variant size>',
      <div key="b" className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => setEx('Exemplo: alterações salvas')}>
          Salvar
        </Button>
        <Button onClick={() => setEx('Exemplo: exportação pronta')}>
          <DownloadIcon /> Exportar
        </Button>
        <Button variant="perigo" onClick={() => setConf(true)}>
          Excluir
        </Button>
        <Dica texto="Editar" lado="top">
          <Button size="icon" aria-label="Editar" onClick={() => setEx('Exemplo: editar')}>
            <PencilIcon />
          </Button>
        </Dica>
      </div>,
    ],
    [
      'Badge',
      'Situação ou categoria curta, com tons de situação.',
      '<Badge tom>',
      <div key="bd" className="flex flex-wrap gap-1.5">
        <Badge tom="green">Ativo</Badge>
        <Badge tom="amber">Pendente</Badge>
        <Badge tom="red">Cancelado</Badge>
        <Badge>Online</Badge>
        <Badge tom="blue">Essential 1</Badge>
      </div>,
    ],
    [
      'Tooltip',
      'Nome de botão só com ícone. Aparece no hover e no foco pelo teclado; explicação de regra continua escrita na tela.',
      '<Dica texto lado>',
      <Dica key="t" texto="Copiar" lado="top">
        <Button size="icon" aria-label="Copiar">
          <CopyIcon />
        </Button>
      </Dica>,
    ],
    [
      'Select',
      'Escolha única com poucas opções. Filtro aplicado fica azul.',
      '<Escolha rotulo todos opcoes>',
      <Escolha
        key="s"
        rotulo="Situação (exemplo)"
        todos="Todas as situações"
        valor={sel}
        aoMudar={setSel}
        opcoes={['Ativo', 'Suspenso', 'Cancelado'].map((v) => ({ v, l: v }))}
        className="w-[220px]"
      />,
    ],
    [
      'Text-select',
      'Select com busca. Entra sozinho quando a lista tem 12 opções ou mais.',
      '<Escolha> com 12+ opções',
      <Escolha
        key="ts"
        rotulo="Aluno (exemplo)"
        todos="Todos os alunos"
        valor={txt}
        aoMudar={setTxt}
        opcoes={NOMES.map((v) => ({ v, l: v }))}
        className="w-[240px]"
      />,
    ],
    [
      'Data-select',
      'Data em dd/mm/aaaa com máscara e calendário (Alt + ↓). O valor lido pelo código continua ISO.',
      '<CampoData rotulo valor aoMudar>',
      <div key="d" className="w-[180px]">
        <CampoData rotulo="Data (exemplo)" valor={data} aoMudar={setData} />
      </div>,
    ],
    [
      'Hora',
      'Hora em HH:MM, 24 horas, validada ao digitar.',
      '<CampoHora rotulo valor aoMudar>',
      <div key="h" className="w-[110px]">
        <CampoHora rotulo="Hora (exemplo)" valor={hora} aoMudar={setHora} />
      </div>,
    ],
    [
      'Busca',
      'Campo de busca da lista.',
      '<Busca rotulo valor aoMudar>',
      <Busca key="bu" rotulo="Buscar (exemplo)" valor={busca} aoMudar={setBusca} />,
    ],
    [
      'Dropdown',
      'Menu de ações de um item. Setas navegam e Esc devolve o foco ao botão.',
      '<DropdownMenu>',
      <DropdownMenu key="dd">
        <DropdownMenuTrigger asChild>
          <Button size="sm" aria-label="Mais ações">
            <EllipsisIcon /> Mais ações
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setEx('Exemplo: editar')}>
            <PencilIcon /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEx('Exemplo: duplicado')}>
            <CopyIcon /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConf(true)}>
            <TrashIcon /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    ],
    [
      'Abas',
      'Troca de visão dentro da mesma tela; nas fichas e nas seções dos menus as abas são links.',
      '<Abas> · <SecaoAbas> · <Segmento>',
      <span key="a" className="text-texto-2">
        Em uso nas fichas de curso, aluno e professor e nas seções de Ações, Relatórios e Configurações.
      </span>,
    ],
    [
      'Tabela',
      'Barra de filtros em linha colada na tabela, paginação acima de 10 itens e rolagem horizontal só na própria tabela.',
      '<Table> · usePaginacao',
      <span key="tb" className="text-texto-2">
        Em uso em Alunos, Auditoria e Relatórios.
      </span>,
    ],
    [
      'Aviso',
      'Aviso fica na tela e diz o que acabou de acontecer ou o que falta.',
      '<Aviso tom icone>',
      <Button key="av" size="sm" onClick={() => setEx('Exemplo de aviso do que acabou de acontecer')}>
        Mostrar aviso
      </Button>,
    ],
    [
      'Confirmação',
      'Antes de apagar, desativar ou descartar o que foi digitado.',
      '<Dialog> com Cancelar e a ação',
      <Button key="c" size="sm" onClick={() => setConf(true)}>
        Abrir confirmação
      </Button>,
    ],
    [
      'Vazio',
      'Lista sem resultado, sempre dizendo o filtro.',
      'linha vazia da <Table>',
      <span key="v" className="text-apagado">
        nenhum registro com esses filtros
      </span>,
    ],
    [
      'Formato',
      'Datas, horas e valores pelo contexto.',
      'lib/fmt.ts (API) · toLocaleString pt-BR',
      <span key="f" className="text-texto-2 tabular-nums">
        {[dia, hm, `${dia} ${hm}:${p2(agora.getSeconds())}`, 'R$ 1.234,50', 'R$ 36,6 mil', '203.000.000-10'].join(
          ' · ',
        )}
      </span>,
    ],
  ];
  const { fatia, rodape } = usePaginacao(itens, 25);
  return (
    <>
      {ex && (
        <Aviso tom="blue" icone="ok">
          {ex}
        </Aviso>
      )}
      <Card className="overflow-hidden">
        <Table aria-label="Componentes">
          <THead>
            <Tr>
              <Th>Componente</Th>
              <Th>Quando usar</Th>
              <Th>Construtor</Th>
              <Th>Exemplo</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.map(([k, q, c, e]) => (
              <Tr key={k} className="align-top">
                <Td className="font-semibold text-texto">{k}</Td>
                <Td className="min-w-[240px]">{q}</Td>
                <Td className="font-mono whitespace-nowrap">{c}</Td>
                <Td className="min-w-[260px]">{e}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        {rodape}
      </Card>
      <Dialog open={conf} onOpenChange={setConf}>
        <DialogContent tamanho="sm">
          <DialogHead titulo="Excluir o exemplo?" descricao="Nada será apagado: é só a vitrine." />
          <DialogBody>Na tela de verdade, a confirmação diz o que será perdido.</DialogBody>
          <DialogFoot>
            <Button
              onClick={() => {
                setConf(false);
                setEx('Cancelado');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="perigo"
              onClick={() => {
                setConf(false);
                setEx('Confirmado');
              }}
            >
              Excluir
            </Button>
          </DialogFoot>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TelaDesign({ abas }: { abas: React.ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const parte = sp.get('parte') ?? 'componentes';
  const tabela = (cab: string[], linhas: string[][], rotulo: string) => (
    <Card className="mb-4 overflow-hidden">
      <Table aria-label={rotulo}>
        <THead>
          <Tr>
            {cab.map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {linhas.map((l) => (
            <Tr key={l[0]} className="align-top">
              {l.map((c, i) => (
                <Td key={i} className={i === 0 ? 'min-w-[200px] font-semibold text-texto' : 'min-w-[240px]'}>
                  {c}
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
  return (
    <>
      <PageHead
        titulo="Design system"
        acoes={
          <Segmento
            rotulo="Parte da documentação"
            valor={parte}
            aoMudar={(v) => router.replace(`${caminho}${v === 'componentes' ? '' : `?parte=${v}`}`, { scroll: false })}
            opcoes={[
              ['componentes', 'Componentes'],
              ['regras', 'Regras'],
              ['nielsen', 'Heurísticas de Nielsen'],
            ]}
          />
        }
      />
      {abas}
      {parte === 'componentes' && <Vitrine />}
      {parte === 'regras' && tabela(['Regra', 'Como vale no portal', 'Quem confere'], REGRAS, 'Regras de interface')}
      {parte === 'nielsen' && (
        <>
          {tabela(['Heurística', 'O que a análise encontrou', 'O que mudou'], NIELSEN, 'Heurísticas de Nielsen')}
          <h2 className="mb-2 text-lg font-bold text-texto">Auditoria automática, antes e depois</h2>
          <Card className="overflow-hidden">
            <Table aria-label="Auditoria antes e depois">
              <THead>
                <Tr>
                  <Th>O que a auditoria conta</Th>
                  <Th className="text-right">Antes</Th>
                  <Th className="text-right">Depois</Th>
                </Tr>
              </THead>
              <TBody>
                {AUDITORIA.map(([t, n]) => (
                  <Tr key={t}>
                    <Td>{t}</Td>
                    <Td className="text-right tabular-nums">{n.toLocaleString('pt-BR')}</Td>
                    <Td className="text-right">
                      <Badge tom="green">0</Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
