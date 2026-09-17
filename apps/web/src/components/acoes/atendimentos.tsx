'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Chips } from '@/components/alunos/abas-aluno';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type Atendimentos, useAcao, useAtendimentos } from '@/lib/acoes';
import { arquivoParaEnvio } from '@/lib/alunos';
import { Busca, normaliza } from './alocacao';

/** CX › Atendimentos: os feedbacks e ocorrências de todos os alunos, com a tratativa */
export function TelaAtendimentos({ abas }: { abas: React.ReactNode }) {
  const q = useAtendimentos();
  const acao = useAcao();
  const [st, setSt] = useState('Aberto');
  const [tipo, setTipo] = useState('');
  const [area, setArea] = useState('');
  const [busca, setBusca] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [novo, setNovo] = useState(false);
  const d = q.data;
  const base = (d?.itens ?? []).filter(
    (x) =>
      (!tipo || x.tipo === tipo) &&
      (!area || x.area === area) &&
      (!busca || normaliza([x.aluno, x.tipo, x.area, x.curso, x.texto, x.canal].join(' ')).includes(normaliza(busca))),
  );
  const ls = base.filter((x) => !st || x.status === st);
  const { fatia, rodape, setPag } = usePaginacao(ls);

  return (
    <>
      <PageHead
        titulo="Atendimentos"
        acoes={
          d?.podeOperar ? (
            <Button variant="primary" onClick={() => setNovo(true)}>
              <PlusIcon /> Novo atendimento
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Chips
          rotulo="Situação"
          valor={st}
          aoMudar={(v) => {
            setSt(v);
            setPag(1);
          }}
          opcoes={[
            { k: '', l: 'Todos', n: base.length },
            ...(d?.situacoes ?? []).map((s) => ({ k: s, l: s, n: base.filter((x) => x.status === s).length })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Busca rotulo="Buscar aluno ou relato" valor={busca} aoMudar={setBusca} />
          <Escolha
            rotulo="Tipo"
            todos="Todos os tipos"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={(d?.tipos ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[170px]"
          />
          <Escolha
            rotulo="Área"
            todos="Todas as áreas"
            valor={area}
            aoMudar={setArea}
            opcoes={(d?.areas ?? []).map((x) => ({ v: x, l: x }))}
            className="w-[170px]"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Aberto há</Th>
              <Th>Aluno</Th>
              <Th>Tipo</Th>
              <Th>Área</Th>
              <Th>Curso</Th>
              <Th>Relato</Th>
              <Th>Canal</Th>
              <Th>Situação</Th>
              {d?.podeOperar && (
                <Th>
                  <span className="sr-only">Tratativa</span>
                </Th>
              )}
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((x) => (
                <Tr key={x.id}>
                  <Td className="whitespace-nowrap">
                    <div className="font-medium text-texto">{x.idade}</div>
                    <div className="text-apagado">{x.data}</div>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Link href={`/alunos/${x.alunoId}/feedbacks`} className="font-medium text-azul hover:underline">
                      {x.aluno}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tom={x.tipoTom}>{x.tipo}</Badge>
                  </Td>
                  <Td>{x.area}</Td>
                  <Td>{x.curso}</Td>
                  <Td className="min-w-[260px]">
                    <div className="text-texto">{x.texto}</div>
                    <div className="mt-1 text-apagado">registrado por {x.por}</div>
                  </Td>
                  <Td className="whitespace-nowrap">{x.canal}</Td>
                  <Td>
                    <Badge tom={x.statusTom}>{x.status}</Badge>
                  </Td>
                  {d?.podeOperar && (
                    <Td className="text-right">
                      {x.status !== 'Concluído' && (
                        <Button
                          size="sm"
                          disabled={acao.isPending}
                          onClick={() =>
                            acao.mutate(
                              { caminho: `/atendimentos/${x.id}/avancar` },
                              {
                                onSuccess: (r) => setMsg({ txt: r.msg }),
                                onError: (e) => setMsg({ txt: e.message, erro: true }),
                              },
                            )
                          }
                        >
                          {x.status === 'Aberto' ? 'Iniciar tratativa' : 'Concluir'}
                        </Button>
                      )}
                    </Td>
                  )}
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={9} className="py-10 text-center text-apagado-2">
                  {q.isPending ? 'Carregando…' : 'nenhum atendimento neste filtro'}
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
      {d && <NovoAtendimento d={d} aberto={novo} aoFechar={() => setNovo(false)} aoSalvo={(txt) => setMsg({ txt })} />}
    </>
  );
}

function NovoAtendimento({
  d,
  aberto,
  aoFechar,
  aoSalvo,
}: {
  d: Atendimentos;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvo: (txt: string) => void;
}) {
  const acao = useAcao();
  const [aluno, setAluno] = useState('');
  const [tipo, setTipo] = useState('');
  const [area, setArea] = useState('');
  const [curso, setCurso] = useState('');
  const [canal, setCanal] = useState('WhatsApp');
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!aberto) return;
    setAluno('');
    setTipo('');
    setArea('');
    setCurso('');
    setCanal('WhatsApp');
    setTexto('');
    setArquivos([]);
    setErro('');
  }, [aberto]);
  const cursos = d.alunos.find((a) => String(a.id) === aluno)?.cursos ?? [];
  const enviar = async () => {
    if (!aluno) return setErro('Escolha o aluno.');
    if (!tipo) return setErro('Escolha o tipo.');
    if (!area) return setErro('Escolha a área responsável.');
    if (!texto.trim()) return setErro('Escreva o relato.');
    if (arquivos.some((f) => f.size > 10 * 1024 * 1024)) return setErro('Cada arquivo pode ter até 10 MB.');
    const anexos = await Promise.all(arquivos.slice(0, 5).map(arquivoParaEnvio));
    acao.mutate(
      {
        caminho: '/atendimentos',
        json: { alunoId: Number(aluno), tipo, area, curso: curso || cursos[0] || '', canal, texto, anexos },
      },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo(r.msg);
        },
        onError: (e) => setErro(e.message),
      },
    );
  };
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="lg">
        <DialogHead titulo="Novo atendimento" descricao="o registro vai para os feedbacks da ficha do aluno" />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>
              Aluno<span className="text-vermelho">*</span>
            </Label>
            <Escolha
              rotulo="Aluno"
              todos="escolha o aluno"
              destacar={false}
              valor={aluno}
              aoMudar={(v) => {
                setAluno(v);
                setCurso('');
              }}
              opcoes={d.alunos.map((a) => ({ v: String(a.id), l: a.nome }))}
            />
          </div>
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
              opcoes={d.tipos.map((x) => ({ v: x, l: x }))}
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
              opcoes={d.areas.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Curso</Label>
            <Escolha
              rotulo="Curso"
              destacar={false}
              disabled={!cursos.length}
              todos={cursos.length ? undefined : aluno ? 'sem matrícula ativa' : 'escolha o aluno'}
              valor={curso || cursos[0] || ''}
              aoMudar={setCurso}
              opcoes={cursos.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Canal</Label>
            <Escolha
              rotulo="Canal"
              destacar={false}
              valor={canal}
              aoMudar={setCanal}
              opcoes={d.canais.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="at-texto">
              Relato<span className="text-vermelho">*</span>
            </Label>
            <textarea
              id="at-texto"
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="o que aconteceu, com as palavras de quem relatou"
              className="w-full rounded-md border border-borda-forte bg-card px-3 py-2.5 text-sm text-texto placeholder:text-apagado-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="at-anexos">Anexos</Label>
            <input
              id="at-anexos"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={(e) => setArquivos([...(e.target.files ?? [])])}
              className="block w-full cursor-pointer rounded-md border border-borda-forte bg-card text-sm text-texto-2 file:mr-3 file:h-10 file:cursor-pointer file:border-0 file:border-r file:border-borda file:bg-bg file:px-4 file:font-medium file:text-texto-2"
            />
            <span className="text-apagado">prints, fotos e documentos — até 10 MB cada, até 5 por vez</span>
          </div>
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending} onClick={enviar}>
            Registrar
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
