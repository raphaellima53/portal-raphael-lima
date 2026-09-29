'use client';

import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AvisoMsg, Barra, Busca, ErroQ, type Msg, normaliza } from '@/components/config/comum';
import { PageHead } from '@/components/ds';
import { Escolha } from '@/components/escolha';
import { usePaginacao } from '@/components/paginacao';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type ItemLixeira, useApagarDeVez, useLixeira, useRestaurar } from '@/lib/lixeira';

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** Configurações › Lixeira (24/09/2026): o que o Admin excluiu, para restaurar igual ou apagar de vez */
export function TelaLixeira({ abas }: { abas: React.ReactNode }) {
  const q = useLixeira();
  const restaurar = useRestaurar();
  const [msg, setMsg] = useState<Msg>(null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [apagar, setApagar] = useState<ItemLixeira | null>(null);
  const d = q.data;
  const lista = useMemo(() => {
    const n = normaliza(busca);
    return (d?.itens ?? []).filter(
      (x) => (!tipo || x.tipo === tipo) && (!n || normaliza(`${x.nome} ${x.resumo} ${x.por}`).includes(n)),
    );
  }, [d, busca, tipo]);
  const { fatia, rodape, setPag } = usePaginacao(lista);

  return (
    <>
      <PageHead titulo="Lixeira" />
      {abas}
      <p className="mt-0 mb-4 text-apagado">
        O que o Admin excluiu fica aqui com tudo o que foi junto. Restaurar devolve igual, com os mesmos códigos; apagar
        de vez não tem volta.
      </p>
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error ?? (restaurar.error as Error | null)} />
      {d && (
        <>
          <Barra>
            <Busca
              rotulo="Buscar na Lixeira"
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
              opcoes={d.tipos}
              className="w-[220px]"
            />
          </Barra>
          <Card className="overflow-hidden">
            <Table aria-label="Lixeira">
              <THead>
                <Tr>
                  <Th>Registro</Th>
                  <Th>Foi junto</Th>
                  <Th>Excluído por</Th>
                  <Th>Quando</Th>
                  <Th className="text-right">Ações</Th>
                </Tr>
              </THead>
              <TBody>
                {fatia.length ? (
                  fatia.map((x) => (
                    <Tr key={x.id}>
                      <Td>
                        <span className="block font-medium text-texto">{x.nome}</span>
                        <span className="text-apagado">{x.rotulo}</span>
                      </Td>
                      <Td>{x.resumo || <span className="text-apagado">nada</span>}</Td>
                      <Td>{x.por}</Td>
                      <Td className="whitespace-nowrap tabular-nums">{dataHora(x.em)}</Td>
                      <Td className="text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          disabled={restaurar.isPending}
                          onClick={() =>
                            restaurar.mutate(x.id, {
                              onSuccess: (r) => setMsg({ txt: r.msg }),
                              onError: (e) => setMsg({ txt: e.message, erro: true }),
                            })
                          }
                        >
                          <RotateCcwIcon /> Restaurar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Apagar ${x.nome} de vez`}
                          className="ml-1"
                          onClick={() => setApagar(x)}
                        >
                          <Trash2Icon />
                        </Button>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={5} className="py-10 text-center text-apagado">
                      {d.itens.length ? 'nada com esses filtros' : 'a Lixeira está vazia'}
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
            {rodape}
          </Card>
        </>
      )}
      <ApagarDeVez item={apagar} aoFechar={() => setApagar(null)} aoMsg={(t) => setMsg({ txt: t })} />
    </>
  );
}

function ApagarDeVez({
  item,
  aoFechar,
  aoMsg,
}: {
  item: ItemLixeira | null;
  aoFechar: () => void;
  aoMsg: (m: string) => void;
}) {
  const apagar = useApagarDeVez();
  const fecha = () => {
    apagar.reset();
    aoFechar();
  };
  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && fecha()}>
      <DialogContent>
        <DialogHead titulo={`Apagar ${item?.nome ?? ''} de vez?`} descricao="não dá para desfazer" />
        <DialogBody>
          <p className="m-0">
            {item?.rotulo}
            {item?.resumo ? `, com ${item.resumo},` : ''} sai da Lixeira e não pode mais ser restaurado.
          </p>
        </DialogBody>
        <DialogFoot>
          {apagar.isError && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {apagar.error.message}
            </span>
          )}
          <Button type="button" onClick={fecha}>
            Voltar
          </Button>
          <Button
            variant="perigo"
            disabled={apagar.isPending}
            onClick={() =>
              item &&
              apagar.mutate(item.id, {
                onSuccess: (r) => {
                  fecha();
                  aoMsg(r.msg);
                },
              })
            }
          >
            Apagar de vez
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
