'use client';

import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/*
 * Campo de cor só em HEX (pedido do usuário, 30/09/2026: "a base será somente HEX").
 * O seletor nativo do navegador mostra RGB e não deixa esconder — por isso a paleta é própria:
 * quadro de saturação × brilho, faixa de matiz e o código #RRGGBB; nada de RGB na tela.
 */

const HEX = /^#[0-9A-F]{6}$/;
const PADRAO = '#003FB0';

type Hsv = { h: number; s: number; v: number };

const limita = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));

function paraHsv(hex: string): Hsv {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function paraHex({ h, s, v }: Hsv) {
  const f = (k: number) => {
    const x = (k + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(x, 4 - x, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** normaliza o que a pessoa digita: maiúsculas, um # na frente, só 0-9A-F, no máximo 6 dígitos */
const mascara = (t: string) =>
  `#${t
    .toUpperCase()
    .replace(/[^0-9A-F]/g, '')
    .slice(0, 6)}`;

export function CampoCor({
  id,
  valor,
  aoMudar,
  rotulo,
  invalido,
}: {
  id?: string;
  valor: string;
  aoMudar: (hex: string) => void;
  rotulo: string;
  invalido?: boolean;
}) {
  const ok = HEX.test((valor ?? '').toUpperCase());
  const atual = ok ? valor.toUpperCase() : PADRAO;
  const [texto, setTexto] = useState((valor ?? '').toUpperCase());
  const [hsv, setHsv] = useState<Hsv>(() => paraHsv(atual));

  /* valor mudou por fora (reset do formulário, outro campo): acompanha sem perder a matiz de cinzas */
  useEffect(() => {
    setTexto((valor ?? '').toUpperCase());
    const v = (valor ?? '').toUpperCase();
    if (HEX.test(v)) setHsv((h) => (paraHex(h) === v ? h : paraHsv(v)));
  }, [valor]);

  const escolhe = (n: Hsv) => {
    setHsv(n);
    aoMudar(paraHex(n));
  };
  const digita = (t: string) => {
    const m = t === '' ? '' : mascara(t);
    setTexto(m);
    if (HEX.test(m)) aoMudar(m);
  };
  const campoHex = (idCampo?: string) => (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-md border bg-card px-2.5 focus-within:border-azul focus-within:ring-2 focus-within:ring-azul/20',
        invalido || (texto && !HEX.test(texto)) ? 'border-vermelho' : 'border-borda-forte',
      )}
    >
      <input
        id={idCampo}
        value={texto}
        onChange={(e) => digita(e.target.value)}
        onBlur={() => !HEX.test(texto) && setTexto((valor ?? '').toUpperCase())}
        placeholder={PADRAO}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        aria-label={idCampo ? undefined : `${rotulo} em HEX`}
        aria-invalid={invalido || (!!texto && !HEX.test(texto))}
        className="w-full min-w-0 bg-transparent text-sm text-texto tabular-nums uppercase outline-none"
      />
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${rotulo}: abrir paleta`}
            className="size-10 shrink-0 cursor-pointer rounded-md border border-borda-forte p-1 focus-visible:outline-2 focus-visible:outline-azul"
          >
            <span className="block size-full rounded" style={{ background: atual }} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="grid w-[260px] gap-3 p-3">
          <Quadro hsv={hsv} aoMudar={escolhe} rotulo={rotulo} />
          <Faixa hsv={hsv} aoMudar={escolhe} rotulo={rotulo} />
          <div className="grid gap-1">
            <span className="text-apagado text-sm">HEX</span>
            {campoHex()}
          </div>
        </PopoverContent>
      </Popover>
      <div className="min-w-0 flex-1">{campoHex(id)}</div>
    </div>
  );
}

/** arrastar com mouse, toque ou caneta; setas do teclado andam 1% (Shift: 10%) */
function useArrasto(aoPonto: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const ponto = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) aoPonto(limita((e.clientX - r.left) / r.width), limita((e.clientY - r.top) / r.height));
  };
  return {
    ref,
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      ponto(e);
    },
    onPointerMove: (e: React.PointerEvent) => e.buttons && ponto(e),
  };
}

function Quadro({ hsv, aoMudar, rotulo }: { hsv: Hsv; aoMudar: (n: Hsv) => void; rotulo: string }) {
  const arr = useArrasto((x, y) => aoMudar({ ...hsv, s: x, v: 1 - y }));
  const tecla = (e: React.KeyboardEvent) => {
    const p = e.shiftKey ? 0.1 : 0.01;
    const d = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, p], ArrowDown: [0, -p] }[e.key];
    if (!d) return;
    e.preventDefault();
    aoMudar({ ...hsv, s: limita(hsv.s + d[0]), v: limita(hsv.v + d[1]) });
  };
  return (
    <div
      {...arr}
      role="slider"
      tabIndex={0}
      aria-label={`${rotulo}: saturação e brilho`}
      aria-valuetext={`saturação ${Math.round(hsv.s * 100)}%, brilho ${Math.round(hsv.v * 100)}%`}
      aria-valuenow={Math.round(hsv.s * 100)}
      onKeyDown={tecla}
      className="relative h-36 cursor-crosshair touch-none rounded-md focus-visible:outline-2 focus-visible:outline-azul"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)`,
      }}
    >
      <span
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute size-3.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
      />
    </div>
  );
}

function Faixa({ hsv, aoMudar, rotulo }: { hsv: Hsv; aoMudar: (n: Hsv) => void; rotulo: string }) {
  const arr = useArrasto((x) => aoMudar({ ...hsv, h: x * 359 }));
  const tecla = (e: React.KeyboardEvent) => {
    const p = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: -p, ArrowDown: -p, ArrowRight: p, ArrowUp: p }[e.key];
    if (!d) return;
    e.preventDefault();
    aoMudar({ ...hsv, h: limita(hsv.h + d, 0, 359) });
  };
  return (
    <div
      {...arr}
      role="slider"
      tabIndex={0}
      aria-label={`${rotulo}: matiz`}
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(hsv.h)}
      onKeyDown={tecla}
      className="relative h-3 cursor-pointer touch-none rounded-full focus-visible:outline-2 focus-visible:outline-azul focus-visible:outline-offset-2"
      style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
    >
      <span
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
        style={{ left: `${(hsv.h / 359) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }}
      />
    </div>
  );
}
