'use client';

import {
  AlertTriangleIcon,
  BellIcon,
  ClockIcon,
  DollarSignIcon,
  DownloadIcon,
  FileTextIcon,
  PlayIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CampoData } from '@/components/campos-data';
import { PageHead, Trilho } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type Alertas, type Execucoes, type Painel as PainelT, useAcaoCfg, useCfg } from '@/lib/config';
import { baixaCsv } from '@/lib/relatorios';
import type { Tom } from '@/lib/tipos';
import {
  AvisoMsg,
  Barra,
  Busca,
  Campo,
  ChipMulti,
  ErroQ,
  FormDialog,
  type Msg,
  normaliza,
  Painel,
  Stats,
  Vazio,
} from './comum';
import { Novo } from './pessoas';

const ICONES: Record<string, typeof BellIcon> = {
  relogio: ClockIcon,
  contrato: FileTextIcon,
  dinheiro: DollarSignIcon,
  alerta: AlertTriangleIcon,
};
const Linha = ({
  icone: I,
  t,
  d,
  children,
}: {
  icone: typeof BellIcon;
  t: string;
  d: string;
  children: React.ReactNode;
}) => (
  <Card className="mb-2 flex flex-wrap items-center gap-4 px-5 py-3.5">
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-azul-suave text-azul" aria-hidden>
      <I className="size-5" />
    </span>
    <div className="min-w-[200px] flex-1">
      <div className="font-semibold text-texto">{t}</div>
      <div className="text-apagado">{d}</div>
    </div>
    {children}
  </Card>
);

/* ================= Alertas automáticos ================= */
export function TelaAlertas({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Alertas>('/alertas');
  const acao = useAcaoCfg();
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<{ nome: string; tipo: string; n: string; para: string[]; canal: string } | null>(
    null,
  );
  const [erro, setErro] = useState('');
  const d = q.data;
  const faz = (caminho: string, method: 'POST' | 'PUT' | 'DELETE' = 'POST', json?: unknown) =>
    acao.mutate(
      { caminho, method, json },
      {
        onSuccess: (r) => {
          setMsg({ txt: r.msg });
          setForm(null);
        },
        onError: (e) => (form ? setErro(e.message) : setMsg({ txt: e.message, erro: true })),
      },
    );
  return (
    <>
      <PageHead
        titulo="Alertas automáticos"
        acoes={
          <Novo
            rotulo="Novo alerta"
            aoClicar={() => {
              setErro('');
              setForm({ nome: '', tipo: '', n: '10', para: ['Administração'], canal: 'E-mail' });
            }}
          />
        }
      />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <h2 className="mb-2 font-bold text-texto">Alertas padrão</h2>
          {d.padrao.map((a) => (
            <Linha key={a.k} icone={ICONES[a.icone] ?? BellIcon} t={a.t} d={a.d}>
              <span className="text-apagado">{a.on ? 'ligado' : 'desligado'}</span>
              <Switch
                aria-label={a.t}
                checked={a.on}
                disabled={acao.isPending}
                onCheckedChange={() => faz(`/alertas/padrao/${a.k}`, 'PUT')}
              />
            </Linha>
          ))}
          <h2 className="mt-5 mb-2 font-bold text-texto">Alertas personalizados</h2>
          {d.pers.length ? (
            d.pers.map((a) => (
              <Linha key={a.id} icone={BellIcon} t={a.nome} d={a.desc}>
                <Button
                  size="sm"
                  disabled={acao.isPending}
                  aria-label={`Excluir ${a.nome}`}
                  onClick={() => faz(`/alertas/pers/${a.id}`, 'DELETE')}
                >
                  Excluir
                </Button>
                <Switch
                  aria-label={a.nome}
                  checked={a.on}
                  disabled={acao.isPending}
                  onCheckedChange={() => faz(`/alertas/pers/${a.id}`, 'PUT')}
                />
              </Linha>
            ))
          ) : (
            <Card className="mb-2 px-5 py-4 text-apagado">nenhum alerta personalizado — use Novo alerta</Card>
          )}
          <div className="mt-5">
            <Linha
              icone={PlayIcon}
              t="Executar rotinas agora"
              d="Dispara na hora as rotinas que normalmente rodam 1x por dia às 08:00 e mostra quantos avisos cada alerta ligado gerou."
            >
              <Button variant="primary" disabled={acao.isPending} onClick={() => faz('/alertas/executar')}>
                Executar agora
              </Button>
            </Linha>
          </div>
          <FormDialog
            aberto={!!form}
            aoFechar={() => setForm(null)}
            titulo="Novo alerta"
            descricao="dispara sozinho todo dia às 08:00"
            erro={erro}
            ocupado={acao.isPending}
            rotuloOk="Criar alerta"
            aoSalvar={() => form && faz('/alertas', 'POST', form)}
          >
            {form && (
              <>
                <Campo id="al-nome" rotulo="Nome" req className="sm:col-span-2">
                  <Input
                    id="al-nome"
                    autoFocus
                    placeholder="Ex.: Saldo acabando — B2C"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Quando avisar" req>
                  <Escolha
                    rotulo="Quando avisar"
                    todos="escolha o gatilho"
                    destacar={false}
                    valor={form.tipo}
                    aoMudar={(v) => setForm({ ...form, tipo: v })}
                    opcoes={d.gatilhos}
                  />
                </Campo>
                <Campo id="al-n" rotulo="Limite" req>
                  <Input
                    id="al-n"
                    type="number"
                    min={0}
                    value={form.n}
                    onChange={(e) => setForm({ ...form, n: e.target.value })}
                  />
                </Campo>
                <fieldset className="grid gap-2 sm:col-span-2">
                  <legend className="mb-1.5 font-semibold text-texto-2">Quem recebe</legend>
                  <div className="flex flex-wrap gap-2">
                    {d.para.map((p) => (
                      <ChipMulti
                        key={p}
                        on={form.para.includes(p)}
                        aoClicar={() =>
                          setForm({
                            ...form,
                            para: form.para.includes(p) ? form.para.filter((x) => x !== p) : [...form.para, p],
                          })
                        }
                      >
                        {p}
                      </ChipMulti>
                    ))}
                  </div>
                </fieldset>
                <Campo rotulo="Canal">
                  <Escolha
                    rotulo="Canal"
                    destacar={false}
                    valor={form.canal}
                    aoMudar={(v) => setForm({ ...form, canal: v })}
                    opcoes={d.canais.map((c) => ({ v: c, l: c }))}
                  />
                </Campo>
              </>
            )}
          </FormDialog>
        </>
      )}
    </>
  );
}

