'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeftIcon, PencilIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Segmento } from '@/components/alunos/abas-aluno';
import { CampoData } from '@/components/campos-data';
import { AvisoMsg, Busca, Campo, ErroQ, type Msg, normaliza, Vazio } from '@/components/config/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { Excluir } from '@/components/excluir';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { api } from '@/lib/api';

/*
 * Produtos e serviços › Materiais › Ciclos de aprendizagem (02/10/2026): o ciclo vale para um módulo ou turma e
 * define o conteúdo de cada data. Definição (início, Período ou Número de conteúdos, conteúdos por semana,
 * Repetição ou Livre) → Gerar datas → validação: cada data com o conteúdo, editável; ao trocar, Replicar nas
 * datas seguintes ou Manter só nesta data.
 */

type Linha = {
  id: number;
  nome: string;
  cursoId: number;
  curso: string;
  item: string;
  inicio: string;
  fim: string;
  datas: number;
  conteudos: number;
  porSemana: number;
  distribuicao: string;
  ativo: boolean;
  completo: boolean;
};
type Opcoes = {
  cursos: {
    id: number;
    nome: string;
    itens: { nome: string; dias: string[]; curriculo: { id: string; nome: string; conteudos: string[] } | null }[];
  }[];
};
type Def = {
  cursoId: number | null;
  item: string;
  inicio: string;
  modo: 'periodo' | 'quantidade';
  fim: string;
  quantidade: string;
  porSemana: string;
  distribuicao: 'repeticao' | 'livre';
};
type DataC = { data: string; s: number; i: number; ajustada?: boolean };

