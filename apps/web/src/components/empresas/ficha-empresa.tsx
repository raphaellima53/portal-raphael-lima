'use client';

import { ChevronLeftIcon, MailIcon, PencilIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Abas } from '@/components/abas';
import { Aviso, PageHead, Stat } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import {
  type AlunosEmp,
  type FichaEmpresa as Ficha,
  type GeralEmp,
  type HistoricoEmp,
  useAcaoEmpresa,
  useEmpresa,
} from '@/lib/empresas';
import { EmpresaFormDialog, RenovarDialog } from './empresa-form';

type Msg = { txt: string; erro?: boolean } | null;

export function FichaEmpresa() {
  return (
    <Suspense>
      <FichaInterna />
    </Suspense>
  );
}

/** Empresas › conta: Visão geral · Alunos (ou Turmas) · Histórico */
function FichaInterna() {
  const { id, aba } = useParams<{ id: string; aba: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const q = useEmpresa(id, aba);
  const acao = useAcaoEmpresa();
  const [msg, setMsg] = useState<Msg>(sp.get('msg') ? { txt: sp.get('msg')! } : null);
  const [editar, setEditar] = useState<{ id: string; form: Ficha['form'] } | null>(null);
  const [renovar, setRenovar] = useState<Ficha | null>(null);
  const e = q.data;

  useEffect(() => {
    if (e) document.title = `${e.nome} · Portal Raphael Lima`;
    if (e && e.aba !== aba) router.replace(`/empresas/${e.id}/${e.aba}`);
  }, [e, aba, router]);

  if (q.isError)
    return (
      <>
        <PageHead
          titulo={q.error.message.startsWith('Sem acesso') ? 'Sem acesso a esta tela' : 'Empresa não encontrada'}
          acoes={
            <Button asChild>
              <Link href="/empresas">
                <ChevronLeftIcon /> Empresas
              </Link>
            </Button>
          }
        />
        <Aviso icone="trava">{q.error.message}</Aviso>
      </>
    );
  if (!e) return <p className="text-apagado">Carregando…</p>;

  const relatorio = () =>
    acao.mutate(
      { caminho: `/${e.id}/relatorio` },
      {
        onSuccess: (r) => {
          setMsg({ txt: r.msg });
          /* abre o e-mail pronto no programa de e-mail de quem envia */
          if (r.email)
            window.location.href = `mailto:${r.email.para}?subject=${encodeURIComponent(r.email.assunto)}&body=${encodeURIComponent(r.email.corpo)}`;
        },
        onError: (x) => setMsg({ txt: x.message, erro: true }),
      },
    );

  return (
    <>
      <PageHead
        titulo={e.nome}
        acoes={
          <>
            <Button asChild>
              <Link href="/empresas">
                <ChevronLeftIcon /> Empresas
              </Link>
            </Button>
            {e.podeGerir && (
              <>
                <Button onClick={() => setEditar({ id: e.id, form: e.form })}>
                  <PencilIcon /> Editar empresa
                </Button>
                <Button onClick={relatorio} disabled={acao.isPending}>
                  <MailIcon /> Enviar relatório ao RH
                </Button>
                <Button variant="primary" onClick={() => setRenovar(e)}>
                  <RefreshCwIcon /> Renovar contrato
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tom={e.modelo === 'B2B' ? 'blue' : 'purple'}>{e.modelo}</Badge>
        <Badge tom={e.sitTom}>{e.sit}</Badge>
        <span className="inline-flex h-[26px] items-center rounded-full border border-borda-forte px-2.5 text-texto-2">
          {e.segmento}
        </span>
        <span className="ml-1 text-apagado">gerente da conta: {e.gerente}</span>
      </div>
      <Abas
        rotulo="Abas da empresa"
        itens={(
          [
            ['geral', 'Visão geral'],
            ['alunos', e.turma ? 'Turmas' : 'Alunos'],
            ['historico', 'Histórico'],
          ] as const
        ).map(([k, l]) => ({ href: `/empresas/${e.id}/${k}`, rotulo: l, ativa: k === e.aba }))}
      />
      {msg && (
        <Aviso tom={msg.erro ? 'red' : 'blue'} icone={msg.erro ? 'alerta' : 'ok'}>
          {msg.txt}
        </Aviso>
      )}
      {e.aba === 'geral' && <Geral d={e.dados as GeralEmp} />}
      {e.aba === 'alunos' && <Alunos e={e} d={e.dados as AlunosEmp} setMsg={setMsg} />}
      {e.aba === 'historico' && <Historico d={e.dados as HistoricoEmp} />}

      <EmpresaFormDialog abre={editar} eu="" aoFechar={() => setEditar(null)} aoSalvo={(r) => setMsg({ txt: r.msg })} />
      <RenovarDialog e={renovar} aoFechar={() => setRenovar(null)} aoSalvo={(txt) => setMsg({ txt })} />
    </>
  );
}

function Kv({ titulo, l }: { titulo: string; l: [string, string][] }) {
  return (
    <Card className="min-w-0">
      <CardHead>
        <CardTitle>{titulo}</CardTitle>
      </CardHead>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-5 gap-y-3 px-5 py-4">
        {l.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-apagado">{k}</dt>
            <dd className="min-w-0 font-medium break-words text-texto">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Geral({ d }: { d: GeralEmp }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {d.stats.map((s) => (
          <Stat key={s.rotulo} valor={s.valor} rotulo={s.rotulo} tom={s.tom} detalhe={s.sub} />
        ))}
      </div>
      {d.alertas.length > 0 && (
        <Aviso tom="amber" icone="alerta">
          <b>Atenção:</b> {d.alertas.join(' · ')}
        </Aviso>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Kv titulo="Contrato" l={d.contrato} />
        <Kv titulo="Gestão da conta" l={d.gestao} />
      </div>
    </>
  );
}

function Alunos({ e, d, setMsg }: { e: Ficha; d: AlunosEmp; setMsg: (m: Msg) => void }) {
  const acao = useAcaoEmpresa();
  const [aluno, setAluno] = useState('');
  const lista = d.turma ? d.turmas : d.alunos;
  const { fatia, rodape } = usePaginacao<(typeof lista)[number]>(lista);
  const faz = (caminho: string, method: 'POST' | 'DELETE', json?: unknown) =>
    acao.mutate(
      { caminho, method, json },
      {
        onSuccess: (r) => {
          setMsg({ txt: r.msg });
          setAluno('');
        },
        onError: (x) => setMsg({ txt: x.message, erro: true }),
      },
    );

  if (d.turma)
    return (
      <Card className="overflow-hidden">
        <CardHead>
          <CardTitle>Turmas dedicadas de {e.nome}</CardTitle>
          <span className="flex-1" />
          <Button asChild size="sm">
            <Link href={`/cursos/${d.cursoId}/grade`}>Abrir a grade do curso</Link>
          </Button>
        </CardHead>
        <Table>
          <THead>
            <Tr>
              <Th>Turma</Th>
              <Th>Grupo</Th>
              <Th>Professor</Th>
              <Th>Grade</Th>
              <Th>Modalidade</Th>
              <Th className="text-right">Vagas</Th>
            </Tr>
          </THead>
          <TBody>
            {(fatia as typeof d.turmas).map((t) => (
              <Tr key={t.nome}>
                <Td className="font-medium text-texto">{t.nome}</Td>
                <Td>{t.grupo}</Td>
                <Td>{t.professor}</Td>
                <Td>{t.grade}</Td>
                <Td>
                  <Badge tom={t.modalidade === 'Presencial' ? 'purple' : 'gray'}>{t.modalidade}</Badge>
                </Td>
                <Td className="text-right tabular-nums">{t.vagas}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        {rodape}
      </Card>
    );

  return (
    <>
      {e.podeGerir && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Aluno sem empresa"
            todos="vincular aluno sem empresa…"
            destacar={false}
            valor={aluno}
            aoMudar={setAluno}
            opcoes={d.semEmpresa.map((a) => ({ v: String(a.id), l: `${a.nome} · ${a.email}` }))}
            className="w-full max-w-[420px]"
          />
          <Button
            variant="primary"
            disabled={acao.isPending}
            onClick={() =>
              aluno
                ? faz(`/${e.id}/alunos`, 'POST', { alunoId: Number(aluno) })
                : setMsg({ txt: 'Escolha o aluno para vincular.', erro: true })
            }
          >
            <PlusIcon /> Vincular à empresa
          </Button>
        </div>
      )}
      <Card className="overflow-hidden">
        <CardHead className="flex-wrap">
          <CardTitle>Alunos de {e.nome}</CardTitle>
          <Badge tom="blue">{d.alunos.length}</Badge>
          <span className="flex-1" />
          <span className="text-apagado">{d.cobranca}</span>
        </CardHead>
        <Table>
          <THead>
            <Tr>
              <Th>Aluno</Th>
              <Th>Cursos</Th>
              <Th className="text-right">Aulas usadas</Th>
              <Th className="text-right">Presença em 30 dias</Th>
              <Th>Quem paga</Th>
              <Th>Situação</Th>
              {e.podeGerir && (
                <Th>
                  <span className="sr-only">Ações</span>
                </Th>
              )}
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              (fatia as typeof d.alunos).map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <Link href={`/alunos/${a.id}/perfil`} className="font-semibold text-azul hover:underline">
                      {a.nome}
                    </Link>
                    <div className="text-apagado">{a.email}</div>
                  </Td>
                  <Td>{a.cursos}</Td>
                  <Td className="text-right tabular-nums">{a.aulas}</Td>
                  <Td className="text-right tabular-nums">{a.presenca}</Td>
                  <Td>{a.paga}</Td>
                  <Td>
                    <Badge tom={a.sitTom}>{a.sit}</Badge>
                  </Td>
                  {e.podeGerir && (
                    <Td className="text-right">
                      <Button
                        size="sm"
                        disabled={acao.isPending}
                        onClick={() => faz(`/${e.id}/alunos/${a.id}`, 'DELETE')}
                      >
                        Desvincular
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={7} className="py-8 text-center text-apagado-2">
                  nenhum aluno vinculado a esta empresa
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

function Historico({ d }: { d: HistoricoEmp }) {
  const { fatia, rodape } = usePaginacao(d.linhas);
  return (
    <Card className="overflow-hidden">
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
