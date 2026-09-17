'use client';

import { ExternalLinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AvisoMsg, Campo, ChipMulti, ErroQ, type Msg, textareaCls } from '@/components/config/comum';
import { Aviso, PageHead } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHead, CardTitle } from '@/components/ui/card';
import { type RespostaIA, useAcaoEng, useIA } from '@/lib/engenharia';

/** Engenharia › IA › Provedores: Anthropic, OpenAI e Google Gemini, com a mesma pergunta lado a lado */
export function TelaIA({ abas }: { abas: React.ReactNode }) {
  const q = useIA();
  const acao = useAcaoEng();
  const [msg, setMsg] = useState<Msg>(null);
  const [prompt, setPrompt] = useState('');
  const [sistema, setSistema] = useState('');
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [respostas, setRespostas] = useState<RespostaIA[]>([]);
  const d = q.data;

  useEffect(() => {
    if (d) setEscolhidos(d.provedores.filter((p) => p.configurado).map((p) => p.k));
  }, [d]);

  const enviar = () => {
    if (!prompt.trim()) return setMsg({ txt: 'Escreva a pergunta.', erro: true });
    if (!escolhidos.length) return setMsg({ txt: 'Escolha ao menos um provedor.', erro: true });
    setMsg(null);
    setRespostas([]);
    acao.mutate(
      { caminho: '/ia/perguntar', json: { prompt, sistema, provedores: escolhidos } },
      {
        onSuccess: (r) => setRespostas(r.respostas ?? []),
        onError: (e) => setMsg({ txt: e.message, erro: true }),
      },
    );
  };

  return (
    <>
      <PageHead titulo="Provedores de IA" />
      {abas}
      <AvisoMsg msg={msg} />
      <ErroQ e={q.error} />
      {d && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {d.provedores.map((p) => (
              <Card key={p.k} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-md text-texto">{p.nome}</b>
                  <Badge tom={p.configurado ? 'green' : 'gray'}>
                    {p.configurado ? 'chave configurada' : 'sem chave'}
                  </Badge>
                </div>
                <div className="mt-1 text-texto-2">
                  modelo <span className="font-mono">{p.modelo}</span>
                </div>
                <div className="mt-0.5 text-apagado">
                  {p.configurado ? (
                    <>
                      chave em <span className="font-mono">{p.chaveEnv}</span>, modelo em{' '}
                      <span className="font-mono">{p.modeloEnv}</span>
                    </>
                  ) : (
                    <>
                      preencha <span className="font-mono">{p.chaveEnv}</span> no .env da API e reinicie
                    </>
                  )}
                </div>
                <a
                  href={p.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-azul hover:underline"
                >
                  documentação da API <ExternalLinkIcon className="size-3.5" aria-hidden />
                </a>
              </Card>
            ))}
          </div>
          {!d.algum && (
            <Aviso icone="info">
              Nenhuma chave configurada. A tela funciona sem chave, mas a resposta de cada provedor vai dizer o que
              falta. As chaves ficam só no <b>.env da API</b> e nunca chegam ao navegador.
            </Aviso>
          )}
          <Card className="mb-4 overflow-hidden">
            <CardHead>
              <CardTitle>Perguntar</CardTitle>
              <span className="text-apagado-2">a mesma pergunta vai para os provedores marcados, ao mesmo tempo</span>
            </CardHead>
            <div className="grid gap-4 px-5 py-4">
              <Campo id="ia-prompt" rotulo="Pergunta" req>
                <textarea
                  id="ia-prompt"
                  rows={4}
                  className={textareaCls}
                  placeholder="Ex.: explique em três frases o que este portal faz."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </Campo>
              <Campo id="ia-sistema" rotulo="Instrução de sistema" ajuda="opcional: como o modelo deve responder">
                <textarea
                  id="ia-sistema"
                  rows={2}
                  className={textareaCls}
                  placeholder="Ex.: responda em português do Brasil, em frases curtas."
                  value={sistema}
                  onChange={(e) => setSistema(e.target.value)}
                />
              </Campo>
              <fieldset className="grid gap-2">
                <legend className="mb-1.5 font-semibold text-texto-2">Provedores</legend>
                <div className="flex flex-wrap gap-2">
                  {d.provedores.map((p) => (
                    <ChipMulti
                      key={p.k}
                      on={escolhidos.includes(p.k)}
                      aoClicar={() =>
                        setEscolhidos(
                          escolhidos.includes(p.k) ? escolhidos.filter((x) => x !== p.k) : [...escolhidos, p.k],
                        )
                      }
                    >
                      {p.nome}
                      {p.configurado ? '' : ' (sem chave)'}
                    </ChipMulti>
                  ))}
                </div>
              </fieldset>
              <div>
                <Button variant="primary" disabled={acao.isPending} onClick={enviar}>
                  {acao.isPending ? 'Perguntando…' : 'Perguntar'}
                </Button>
              </div>
            </div>
          </Card>
          {respostas.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2">
              {respostas.map((r) => (
                <Card key={r.k} className="overflow-hidden">
                  <CardHead className="flex-wrap">
                    <CardTitle>{r.nome}</CardTitle>
                    <span className="font-mono text-apagado-2">{r.modelo}</span>
                    {r.erro ? (
                      <Badge tom="red">erro</Badge>
                    ) : (
                      <span className="ml-auto text-apagado">
                        {(r.ms / 1000).toFixed(1).replace('.', ',')} s{r.tokens ? ` · ${r.tokens} tokens` : ''}
                      </span>
                    )}
                  </CardHead>
                  <div className="px-5 py-4">
                    {r.erro ? (
                      <p role="alert" className="text-vermelho">
                        {r.erro}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap text-texto-2">{r.texto}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
