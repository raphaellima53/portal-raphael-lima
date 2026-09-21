'use client';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Aviso } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dica } from '@/components/ui/tooltip';
import {
  FILTROS_VAZIOS,
  type Filtros,
  type Layout,
  passo,
  somaMeses,
  useAgenda,
  useLayoutAgenda,
  useSalvarLayout,
  type Vista,
} from '@/lib/agenda';
import { useMe } from '@/lib/consultas';
import { cn } from '@/lib/utils';
import { AulaDialog } from './aula-dialog';
import { type AbreEvento, EventoDialog } from './evento-dialog';
import { ListaDia } from './lista-dia';
import { MassaDialog } from './massa-dialog';
import { Diaria, Kanban, Mensal, Semanal } from './visoes';

const VISTAS: [Vista, string][] = [
  ['mensal', 'Mensal'],
  ['semanal', 'Semanal'],
  ['diaria', 'Diária'],
  ['kanban', 'Kanban'],
];
const CHAVES: (keyof Filtros)[] = ['tipo', 'aluno', 'prof', 'prod', 'mod', 'qual'];

/**
 * Agenda: uma agenda, quatro recortes (Mensal, Semanal, Diária, Kanban) sobre a mesma lista de aulas e os mesmos filtros.
 * O estado (visão, data, período e filtros) mora no endereço — voltar do navegador volta ao recorte anterior.
 * `minha` = Minha agenda de quem também é aluno.
 */
