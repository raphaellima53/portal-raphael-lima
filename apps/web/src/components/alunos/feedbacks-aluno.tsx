'use client';

import { FileTextIcon, PaperclipIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Stat } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import {
  arquivoParaEnvio,
  type Feedback,
  type FeedbacksAba,
  type FichaResp,
  type Ponto,
  useAcaoAluno,
  useOpcoesAluno,
} from '@/lib/alunos';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Chips, type Vai } from './abas-aluno';
import type { Msg } from './comum';

const MAX = 10 * 1024 * 1024;
const ACEITA = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';
const NIVEL = { red: 'red', amber: 'amber', ok: 'green' } as const;
const tamanho = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

function Anexos({ l }: { l: Feedback['anexos'] }) {
  if (!l.length) return <span className="text-apagado">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {l.map((x) =>
        x.img ? (
          <a
            key={x.id}
            href={`${API_URL}/anexos/${x.id}`}
            target="_blank"
            rel="noopener"
            aria-label={`Abrir ${x.nome}`}
            className="block overflow-hidden rounded-md border border-borda shadow-el-1 hover:shadow-el-2"
          >
            {/* biome-ignore lint/performance/noImgElement: anexo servido pela API com o cookie da sessão */}
            <img src={`${API_URL}/anexos/${x.id}`} alt={x.nome} className="size-12 object-cover" />
          </a>
        ) : (
          <a
            key={x.id}
            href={`${API_URL}/anexos/${x.id}`}
            className="inline-flex h-9 max-w-[200px] items-center gap-1.5 rounded-md border border-borda px-2.5 text-texto-2 hover:shadow-el-2"
          >
            <FileTextIcon className="size-4 shrink-0 text-apagado" />
            <span className="truncate">{x.nome}</span>
          </a>
        ),
      )}
    </div>
  );
}

