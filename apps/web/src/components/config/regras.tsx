'use client';

import { BookOpenIcon, ChevronRightIcon, DownloadIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Segmento } from '@/components/alunos/abas-aluno';
import { CampoData, CampoHora } from '@/components/campos-data';
import { CurriculoFormDialog } from '@/components/cursos/curriculo-forms';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import {
  type Curriculos,
  type Dias,
  type Feriados,
  type Politicas,
  type Salas,
  useAcaoCfg,
  useCfg,
} from '@/lib/config';
import { corLegivel } from '@/lib/cor';
import { cn } from '@/lib/utils';
import {
  AvisoMsg,
  Barra,
  Busca,
  Campo,
  Chave,
  ErroQ,
  FormDialog,
  JustificativaDialog,
  type Msg,
  normaliza,
  Vazio,
} from './comum';
import { Novo, StatusBadge } from './pessoas';
import { Secao } from './usuario-form';

/** salvar com justificativa: conta o que mudou e só pede a justificativa se algo mudou (cfgSalvarPede) */
function useSalvarRegra(caminho: string, aoSalvo: () => void) {
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(null);
  const [pede, setPede] = useState(0);
  const [erro, setErro] = useState('');
  const pedir = (muda: number) => {
    if (!muda) return setMsg({ txt: 'Nada mudou desde o último salvamento.' });
    setErro('');
    setPede(muda);
  };
  const dialogo = (json: (just: string) => unknown) => (
    <JustificativaDialog
      key={pede}
      aberto={pede > 0}
      muda={pede}
      aoFechar={() => setPede(0)}
      erro={erro}
      ocupado={acao.isPending}
      aoSalvar={(just) =>
        acao.mutate(
          { caminho, method: 'PUT', json: json(just) },
          {
            onSuccess: (r) => {
              setPede(0);
              setMsg({ txt: r.msg });
              aoSalvo();
            },
            onError: (e) => setErro(e.message),
          },
        )
      }
    />
  );
  return { msg, setMsg, pedir, dialogo };
}