const BASE = '/produtos/ciclos';
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dataBr = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${DIAS[d.getDay()]}., ${d.toLocaleDateString('pt-BR')}`;
};

/**
 * a tela: lista em /produtos/ciclos; Novo e Editar em /produtos/ciclos/novo e /produtos/ciclos/<id>. Desde 02/10/2026
 * ela abre pelo botão Ciclos de aprendizagem da edição do módulo ou da turma, com ?curso=<id>&item=<nome>: a lista
 * mostra os ciclos daquele item e o Novo ciclo já vem com o curso e o item.
 */
export function TelaCiclos({ abas }: { abas?: React.ReactNode }) {
  return (
    <Suspense>
      <Tela abas={abas} />
    </Suspense>
  );
}
type Filtro = { cursoId: number; item: string } | null;
function Tela({ abas }: { abas?: React.ReactNode }) {
  const id = usePathname().split('/')[3];
  const sp = useSearchParams();
  const filtro: Filtro =
    sp.get('curso') && sp.get('item') ? { cursoId: Number(sp.get('curso')), item: sp.get('item')! } : null;
  const qs = filtro ? `?curso=${filtro.cursoId}&item=${encodeURIComponent(filtro.item)}` : '';
  return id ? (
    <EditorCiclo id={id === 'novo' ? null : Number(id)} filtro={filtro} qs={qs} />
  ) : (
    <ListaCiclos abas={abas} filtro={filtro} qs={qs} />
  );
}

function ListaCiclos({ abas, filtro, qs }: { abas?: React.ReactNode; filtro: Filtro; qs: string }) {
  const q = useQuery({
    queryKey: ['ciclos'],
    queryFn: () => api<{ linhas: Linha[]; pode: { criar: boolean } }>('/ciclos'),
  });
  const [busca, setBusca] = useState('');
  const [curso, setCurso] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const qc = useQueryClient();
  const ls = useMemo(() => {
    const b = normaliza(busca.trim());
    return (q.data?.linhas ?? []).filter(
      (l) =>
        (!filtro || (l.cursoId === filtro.cursoId && l.item === filtro.item)) &&
        (!curso || l.curso === curso) &&
        (!b || normaliza(`${l.nome} ${l.curso} ${l.item}`).includes(b)),
    );
  }, [q.data, busca, curso, filtro]);
  const { fatia, rodape } = usePaginacao(ls);
  const cursos = [...new Set((q.data?.linhas ?? []).map((l) => l.curso))].map((v) => ({ v, l: v }));
  return (
    <>
      <PageHead
        titulo={filtro ? `Ciclos de aprendizagem · ${filtro.item}` : 'Ciclos de aprendizagem'}
        acoes={
          <>
            {filtro && (
              <Button asChild>
                <Link href={`/cursos/${filtro.cursoId}/modulos`}>
                  <ChevronLeftIcon /> Voltar ao curso
                </Link>
              </Button>
            )}
            {q.data?.pode.criar && (
              <Button asChild variant="primary">
                <Link href={`${BASE}/novo${qs}`}>
                  <PlusIcon /> Novo ciclo
                </Link>
              </Button>
            )}
          </>
        }
      />
      {abas}
      <p className="mb-3 text-texto-2">
        {filtro
          ? `Os ciclos de ${filtro.item}: qual conteúdo do currículo cai em cada data de aula.`
          : 'O ciclo vale para um módulo ou turma e define qual conteúdo do currículo cai em cada data de aula. Crie e edite pela edição do módulo ou da turma, no curso.'}
      </p>
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar ciclo" valor={busca} aoMudar={setBusca} />
        {!filtro && (
          <Escolha
            rotulo="Curso"
            todos="Curso: todos"
            valor={curso}
            aoMudar={setCurso}
            opcoes={cursos}
            className="w-[240px]"
          />
        )}
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Nome</Th>
              <Th>Curso</Th>
              <Th>Módulo ou turma</Th>
              <Th>Período</Th>
              <Th className="text-right">Conteúdos</Th>
              <Th className="text-right">Por semana</Th>
              <Th>Distribuição</Th>
              <Th>Ativo</Th>
              <Th>Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((l) => (
                <Tr key={l.id}>
                  <Td className="font-medium">
                    <Link href={`${BASE}/${l.id}${qs}`} className="text-azul hover:underline">
                      {l.nome}
                    </Link>
                    {!l.completo && <div className="text-ambar">sem módulo ou datas — abra para completar</div>}
                  </Td>
                  <Td>{l.curso}</Td>
                  <Td>{l.item}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {l.inicio} a {l.fim}
                  </Td>
                  <Td className="text-right tabular-nums">{l.conteudos}</Td>
                  <Td className="text-right tabular-nums">{l.porSemana}</Td>
                  <Td>{l.distribuicao}</Td>
                  <Td>
                    <Badge tom={l.ativo ? 'green' : 'gray'}>{l.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Button asChild variant="ghost" size="icon-sm" aria-label={`Editar ${l.nome}`}>
                      <Link href={`${BASE}/${l.id}${qs}`}>
                        <PencilIcon />
                      </Link>
                    </Button>
                    <Excluir
                      tipo="cicloAprendizagem"
                      id={l.id}
                      nome={l.nome}
                      icone
                      aoExcluido={(txt) => {
                        setMsg({ txt });
                        qc.invalidateQueries({ queryKey: ['ciclos'] });
                      }}
                    />
                  </Td>
                </Tr>
              ))
            ) : (
              <Vazio cols={9} txt={q.data?.linhas.length ? 'nenhum ciclo com esses filtros' : 'nenhum ciclo ainda'} />
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
    </>
  );
}

const DEF0: Def = {
  cursoId: null,
  item: '',
  inicio: '',
  modo: 'periodo',
  fim: '',
  quantidade: '',
  porSemana: '2',
  distribuicao: 'repeticao',
};

function EditorCiclo({ id, filtro, qs }: { id: number | null; filtro: Filtro; qs: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const op = useQuery({ queryKey: ['ciclos-opcoes'], queryFn: () => api<Opcoes>('/ciclos-opcoes') });
  const atual = useQuery({
    queryKey: ['ciclo', id],
    queryFn: () =>
      api<{ nome: string; ativo: boolean; def: Def & { quantidade: number | null; cursoId: number }; datas: DataC[] }>(
        `/ciclos/${id}`,
      ),
    enabled: id != null,
    gcTime: 0,
  });
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [def, setDef] = useState<Def>(
    id == null && filtro ? { ...DEF0, cursoId: filtro.cursoId, item: filtro.item } : DEF0,
  );
  const [datas, setDatas] = useState<DataC[] | null>(null);
  /** a última troca feita na validação, para Replicar ou Manter */
  const [troca, setTroca] = useState<{ k: number; antes: number } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const a = atual.data;
    if (!a) return;
    setNome(a.nome);
    setAtivo(a.ativo);
    setDef({
      ...DEF0,
      ...a.def,
      modo: a.def.modo === 'quantidade' ? 'quantidade' : 'periodo',
      distribuicao: a.def.distribuicao === 'livre' ? 'livre' : 'repeticao',
      quantidade: a.def.quantidade ? String(a.def.quantidade) : '',
      porSemana: String(a.def.porSemana),
    });
    setDatas(a.datas.length ? a.datas : null);
  }, [atual.data]);

  const curso = op.data?.cursos.find((c) => c.id === def.cursoId);
  const item = curso?.itens.find((i) => i.nome === def.item);
  const conteudos = item?.curriculo?.conteudos ?? [];
  const muda = (p: Partial<Def>) => {
    setDef((d) => ({ ...d, ...p }));
    /* mudou a definição: as datas geradas não valem mais */
    if (datas) {
      setDatas(null);
      setTroca(null);
      setMsg({ txt: 'A definição mudou: gere as datas de novo.' });
    }
  };
  const corpoDef = () => ({
    ...def,
    quantidade: def.quantidade ? Number(def.quantidade) : null,
    porSemana: Number(def.porSemana),
  });

  const gera = async () => {
    setOcupado(true);
    setMsg(null);
    setTroca(null);
    try {
      const r = await api<{ datas: DataC[] }>('/ciclos/previa', { method: 'POST', json: corpoDef() });
      setDatas(r.datas);
    } catch (e) {
      setMsg({ txt: (e as Error).message, erro: true });
    } finally {
      setOcupado(false);
    }
  };
  const salva = async () => {
    if (!datas) return;
    setOcupado(true);
    setMsg(null);
    try {
      await api(id ? `/ciclos/${id}` : '/ciclos', {
        method: id ? 'PUT' : 'POST',
        json: { nome, ativo, def: corpoDef(), datas: datas.map(({ data, s, i }) => ({ data, s, i })) },
      });
      qc.invalidateQueries();
      router.push(`${BASE}${qs}`);
    } catch (e) {
      setMsg({ txt: (e as Error).message, erro: true });
    } finally {
      setOcupado(false);
    }
  };

  /** troca o conteúdo de uma data (só ela, por enquanto) e oferece Replicar */
  const trocaConteudo = (k: number, i: number) => {
    if (!datas) return;
    setTroca({ k, antes: datas[k].i });
    setDatas(datas.map((d, j) => (j === k ? { ...d, i, ajustada: true } : d)));
  };
  /** leva a troca às datas seguintes: cada uma anda na sequência a partir do conteúdo escolhido */
  const replica = () => {
    if (!datas || !troca) return;
    const n = conteudos.length;
    const base = datas[troca.k];
    setDatas(
      datas.map((d, j) => (j > troca.k ? { ...d, i: (((base.i + d.s - base.s) % n) + n) % n, ajustada: true } : d)),
    );
    setTroca(null);
  };

  const pag = usePaginacao(datas ?? [], 25);
  if (id != null && atual.isError) return <ErroQ e={atual.error} />;
  if (id != null && !atual.data) return <p className="text-apagado">Carregando…</p>;

  return (
    <>
      <PageHead
        titulo={id ? `Ciclo ${nome}` : 'Novo ciclo'}
        acoes={
          <Button asChild>
            <Link href={`${BASE}${qs}`}>
              <ChevronLeftIcon /> Ciclos
            </Link>
          </Button>
        }
      />
      <AvisoMsg msg={msg} />
      <ErroQ e={op.error} />

      <Card className="mb-5">
        <CardHead>
          <CardTitle>1 · Definição</CardTitle>
        </CardHead>
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
          <Campo id="cic-nome" rotulo="Nome" req>
            <Input id="cic-nome" value={nome} maxLength={160} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo rotulo="Curso" req>
            <Escolha
              rotulo="Curso"
              destacar={false}
              valor={def.cursoId ? String(def.cursoId) : ''}
              aoMudar={(v) => muda({ cursoId: v ? Number(v) : null, item: '' })}
              opcoes={(op.data?.cursos ?? []).map((c) => ({ v: String(c.id), l: c.nome }))}
            />
          </Campo>
          <Campo
            rotulo="Módulo ou turma"
            req
            ajuda={
              item
                ? `${item.dias.length ? `aulas: ${item.dias.join(', ')}` : 'sem dias de aula na grade'} · ${
                    item.curriculo
                      ? `${item.curriculo.nome} (${item.curriculo.conteudos.length} conteúdos)`
                      : 'sem currículo publicado'
                  }`
                : undefined
            }
          >
            <Escolha
              rotulo="Módulo ou turma"
              destacar={false}
              disabled={!curso}
              valor={def.item}
              aoMudar={(v) => muda({ item: v })}
              opcoes={(curso?.itens ?? []).map((i) => ({ v: i.nome, l: i.nome }))}
            />
          </Campo>
          <Campo id="cic-inicio" rotulo="Data de início" req>
            <CampoData
              id="cic-inicio"
              rotulo="Data de início"
              valor={def.inicio}
              aoMudar={(v) => muda({ inicio: v })}
            />
          </Campo>
          <Campo rotulo="Duração" req>
            <Segmento
              rotulo="Duração"
              valor={def.modo}
              aoMudar={(v) => muda({ modo: v === 'quantidade' ? 'quantidade' : 'periodo' })}
              opcoes={[
                ['periodo', 'Período'],
                ['quantidade', 'Número de conteúdos'],
              ]}
            />
          </Campo>
          {def.modo === 'periodo' ? (
            <Campo id="cic-fim" rotulo="Data de fim" req>
              <CampoData id="cic-fim" rotulo="Data de fim" valor={def.fim} aoMudar={(v) => muda({ fim: v })} />
            </Campo>
          ) : (
            <Campo id="cic-qtd" rotulo="Quantos conteúdos o ciclo terá" req>
              <Input
                id="cic-qtd"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={def.quantidade}
                onChange={(e) => muda({ quantidade: e.target.value })}
              />
            </Campo>
          )}
          <Campo id="cic-sem" rotulo="Conteúdos por semana" req>
            <Input
              id="cic-sem"
              type="number"
              inputMode="numeric"
              min={1}
              max={7}
              value={def.porSemana}
              onChange={(e) => muda({ porSemana: e.target.value })}
            />
          </Campo>
          <Campo
            rotulo="Distribuição"
            req
            className="md:col-span-2"
            ajuda={
              def.distribuicao === 'repeticao'
                ? 'o conteúdo se repete em dias seguidos — 2 por semana, seg a sáb: seg, ter e qua = conteúdo 1 · qui, sex e sáb = conteúdo 2'
                : 'os conteúdos da semana se intercalam — 2 por semana: seg = 1, ter = 2, qua = 1, qui = 2…; ajuste dia a dia na validação'
            }
          >
            <Segmento
              rotulo="Distribuição"
              valor={def.distribuicao}
              aoMudar={(v) => muda({ distribuicao: v === 'livre' ? 'livre' : 'repeticao' })}
              opcoes={[
                ['repeticao', 'Com repetição'],
                ['livre', 'Livre'],
              ]}
            />
          </Campo>
          <Campo id="cic-ativo" rotulo="Ativo">
            <Switch id="cic-ativo" checked={ativo} onCheckedChange={setAtivo} />
          </Campo>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-borda-suave px-5 py-4">
          <Button variant="primary" onClick={gera} disabled={ocupado || !def.cursoId || !def.item || !def.inicio}>
            <RefreshCwIcon /> {datas ? 'Gerar datas de novo' : 'Gerar datas'}
          </Button>
          {datas && <span className="text-apagado">gerar de novo desfaz os ajustes da validação</span>}
        </div>
      </Card>

      {datas && (
        <Card className="overflow-hidden">
          <CardHead className="flex-wrap">
            <CardTitle>2 · Validação</CardTitle>
            <span className="text-apagado-2">
              {datas.length} datas · {new Set(datas.map((d) => d.s)).size} conteúdos · de {dataBr(datas[0].data)} a{' '}
              {dataBr(datas[datas.length - 1].data)}
            </span>
          </CardHead>
          {troca && (
            <div className="px-5 pb-3">
              <Aviso tom="blue" icone="info">
                <span className="flex flex-wrap items-center gap-3">
                  <span>
                    {dataBr(datas[troca.k].data)} passou para{' '}
                    <b>
                      {datas[troca.k].i + 1}. {conteudos[datas[troca.k].i]}
                    </b>
                    .
                  </span>
                  <Button size="sm" variant="primary" onClick={replica}>
                    Replicar nas datas seguintes
                  </Button>
                  <Button size="sm" onClick={() => setTroca(null)}>
                    Manter só nesta data
                  </Button>
                </span>
              </Aviso>
            </div>
          )}
          <Table>
            <THead>
              <Tr>
                <Th>Data</Th>
                <Th>Conteúdo</Th>
                <Th>Situação</Th>
              </Tr>
            </THead>
            <TBody>
              {pag.fatia.map((d) => {
                const k = datas.indexOf(d);
                return (
                  <Tr key={d.data}>
                    <Td className="whitespace-nowrap tabular-nums">{dataBr(d.data)}</Td>
                    <Td className="min-w-[280px]">
                      <Escolha
                        rotulo={`Conteúdo de ${dataBr(d.data)}`}
                        destacar={false}
                        valor={String(d.i)}
                        aoMudar={(v) => v && trocaConteudo(k, Number(v))}
                        opcoes={conteudos.map((t, i) => ({ v: String(i), l: `${i + 1}. ${t}` }))}
                      />
                    </Td>
                    <Td>
                      {d.ajustada ? <Badge tom="amber">ajustada</Badge> : <span className="text-apagado">gerada</span>}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
          {pag.rodape}
          <div className="flex flex-wrap justify-end gap-2 border-t border-borda-suave px-5 py-4">
            <Button asChild>
              <Link href={`${BASE}${qs}`}>Cancelar</Link>
            </Button>
            <Button variant="primary" onClick={salva} disabled={ocupado || !nome.trim()}>
              {ocupado ? 'Salvando…' : 'Salvar ciclo'}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
