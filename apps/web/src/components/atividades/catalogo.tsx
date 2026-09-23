'use client';

import { PencilIcon, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Busca, normaliza } from '@/components/acoes/alocacao';
import type { Msg } from '@/components/alunos/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { CADENCIA_ROT, type Catalogo, type Opcoes, useAtvAcao, useAtvOpcoes, useCatalogo } from '@/lib/atividades';

type Item = Catalogo['itens'][number];

/**
 * Atividades › Dashboard › Catálogo: as atividades de cada setor com a cadência (lista do usuário de 23/09/2026).
 * Recorrentes geram o cartão do período sozinhas; eventuais e projetos entram por Nova atividade › Do catálogo.
 */
export function TelaCatalogo({ abas }: { abas: React.ReactNode }) {
  const q = useCatalogo();
  const op = useAtvOpcoes();
  const [busca, setBusca] = useState('');
  const [setor, setSetor] = useState('');
  const [cad, setCad] = useState('');
  const [ativo, setAtivo] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [edita, setEdita] = useState<Item | 'novo' | null>(null);
  const d = q.data;
  const ls = (d?.itens ?? []).filter(
    (m) =>
      (!setor || m.setor === setor) &&
      (!cad || m.cadencia === cad) &&
      (!ativo || String(m.ativo) === ativo) &&
      (!busca || normaliza(`${m.nome} ${m.descricao} ${m.responsavel}`).includes(normaliza(busca))),
  );
  const { fatia, rodape } = usePaginacao(ls);
  const setores = [...new Set((d?.itens ?? []).map((m) => m.setor))];
  const conta = (k: string) => (d?.itens ?? []).filter((m) => m.cadencia === k).length;

  return (
    <>
      <PageHead
        titulo="Catálogo de atividades"
        acoes={
          d?.podeEditar ? (
            <Button variant="primary" onClick={() => setEdita('novo')}>
              <PlusIcon /> Atividade no catálogo
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
      <Aviso icone="info">
        As recorrentes (diária, semanal, quinzenal, mensal, bimestral, trimestral) ganham um cartão por período nos
        quadros de Comercial e Operações. As eventuais e os projetos entram por Nova atividade › Do catálogo. O cartão
        recorrente que nem foi iniciado sai do quadro quando o período vira e conta como não realizado no Dashboard.
      </Aviso>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Busca rotulo="Buscar no catálogo" valor={busca} aoMudar={setBusca} />
        <div className="flex flex-wrap items-center gap-2">
          <Escolha
            rotulo="Setor"
            todos="Todos os setores"
            valor={setor}
            aoMudar={setSetor}
            opcoes={setores.map((x) => ({ v: x, l: x }))}
            className="w-[190px]"
          />
          <Escolha
            rotulo="Cadência"
            todos="Todas as cadências"
            valor={cad}
            aoMudar={setCad}
            opcoes={Object.entries(CADENCIA_ROT).map(([k, l]) => ({ v: k, l: `${l} · ${conta(k)}` }))}
            className="w-[200px]"
          />
          <Escolha
            rotulo="Situação"
            todos="Ativas e inativas"
            valor={ativo}
            aoMudar={setAtivo}
            opcoes={[
              { v: 'true', l: 'Ativas' },
              { v: 'false', l: 'Inativas' },
            ]}
            className="w-[180px]"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <Table aria-label="Catálogo de atividades">
          <THead>
            <Tr>
              <Th>Atividade</Th>
              <Th>Setor</Th>
              <Th>Cadência</Th>
              <Th>Tipo</Th>
              <Th>Responsável padrão</Th>
              <Th className="text-right">Abertas</Th>
              <Th>Situação</Th>
              {d?.podeEditar && <Th className="w-12" />}
            </Tr>
          </THead>
          <TBody>
            {fatia.length ? (
              fatia.map((m) => (
                <Tr key={m.id}>
                  <Td className="max-w-[460px]">
                    <b className="text-texto">{m.nome}</b>
                    {m.descricao && <p className="m-0 mt-0.5 line-clamp-2 text-apagado">{m.descricao}</p>}
                  </Td>
                  <Td className="whitespace-nowrap">{m.setor}</Td>
                  <Td>
                    <Badge tom={m.cadencia === 'projeto' ? 'purple' : m.cadencia === 'eventual' ? 'gray' : 'blue'}>
                      {CADENCIA_ROT[m.cadencia]}
                    </Badge>
                  </Td>
                  <Td>{m.tipo}</Td>
                  <Td>{m.responsavel || <span className="text-apagado">—</span>}</Td>
                  <Td className="text-right tabular-nums">{m.abertas}</Td>
                  <Td>
                    <Badge tom={m.ativo ? 'green' : 'gray'}>{m.ativo ? 'Ativa' : 'Inativa'}</Badge>
                  </Td>
                  {d?.podeEditar && (
                    <Td>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${m.nome}`}
                        onClick={() => setEdita(m)}
                      >
                        <PencilIcon />
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={8} className="py-8 text-center text-apagado">
                  nenhuma atividade neste filtro
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
        {rodape}
      </Card>
      {op.data && (
        <DialogoModelo op={op.data} item={edita} aoFechar={() => setEdita(null)} aoSalvo={(txt) => setMsg({ txt })} />
      )}
    </>
  );
}

function DialogoModelo({
  op,
  item,
  aoFechar,
  aoSalvo,
}: {
  op: Opcoes;
  item: Item | 'novo' | null;
  aoFechar: () => void;
  aoSalvo: (txt: string) => void;
}) {
  const acao = useAtvAcao();
  const setores = op.frentes.flatMap((f) => f.setores);
  const ini = () =>
    item && item !== 'novo'
      ? { ...item }
      : {
          nome: '',
          descricao: '',
          cadencia: 'eventual',
          setor: setores[0] ?? '',
          tipo: 'Tarefa',
          responsavel: '',
          prioridade: 'Média',
          ativo: true,
        };
  const [v, setV] = useState(ini);
  const [erro, setErro] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (item) {
      setV(ini());
      setErro('');
    }
  }, [item]);
  const m = (k: string) => (x: string | boolean) => setV((o) => ({ ...o, [k]: x }));
  const salvar = () => {
    if (v.nome.trim().length < 3) return setErro('Informe o nome (3 letras ou mais).');
    const { nome, descricao, cadencia, setor, tipo, responsavel, prioridade, ativo } = v;
    acao.mutate(
      {
        caminho: item && item !== 'novo' ? `/catalogo/${item.id}` : '/catalogo',
        method: item && item !== 'novo' ? 'PATCH' : 'POST',
        json: { nome, descricao, cadencia, setor, tipo, responsavel, prioridade, ativo },
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
    <Dialog open={!!item} onOpenChange={(x) => !x && aoFechar()}>
      <DialogContent tamanho="lg">
        <DialogHead
          titulo={item && item !== 'novo' ? 'Editar atividade do catálogo' : 'Atividade no catálogo'}
          descricao="vale para os próximos cartões; os que já existem não mudam"
        />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="md-nome">
              Nome<span className="text-vermelho">*</span>
            </Label>
            <Input id="md-nome" value={v.nome} onChange={(e) => m('nome')(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Setor</Label>
            <Escolha
              rotulo="Setor"
              destacar={false}
              valor={v.setor}
              aoMudar={m('setor')}
              grupos={op.frentes.map((f) => ({ rot: f.frente, opcoes: f.setores.map((s) => ({ v: s, l: s })) }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Cadência</Label>
            <Escolha
              rotulo="Cadência"
              destacar={false}
              valor={v.cadencia}
              aoMudar={m('cadencia')}
              opcoes={op.cadencias.map((c) => ({ v: c.k, l: c.t }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Escolha
              rotulo="Tipo"
              destacar={false}
              valor={v.tipo}
              aoMudar={m('tipo')}
              opcoes={op.tipos.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Prioridade</Label>
            <Escolha
              rotulo="Prioridade"
              destacar={false}
              valor={v.prioridade}
              aoMudar={m('prioridade')}
              opcoes={op.prioridades.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Responsável padrão</Label>
            <Escolha
              rotulo="Responsável padrão"
              todos="Sem responsável"
              destacar={false}
              valor={v.responsavel}
              aoMudar={m('responsavel')}
              opcoes={op.pessoas.map((x) => ({ v: x, l: x }))}
            />
          </div>
          <div className="flex items-center gap-3 self-end pb-2">
            <Switch id="md-ativo" checked={v.ativo} onCheckedChange={m('ativo')} />
            <Label htmlFor="md-ativo">Ativa (recorrente gera cartões)</Label>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="md-desc">Descrição</Label>
            <textarea
              id="md-desc"
              rows={4}
              value={v.descricao}
              onChange={(e) => m('descricao')(e.target.value)}
              className="w-full rounded-md border border-borda-forte bg-card px-3 py-2.5 text-sm text-texto placeholder:text-apagado-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
            />
          </div>
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending} onClick={salvar}>
            Salvar
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