/* ================= Condições e vigência ================= */
export function TelaPoliticas({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Politicas>('/politicas');
  const d = q.data;
  const [v, setV] = useState<Record<string, string | boolean>>({});
  useEffect(() => {
    if (d) setV(d.valores);
  }, [d]);
  const muda = d ? Object.keys(d.valores).filter((k) => v[k] !== d.valores[k]).length : 0;
  const s = useSalvarRegra('/politicas', () => {});
  const acoes = (
    <>
      <Button
        onClick={() => {
          if (d) setV(d.valores);
          s.setMsg({ txt: 'Alterações descartadas: voltou ao último salvamento.' });
        }}
      >
        Descartar
      </Button>
      <Button variant="primary" onClick={() => s.pedir(muda)}>
        Salvar políticas
      </Button>
    </>
  );
  return (
    <>
      <PageHead titulo="Políticas de crédito e renovação" acoes={acoes} />
      {abas}
      <AvisoMsg msg={s.msg} />
      <ErroQ e={q.error} />
      {d?.secoes.map((sec) => (
        <Secao key={sec.n} n={sec.n} t={sec.t} d={sec.d}>
          {sec.campos[0]?.tipo === 'chave' ? (
            <div className="grid gap-2">
              {sec.campos.map((c) =>
                c.tipo === 'chave' ? (
                  <div key={c.k} className="flex items-center gap-4 rounded-lg border border-borda-suave px-4 py-3">
                    <div className="flex-1">
                      <div className="font-semibold text-texto">{c.t}</div>
                      <div className="text-apagado">{c.d}</div>
                    </div>
                    <Switch aria-label={c.t} checked={!!v[c.k]} onCheckedChange={(x) => setV({ ...v, [c.k]: x })} />
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sec.campos.map((c) =>
                c.tipo === 'texto' ? (
                  <Campo key={c.k} id={`pol-${c.k}`} rotulo={c.t} req={c.req}>
                    <Input
                      id={`pol-${c.k}`}
                      value={String(v[c.k] ?? '')}
                      onChange={(e) => setV({ ...v, [c.k]: e.target.value })}
                    />
                  </Campo>
                ) : c.tipo === 'radio' ? (
                  <div key={c.k} className="grid content-start gap-1.5">
                    <span className="text-sm font-semibold text-texto-2">{c.t}</span>
                    <div className="overflow-x-auto">
                      <Segmento
                        rotulo={c.t}
                        valor={String(v[c.k] ?? '')}
                        aoMudar={(x) => setV({ ...v, [c.k]: x })}
                        opcoes={c.ops.map((o) => [o, o])}
                      />
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </Secao>
      ))}
      {d && <div className="flex flex-wrap justify-end gap-2">{acoes}</div>}
      {s.dialogo((just) => ({ valores: v, just }))}
    </>
  );
}

/* ================= Dias e horários ================= */
export function TelaDias({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Dias>('/dias');
  const d = q.data;
  const [ls, setLs] = useState<Dias['linhas']>([]);
  useEffect(() => {
    if (d) setLs(d.linhas);
  }, [d]);
  const muda = d
    ? ls.reduce((n, l, i) => {
        const a = d.linhas[i];
        return a ? n + Number(a.aberto !== l.aberto) + Number(a.inicio !== l.inicio) + Number(a.fim !== l.fim) : n;
      }, 0)
    : 0;
  const s = useSalvarRegra('/dias', () => {});
  const muda1 = (i: number, x: Partial<Dias['linhas'][number]>) =>
    setLs(ls.map((l, j) => (j === i ? { ...l, ...x } : l)));
  return (
    <>
      <PageHead
        titulo="Dias e horários de funcionamento"
        acoes={
          <>
            <Button
              onClick={() => {
                if (d) setLs(d.linhas);
                s.setMsg({ txt: 'Alterações descartadas: voltou ao último salvamento.' });
              }}
            >
              Descartar
            </Button>
            <Button variant="primary" onClick={() => s.pedir(muda)}>
              Salvar
            </Button>
          </>
        }
      />
      {abas}
      <AvisoMsg msg={s.msg} />
      <ErroQ e={q.error} />
      {d && (
        <Card className="max-w-[640px] overflow-hidden">
          <ul>
            {ls.map((l, i) => (
              <li
                key={l.dia}
                className="flex flex-wrap items-center gap-3 border-b border-borda-suave px-5 py-3 last:border-b-0"
              >
                <Switch
                  aria-label={`${l.nome} aberto`}
                  checked={l.aberto}
                  onCheckedChange={(x) => muda1(i, { aberto: x })}
                />
                <span
                  className={cn(
                    'flex-1 font-semibold sm:w-[130px] sm:flex-none',
                    l.aberto ? 'text-texto' : 'text-apagado-2',
                  )}
                >
                  {l.nome}
                </span>
                {l.aberto ? (
                  <div className="flex items-center gap-3">
                    <div className="w-[96px]">
                      <CampoHora
                        rotulo={`${l.nome}: abre às`}
                        valor={l.inicio}
                        aoMudar={(x) => muda1(i, { inicio: x })}
                      />
                    </div>
                    <span className="text-apagado">às</span>
                    <div className="w-[96px]">
                      <CampoHora rotulo={`${l.nome}: fecha às`} valor={l.fim} aoMudar={(x) => muda1(i, { fim: x })} />
                    </div>
                  </div>
                ) : (
                  <span className="text-apagado-2">fechado</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {s.dialogo((just) => ({ linhas: ls, just }))}
    </>
  );
}

/* ================= Feriados e recessos ================= */
export function TelaFeriados({ abas }: { abas: React.ReactNode }) {
  const [ano, setAno] = useState('');
  const q = useCfg<Feriados>(`/feriados${ano ? `?ano=${ano}` : ''}`);
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(null);
  const [rec, setRec] = useState<{ nome: string; ini: string; fim: string } | null>(null);
  const [erro, setErro] = useState('');
  const d = q.data;
  const { fatia, rodape, setPag } = usePaginacao(d?.linhas ?? []);
  const faz = (caminho: string, method: 'POST' | 'DELETE', json?: unknown) =>
    acao.mutate(
      { caminho, method, json },
      {
        onSuccess: (r) => {
          setMsg({ txt: r.msg });
          setRec(null);
          if (r.ano) setAno(String(r.ano));
        },
        onError: (e) => (rec ? setErro(e.message) : setMsg({ txt: e.message, erro: true })),
      },
    );
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const importar = () => d && faz('/feriados/importar', 'POST', { ano: d.ano });
  return (
    <>
      <PageHead
        titulo="Feriados e recessos"
        acoes={
          <Novo
            rotulo="Novo recesso"
            aoClicar={() => {
              setErro('');
              setRec({ nome: '', ini: iso, fim: iso });
            }}
          />
        }
      />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          {!d.nacionais && (
            <Aviso tom="amber" icone="alerta">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex-1">
                  Os feriados nacionais de {d.ano} ainda não foram importados: a agenda gera aula nesses dias.
                </span>
                <Button size="sm" disabled={acao.isPending} onClick={importar}>
                  Importar
                </Button>
              </div>
            </Aviso>
          )}
          <Barra>
            <Escolha
              rotulo="Ano"
              destacar={false}
              valor={String(d.ano)}
              aoMudar={(v) => {
                setAno(v);
                setPag(1);
              }}
              opcoes={d.anos.map((a) => ({ v: a, l: a }))}
              className="w-[120px]"
            />
            <span className="flex-1" />
            <Button disabled={acao.isPending} onClick={importar}>
              <DownloadIcon /> Importar feriados nacionais de {d.ano}
            </Button>
          </Barra>
          <Card className="overflow-hidden">
            <Table aria-label={`Feriados e recessos de ${d.ano}`}>
              <THead>
                <Tr>
                  <Th>Data</Th>
                  <Th>Dia</Th>
                  <Th>Nome</Th>
                  <Th>Origem</Th>
                  <Th className="text-right">Ações</Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.map((f) => (
                    <Tr key={f.id}>
                      <Td className="font-medium text-texto tabular-nums">{f.data}</Td>
                      <Td>{f.dia}</Td>
                      <Td>{f.nome}</Td>
                      <Td>
                        <Badge tom={f.origem === 'Nacional' ? 'blue' : 'gray'}>{f.origem}</Badge>
                      </Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          aria-label={`Remover ${f.nome} de ${f.data}`}
                          disabled={acao.isPending}
                          onClick={() => faz(`/feriados/${f.id}`, 'DELETE')}
                        >
                          Remover
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={5} txt={`nenhum feriado ou recesso em ${d.ano}`} />
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
        </>
      )}
      <FormDialog
        aberto={!!rec}
        aoFechar={() => setRec(null)}
        titulo="Novo recesso"
        descricao="dias em que a escola não dá aula — cada dia do intervalo entra na lista e as aulas desses dias saem da agenda"
        erro={erro}
        ocupado={acao.isPending}
        rotuloOk="Criar recesso"
        aoSalvar={() => rec && faz('/feriados/recesso', 'POST', rec)}
      >
        {rec && (
          <>
            <Campo id="rec-nome" rotulo="Nome" req className="sm:col-span-2">
              <Input
                id="rec-nome"
                autoFocus
                placeholder="Ex.: Recesso de fim de ano"
                value={rec.nome}
                onChange={(e) => setRec({ ...rec, nome: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Primeiro dia" req>
              <CampoData rotulo="Primeiro dia" valor={rec.ini} aoMudar={(x) => setRec({ ...rec, ini: x })} />
            </Campo>
            <Campo rotulo="Último dia" req>
              <CampoData rotulo="Último dia" valor={rec.fim} aoMudar={(x) => setRec({ ...rec, fim: x })} />
            </Campo>
          </>
        )}
      </FormDialog>
    </>
  );
}

/* ================= Salas ================= */
type SalaForm = { id: number | null; nome: string; tipo: string; atende: string; zoom: boolean; ativo: boolean };
export function TelaSalas({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Salas>('/salas');
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [sit, setSit] = useState('Ativas');
  const [form, setForm] = useState<SalaForm | null>(null);
  const [erro, setErro] = useState('');
  const d = q.data;
  const lista = useMemo(() => {
    const n = normaliza(busca);
    return (d?.linhas ?? []).filter(
      (s) =>
        (sit === 'Todas' || (sit === 'Ativas') === s.ativo) &&
        (!tipo || s.tipo === tipo) &&
        (!n || normaliza(`${s.nome} ${s.atende}`).includes(n)),
    );
  }, [d, busca, tipo, sit]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const abre = (s?: Salas['linhas'][number]) => {
    setErro('');
    setForm(s ? { ...s } : { id: null, nome: '', tipo: '', atende: '', zoom: false, ativo: true });
  };
  return (
    <>
      <PageHead titulo="Salas" acoes={<Novo rotulo="Nova sala" aoClicar={() => abre()} />} />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <Barra>
            <Busca
              rotulo="Buscar sala"
              valor={busca}
              aoMudar={(v) => {
                setBusca(v);
                setPag(1);
              }}
            />
            <span className="flex-1" />
            <Escolha
              rotulo="Tipo"
              todos="Todos os tipos"
              valor={tipo}
              aoMudar={(v) => {
                setTipo(v);
                setPag(1);
              }}
              opcoes={[...new Set(d.linhas.map((s) => s.tipo))].map((t) => ({ v: t, l: t }))}
              className="w-[210px]"
            />
            <Escolha
              rotulo="Status"
              destacar={sit !== 'Ativas'}
              valor={sit}
              aoMudar={(v) => {
                setSit(v);
                setPag(1);
              }}
              opcoes={['Ativas', 'Inativas', 'Todas'].map((s) => ({ v: s, l: s }))}
              className="w-[140px]"
            />
          </Barra>
          <Card className="overflow-hidden">
            <Table aria-label="Salas">
              <THead>
                <Tr>
                  <Th>Nome</Th>
                  <Th>Atende</Th>
                  <Th>Tipo</Th>
                  <Th className="text-center">Zoom</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.map((s) => (
                    <Tr key={s.id}>
                      <Td className="font-medium text-texto">{s.nome}</Td>
                      <Td>
                        {s.cor ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 font-medium"
                            style={{ background: `${corLegivel(s.cor)}1a`, color: corLegivel(s.cor) }}
                          >
                            {s.atende}
                          </span>
                        ) : (
                          <Badge>{s.atende}</Badge>
                        )}
                      </Td>
                      <Td>
                        <Badge>{s.tipo}</Badge>
                      </Td>
                      <Td className="text-center">
                        {s.zoom ? (
                          <span className="font-bold text-verde">
                            ✓<span className="sr-only">tem Zoom</span>
                          </span>
                        ) : (
                          <span className="text-apagado-2">
                            —<span className="sr-only">sem Zoom</span>
                          </span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge ativo={s.ativo} fem />
                      </Td>
                      <Td className="text-right">
                        <Button size="sm" aria-label={`Editar ${s.nome}`} onClick={() => abre(s)}>
                          Editar
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={6} txt="nenhuma sala com esses filtros" />
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
          <FormDialog
            aberto={!!form}
            aoFechar={() => setForm(null)}
            titulo={form?.id ? 'Editar sala' : 'Nova sala'}
            erro={erro}
            ocupado={acao.isPending}
            rotuloOk={form?.id ? 'Salvar' : 'Criar'}
            aoSalvar={() =>
              form &&
              acao.mutate(
                { caminho: form.id ? `/salas/${form.id}` : '/salas', method: form.id ? 'PUT' : 'POST', json: form },
                {
                  onSuccess: (r) => {
                    setForm(null);
                    setMsg({ txt: r.msg });
                  },
                  onError: (e) => setErro(e.message),
                },
              )
            }
          >
            {form && (
              <>
                <Campo id="sa-nome" rotulo="Nome" req className="sm:col-span-2">
                  <Input
                    id="sa-nome"
                    autoFocus
                    placeholder="Ex.: Zoom 05"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Tipo de sala">
                  <Escolha
                    rotulo="Tipo de sala"
                    todos="Selecione…"
                    destacar={false}
                    valor={form.tipo === '—' ? '' : form.tipo}
                    aoMudar={(v) => setForm({ ...form, tipo: v })}
                    opcoes={d.tipos.map((t) => ({ v: t, l: t }))}
                  />
                </Campo>
                <Campo rotulo="Atende">
                  <Escolha
                    rotulo="Atende"
                    todos="Selecione…"
                    destacar={false}
                    valor={form.atende === '—' ? '' : form.atende}
                    aoMudar={(v) => setForm({ ...form, atende: v })}
                    opcoes={d.alvos}
                  />
                </Campo>
                <Chave
                  id="sa-zoom"
                  className="sm:col-span-2"
                  on={form.zoom}
                  aoMudar={(v) => setForm({ ...form, zoom: v })}
                  rotulo="Tem link do Zoom"
                  ajuda="Sem link, a aula online entra como pendência na agenda."
                />
                <Chave
                  id="sa-ativo"
                  className="sm:col-span-2"
                  on={form.ativo}
                  aoMudar={(v) => setForm({ ...form, ativo: v })}
                  rotulo="Sala ativa"
                />
              </>
            )}
          </FormDialog>
        </>
      )}
    </>
  );
}

/* ================= Currículos e acervos ================= */
export function TelaCurriculos({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Curriculos>('/curriculos');
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [tipo, setTipo] = useState('');
  const [sit, setSit] = useState('');
  const [novo, setNovo] = useState<{ grupo: string } | null>(null);
  const d = q.data;
  const filtrado = !!(busca || grupo || sit);
  const cs = useMemo(() => {
    const n = normaliza(busca);
    return (d?.linhas ?? []).filter(
      (c) =>
        (!grupo || c.grupo === grupo) &&
        (!tipo || c.tipo === tipo) &&
        (!sit || (sit === 'Rascunho' ? !!c.rascunho : !!c.publicada)) &&
        (!n || normaliza(`${c.nome} ${c.grupo} ${c.aplicado}`).includes(n)),
    );
  }, [d, busca, grupo, tipo, sit]);
  const grupos = (t: string) => [...new Set(cs.filter((c) => c.tipo === t).map((c) => c.grupo))];
  const Grupo = ({ g, aberto }: { g: string; aberto: boolean }) => {
    const gs = cs.filter((c) => c.grupo === g);
    const prod = gs[0].tipo === 'produto';
    const sem = gs.reduce((s, c) => s + c.semLink, 0);
    const { fatia, rodape } = usePaginacao(gs);
    return (
      <details open={aberto} className="group mb-2 overflow-hidden rounded-lg border border-borda bg-card shadow-el-1">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2.5 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-4 text-apagado transition-transform group-open:rotate-90" aria-hidden />
          {gs[0].cor ? (
            <i className="size-2.5 rounded-full" style={{ background: gs[0].cor }} aria-hidden />
          ) : (
            <BookOpenIcon className="size-4 text-apagado" aria-hidden />
          )}
          <b className="text-texto">{g}</b>
          <span className="text-apagado">
            {gs.length} {gs.length === 1 ? 'currículo' : 'currículos'} · {gs.reduce((s, c) => s + c.conteudos, 0)}{' '}
            conteúdos
            {sem ? ` · ${sem} sem link de In-class` : ''}
          </span>
        </summary>
        <Table aria-label={`Currículos de ${g}`}>
          <THead>
            <Tr>
              <Th>Currículo</Th>
              <Th>{prod ? 'Aplicado em' : 'Uso'}</Th>
              <Th>Versão</Th>
              <Th className="text-right">Conteúdos</Th>
              <Th className="text-right">Sem link de In-class</Th>
              <Th>Publicado em</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium">
                  <Link href={`/cursos/curriculos/${c.id}`} className="text-azul hover:underline">
                    {c.nome}
                  </Link>
                </Td>
                <Td>{prod ? c.aplicado || '—' : 'o professor escolhe na aula'}</Td>
                <Td className="whitespace-nowrap">
                  <span className="flex flex-wrap gap-1">
                    {c.publicada && <Badge tom="green">{c.publicada} publicada</Badge>}
                    {c.rascunho && <Badge tom="amber">{c.rascunho} rascunho</Badge>}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{c.conteudos}</Td>
                <Td className="text-right tabular-nums">{c.semLink || '—'}</Td>
                <Td className="tabular-nums">{c.publicadaEm ?? '—'}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        {rodape}
      </details>
    );
  };
  const prods = grupos('produto');
  const acs = grupos('acervo');
  return (
    <>
      <PageHead
        titulo="Currículos e acervos"
        acoes={
          <Button variant="primary" onClick={() => setNovo({ grupo: '' })}>
            <PlusIcon /> Novo acervo
          </Button>
        }
      />
      {abas}
      <ErroQ e={q.error} />
      {d && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <Card className="px-5 py-4">
              <b className="text-texto">1 · Currículo de produto</b>
              <p className="mt-1 text-texto-2">
                Sequência de conteúdos de um módulo ou turma. A geração de aulas aplica um conteúdo por aula, na ordem,
                a partir da versão publicada. Crie pela aba Currículo do curso.
              </p>
            </Card>
            <Card className="px-5 py-4">
              <b className="text-texto">2 · Acervo de conteúdo</b>
              <p className="mt-1 text-texto-2">
                Biblioteca avulsa — Careers, Grammar Practice e Private for Business. Não entra na sequência: o
                professor escolhe o conteúdo ao montar a aula.
              </p>
            </Card>
          </div>
          <Barra>
            <Busca rotulo="Buscar currículo, produto ou módulo" valor={busca} aoMudar={setBusca} />
            <span className="flex-1" />
            <Escolha
              rotulo="Produto ou acervo"
              todos="Todos os produtos e acervos"
              valor={grupo}
              aoMudar={setGrupo}
              opcoes={[...new Set(d.linhas.map((c) => c.grupo))].map((g) => ({ v: g, l: g }))}
              className="w-[250px]"
            />
            <Escolha
              rotulo="Tipo"
              todos="Todos os tipos"
              valor={tipo}
              aoMudar={setTipo}
              opcoes={[
                { v: 'produto', l: 'De produto' },
                { v: 'acervo', l: 'Acervo' },
              ]}
              className="w-[170px]"
            />
            <Escolha
              rotulo="Situação"
              todos="Todas as situações"
              valor={sit}
              aoMudar={setSit}
              opcoes={[
                { v: 'Publicada', l: 'Com versão publicada' },
                { v: 'Rascunho', l: 'Com rascunho' },
              ]}
              className="w-[220px]"
            />
          </Barra>
          {(!tipo || tipo === 'produto') && (
            <section aria-labelledby="cur-prod" className="mb-5">
              <h2 id="cur-prod" className="mb-2 font-bold text-apagado">
                Currículos de produto
              </h2>
              {prods.length ? (
                prods.map((g, k) => <Grupo key={g} g={g} aberto={!k || filtrado} />)
              ) : (
                <Card className="px-5 py-4 text-apagado">nenhum currículo de produto neste filtro</Card>
              )}
            </section>
          )}
          {(!tipo || tipo === 'acervo') && (
            <section aria-labelledby="cur-ac">
              <h2 id="cur-ac" className="mb-2 font-bold text-apagado">
                Acervos de conteúdo
              </h2>
              {acs.length ? (
                acs.map((g) => <Grupo key={g} g={g} aberto={filtrado} />)
              ) : (
                <Card className="px-5 py-4 text-apagado">nenhum acervo neste filtro</Card>
              )}
            </section>
          )}
        </>
      )}
      <CurriculoFormDialog abre={novo} aoFechar={() => setNovo(null)} />
    </>
  );
}