export function AgendaTela({ minha = false }: { minha?: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();
  const me = useMe();
  const ehAluno = !!me.data?.usuario.ehAluno;
  const soAluno = ehAluno || minha;

  const vista = (VISTAS.find((v) => v[0] === sp.get('vista'))?.[0] ?? 'mensal') as Vista;
  const data = sp.get('data') ?? undefined;
  const periodo = sp.get('periodo') ?? 'semana';
  const filtros: Filtros = { ...FILTROS_VAZIOS };
  for (const k of CHAVES) filtros[k] = sp.get(k) ?? '';

  const q = useAgenda({ vista, data, periodo, ...filtros, minha });
  const d = q.data;
  const layout = useLayoutAgenda(!soAluno);
  const salvarLayout = useSalvarLayout();
  const [msg, setMsg] = useState<{ txt: string; erro?: boolean } | null>(null);
  const [layoutMsg, setLayoutMsg] = useState('');
  const [aula, setAula] = useState<string | null>(null);
  const [evento, setEvento] = useState<AbreEvento>(null);
  const [massa, setMassa] = useState<string[] | null>(null);

  const url = (p: Record<string, string | undefined>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(p)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    const s = n.toString();
    return `${caminho}${s ? `?${s}` : ''}`;
  };
  const vai = (p: Record<string, string | undefined>) => router.push(url(p), { scroll: false });

  /* ao entrar na Agenda sem recorte no endereço, aplica o layout salvo de quem está logado */
  const aplicou = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: aplica uma vez por entrada
  useEffect(() => {
    if (soAluno || aplicou.current || !layout.isFetched) return;
    aplicou.current = true;
    const l = layout.data?.salvo;
    if (!l || sp.toString()) return;
    router.replace(
      url({
        vista: l.vista,
        periodo: l.periodo === 'semana' ? undefined : l.periodo,
        ...Object.fromEntries(CHAVES.map((k) => [k, l.agF[k] || undefined])),
      }),
      { scroll: false },
    );
  }, [layout.isFetched, soAluno]);

  const atual: Layout = { agF: filtros, vista, periodo };
  const salvo = layout.data?.salvo;
  const salvoIgual =
    !!salvo &&
    JSON.stringify({ agF: { ...FILTROS_VAZIOS, ...salvo.agF }, vista: salvo.vista, periodo: salvo.periodo }) ===
      JSON.stringify(atual);

  useEffect(() => {
    document.title = `${minha || ehAluno ? 'Minha agenda' : 'Agenda'} · Portal Raphael Lima`;
  }, [minha, ehAluno]);

  const abre = {
    aula: setAula,
    evento: (id: string) => setEvento({ id }),
    dia: (iso: string) => vai({ vista: 'diaria', data: iso }),
  };
  const o = d?.opcoes;
  const presaProf = o && !o.soAluno ? o.presa?.prof : undefined;

  /* pirâmide do aluno: filtros Produtos e Módulos, com os cursos e módulos dele */
  const filtrosUi = !o ? null : o.soAluno ? (
    <>
      <Escolha
        rotulo="Todos os meus produtos"
        todos="Todos os meus produtos"
        valor={filtros.prod}
        aoMudar={(v) => vai({ prod: v, mod: undefined })}
        opcoes={o.cursosDoAluno.map((c) => ({ v: c, l: c }))}
        className="w-[220px]"
      />
      <Escolha
        rotulo="Todos os meus módulos"
        todos="Todos os meus módulos"
        valor={filtros.mod}
        aoMudar={(v) => vai({ mod: v })}
        opcoes={o.modulosDoAluno.map((m) => ({ v: m, l: m }))}
        className="w-[240px]"
      />
    </>
  ) : (
    <>
      {/* pirâmide do professor: Alunos, Usuários, Produtos e Módulos (sem Aulas e eventos) */}
      {!presaProf && (
        <Escolha
          rotulo="Aulas e eventos"
          valor={filtros.tipo}
          todos="Aulas e eventos"
          aoMudar={(v) => vai({ tipo: v })}
          opcoes={[
            { v: 'aulas', l: 'Só aulas' },
            { v: 'eventos', l: 'Só eventos e reuniões' },
          ]}
          className="w-[172px]"
        />
      )}
      <Escolha
        rotulo="Todos os alunos"
        todos="Todos os alunos"
        valor={filtros.aluno}
        aoMudar={(v) => vai({ aluno: v })}
        opcoes={o.alunos.map((n) => ({ v: n, l: n }))}
        className="w-[180px]"
      />
      <Escolha
        rotulo="Todos os usuários"
        todos="Todos os usuários"
        valor={presaProf ?? filtros.prof}
        aoMudar={(v) => vai({ prof: v })}
        disabled={!!presaProf}
        /* uma lista só, em ordem alfabética: colaborador e prestador não se separam (21/09/2026) */
        opcoes={[...new Set([...o.colaboradores, ...o.prestadores])]
          .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
          .map((n) => ({ v: n, l: n }))}
        className="w-[180px]"
      />
      <Escolha
        rotulo="Todos os produtos"
        todos="Todos os produtos"
        valor={filtros.prod}
        aoMudar={(v) =>
          vai({ prod: v, mod: filtros.mod && v && !filtros.mod.startsWith(`${v} · `) ? undefined : filtros.mod })
        }
        opcoes={o.produtos.map((n) => ({ v: n, l: n }))}
        className="w-[180px]"
      />
      <Escolha
        rotulo="Todos os módulos e turmas"
        todos="Todos os módulos e turmas"
        valor={filtros.mod}
        aoMudar={(v) => vai({ mod: v })}
        opcoes={o.modulos.map((n) => ({ v: n, l: n }))}
        className="w-[210px]"
      />
      <div role="group" aria-label="Layout da agenda" className="flex items-center gap-1.5">
        <Dica texto={salvoIgual ? 'Layout salvo' : 'Salvar layout da agenda'} lado="bottom">
          <Button
            size="icon"
            aria-label={salvoIgual ? 'Layout salvo' : 'Salvar layout da agenda'}
            aria-pressed={salvoIgual}
            className={cn(salvoIgual && 'border-azul-linha bg-azul-suave text-azul')}
            onClick={() =>
              salvarLayout.mutate(atual, {
                onSuccess: () => setLayoutMsg('Layout salvo'),
                onError: () => setLayoutMsg('Não foi possível salvar'),
              })
            }
          >
            <SaveIcon />
          </Button>
        </Dica>
        <Dica texto="Resetar filtros" lado="bottom">
          <Button
            size="icon"
            aria-label="Resetar filtros"
            onClick={() =>
              salvarLayout.mutate(null, {
                onSuccess: () => {
                  setLayoutMsg('Filtros resetados');
                  router.push(caminho, { scroll: false });
                },
              })
            }
          >
            <RotateCcwIcon />
          </Button>
        </Dica>
        {layoutMsg && (
          <span role="status" className="text-apagado">
            {layoutMsg}
          </span>
        )}
      </div>
    </>
  );

  const nav = d && (
    <div className="flex items-center gap-1">
      {vista === 'kanban' && d.qualidades && d.periodos && (
        <>
          <Escolha
            rotulo="Qualidade"
            todos="qualidade: todas as aulas"
            valor={filtros.qual}
            aoMudar={(v) => vai({ qual: v })}
            opcoes={d.qualidades.map((x) => ({ v: x.k, l: x.l }))}
            className="w-[272px]"
          />
          <Escolha
            rotulo="Período"
            valor={periodo}
            destacar={false}
            aoMudar={(v) => vai({ periodo: v === 'semana' ? undefined : v })}
            opcoes={d.periodos.map((x) => ({ v: x.k, l: x.l }))}
            className="mr-1 w-[190px]"
          />
        </>
      )}
      {vista === 'mensal' && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ano anterior"
          onClick={() => vai({ data: somaMeses(d.ref, -12) })}
        >
          <ChevronsLeftIcon />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Período anterior"
        onClick={() => vai({ data: passo(vista, periodo, d.ref, -1) })}
      >
        <ChevronLeftIcon />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => vai({ data: undefined })}>
        Hoje
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Próximo período"
        onClick={() => vai({ data: passo(vista, periodo, d.ref, 1) })}
      >
        <ChevronRightIcon />
      </Button>
      {vista === 'mensal' && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Próximo ano"
          onClick={() => vai({ data: somaMeses(d.ref, 12) })}
        >
          <ChevronsRightIcon />
        </Button>
      )}
    </div>
  );

  const barra = d && (
    <div className="flex flex-wrap items-center gap-3 border-b border-borda-suave px-[18px] py-3.5">
      <div className="min-w-0 flex-1">
        <span className="block text-sm text-texto">{d.titulo}</span>
        {d.sub && <span className="font-medium text-azul">{d.sub}</span>}
      </div>
      {nav}
    </div>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <h1 className="grow basis-auto">Agenda</h1>
        <div className="ml-auto flex max-w-full flex-col items-end gap-3">
          {filtrosUi && (
            <div className="flex flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:[&>*]:w-full">
              {filtrosUi}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              role="tablist"
              aria-label="Visão da agenda"
              className="inline-flex gap-0.5 rounded-md bg-[#e3e7ee] p-1 dark:bg-hover"
            >
              {VISTAS.filter(([v]) => v !== 'kanban' || !soAluno).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={vista === v}
                  onClick={() => vai({ vista: v === 'mensal' ? undefined : v })}
                  className={cn(
                    'h-8 cursor-pointer rounded-sm px-3.5 text-texto-2 transition-colors hover:text-texto',
                    vista === v && 'bg-card font-semibold text-texto shadow-el-1',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            {vista !== 'kanban' && d?.podeCriarEvento && (
              <Button
                variant="primary"
                onClick={() => setEvento({ novo: vista === 'mensal' || !d ? (data ?? d?.hoje ?? '') : d.ref })}
              >
                <PlusIcon /> Novo evento
              </Button>
            )}
          </div>
        </div>
      </div>

      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      {q.isError && (
        <Aviso tom="red" icone="alerta">
          {q.error.message}
        </Aviso>
      )}
      {!d && q.isPending && <p className="text-apagado">Carregando a agenda…</p>}

      {d && (
        <div className={cn('transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching}>
          {vista === 'kanban' ? (
            <>
              <Card className="mb-4 overflow-hidden">{barra}</Card>
              <Kanban d={d} abre={abre} />
            </>
          ) : (
            <Card className="overflow-hidden">
              {barra}
              {d.vazio ? (
                <div className="px-5 py-10 text-center text-apagado">{d.vazio}</div>
              ) : vista === 'mensal' ? (
                <Mensal d={d} abre={abre} />
              ) : vista === 'semanal' ? (
                <Semanal d={d} abre={abre} />
              ) : (
                <Diaria d={d} abre={abre} />
              )}
            </Card>
          )}
          {vista === 'diaria' && !soAluno && d.podeMassa && (d.aulas?.length ?? 0) > 0 && (
            <ListaDia key={d.ref} aulas={d.aulas!} data={d.ref} aoDetalhe={setAula} aoMassa={setMassa} aoMsg={setMsg} />
          )}
        </div>
      )}

      <AulaDialog k={aula} aoFechar={() => setAula(null)} />
      <EventoDialog
        abre={evento}
        aoFechar={() => setEvento(null)}
        eu={me.data && !ehAluno ? me.data.usuario.nome : null}
        euProfessor={me.data?.usuario.tipoPerfil === 'Prestador'}
        aoSalvo={(iso) => {
          if (d && iso !== d.ref) vai({ data: iso });
        }}
      />
      <MassaDialog
        ks={massa}
        aoFechar={() => setMassa(null)}
        aoOk={(t) => {
          setMassa(null);
          setMsg({ txt: t });
        }}
      />
    </>
  );
}
