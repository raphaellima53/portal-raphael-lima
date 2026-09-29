'use client';

import { useMemo, useState } from 'react';
import { CampoData, CampoHora } from '@/components/campos-data';
import { Escolha, EscolhaVarias } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { DialogBody, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type AvulsaForm, useCriarAvulsa, useOpcoesAvulsa } from '@/lib/agenda';
import { ErroApi } from '@/lib/api';

const Req = () => <span className="text-vermelho">*</span>;
/** "09:00" + 50 min → "09:50" */
const soma = (hm: string, min: number) => {
  const [h, m] = hm.split(':').map(Number);
  const t = (h || 0) * 60 + (m || 0) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * + Novo › Aula (24/09/2026): uma aula fora da grade. Curso, Módulo ou turma, Tópico, Data, Início e Término são
 * obrigatórios; Professor, Local ou link, Descrição e Participantes (alunos com matrícula no curso) são opcionais.
 * O tópico vem do currículo do módulo; sem currículo, é texto livre.
 */
export function FormAula({
  novoData,
  tipo,
  voltar,
  aoOk,
}: {
  novoData: string;
  /** seletor Reunião · Aula do + Novo */
  tipo: React.ReactNode;
  voltar: () => void;
  aoOk: (r: { k: string; data: string; msg: string }) => void;
}) {
  const op = useOpcoesAvulsa(true);
  const criar = useCriarAvulsa();
  const [f, setF] = useState<AvulsaForm>({
    cursoId: null,
    modulo: '',
    topico: '',
    conteudo: '',
    professorId: '',
    data: novoData,
    ini: '09:00',
    fim: '10:00',
    local: '',
    desc: '',
    alunos: [],
  });
  const [erro, setErro] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const muda = (p: Partial<AvulsaForm>) => {
    setF((x) => ({ ...x, ...p }));
    setErro('');
    setConfirmar(false);
  };
  const c = op.data?.cursos.find((x) => x.id === f.cursoId);
  const topicos = useMemo(() => {
    const l = c ? (c.topicos[f.modulo] ?? c.topicos[''] ?? []) : [];
    const gs = [...new Set(l.map((x) => x.grupo))];
    return gs.map((g) => ({ rot: g, opcoes: l.filter((x) => x.grupo === g).map(({ v, l: t }) => ({ v, l: t })) }));
  }, [c, f.modulo]);

  const enviar = () => {
    if (!f.cursoId) return setErro('Escolha o curso.');
    if (c?.itens.length && !f.modulo) return setErro(`Escolha ${c.rotuloItem === 'Turma' ? 'a turma' : 'o módulo'}.`);
    if (!f.conteudo && !f.topico.trim()) return setErro('Informe o tópico da aula.');
    if (!f.data) return setErro('Informe a data.');
    if (!f.ini || !f.fim || f.fim <= f.ini) return setErro('O término precisa ser depois do início.');
    criar.mutate(
      { ...f, confirmar },
      {
        onSuccess: aoOk,
        onError: (e) => {
          if (e instanceof ErroApi && e.status === 409) setConfirmar(true);
          setErro(e.message);
        },
      },
    );
  };

  return (
    <>
      <DialogHead titulo="Nova aula" descricao="uma aula fora da grade, com tópico, professor e alunos" />
      <DialogBody className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">{tipo}</div>
        {op.isError && <p className="m-0 text-vermelho sm:col-span-2">{op.error.message}</p>}
        <div className="grid content-start gap-1.5">
          <Label>
            Curso
            <Req />
          </Label>
          <Escolha
            rotulo="Curso"
            todos="Escolha o curso…"
            destacar={false}
            valor={f.cursoId ? String(f.cursoId) : ''}
            aoMudar={(v) => {
              const nc = op.data?.cursos.find((x) => String(x.id) === v);
              muda({
                cursoId: v ? Number(v) : null,
                modulo: '',
                conteudo: '',
                professorId: '',
                alunos: [],
                fim: nc ? soma(f.ini, nc.duracao) : f.fim,
              });
            }}
            opcoes={(op.data?.cursos ?? []).map((x) => ({ v: String(x.id), l: x.nome }))}
          />
        </div>
        <div className="grid content-start gap-1.5">
          <Label>
            {c?.rotuloItem === 'Turma' ? 'Turma' : c?.rotuloItem === 'Módulo' ? 'Módulo' : 'Módulo ou turma'}
            {!!c?.itens.length && <Req />}
          </Label>
          <Escolha
            rotulo="Módulo ou turma"
            todos={!c ? 'escolha o curso antes' : c.itens.length ? 'Escolha…' : 'o curso não tem'}
            destacar={false}
            disabled={!c?.itens.length}
            valor={f.modulo}
            aoMudar={(v) => muda({ modulo: v, conteudo: '' })}
            opcoes={(c?.itens ?? []).map((x) => ({ v: x, l: x }))}
          />
        </div>
        <div className="grid content-start gap-1.5 sm:col-span-2">
          <Label htmlFor="avTopico">
            Tópico
            <Req />
          </Label>
          {topicos.length > 0 && (
            <Escolha
              rotulo="Tópico do currículo"
              todos="Tópico livre (escrever abaixo)"
              destacar={false}
              valor={f.conteudo}
              aoMudar={(v) => muda({ conteudo: v })}
              grupos={topicos}
            />
          )}
          {!f.conteudo && (
            <Input
              id="avTopico"
              placeholder={topicos.length ? 'ou escreva o tópico' : 'ex.: Revisão para a prova'}
              value={f.topico}
              onChange={(e) => muda({ topico: e.target.value })}
            />
          )}
        </div>
        <div className="grid content-start gap-1.5 sm:col-span-2">
          <Label>Professor</Label>
          <Escolha
            rotulo="Professor"
            todos={c ? 'sem professor (vincular depois)' : 'escolha o curso antes'}
            destacar={false}
            disabled={!c}
            valor={f.professorId}
            aoMudar={(v) => muda({ professorId: v })}
            opcoes={c?.professores ?? []}
          />
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor="avData">
            Data
            <Req />
          </Label>
          <CampoData id="avData" rotulo="Data" valor={f.data} aoMudar={(data) => muda({ data })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="avIni">
              Início
              <Req />
            </Label>
            <CampoHora
              id="avIni"
              rotulo="Início"
              valor={f.ini}
              aoMudar={(ini) => muda({ ini, fim: c && ini ? soma(ini, c.duracao) : f.fim })}
            />
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor="avFim">
              Término
              <Req />
            </Label>
            <CampoHora id="avFim" rotulo="Término" valor={f.fim} aoMudar={(fim) => muda({ fim })} />
          </div>
        </div>
        <div className="grid content-start gap-1.5 sm:col-span-2">
          <Label htmlFor="avLocal">Local ou link</Label>
          <Input
            id="avLocal"
            placeholder="ex.: Sala 12 — Paulista ou https://zoom.us/j/…"
            value={f.local}
            onChange={(e) => muda({ local: e.target.value })}
          />
        </div>
        <div className="grid content-start gap-1.5 sm:col-span-2">
          <Label htmlFor="avDesc">Descrição</Label>
          <textarea
            id="avDesc"
            rows={3}
            className="rounded-md border border-borda-forte bg-card px-3 py-2 text-sm text-texto placeholder:text-apagado-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
            value={f.desc}
            onChange={(e) => muda({ desc: e.target.value })}
          />
        </div>
        <div className="grid content-start gap-1.5 sm:col-span-2">
          <Label>Participantes</Label>
          <EscolhaVarias
            rotulo="Participantes"
            todos={c ? 'nenhum aluno ainda' : 'escolha o curso antes'}
            resumo={(n) => `${n} alunos`}
            disabled={!c}
            valor={f.alunos}
            aoMudar={(alunos) => muda({ alunos })}
            opcoes={(c?.alunos ?? []).map((n) => ({ v: n, l: n }))}
            className="w-full"
          />
          <span className="text-apagado">alunos com matrícula ativa no curso</span>
        </div>
      </DialogBody>
      <DialogFoot>
        {erro && (
          <span role="alert" className="mr-auto font-medium text-vermelho">
            {erro}
          </span>
        )}
        <Button onClick={voltar}>Cancelar</Button>
        <Button variant="primary" disabled={criar.isPending} onClick={enviar}>
          {confirmar ? 'Criar mesmo assim' : 'Criar aula'}
        </Button>
      </DialogFoot>
    </>
  );
}
