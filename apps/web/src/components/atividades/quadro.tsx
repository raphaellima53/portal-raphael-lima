'use client';

import { AlertTriangleIcon, CalendarIcon, PlusIcon, RepeatIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Busca, normaliza } from '@/components/acoes/alocacao';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CADENCIA_ROT, type Cartao, PRI_TOM, useAtvAcao, useAtvOpcoes, useQuadro } from '@/lib/atividades';
import { cn } from '@/lib/utils';
import { DialogoAtividade } from './dialogo';

const PRAZOS = ['Atrasadas', 'Hoje', 'Próximos 7 dias', 'Próximos 30 dias', 'Sem prazo'];
const ORIGENS = [
  { v: 'recorrente', l: 'Recorrentes do catálogo' },
  { v: 'eventual', l: 'Eventuais do catálogo' },
  { v: 'projeto', l: 'Projetos do catálogo' },
  { v: 'avulsa', l: 'Avulsas (fora do catálogo)' },
];
const SEM = '__sem__';
const F0 = { setor: '', tipo: '', resp: '', pri: '', prazo: '', rel: '', origem: '', atalho: '' };

/** atalhos e filtros do quadro: tudo junto, para os contadores dos atalhos saírem dos outros filtros */
function filtra(ls: Cartao[], f: typeof F0, busca: string, eu: string, semAtalho = false) {
  const agora = new Date();
  const d0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const ate = (n: number) => new Date(+d0 + (n + 1) * 864e5);
  return ls.filter((x) => {
    const p = x.prazo ? new Date(x.prazo) : null;
    const cad = x.modelo?.cadencia;
    return (
      (!f.setor || x.setor === f.setor) &&
      (!f.tipo || x.tipo === f.tipo) &&
      (!f.resp || (f.resp === SEM ? !x.responsavel : x.responsavel === f.resp)) &&
      (!f.pri || x.prioridade === f.pri) &&
      (!f.rel || (f.rel === SEM ? !x.rel : x.rel?.tipo === f.rel)) &&
      (!f.origem ||
        (f.origem === 'avulsa'
          ? !x.modelo
          : f.origem === 'recorrente'
            ? !!cad && cad !== 'eventual' && cad !== 'projeto'
            : cad === f.origem)) &&
      (!f.prazo ||
        (f.prazo === 'Atrasadas'
          ? x.atrasada
          : f.prazo === 'Sem prazo'
            ? !p
            : !!p && p >= d0 && p < ate(f.prazo === 'Hoje' ? 0 : f.prazo === 'Próximos 7 dias' ? 7 : 30))) &&
      (semAtalho ||
        !f.atalho ||
        (f.atalho === 'minhas' ? x.responsavel === eu : f.atalho === 'sem' ? !x.responsavel : x.atrasada)) &&
      (!busca ||
        normaliza([x.titulo, x.setor, x.tipo, x.responsavel, x.rel?.nome, x.descricao].join(' ')).includes(
          normaliza(busca),
        ))
    );
  });
}

/**
 * Atividades › Comercial e Operações (rascunho "D - Atividades (Cartões)"): o quadro A fazer · Em andamento · Concluída,
 * com pesquisa, atalhos (Abertas, Minhas, Sem responsável, Atrasadas) e os filtros em linha.
 */
