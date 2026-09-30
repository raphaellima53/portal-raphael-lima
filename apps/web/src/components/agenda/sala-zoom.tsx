'use client';

import { VideoIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Aviso } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Entrada = {
  sdkKey: string;
  assinatura: string;
  reuniao: string;
  senha: string;
  nome: string;
  email: string;
  zak: string;
  anfitriao: boolean;
  sala: string;
};

/**
 * Sala do Zoom dentro do portal (30/09/2026): sem sair do portal e sem login. A API cria a reunião na conta (sala) que a
 * distribuição deu à aula — até 2 aulas simultâneas por conta — e devolve a assinatura; o professor entra como
 * anfitrião. A reunião roda em /zoom/sala.html, num iframe desta página, isolada do React do portal.
 */
export function SalaZoom({
  k,
  sala,
  semConta,
  autoAbrir,
}: {
  k: string;
  sala: string;
  semConta: boolean;
  autoAbrir?: boolean;
}) {
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [erro, setErro] = useState('');
  const [abrindo, setAbrindo] = useState(false);
  const quadro = useRef<HTMLIFrameElement>(null);

  const entra = async () => {
    setErro('');
    setAbrindo(true);
    try {
      setEntrada(await api<Entrada>(`/aulas/zoom?k=${encodeURIComponent(k)}`));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAbrindo(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: abre uma vez quando a página vem de "Entrar na sala"
  useEffect(() => {
    if (autoAbrir && !semConta) entra();
  }, [autoAbrir]);

  /* conversa com o iframe: ele avisa que está pronto, recebe a entrada e responde se abriu */
  useEffect(() => {
    if (!entrada) return;
    const ouve = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== quadro.current?.contentWindow) return;
      if (e.data?.tipo === 'zoom-pronto')
        quadro.current?.contentWindow?.postMessage({ tipo: 'zoom-entrar', ...entrada }, window.location.origin);
      if (e.data?.tipo === 'zoom-erro') setErro(`O Zoom não abriu a sala: ${e.data.erro}`);
    };
    window.addEventListener('message', ouve);
    return () => window.removeEventListener('message', ouve);
  }, [entrada]);

  if (semConta)
    return (
      <Aviso tom="red" icone="alerta">
        Todas as contas do Zoom já têm 2 aulas nesse horário. Cadastre mais uma conta em Configurações › Salas ou mude o
        horário da aula.
      </Aviso>
    );

  return (
    <div className="grid gap-3">
      {erro && (
        <Aviso tom="red" icone="alerta">
          {erro}
        </Aviso>
      )}
      {entrada ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-texto-2">
              {entrada.sala} · {entrada.anfitriao ? 'você é o anfitrião' : 'você entra como participante'}
            </span>
            <Button size="sm" className="ml-auto" onClick={() => setEntrada(null)}>
              <XIcon /> Sair da sala
            </Button>
          </div>
          <iframe
            ref={quadro}
            title={`Sala do Zoom · ${entrada.sala}`}
            src="/zoom/sala.html"
            allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
            className="h-[min(720px,calc(100dvh-160px))] w-full rounded-lg border border-borda bg-card"
          />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={entra} disabled={abrindo}>
            <VideoIcon /> {abrindo ? 'Abrindo a sala…' : 'Entrar na sala de aula'}
          </Button>
          <span className="text-apagado">{sala} · abre aqui mesmo, sem login no Zoom</span>
        </div>
      )}
    </div>
  );
}