/** Feedbacks: pontos de qualidade lidos da base e os registros do aluno, com anexos e tratativa. */
export function AbaFeedbacks({
  f,
  d,
  vai,
  setMsg,
}: {
  f: FichaResp;
  d: FeedbacksAba;
  vai: Vai;
  setMsg: (m: Msg) => void;
}) {
  const acao = useAcaoAluno();
  const [tipo, setTipo] = useState('');
  const [st, setSt] = useState('');
  const [novo, setNovo] = useState<{ ponto: Ponto | null } | null>(null);
  const [anexar, setAnexar] = useState<Feedback | null>(null);
  const ls = d.lista.filter((x) => (!tipo || x.tipo === tipo) && (!st || x.status === st));
  const { fatia, rodape, setPag } = usePaginacao(ls);
  const op = f.pode.operar;
  const tipos = ['Reclamação', 'Elogio', 'Sugestão', 'Qualidade'];
  const situacoes = ['Aberto', 'Em tratativa', 'Concluído'];

  const avanca = (x: Feedback) =>
    acao.mutate(
      { caminho: `/${f.id}/feedbacks/${x.id}/avancar` },
      { onSuccess: (r) => setMsg({ txt: r.msg }), onError: (e) => setMsg({ txt: e.message, erro: true }) },
    );

  return (
    <>
      <Card className="mb-4">
        <CardHead className="flex-wrap">
          <CardTitle>Qualidade do aluno</CardTitle>
          <span className="text-apagado">lida da agenda, da presença, da alocação e do currículo</span>
          <span className="flex-1" />
          <Escolha
            rotulo="Período da qualidade"
            destacar={false}
            valor={String(d.dias)}
            aoMudar={(v) => vai({ hist: v === '60' ? undefined : v })}
            opcoes={[
              { v: '30', l: 'últimos 30 dias' },
              { v: '60', l: 'últimos 60 dias' },
              { v: '90', l: 'últimos 90 dias' },
            ]}
            className="w-[180px]"
          />
        </CardHead>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-5">
          {d.pontos.map((p) => (
            <div
              key={p.k}
              className={cn(
                'flex min-w-0 flex-col gap-2 rounded-md border p-3.5',
                p.nivel === 'red' && 'border-[#f5c2c7] bg-vermelho-suave/40',
                p.nivel === 'amber' && 'border-[#f1d9a6] bg-ambar-suave/40',
                p.nivel === 'ok' && 'border-borda-suave',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <b className="text-texto">{p.t}</b>
                <Badge tom={NIVEL[p.nivel]}>{p.n ? p.n : 'ok'}</Badge>
              </div>
              <p className="flex-1 text-texto-2">{p.d}</p>
              {p.n > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.ir && (
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        href={
                          p.ir === 'passadas'
                            ? `/alunos/${f.id}/agendamentos?quando=passadas${d.dias !== 60 ? `&hist=${d.dias}` : ''}`
                            : `/alunos/${f.id}/cursos`
                        }
                      >
                        {p.rot}
                      </Link>
                    </Button>
                  )}
                  {op && (
                    <Button size="sm" onClick={() => setNovo({ ponto: p })}>
                      <PlusIcon /> Registrar ocorrência
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {d.stats.map((x) => (
          <Stat key={x.rotulo} valor={x.valor} rotulo={x.rotulo} tom={x.tom} />
        ))}
      </div>

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Chips
            rotulo="Tipo"
            valor={tipo}
            aoMudar={(v) => {
              setTipo(v);
              setPag(1);
            }}
            opcoes={[
              { k: '', l: 'Todos', n: d.lista.length },
              ...tipos.map((t) => ({ k: t, l: t, n: d.lista.filter((x) => x.tipo === t).length })),
            ]}
          />
          <Chips
            rotulo="Situação"
            valor={st}
            aoMudar={(v) => {
              setSt(v);
              setPag(1);
            }}
            opcoes={[
              { k: '', l: 'Qualquer situação', n: d.lista.length },
              ...situacoes.map((s) => ({ k: s, l: s, n: d.lista.filter((x) => x.status === s).length })),
            ]}
          />
        </div>
        {op && (
          <Button variant="primary" onClick={() => setNovo({ ponto: null })}>
            <PlusIcon /> Novo feedback
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Data</Th>
              <Th>Tipo</Th>
              <Th>Área</Th>
              <Th>Curso</Th>
              <Th>Relato</Th>
              <Th>Anexos</Th>
              <Th>Canal</Th>
              <Th>Situação</Th>
              {op && (
                <Th>
                  <span className="sr-only">Ações</span>
                </Th>
              )}
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.id}>
                  <Td className="font-medium whitespace-nowrap text-texto">{x.data}</Td>
                  <Td>
                    <Badge tom={x.tipoTom}>{x.tipo}</Badge>
                  </Td>
                  <Td>{x.area}</Td>
                  <Td>{x.curso}</Td>
                  <Td className="min-w-[260px]">
                    <div className="text-texto">{x.texto}</div>
                    <div className="mt-1 text-apagado">registrado por {x.por}</div>
                  </Td>
                  <Td>
                    <Anexos l={x.anexos} />
                  </Td>
                  <Td className="whitespace-nowrap">{x.canal}</Td>
                  <Td>
                    <Badge tom={x.statusTom}>{x.status}</Badge>
                  </Td>
                  {op && (
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {x.status !== 'Concluído' && (
                          <Button size="sm" disabled={acao.isPending} onClick={() => avanca(x)}>
                            {x.status === 'Aberto' ? 'Iniciar tratativa' : 'Concluir'}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setAnexar(x)}>
                          <PaperclipIcon /> Anexar
                        </Button>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={9} className="py-8 text-center text-apagado-2">
                  {d.lista.length
                    ? 'nenhum registro neste filtro'
                    : 'nenhum feedback nem ocorrência registrada para este aluno'}
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>

      <FeedbackDialog f={f} d={d} abre={novo} aoFechar={() => setNovo(null)} aoSalvo={(txt) => setMsg({ txt })} />
      <AnexarDialog f={f} fb={anexar} aoFechar={() => setAnexar(null)} aoSalvo={(txt) => setMsg({ txt })} />
    </>
  );
}

/** campo de arquivos: prints, fotos e documentos até 10 MB cada */
function CampoArquivos({
  id,
  arquivos,
  setArquivos,
}: {
  id: string;
  arquivos: File[];
  setArquivos: (f: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <Label htmlFor={id}>Anexos</Label>
      <input
        ref={ref}
        id={id}
        type="file"
        multiple
        accept={ACEITA}
        onChange={(e) => setArquivos([...(e.target.files ?? [])])}
        className="block w-full cursor-pointer rounded-md border border-borda-forte bg-card text-sm text-texto-2 file:mr-3 file:h-10 file:cursor-pointer file:border-0 file:border-r file:border-borda file:bg-bg file:px-4 file:font-medium file:text-texto-2"
      />
      <span className="text-apagado">prints, fotos e documentos — até 10 MB cada, até 5 por vez</span>
      {arquivos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {arquivos.map((a) => (
            <li
              key={a.name + a.size}
              className={cn(
                'rounded-full bg-cinza-suave px-2.5 py-1',
                a.size > MAX && 'bg-vermelho-suave text-vermelho',
              )}
            >
              {a.name} · {tamanho(a.size)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const confereArquivos = (l: File[]) => {
  const grande = l.find((a) => a.size > MAX);
  if (grande) return `${grande.name} passa de 10 MB.`;
  if (l.length > 5) return 'Envie até 5 arquivos por vez.';
  return '';
};

function FeedbackDialog({
  f,
  d,
  abre,
  aoFechar,
  aoSalvo,
}: {
  f: FichaResp;
  d: FeedbacksAba;
  abre: { ponto: Ponto | null } | null;
  aoFechar: () => void;
  aoSalvo: (txt: string) => void;
}) {
  const op = useOpcoesAluno(!!abre);
  const acao = useAcaoAluno();
  const p = abre?.ponto ?? null;
  const [tipo, setTipo] = useState('');
  const [area, setArea] = useState('');
  const [curso, setCurso] = useState('');
  const [canal, setCanal] = useState('WhatsApp');
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (!abre) return;
    setTipo(p ? 'Qualidade' : '');
    setArea(p ? p.area : '');
    setCurso(d.cursos[0] ?? '');
    setCanal(p ? 'Registro interno' : 'WhatsApp');
    setTexto(p ? `${p.t}: ${p.d}` : '');
    setArquivos([]);
    setErro('');
  }, [abre]);

  const enviar = async () => {
    if (!tipo) return setErro('Escolha o tipo.');
    if (!area) return setErro('Escolha a área responsável.');
    if (!texto.trim()) return setErro('Escreva o relato.');
    const e = confereArquivos(arquivos);
    if (e) return setErro(e);
    setLendo(true);
    try {
      const anexos = await Promise.all(arquivos.map(arquivoParaEnvio));
      acao.mutate(
        { caminho: `/${f.id}/feedbacks`, json: { tipo, area, curso, canal, texto, anexos } },
        {
          onSuccess: (r) => {
            aoFechar();
            aoSalvo(r.msg);
          },
          onError: (x) => setErro(x.message),
        },
      );
    } catch (x) {
      setErro((x as Error).message);
    } finally {
      setLendo(false);
    }
  };

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <DialogHead
          titulo={p ? 'Registrar ocorrência de qualidade' : 'Novo feedback'}
          descricao={`${f.nome} · ${p ? p.t : 'feedbacks e qualidade'}`}
        />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>
              Tipo<span className="text-vermelho">*</span>
            </Label>
            <Escolha
              rotulo="Tipo"
              todos="escolha o tipo"
              destacar={false}
              valor={tipo}
              aoMudar={setTipo}
              opcoes={(op.data?.fb.tipos ?? []).map(([t]) => ({ v: t, l: t }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              Área responsável<span className="text-vermelho">*</span>
            </Label>
            <Escolha
              rotulo="Área responsável"
              todos="escolha a área"
              destacar={false}
              valor={area}
              aoMudar={setArea}
              opcoes={(op.data?.fb.areas ?? []).map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Curso</Label>
            <Escolha
              rotulo="Curso"
              destacar={false}
              disabled={!d.cursos.length}
              todos={d.cursos.length ? undefined : 'sem matrícula ativa'}
              valor={curso}
              aoMudar={setCurso}
              opcoes={d.cursos.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Canal</Label>
            <Escolha
              rotulo="Canal"
              destacar={false}
              valor={canal}
              aoMudar={setCanal}
              opcoes={(op.data?.fb.canais ?? [canal]).map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="fb-texto">
              Relato<span className="text-vermelho">*</span>
            </Label>
            <textarea
              id="fb-texto"
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="o que aconteceu, com as palavras de quem relatou"
              className="w-full rounded-md border border-borda-forte bg-card px-3 py-2.5 text-sm text-texto placeholder:text-apagado-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
            />
          </div>
          <CampoArquivos id="fb-anexos" arquivos={arquivos} setArquivos={setArquivos} />
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending || lendo} onClick={enviar}>
            {p ? 'Registrar ocorrência' : 'Registrar feedback'}
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

function AnexarDialog({
  f,
  fb,
  aoFechar,
  aoSalvo,
}: {
  f: FichaResp;
  fb: Feedback | null;
  aoFechar: () => void;
  aoSalvo: (txt: string) => void;
}) {
  const acao = useAcaoAluno();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    setArquivos([]);
    setErro('');
  }, [fb]);

  const enviar = async () => {
    if (!fb) return;
    if (!arquivos.length) return setErro('Escolha ao menos um arquivo.');
    const e = confereArquivos(arquivos);
    if (e) return setErro(e);
    setLendo(true);
    try {
      const anexos = await Promise.all(arquivos.map(arquivoParaEnvio));
      acao.mutate(
        { caminho: `/${f.id}/feedbacks/${fb.id}/anexos`, json: { anexos } },
        {
          onSuccess: (r) => {
            aoFechar();
            aoSalvo(r.msg);
          },
          onError: (x) => setErro(x.message),
        },
      );
    } catch (x) {
      setErro((x as Error).message);
    } finally {
      setLendo(false);
    }
  };

  return (
    <Dialog open={!!fb} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead
          titulo="Anexar ao registro"
          descricao={fb ? `${f.nome} · ${fb.tipo} de ${fb.area.toLowerCase()} · ${fb.data}` : undefined}
        />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <CampoArquivos id="fb-anexar" arquivos={arquivos} setArquivos={setArquivos} />
          <div className="grid gap-1.5 sm:col-span-2">
            <span className="font-semibold text-texto-2">Já anexados</span>
            {fb && <Anexos l={fb.anexos} />}
          </div>
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending || lendo} onClick={enviar}>
            Anexar
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