export function TelaQuadro({ frente, abas }: { frente: 'Comercial' | 'Operações'; abas: React.ReactNode }) {
  const q = useQuadro(frente);
  const op = useAtvOpcoes();
  const acao = useAtvAcao();
  const [busca, setBusca] = useState('');
  const [f, setF] = useState(F0);
  const [mais, setMais] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [aberto, setAberto] = useState<{ id: number | null } | null>(null);
  const d = q.data;
  const o = op.data;
  const eu = o?.eu ?? '';
  const base = d?.itens ?? [];
  const ls = filtra(base, f, busca, eu);
  const semAt = filtra(base, f, busca, eu, true).filter((x) => x.situacao !== 'concluida');
  const set = (k: keyof typeof F0) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const filtrado = busca || Object.values(f).some(Boolean);
  const resps = [...new Set(base.map((x) => x.responsavel).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  const mover = (c: Cartao, situacao: string) =>
    acao.mutate(
      { caminho: `/${c.id}/situacao`, json: { situacao } },
      { onSuccess: (r) => setMsg({ txt: r.msg }), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );
  const chip = (v: string, rot: string, n: number) => {
    const on = f.atalho === v;
    return (
      <button
        key={v}
        type="button"
        aria-pressed={on}
        onClick={() => set('atalho')(v)}
        className={cn(
          'inline-flex h-9 items-center rounded-full border px-3.5 whitespace-nowrap transition-colors',
          on
            ? 'border-azul-linha bg-azul-suave font-semibold text-azul'
            : 'border-transparent text-apagado hover:bg-hover hover:text-texto',
        )}
      >
        {rot} · {n}
      </button>
    );
  };

  return (
    <>
      <PageHead
        titulo={frente === 'Comercial' ? 'Atividades comerciais' : 'Atividades de operações'}
        acoes={
          o?.podeOperar ? (
            <Button variant="primary" onClick={() => setAberto({ id: null })}>
              <PlusIcon /> Nova atividade
            </Button>
          ) : null
        }
      />
      {abas}
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Pesquisar atividade, pessoa ou responsável" valor={busca} aoMudar={setBusca} />
        <div role="group" aria-label="Atalhos" className="flex flex-wrap items-center gap-1">
          {chip('', 'Abertas', semAt.length)}
          {chip('minhas', 'Minhas', semAt.filter((x) => x.responsavel === eu).length)}
          {chip('sem', 'Sem responsável', semAt.filter((x) => !x.responsavel).length)}
          {chip('atrasadas', 'Atrasadas', semAt.filter((x) => x.atrasada).length)}
        </div>
      </div>
      <div role="group" aria-label="Filtros" className="mb-4 flex flex-wrap items-center gap-2">
        {(d?.setores.length ?? 0) > 1 && (
          <Escolha
            rotulo="Setor"
            todos="Todos os setores"
            valor={f.setor}
            aoMudar={set('setor')}
            opcoes={(d?.setores ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[190px]"
          />
        )}
        <Escolha
          rotulo="Tipo"
          todos="Todos os tipos"
          valor={f.tipo}
          aoMudar={set('tipo')}
          opcoes={(o?.tipos ?? []).map((x) => ({ v: x, l: x }))}
          className="w-[170px]"
        />
        <Escolha
          rotulo="Responsável"
          todos="Todos os responsáveis"
          valor={f.resp}
          aoMudar={set('resp')}
          opcoes={[{ v: SEM, l: 'Sem responsável' }, ...resps.map((x) => ({ v: x, l: x }))]}
          className="w-[220px]"
        />
        <Escolha
          rotulo="Prioridade"
          todos="Todas as prioridades"
          valor={f.pri}
          aoMudar={set('pri')}
          opcoes={(o?.prioridades ?? []).map((x) => ({ v: x, l: x }))}
          className="w-[190px]"
        />
        <Escolha
          rotulo="Prazo"
          todos="Qualquer prazo"
          valor={f.prazo}
          aoMudar={set('prazo')}
          opcoes={PRAZOS.map((x) => ({ v: x, l: x }))}
          className="w-[180px]"
        />
        <Escolha
          rotulo="Com quem"
          todos="Com qualquer um"
          valor={f.rel}
          aoMudar={set('rel')}
          opcoes={[...(o?.rels ?? []).map((r) => ({ v: r.k, l: r.t })), { v: SEM, l: 'Ninguém' }]}
          className="w-[180px]"
        />
        <Escolha
          rotulo="Origem"
          todos="Qualquer origem"
          valor={f.origem}
          aoMudar={set('origem')}
          opcoes={ORIGENS}
          className="w-[220px]"
        />
        {filtrado && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setF(F0);
              setBusca('');
            }}
          >
            <XIcon /> Limpar filtros
          </Button>
        )}
      </div>
      {d && !ls.length && <Aviso icone="info">Nenhuma atividade com esses filtros.</Aviso>}
      <div className="grid auto-cols-[minmax(270px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {(o?.situacoes ?? []).map((s) => {
          let cs = ls.filter((x) => x.situacao === s.k);
          cs =
            s.k === 'concluida'
              ? cs.sort((a, b) =>
                  (b.concluida ?? '')
                    .split('/')
                    .reverse()
                    .join()
                    .localeCompare((a.concluida ?? '').split('/').reverse().join()),
                )
              : cs.sort((a, b) => (a.prazo ?? '9').localeCompare(b.prazo ?? '9'));
          const lim = mais[s.k] ? cs.length : 10;
          return (
            <section
              key={s.k}
              aria-label={s.t}
              className="flex min-h-[220px] flex-col gap-2 rounded-lg border border-borda bg-bg p-2.5"
            >
              <div className="flex items-center gap-2 px-1">
                <i className="size-2.5 rounded-full" style={{ background: s.cor }} aria-hidden />
                <b className="text-texto">{s.t}</b>
                <span className="ml-auto rounded-full border border-borda bg-card px-2 tabular-nums text-apagado">
                  {cs.length}
                </span>
              </div>
              {s.k === 'concluida' && <p className="m-0 px-1 text-apagado">nos últimos 30 dias</p>}
              {cs.length ? (
                cs
                  .slice(0, lim)
                  .map((c) => (
                    <CartaoAtv
                      key={c.id}
                      c={c}
                      podeOperar={!!o?.podeOperar}
                      ocupado={acao.isPending}
                      abrir={() => setAberto({ id: c.id })}
                      mover={mover}
                    />
                  ))
              ) : (
                <p className="py-4 text-center text-apagado-2">nenhuma atividade</p>
              )}
              {cs.length > lim && (
                <Button variant="ghost" size="sm" onClick={() => setMais((x) => ({ ...x, [s.k]: true }))}>
                  mostrar mais {cs.length - lim}
                </Button>
              )}
            </section>
          );
        })}
      </div>
      {o && (
        <DialogoAtividade
          op={o}
          aberto={!!aberto}
          id={aberto?.id ?? null}
          frente={frente}
          aoFechar={() => setAberto(null)}
          aoSalvo={(txt, fr) => setMsg({ txt: fr && fr !== frente ? `${txt} Ela está no quadro de ${fr}.` : txt })}
        />
      )}
    </>
  );
}

