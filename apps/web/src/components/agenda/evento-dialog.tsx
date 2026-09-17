'use client';

import { AlertTriangleIcon, CalendarIcon, ClockIcon, DoorOpenIcon, VideoIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CampoData, CampoHora } from '@/components/campos-data';
import { Aviso } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type EventoDetalhe,
  type EventoForm,
  useEvento,
  useExcluirEvento,
  usePessoasEvento,
  useSalvarEvento,
} from '@/lib/agenda';
import { ErroApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Avatar } from './aula-comum';

export type AbreEvento = { id: string } | { novo: string } | null;
type Grupo = 'colaborador' | 'prestador' | 'aluno';
const UM: Record<Grupo, string> = { colaborador: 'Colaborador', prestador: 'Prestador', aluno: 'Aluno' };
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

/** Eventos e reuniões: detalhes (Editar, Excluir), criação e edição com participantes e aviso de choque de horário. */
export function EventoDialog({
  abre,
  aoFechar,
  eu,
  euProfessor,
  aoSalvo,
}: {
  abre: AbreEvento;
  aoFechar: () => void;
  eu: string | null;
  euProfessor: boolean;
  aoSalvo: (data: string) => void;
}) {
  const [modo, setModo] = useState<'ver' | 'form' | 'excluir'>('ver');
  const [id, setId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setMsg('');
    if (!abre) return;
    if ('id' in abre) {
      setId(abre.id);
      setModo('ver');
    } else {
      setId(null);
      setModo('form');
    }
  }, [abre]);
  const q = useEvento(id);
  const e = q.data;
  const novoData = abre && 'novo' in abre ? abre.novo : '';

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        {modo === 'form' ? (
          <Formulario
            key={id ?? `novo-${novoData}`}
            e={id ? (e ?? null) : null}
            novoData={novoData}
            eu={eu}
            euProfessor={euProfessor}
            voltar={() => (id ? setModo('ver') : aoFechar())}
            aoOk={(r) => {
              setId(r.id);
              setMsg(r.msg);
              setModo('ver');
              aoSalvo(r.data);
            }}
          />
        ) : !e ? (
          <>
            <DialogHead titulo="Detalhes do evento" />
            <DialogBody>
              {q.isError ? (
                <Aviso tom="red" icone="alerta">
                  {q.error.message}
                </Aviso>
              ) : (
                <p className="text-apagado">Carregando…</p>
              )}
            </DialogBody>
          </>
        ) : modo === 'excluir' ? (
          <Excluir e={e} voltar={() => setModo('ver')} aoOk={aoFechar} />
        ) : (
          <Detalhe
            e={e}
            msg={msg}
            aoFechar={aoFechar}
            editar={() => setModo('form')}
            excluir={() => setModo('excluir')}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detalhe({
  e,
  msg,
  aoFechar,
  editar,
  excluir,
}: {
  e: EventoDetalhe;
  msg: string;
  aoFechar: () => void;
  editar: () => void;
  excluir: () => void;
}) {
  const reuniao = e.tipo === 'Reunião';
  return (
    <>
      <DialogHead titulo={reuniao ? 'Detalhes da reunião' : 'Detalhes do evento'} />
      <DialogBody className="grid gap-3">
        {msg && (
          <Aviso tom="blue" icone="ok">
            {msg}
          </Aviso>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Badge tom={reuniao ? 'blue' : 'purple'}>{e.tipo}</Badge>
          <Badge>
            {e.part.length} {e.part.length === 1 ? 'participante' : 'participantes'}
          </Badge>
        </div>
        <div className="grid gap-1.5 rounded-lg bg-bg px-[18px] py-4">
          <h3 className="text-xl font-bold">{e.titulo}</h3>
          {e.desc && <p className="text-apagado">{e.desc}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-texto-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4 text-apagado" />
              {e.dataTxt}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-4 text-apagado" />
              {e.ini} – {e.fim}
            </span>
          </div>
        </div>
        {e.link ? (
          <Button asChild variant="primary">
            <a href={e.local} target="_blank" rel="noopener noreferrer">
              <VideoIcon /> Abrir link
            </a>
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2 text-texto-2">
            <DoorOpenIcon className="size-4 text-apagado" /> {e.local || 'sem local definido'}
          </span>
        )}
        {e.choques.length > 0 && (
          <Aviso tom="amber" icone="alerta">
            No mesmo horário: {e.choques.join(' · ')}
          </Aviso>
        )}
        <div>
          <small className="block text-sm font-semibold text-azul">Participantes</small>
          <b>
            {e.part.length} {e.part.length === 1 ? 'pessoa' : 'pessoas'}
          </b>
        </div>
        <ul className="grid gap-1">
          {e.part.map((x) => (
            <li key={`${x.g}|${x.n}`} className="flex items-center gap-3 py-1">
              <Avatar nome={x.n} />
              <div>
                <b className="block">{x.n}</b>
                <small className="text-sm text-apagado">{x.grupo}</small>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-apagado">criado por {e.por}</p>
      </DialogBody>
      <DialogFoot>
        {e.podeExcluir && (
          <Button variant="perigo" className="mr-auto" onClick={excluir}>
            Excluir
          </Button>
        )}
        {e.podeEditar && <Button onClick={editar}>Editar</Button>}
        <Button onClick={aoFechar}>Fechar</Button>
      </DialogFoot>
    </>
  );
}

function Excluir({ e, voltar, aoOk }: { e: EventoDetalhe; voltar: () => void; aoOk: () => void }) {
  const exc = useExcluirEvento();
  return (
    <>
      <DialogHead titulo={e.tipo === 'Reunião' ? 'Excluir reunião' : 'Excluir evento'} descricao={e.titulo} />
      <DialogBody>
        <div className="rounded-lg border border-[#f5c2c7] bg-vermelho-suave px-4 py-3">
          Sai da agenda dos {e.part.length} participantes. Não dá para desfazer.
        </div>
        {exc.isError && (
          <p role="alert" className="mt-3 font-medium text-vermelho">
            {exc.error.message}
          </p>
        )}
      </DialogBody>
      <DialogFoot>
        <Button onClick={voltar}>Voltar</Button>
        <Button variant="perigo" disabled={exc.isPending} onClick={() => exc.mutate(e.id, { onSuccess: aoOk })}>
          Excluir
        </Button>
      </DialogFoot>
    </>
  );
}

function Formulario({
  e,
  novoData,
  eu,
  euProfessor,
  voltar,
  aoOk,
}: {
  e: EventoDetalhe | null;
  novoData: string;
  eu: string | null;
  euProfessor: boolean;
  voltar: () => void;
  aoOk: (r: { id: string; data: string; msg: string }) => void;
}) {
  const pessoas = usePessoasEvento(true);
  const salvar = useSalvarEvento();
  const [f, setF] = useState<EventoForm>(() =>
    e
      ? {
          tipo: e.tipo as EventoForm['tipo'],
          titulo: e.titulo,
          data: e.data,
          ini: e.ini,
          fim: e.fim,
          local: e.local,
          desc: e.desc,
          part: e.part.map(({ g, n }) => ({ g, n })),
          confirmar: false,
        }
      : {
          tipo: 'Reunião',
          titulo: '',
          data: novoData,
          ini: '09:00',
          fim: '10:00',
          local: '',
          desc: '',
          part: eu ? [{ g: euProfessor ? 'prestador' : 'colaborador', n: eu }] : [],
          confirmar: false,
        },
  );
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const muda = (p: Partial<EventoForm>) => {
    setF((x) => ({ ...x, ...p, confirmar: p.part ? false : x.confirmar }));
    setErro('');
  };
  const tem = (g: Grupo, n: string) => f.part.some((x) => x.g === g && x.n === n);
  const troca = (g: Grupo, n: string) =>
    muda({ part: tem(g, n) ? f.part.filter((x) => !(x.g === g && x.n === n)) : [...f.part, { g, n }] });
  const grupos = useMemo(() => {
    const qn = norm(busca);
    return (pessoas.data?.grupos ?? [])
      .map((g) => {
        const itens = g.pessoas.filter((x) => !qn || norm(x).includes(qn));
        return { ...g, total: itens.length, itens: qn ? itens : itens.slice(0, 8) };
      })
      .filter((g) => g.itens.length);
  }, [pessoas.data, busca]);
  const ed = !!e;

  const enviar = () => {
    if (!f.titulo.trim()) return setErro('Informe o título.');
    if (!f.data) return setErro('Informe a data.');
    if (!f.ini || !f.fim || f.fim <= f.ini) return setErro('O término precisa ser depois do início.');
    if (!f.part.length) return setErro('Escolha ao menos um participante.');
    salvar.mutate(
      { ...f, id: e?.id ?? null },
      {
        onSuccess: aoOk,
        onError: (err) => {
          if (err instanceof ErroApi && err.status === 409) setF((x) => ({ ...x, confirmar: true }));
          setErro(err.message);
        },
      },
    );
  };

  return (
    <>
      <DialogHead
        titulo={ed ? `Editar ${f.tipo.toLowerCase()}` : 'Novo evento ou reunião'}
        descricao="vincule a um ou mais colaboradores, prestadores ou alunos"
      />
      <DialogBody className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label>Tipo</Label>
          <div role="group" aria-label="Tipo" className="inline-flex w-fit gap-1 rounded-md bg-cinza-suave p-1">
            {(['Reunião', 'Evento'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={f.tipo === t}
                onClick={() => muda({ tipo: t })}
                className={cn(
                  'h-8 cursor-pointer rounded-sm px-3.5 text-texto-2',
                  f.tipo === t && 'bg-card font-semibold text-texto shadow-el-1',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="evTitulo">
            Título<span className="text-vermelho">*</span>
          </Label>
          <Input
            id="evTitulo"
            autoFocus
            value={f.titulo}
            placeholder="ex.: Reunião pedagógica"
            onChange={(x) => muda({ titulo: x.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="evData">
            Data<span className="text-vermelho">*</span>
          </Label>
          <CampoData id="evData" rotulo="Data" valor={f.data} aoMudar={(data) => muda({ data })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="evIni">
              Início<span className="text-vermelho">*</span>
            </Label>
            <CampoHora id="evIni" rotulo="Início" valor={f.ini} aoMudar={(ini) => muda({ ini })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="evFim">
              Término<span className="text-vermelho">*</span>
            </Label>
            <CampoHora id="evFim" rotulo="Término" valor={f.fim} aoMudar={(fim) => muda({ fim })} />
          </div>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="evLocal">Local ou link</Label>
          <Input
            id="evLocal"
            value={f.local}
            placeholder="Sala 12 — Paulista ou https://zoom.us/j/…"
            onChange={(x) => muda({ local: x.target.value })}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="evDesc">Descrição</Label>
          <textarea
            id="evDesc"
            rows={2}
            value={f.desc}
            placeholder="pauta ou observações"
            onChange={(x) => muda({ desc: x.target.value })}
            className="rounded-md border border-borda-forte bg-card px-3 py-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="evBusca">
            Participantes<span className="text-vermelho">*</span>
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {f.part.length ? (
              f.part.map((x) => (
                <span
                  key={`${x.g}|${x.n}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-azul-suave py-1 pr-1 pl-3 text-azul"
                >
                  {x.n}
                  <small className="text-sm text-apagado">{UM[x.g]}</small>
                  <button
                    type="button"
                    aria-label={`Tirar ${x.n}`}
                    onClick={() => troca(x.g, x.n)}
                    className="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-card"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-apagado">nenhum participante escolhido</span>
            )}
          </div>
          <Input
            id="evBusca"
            value={busca}
            placeholder="Buscar colaborador, prestador ou aluno…"
            autoComplete="off"
            onChange={(x) => setBusca(x.target.value)}
          />
          <div
            role="group"
            aria-label="Pessoas"
            className="max-h-[260px] overflow-y-auto rounded-lg border border-borda p-2"
          >
            {grupos.map((g) => (
              <div key={g.g} className="mb-2">
                <small className="block px-1 py-1 text-sm font-semibold text-azul">
                  {g.rot}
                  {!busca && g.total > 8 ? ` · digite para ver os ${g.total}` : ''}
                </small>
                {g.itens.map((n) => (
                  <div key={n} className="flex items-center gap-2.5 rounded-sm px-1 py-1.5 hover:bg-hover">
                    <Checkbox id={`ev-${g.g}-${n}`} checked={tem(g.g, n)} onCheckedChange={() => troca(g.g, n)} />
                    <label htmlFor={`ev-${g.g}-${n}`} className="flex-1 cursor-pointer">
                      {n}
                    </label>
                  </div>
                ))}
              </div>
            ))}
            {!grupos.length && (
              <p className="p-2 text-apagado">{pessoas.isPending ? 'Carregando…' : 'ninguém com esse nome'}</p>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFoot>
        {erro && (
          <span role="alert" className="mr-auto inline-flex items-center gap-1.5 font-medium text-vermelho">
            {f.confirmar && <AlertTriangleIcon className="size-4" />}
            {erro}
          </span>
        )}
        <Button onClick={voltar}>{ed ? 'Voltar' : 'Cancelar'}</Button>
        <Button variant="primary" disabled={salvar.isPending} onClick={enviar}>
          {f.confirmar ? 'Salvar mesmo assim' : ed ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFoot>
    </>
  );
}