/* ================= Painel administrativo ================= */
const COR: Record<string, string> = { green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)' };
export function TelaPainel({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<PainelT>('/painel');
  const [acaoF, setAcaoF] = useState('');
  const [autor, setAutor] = useState('');
  const d = q.data;
  const alt = (d?.alteracoes ?? []).filter((a) => (!acaoF || a[3] === acaoF) && (!autor || a[1] === autor));
  return (
    <>
      <PageHead titulo="Painel administrativo" />
      {abas}
      <ErroQ e={q.error} />
      {d && (
        <>
          <Stats itens={d.stats.map(([v, t, tom]) => ({ v, t, tom: (tom || undefined) as Tom | undefined }))} />
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Painel titulo="Regras por domínio" acoes={<Badge tom="blue">runtime</Badge>}>
              <Table aria-label="Regras por domínio">
                <THead>
                  <Tr>
                    <Th>Domínio</Th>
                    <Th className="text-right">Regras</Th>
                    <Th className="text-right">Ativas</Th>
                    <Th className="text-right">Desligadas</Th>
                    <Th>Situação</Th>
                  </Tr>
                </THead>
                <TBody>
                  {d.dominios.map(([nome, regras, ativas, off, tom]) => (
                    <Tr key={nome}>
                      <Td className="font-medium text-texto">{nome}</Td>
                      <Td className="text-right tabular-nums">{regras}</Td>
                      <Td className="text-right tabular-nums">{ativas}</Td>
                      <Td className="text-right tabular-nums">{off}</Td>
                      <Td>
                        <Badge tom={tom as Tom}>{off ? `${off} fora do padrão` : 'conforme'}</Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Painel>
            <Painel
              titulo="Prontidão dos parâmetros"
              sub="cadastros de apoio que as regras leem; parâmetro vazio é regra sem lastro"
            >
              <ul className="grid gap-3 px-5 py-4">
                {d.prontidao.map(([l, v, tom]) => (
                  <li key={l} className="grid grid-cols-[minmax(0,1fr)_120px_48px] items-center gap-3">
                    <span className="text-texto-2">{l}</span>
                    <Trilho pct={v} cor={COR[tom]} rotulo={`${l}: ${v}%`} />
                    <span className="text-right font-semibold tabular-nums" style={{ color: COR[tom] }}>
                      {v}%
                    </span>
                  </li>
                ))}
              </ul>
            </Painel>
          </div>
          <Painel
            titulo="Últimas alterações de regra"
            acoes={
              <>
                <Escolha
                  rotulo="Ação"
                  todos="todas as ações"
                  valor={acaoF}
                  aoMudar={setAcaoF}
                  opcoes={[...new Set(d.alteracoes.map((a) => a[3]))].map((a) => ({ v: a, l: a }))}
                  className="w-[170px]"
                />
                <Escolha
                  rotulo="Autor"
                  todos="todos os autores"
                  valor={autor}
                  aoMudar={setAutor}
                  opcoes={[...new Set(d.alteracoes.map((a) => a[1]))].map((a) => ({ v: a, l: a }))}
                  className="w-[210px]"
                />
                <Button
                  size="sm"
                  onClick={() =>
                    baixaCsv(
                      'ultimas-alteracoes-de-regra',
                      ['Quando', 'Quem', 'Regra', 'Ação', 'Efeito declarado'].map((t, i) => ({ k: String(i), t })),
                      alt.map((a) => ({ 0: a[0], 1: a[1], 2: a[2], 3: a[3], 4: a[5] })),
                    )
                  }
                >
                  <DownloadIcon /> Exportar
                </Button>
              </>
            }
          >
            <Table aria-label="Últimas alterações de regra">
              <THead>
                <Tr>
                  <Th>Quando</Th>
                  <Th>Quem</Th>
                  <Th>Regra</Th>
                  <Th>Ação</Th>
                  <Th>Efeito declarado</Th>
                </Tr>
              </THead>
              <TBody>
                {alt.length ? (
                  alt.map((a) => (
                    <Tr key={a[0] + a[2]}>
                      <Td className="font-medium whitespace-nowrap text-texto tabular-nums">{a[0]}</Td>
                      <Td>{a[1]}</Td>
                      <Td className="font-mono">{a[2]}</Td>
                      <Td>
                        <Badge tom={a[4] as Tom}>{a[3]}</Badge>
                      </Td>
                      <Td>{a[5]}</Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={5} txt="nenhuma alteração com esses filtros" />
                )}
              </TBody>
            </Table>
          </Painel>
        </>
      )}
    </>
  );
}

/* ================= Execuções do Relógio ================= */
const dataDe = (s: string) => s.slice(6, 10) + s.slice(3, 5) + s.slice(0, 2);
export function TelaExecucoes({ abas }: { abas: React.ReactNode }) {
  const q = useCfg<Execucoes>('/execucoes');
  const [verbo, setVerbo] = useState('');
  const [res, setRes] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [busca, setBusca] = useState('');
  const [ver, setVer] = useState<Execucoes['linhas'][number] | null>(null);
  const d = q.data;
  const lista = useMemo(() => {
    const n = normaliza(busca);
    return (d?.linhas ?? []).filter(
      (x) =>
        (!verbo || x.verbo === verbo) &&
        (!res || x.resultado === res) &&
        (!de || dataDe(x.quando) >= de.replace(/-/g, '')) &&
        (!ate || dataDe(x.quando) <= ate.replace(/-/g, '')) &&
        (!n || normaliza(`${x.critica} ${JSON.stringify(x.payload)}`).includes(n)),
    );
  }, [d, verbo, res, de, ate, busca]);
  const { fatia, rodape, setPag } = usePaginacao(lista);
  const f =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPag(1);
    };
  return (
    <>
      <PageHead titulo="Execuções do Relógio" />
      {abas}
      <ErroQ e={q.error} />
      {d && (
        <>
          <Barra>
            <Busca rotulo="Buscar na crítica ou payload" valor={busca} aoMudar={f(setBusca)} />
            <span className="flex-1" />
            <Escolha
              rotulo="Verbo"
              todos="todos os verbos"
              valor={verbo}
              aoMudar={f(setVerbo)}
              opcoes={[...new Set(d.linhas.map((x) => x.verbo))].map((v) => ({ v, l: v }))}
              className="w-[280px]"
            />
            <Escolha
              rotulo="Resultado"
              todos="todos os resultados"
              valor={res}
              aoMudar={f(setRes)}
              opcoes={[...new Set(d.linhas.map((x) => x.resultado))].map((v) => ({ v, l: v }))}
              className="w-[190px]"
            />
            <div className="w-[160px]">
              <CampoData rotulo="De" valor={de} aoMudar={f(setDe)} />
            </div>
            <span className="text-apagado">até</span>
            <div className="w-[160px]">
              <CampoData rotulo="Até" valor={ate} aoMudar={f(setAte)} />
            </div>
          </Barra>
          <Card className="overflow-hidden">
            <Table aria-label="Execuções do Relógio">
              <THead>
                <Tr>
                  <Th>Quando</Th>
                  <Th>Ator</Th>
                  <Th>Verbo</Th>
                  <Th>Alvo</Th>
                  <Th>Resultado</Th>
                  <Th>Crítica do sistema</Th>
                  <Th>
                    <span className="sr-only">Payload</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.map((x) => (
                    <Tr key={x.i}>
                      <Td className="font-medium whitespace-nowrap text-texto tabular-nums">{x.quando}</Td>
                      <Td>{x.ator}</Td>
                      <Td className="font-mono">{x.verbo}</Td>
                      <Td className="tabular-nums">{x.alvo}</Td>
                      <Td>
                        <Badge tom={x.tom}>{x.resultado}</Badge>
                      </Td>
                      <Td>{x.critica || '—'}</Td>
                      <Td className="text-right">
                        <Button size="sm" onClick={() => setVer(x)}>
                          Ver payload
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Vazio cols={7} txt="nenhuma execução com esses filtros" />
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
        </>
      )}
      <Dialog open={!!ver} onOpenChange={(v) => !v && setVer(null)}>
        <DialogContent tamanho="md">
          <DialogHead titulo="Execução do Relógio" descricao={ver ? `${ver.verbo} · ${ver.quando}` : ''} />
          <DialogBody>
            <pre className="overflow-auto rounded-lg border border-borda bg-bg p-3 font-mono text-sm">
              {ver ? JSON.stringify(ver.payload, null, 2) : ''}
            </pre>
          </DialogBody>
          <DialogFoot>
            <Button onClick={() => setVer(null)}>Fechar</Button>
          </DialogFoot>
        </DialogContent>
      </Dialog>
    </>
  );
}