function CartaoAtv({
  c,
  podeOperar,
  ocupado,
  abrir,
  mover,
}: {
  c: Cartao;
  podeOperar: boolean;
  ocupado: boolean;
  abrir: () => void;
  mover: (c: Cartao, s: string) => void;
}) {
  const prox =
    c.situacao === 'afazer'
      ? ['andamento', 'Iniciar']
      : c.situacao === 'andamento'
        ? ['concluida', 'Concluir']
        : ['afazer', 'Reabrir'];
  const recorrente = c.modelo && c.modelo.cadencia !== 'eventual' && c.modelo.cadencia !== 'projeto';
  return (
    <article className="flex flex-col gap-1.5 rounded-md border border-borda bg-card p-3 shadow-el-1 transition-shadow hover:shadow-el-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tom="blue">{c.setor}</Badge>
        <Badge tom={PRI_TOM[c.prioridade] ?? 'gray'}>{c.prioridade}</Badge>
        {recorrente && (
          <Badge tom="gray">
            <RepeatIcon className="size-3.5" aria-hidden />
            {CADENCIA_ROT[c.modelo!.cadencia]}
          </Badge>
        )}
      </div>
      <button
        type="button"
        onClick={abrir}
        className="text-left font-semibold text-texto hover:text-azul hover:underline"
      >
        {c.titulo}
      </button>
      {c.rel && (
        <span className="text-texto-2">
          {c.rel.rot}:{' '}
          {c.rel.href ? (
            <Link href={c.rel.href} className="text-azul hover:underline">
              {c.rel.nome}
            </Link>
          ) : (
            c.rel.nome
          )}
        </span>
      )}
      <span className="text-apagado">
        {c.tipo} · {c.responsavel || 'sem responsável'}
      </span>
      <span className={cn('flex items-center gap-1.5', c.atrasada ? 'font-semibold text-vermelho' : 'text-apagado')}>
        {c.atrasada ? (
          <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
        ) : (
          <CalendarIcon className="size-4 shrink-0" aria-hidden />
        )}
        {c.situacao === 'concluida' && c.concluida ? `concluída em ${c.concluida}` : c.prazoTxt}
      </span>
      {podeOperar && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={prox[0] === 'concluida' ? 'primary' : 'default'}
            disabled={ocupado}
            onClick={() => mover(c, prox[0])}
          >
            {prox[1]}
          </Button>
          <Button size="sm" variant="ghost" onClick={abrir}>
            Detalhes
          </Button>
        </div>
      )}
    </article>
  );
}
