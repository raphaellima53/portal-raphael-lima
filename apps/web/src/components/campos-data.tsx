'use client';

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const p2 = (n: number) => String(n).padStart(2, '0');
const isoParaBr = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
const brParaIso = (br: string) => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const mascara = (v: string, partes: number[], sep: string) => {
  const d = v.replace(/\D/g, '').slice(
    0,
    partes.reduce((s, x) => s + x, 0),
  );
  let out = '';
  let i = 0;
  partes.forEach((n, k) => {
    const pedaco = d.slice(i, i + n);
    if (!pedaco) return;
    out += (k ? sep : '') + pedaco;
    i += n;
  });
  return out;
};
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const CLASSE_CAMPO =
  'h-10 w-full rounded-md border border-borda-forte bg-card px-3 text-sm tabular-nums text-texto transition-[border-color,box-shadow] duration-150 hover:border-[#b7c1d1] focus:border-azul focus:shadow-anel focus-visible:outline-none aria-invalid:border-vermelho';

/** data-select do DS: dd/mm/aaaa com máscara e calendário (Alt + ↓ abre). Valor em AAAA-MM-DD. */
export function CampoData({
  id,
  valor,
  aoMudar,
  rotulo,
}: {
  id?: string;
  valor: string;
  aoMudar: (iso: string) => void;
  rotulo: string;
}) {
  const [txt, setTxt] = useState(isoParaBr(valor));
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => setTxt(isoParaBr(valor)), [valor]);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverAnchor asChild>
        <div className="relative">
          <input
            id={id}
            aria-label={rotulo}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={txt}
            aria-invalid={!!erro}
            className={cn(CLASSE_CAMPO, 'pr-11')}
            onChange={(e) => {
              const t = mascara(e.target.value, [2, 2, 4], '/');
              setTxt(t);
              const iso = brParaIso(t);
              setErro(t.length === 10 && !iso ? 'Data inválida' : '');
              if (iso) aoMudar(iso);
            }}
            onKeyDown={(e) => {
              if (e.altKey && e.key === 'ArrowDown') {
                e.preventDefault();
                setAberto(true);
              }
            }}
          />
          <button
            type="button"
            aria-label="Abrir calendário"
            aria-expanded={aberto}
            onClick={() => setAberto(!aberto)}
            className="absolute top-1 right-1 grid size-8 cursor-pointer place-items-center rounded-sm text-apagado hover:bg-azul-suave hover:text-azul"
          >
            <CalendarIcon className="size-[18px]" />
          </button>
          {erro && <span className="mt-1 block font-medium text-vermelho">{erro}</span>}
        </div>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-[308px] p-3">
        <Calendario
          valor={valor}
          aoEscolher={(iso) => {
            aoMudar(iso);
            setErro('');
            setAberto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function Calendario({ valor, aoEscolher }: { valor: string; aoEscolher: (iso: string) => void }) {
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${p2(hoje.getMonth() + 1)}-${p2(hoje.getDate())}`;
  const base = /^\d{4}-\d{2}/.test(valor) ? valor : hojeIso;
  const [ano, setAno] = useState(Number(base.slice(0, 4)));
  const [mes, setMes] = useState(Number(base.slice(5, 7)) - 1);
  const primeiro = new Date(ano, mes, 1);
  const ini = new Date(primeiro);
  ini.setDate(1 - primeiro.getDay());
  const anda = (n: number) => {
    const d = new Date(ano, mes + n, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => anda(-1)}
          className="grid size-9 cursor-pointer place-items-center rounded-sm hover:bg-bg"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <b className="text-md">
          {MESES[mes]} de {ano}
        </b>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => anda(1)}
          className="grid size-9 cursor-pointer place-items-center rounded-sm hover:bg-bg"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
      <div role="grid" className="grid grid-cols-7 gap-0.5 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={i} className="py-1 font-semibold text-apagado">
            {d}
          </span>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const d = new Date(ini);
          d.setDate(ini.getDate() + i);
          const iso = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
          return (
            <button
              key={iso}
              type="button"
              aria-label={iso.split('-').reverse().join('/')}
              aria-pressed={iso === valor}
              onClick={() => aoEscolher(iso)}
              className={cn(
                'size-[38px] cursor-pointer rounded-full tabular-nums hover:bg-azul-suave hover:text-azul',
                d.getMonth() !== mes && 'text-[#9aa3b2]',
                iso === hojeIso && 'font-bold text-azul shadow-[inset_0_0_0_1.5px_var(--blue)]',
                iso === valor && 'bg-azul font-bold text-white hover:bg-azul hover:text-white',
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between">
        <button
          type="button"
          className="cursor-pointer px-2 py-1 font-medium text-azul hover:underline"
          onClick={() => aoEscolher(hojeIso)}
        >
          Hoje
        </button>
      </div>
    </div>
  );
}

/** hora do DS: HH:MM com máscara */
export function CampoHora({
  id,
  valor,
  aoMudar,
  rotulo,
}: {
  id?: string;
  valor: string;
  aoMudar: (v: string) => void;
  rotulo: string;
}) {
  const [txt, setTxt] = useState(valor);
  useEffect(() => setTxt(valor), [valor]);
  const valido = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  return (
    <input
      id={id}
      aria-label={rotulo}
      inputMode="numeric"
      placeholder="HH:MM"
      value={txt}
      aria-invalid={txt.length === 5 && !valido(txt)}
      className={cn(CLASSE_CAMPO, 'text-center')}
      onChange={(e) => {
        const t = mascara(e.target.value, [2, 2], ':');
        setTxt(t);
        if (valido(t)) aoMudar(t);
      }}
    />
  );
}
