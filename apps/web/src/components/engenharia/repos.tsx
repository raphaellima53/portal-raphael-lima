'use client';

import { ExternalLinkIcon, GitForkIcon, SearchIcon, StarIcon } from 'lucide-react';
import { useState } from 'react';
import { AvisoMsg, Barra, ErroQ, type Msg, Painel, Vazio } from '@/components/config/comum';
import { Aviso, PageHead, Stat } from '@/components/ds';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { type Analise, type RepoLinha, useAcaoEng, useIA, useRepos } from '@/lib/engenharia';

/** Engenharia › GitHub › Repositórios: lista do dono, clone e os 16 critérios de saúde */
export function TelaRepos({ abas }: { abas: React.ReactNode }) {
  const [dono, setDono] = useState('');
  const [busca, setBusca] = useState('');
  const q = useRepos(dono);
  const ia = useIA();
  const acao = useAcaoEng();
  const [msg, setMsg] = useState<Msg>(null);
  const [aberto, setAberto] = useState<{ repo: RepoLinha; analise: Analise } | null>(null);
  const [ocupado, setOcupado] = useState('');
  const d = q.data;
  const { fatia, rodape } = usePaginacao(d?.linhas ?? []);
  const crit = usePaginacao(d?.criterios ?? []);
  const aval = usePaginacao(aberto?.analise.itens ?? []);

  const analisar = (repo: RepoLinha) => {
    setOcupado(repo.nome);
    setMsg(null);
    acao.mutate(
      { caminho: '/repos/analisar', json: { dono: d?.dono, repo: repo.nome } },
      {
        onSuccess: (r) => {
          setOcupado('');
          setMsg({ txt: r.msg ?? '' });
          if (r.analise) setAberto({ repo, analise: r.analise });
        },
        onError: (e) => {
          setOcupado('');
          setMsg({ txt: e.message, erro: true });
        },
      },
    );
  };
  const explicar = (k: string) => {
    if (!aberto) return;
    setOcupado('ia');
    acao.mutate(
      { caminho: '/ia/explicar', json: { dono: d?.dono, repo: aberto.repo.nome, provedor: k } },
      {
        onSuccess: (r) => {
          setOcupado('');
          setMsg({ txt: r.resposta ? `${r.resposta.nome}: ${r.resposta.texto}` : '' });
          setAberto(null);
        },
        onError: (e) => {
          setOcupado('');
          setMsg({ txt: e.message, erro: true });
        },
      },
    );
  };
  const provedoresOk = (ia.data?.provedores ?? []).filter((p) => p.configurado);

  return (
    <>
      <PageHead titulo="Repositórios" />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      <Barra>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setDono(busca.trim());
            setMsg(null);
          }}
        >
          <div className="relative w-[300px] max-w-full">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-apagado" />
            <Input
              aria-label="Dono no GitHub"
              placeholder="usuário ou organização no GitHub…"
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" disabled={q.isFetching}>
            Buscar repositórios
          </Button>
        </form>
        {d?.dono && (
          <span className="ml-auto text-apagado">
            {d.linhas.length} {d.linhas.length === 1 ? 'repositório' : 'repositórios'} de {d.dono}
          </span>
        )}
      </Barra>
      {d && !d.comToken && (
        <Aviso icone="info">
          Sem <b>GITHUB_TOKEN</b> no .env da API: a busca usa a API pública, que responde 60 vezes por hora e mostra só
          repositório público. Com token, entram os privados e o limite sobe.
        </Aviso>
      )}
      {d && !d.dono && (
        <Aviso icone="info">
          Escreva o usuário ou a organização do GitHub para listar os repositórios. Para já vir preenchido, use
          GITHUB_OWNER no .env da API.
        </Aviso>
      )}
      {d?.dono && (
        <Card className="mb-4 overflow-hidden">
          <Table aria-label="Repositórios">
            <THead>
              <Tr>
                <Th>Repositório</Th>
                <Th>Linguagem</Th>
                <Th className="text-right">Estrelas</Th>
                <Th className="text-right">Issues</Th>
                <Th>Atualizado</Th>
                <Th>Saúde</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </THead>
            <TBody>
              {fatia.length ? (
                fatia.map((r) => {
                  const a = d.analises[r.nome];
                  return (
                    <Tr key={r.nome}>
                      <Td>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-azul hover:underline"
                        >
                          {r.nome} <ExternalLinkIcon className="size-3.5" aria-hidden />
                        </a>
                        <div className="text-apagado">{r.descricao || 'sem descrição'}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.privado && <Badge tom="amber">privado</Badge>}
                          {r.arquivado && <Badge tom="gray">arquivado</Badge>}
                          {r.fork && <Badge tom="gray">fork</Badge>}
                          {r.licenca && <Badge tom="blue">{r.licenca}</Badge>}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">{r.linguagem}</Td>
                      <Td className="text-right tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <StarIcon className="size-3.5 text-apagado" aria-hidden />
                          {r.estrelas}
                          <GitForkIcon className="ml-2 size-3.5 text-apagado" aria-hidden />
                          {r.forks}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums">{r.issues}</Td>
                      <Td className="whitespace-nowrap tabular-nums">{r.atualizado}</Td>
                      <Td>
                        {a ? (
                          <button
                            type="button"
                            className="cursor-pointer"
                            onClick={() => setAberto({ repo: r, analise: a })}
                            aria-label={`Ver os critérios de ${r.nome}`}
                          >
                            <Badge tom={a.tom}>
                              {a.nota}/100 · {a.selo}
                            </Badge>
                          </button>
                        ) : (
                          <span className="text-apagado-2">nunca analisado</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          disabled={!!ocupado}
                          aria-label={`Analisar ${r.nome}`}
                          onClick={() => analisar(r)}
                        >
                          {ocupado === r.nome ? 'Analisando…' : a ? 'Analisar de novo' : 'Analisar'}
                        </Button>
                      </Td>
                    </Tr>
                  );
                })
              ) : (
                <Vazio cols={7} txt="nenhum repositório para este dono" />
              )}
            </TBody>
          </Table>
          {rodape}
        </Card>
      )}
      {d && (
        <Painel titulo="Os 16 critérios de saúde" sub="a nota é a média ponderada pelo peso de cada critério">
          <Table aria-label="Critérios de saúde">
            <THead>
              <Tr>
                <Th>Critério</Th>
                <Th>O que conta</Th>
                <Th className="text-right">Peso</Th>
              </Tr>
            </THead>
            <TBody>
              {crit.fatia.map((c) => (
                <Tr key={c.k}>
                  <Td className="font-medium whitespace-nowrap text-texto">{c.t}</Td>
                  <Td>{c.d}</Td>
                  <Td className="text-right tabular-nums">{c.peso}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {crit.rodape}
        </Painel>
      )}

      <Dialog open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent tamanho="lg">
          <DialogHead
            titulo={aberto ? `${d?.dono}/${aberto.repo.nome}` : ''}
            descricao={aberto ? `análise de ${aberto.analise.quando} por ${aberto.analise.por}` : ''}
          />
          <DialogBody>
            {aberto && (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat valor={`${aberto.analise.nota}/100`} rotulo={aberto.analise.selo} tom={aberto.analise.tom} />
                  <Stat valor={aberto.analise.ok} rotulo="critérios ok" tom="green" />
                  <Stat valor={aberto.analise.atencao} rotulo="em atenção" tom="amber" />
                  <Stat valor={aberto.analise.falha} rotulo="em falha" tom="red" />
                </div>
                <Table aria-label="Critérios avaliados">
                  <THead>
                    <Tr>
                      <Th>Critério</Th>
                      <Th>Situação</Th>
                      <Th>O que foi encontrado</Th>
                      <Th className="text-right">Peso</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {aval.fatia.map((i) => (
                      <Tr key={i.k}>
                        <Td className="font-medium text-texto">{i.t}</Td>
                        <Td>
                          <Badge tom={i.tom}>{i.rotulo}</Badge>
                        </Td>
                        <Td>{i.detalhe}</Td>
                        <Td className="text-right tabular-nums">{i.peso}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
                {aval.rodape}
              </>
            )}
          </DialogBody>
          <DialogFoot>
            {provedoresOk.length ? (
              <span className="mr-auto flex flex-wrap items-center gap-2">
                <span className="text-apagado">Explicar o que corrigir primeiro com:</span>
                {provedoresOk.map((p) => (
                  <Button key={p.k} size="sm" disabled={!!ocupado} onClick={() => explicar(p.k)}>
                    {p.nome}
                  </Button>
                ))}
              </span>
            ) : (
              <span className="mr-auto text-apagado">
                Configure uma chave em Provedores de IA para pedir a explicação do que corrigir primeiro.
              </span>
            )}
            <Button onClick={() => setAberto(null)}>Fechar</Button>
          </DialogFoot>
        </DialogContent>
      </Dialog>
    </>
  );
}
