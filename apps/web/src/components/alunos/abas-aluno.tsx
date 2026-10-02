'use client';

import { CircleCheckIcon, CircleIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CampoData } from '@/components/campos-data';
import { Stats } from '@/components/cursos/abas-curso';
import { GradeDisponibilidade } from '@/components/disponibilidade';
import { Aviso } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import type { AgendamentosAba, DispAba, FichaResp, FinanceiroAba, LogAba, Perfil, Vinculos } from '@/lib/alunos';
import { useAcaoAluno } from '@/lib/alunos';
import { fundoCor } from '@/lib/cor';
import { cn } from '@/lib/utils';
import type { Msg } from './comum';

/** navegação dentro da ficha: troca parâmetros do endereço sem sair da aba */
export type Vai = (p: Record<string, string | undefined>) => void;

const Vazio = ({ n, txt }: { n: number; txt: string }) => (
  <Tr>
    <Td colSpan={n} className="py-8 text-center text-apagado-2">
      {txt}
    </Td>
  </Tr>
);

/* ---------------- Perfil ---------------- */
export function AbaPerfil({ d }: { d: Perfil }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {d.vinculos && <CartaoVinculos v={d.vinculos} />}
      {d.blocos.map((b) => (
        <Card key={b.titulo} className="min-w-0">
          <CardHead>
            <CardTitle>{b.titulo}</CardTitle>
          </CardHead>
          <dl className="flex flex-col gap-3 px-5 py-4">
            {b.itens.map((x) => (
              <div key={x.k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <dt className="text-apagado">{x.k}</dt>
                <dd className="min-w-0 text-right font-medium break-words text-texto">
                  {x.v == null || x.v === '' ? (
                    <span className="text-apagado">—</span>
                  ) : x.tom ? (
                    <Badge tom={x.tom}>{x.v}</Badge>
                  ) : (
                    x.v
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}

/** Usuário e perfis vinculados: um ID, e o mesmo usuário pode ser aluno, professor e colaborador */
function CartaoVinculos({ v }: { v: Vinculos }) {
  const u = v.usuario;
  return (
    <Card className="min-w-0 lg:col-span-3">
      <CardHead className="flex-wrap">
        <CardTitle>Usuário e perfis vinculados</CardTitle>
        <span className="flex-1" />
        {u ? (
          <span className="text-apagado">
            ID <b className="font-semibold text-texto tabular-nums">{u.codigo}</b> · {u.email} · {u.perfil}
          </span>
        ) : null}
      </CardHead>
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        {!u && (
          <span className="mr-2 text-apagado">Sem usuário de acesso. O acesso se cria na aba Acesso desta ficha.</span>
        )}
        {v.papeis.map((p) => {
          const rot = (
            <>
              <span className="font-semibold">{p.tipo}</span>
              <span className="text-apagado">{p.nome}</span>
              {p.atual && <span className="text-apagado">· esta ficha</span>}
            </>
          );
          const cls =
            'inline-flex min-h-9 items-center gap-2 rounded-full border border-borda bg-card px-3.5 transition-shadow';
          return p.href && !p.atual ? (
            <Link key={p.tipo} href={p.href} className={cn(cls, 'hover:shadow-el-2')}>
              {rot}
            </Link>
          ) : (
            <span key={p.tipo} className={cn(cls, p.atual && 'bg-azul-suave')}>
              {rot}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------- Financeiro ---------------- */
const SIT_PARCELA: Record<FinanceiroAba['linhas'][number]['sit'], [string, 'green' | 'red' | 'gray']> = {
  paga: ['Paga', 'green'],
  vencida: ['Vencida', 'red'],
  aVencer: ['A vencer', 'gray'],
};
export function AbaFinanceiro({ d }: { d: FinanceiroAba }) {
  const { fatia, rodape } = usePaginacao(d.linhas);
  return (
    <>
      <Stats s={d.stats} />
      <Card className="overflow-hidden">
        <CardHead className="flex-wrap">
          <CardTitle>Parcelas das matrículas</CardTitle>
          <Badge tom="blue">{d.linhas.length}</Badge>
          <span className="flex-1" />
          {d.cobranca && (
            <Button asChild size="sm">
              <Link href={d.cobranca}>Abrir na Cobrança</Link>
            </Button>
          )}
        </CardHead>
        <Table aria-label="Parcelas">
          <THead>
            <Tr>
              <Th>Curso</Th>
              <Th>Parcela</Th>
              <Th>Vencimento</Th>
              <Th className="text-right">Valor</Th>
              <Th>Pago em</Th>
              <Th>Situação</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.key}>
                  <Td>
                    <span className="font-medium text-texto">{x.curso}</span>
                    {x.item && x.item !== '—' && <div className="text-apagado">{x.item}</div>}
                  </Td>
                  <Td className="tabular-nums">{x.parcela}</Td>
                  <Td className="tabular-nums">{x.venc}</Td>
                  <Td className="text-right tabular-nums">{x.valor}</Td>
                  <Td className="tabular-nums">{x.pago ?? <span className="text-apagado">—</span>}</Td>
                  <Td>
                    <Badge tom={SIT_PARCELA[x.sit][1]}>{SIT_PARCELA[x.sit][0]}</Badge>
                    {x.sit === 'vencida' && x.atraso > 0 && (
                      <span className="ml-2 text-apagado">
                        {x.atraso} {x.atraso === 1 ? 'dia' : 'dias'}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={6} className="py-10 text-center text-apagado-2">
                  nenhuma parcela: o aluno não tem matrícula ativa cobrada
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
    </>
  );
}

/* ---------------- Log ---------------- */
export function AbaLog({ d }: { d: LogAba }) {
  const { fatia, rodape } = usePaginacao(d.linhas);
  return (
    <Card className="overflow-hidden">
      <CardHead>
        <CardTitle>O que mudou nesta ficha</CardTitle>
        <Badge tom="blue">{d.linhas.length}</Badge>
      </CardHead>
      <Table>
        <THead>
          <Tr>
            <Th>Quando</Th>
            <Th>Quem</Th>
            <Th>O que mudou</Th>
            <Th>Detalhe</Th>
          </Tr>
        </THead>
        <TBody>
          {fatia.map((x, i) => (
            <Tr key={`${x.quando}-${i}`}>
              <Td className="font-medium whitespace-nowrap text-texto">{x.quando}</Td>
              <Td className={x.base ? 'text-apagado' : undefined}>{x.quem}</Td>
              <Td>
                {x.acao}
                {x.vezes > 1 && <span className="text-apagado"> · {x.vezes} cliques</span>}
              </Td>
              <Td>{x.detalhe}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      {rodape}
    </Card>
  );
}

/* ---------------- Disponibilidade ---------------- */
export function AbaDisponibilidade({ f, d, setMsg }: { f: FichaResp; d: DispAba; setMsg: (m: Msg) => void }) {
  const acao = useAcaoAluno();
  const troca = (k: string) =>
    acao.mutate(
      { caminho: `/${f.id}/disponibilidade`, method: 'PUT', json: { k } },
      { onSuccess: () => setMsg(null), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );
  return (
    <>
      <Stats s={d.stats} />
      <Card className="mb-4 overflow-hidden">
        <CardHead className="flex-wrap">
          <CardTitle>Disponibilidade semanal</CardTitle>
          <span className="flex-1" />
          <span className="text-apagado">
            {f.pode.operar
              ? 'clique numa hora para marcar ou desmarcar · no dia ou na hora do cabeçalho, a coluna ou a linha · grava na hora'
              : 'seu acesso é só de leitura'}
          </span>
        </CardHead>
        <div className="pt-4">
          <GradeDisponibilidade g={d} troca={troca} ocupado={acao.isPending} soLeitura={!f.pode.operar} />
        </div>
      </Card>
      {d.conflitos.length ? (
        <Aviso tom="red" icone="alerta">
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">
              <b>
                {d.conflitos.length} {d.conflitos.length === 1 ? 'aula está' : 'aulas estão'} fora da disponibilidade:
              </b>{' '}
              {d.conflitos.join('; ')}. Marque a hora como disponível ou mude a alocação.
            </span>
            {d.abrirAlocacao && (
              <Button asChild size="sm">
                <Link href={`/alunos/${f.id}/cursos`}>Abrir alocação</Link>
              </Button>
            )}
          </div>
        </Aviso>
      ) : (
        <Aviso tom="blue" icone="ok">
          Todas as aulas da grade estão dentro da disponibilidade.
        </Aviso>
      )}
    </>
  );
}

/* ---------------- Agendamentos ---------------- */
export function Segmento({
  valor,
  opcoes,
  aoMudar,
  rotulo,
}: {
  valor: string;
  opcoes: [string, string][];
  aoMudar: (v: string) => void;
  rotulo: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="inline-flex rounded-md border border-borda bg-card p-1 shadow-el-1"
    >
      {opcoes.map(([k, l]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={valor === k}
          onClick={() => aoMudar(k)}
          className={cn(
            'h-8 cursor-pointer rounded-sm px-4 text-texto-2 hover:text-texto',
            valor === k && 'bg-azul-suave font-semibold text-azul',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Chips({
  valor,
  opcoes,
  aoMudar,
  rotulo,
}: {
  valor: string;
  opcoes: { k: string; l: string; n: number }[];
  aoMudar: (v: string) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button
          key={o.k || 'todos'}
          type="button"
          role="radio"
          aria-checked={valor === o.k}
          onClick={() => aoMudar(o.k)}
          className={cn(
            'h-9 cursor-pointer rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] transition-shadow hover:bg-card hover:shadow-el-2 dark:bg-hover dark:text-texto-2',
            valor === o.k && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
          )}
        >
          {o.l} · {o.n}
        </button>
      ))}
    </div>
  );
}

const semAcento = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/** ícone do status da aula: check na concluída com presença, círculo nos demais (na cor do status) */
function StatusAula({ s }: { s: AgendamentosAba['aulas'][number]['status'] }) {
  const Icone = s.tom === 'green' ? CircleCheckIcon : CircleIcon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', TOM_STATUS[s.tom] ?? 'text-texto-2')}>
      <Icone className="size-4 shrink-0" aria-hidden />
      {s.rotulo}
    </span>
  );
}
const TOM_STATUS: Partial<Record<string, string>> = {
  green: 'text-verde',
  red: 'text-vermelho',
  amber: 'text-ambar',
  purple: 'text-roxo',
  gray: 'text-texto-2',
};

/**
 * Histórico › Aulas (02/10/2026, pelo print do usuário): Busca · De · Até · Status e a tabela
 * Data/Hora · Módulo · Aula · Professor · Status · Ações. De/Até buscam na API; Busca e Status filtram na tela.
 */
export function AbaAgendamentos({ f, d, vai }: { f: FichaResp; d: AgendamentosAba; vai: Vai }) {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const b = semAcento(busca.trim());
  const ls = d.aulas.filter(
    (x) =>
      (!status || x.status.rotulo === status) &&
      (!b || semAcento(`${x.aula} ${x.modulo} ${x.prod} ${x.prof}`).includes(b)),
  );
  const { fatia, rodape, setPag } = usePaginacao(ls);
  const opcoes = [...new Set(d.aulas.map((x) => x.status.rotulo))].sort().map((v) => ({ v, l: v }));
  const volta = `/alunos/${f.id}/agendamentos`;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <div className="grid w-[340px] max-w-full gap-1.5">
          <Label htmlFor="hist-busca">Busca</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
            <Input
              id="hist-busca"
              type="search"
              placeholder="Busque por aula, curso…"
              className="pl-9"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPag(1);
              }}
            />
          </div>
        </div>
        <div className="grid w-[190px] gap-1.5">
          <Label htmlFor="hist-de">De</Label>
          <CampoData id="hist-de" rotulo="De" valor={d.de} aoMudar={(v) => vai({ de: v })} />
        </div>
        <div className="grid w-[190px] gap-1.5">
          <Label htmlFor="hist-ate">Até</Label>
          <CampoData id="hist-ate" rotulo="Até" valor={d.ate} aoMudar={(v) => vai({ ate: v })} />
        </div>
        <div className="grid w-[200px] gap-1.5">
          <Label>Status</Label>
          <Escolha
            rotulo="Status"
            todos="Todos"
            valor={status}
            aoMudar={(v) => {
              setStatus(v);
              setPag(1);
            }}
            opcoes={opcoes}
          />
        </div>
      </div>
      <p className="mb-3 text-apagado" aria-live="polite">
        {ls.length} {ls.length === 1 ? 'aula' : 'aulas'}.
      </p>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Data/Hora</Th>
              <Th>Módulo</Th>
              <Th>Aula</Th>
              <Th>Professor</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.k}>
                  <Td className="whitespace-nowrap text-texto">
                    {x.data} <span className="text-azul">às {x.hora}</span>
                  </Td>
                  <Td>
                    <span
                      className="inline-block rounded-[6px] px-2 py-0.5 font-semibold whitespace-nowrap"
                      style={fundoCor(x.cor)}
                      title={x.prod}
                    >
                      {x.modulo}
                    </span>
                  </Td>
                  <Td className="text-texto">{x.aula || <span className="text-apagado">—</span>}</Td>
                  <Td>
                    {x.prof === '—' ? (
                      <span className="text-vermelho">sem professor</span>
                    ) : x.profId ? (
                      <Link
                        href={`/professores/${x.profId}/perfil`}
                        className="text-texto hover:text-azul hover:underline"
                      >
                        {x.prof}
                      </Link>
                    ) : (
                      x.prof
                    )}
                    {x.sub && <div className="text-apagado">no lugar de {x.sub}</div>}
                  </Td>
                  <Td>
                    <StatusAula s={x.status} />
                  </Td>
                  <Td>
                    <Link
                      href={`/agenda/aula?k=${encodeURIComponent(x.k)}&volta=${encodeURIComponent(volta)}`}
                      className="whitespace-nowrap text-texto-2 hover:text-azul hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  </Td>
                </Tr>
              ))
            ) : (
              <Vazio n={6} txt={d.aulas.length ? 'nenhuma aula com esses filtros' : 'nenhuma aula no período'} />
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
    </>
  );
}
