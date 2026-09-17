'use client';

import { useEffect, useState } from 'react';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useMassa, usePreviaMassa } from '@/lib/agenda';

/** Ação em massa da lista do dia: trocar professor, cancelar as futuras ou reenviar o link da sala. */
export function MassaDialog({
  ks,
  aoFechar,
  aoOk,
}: {
  ks: string[] | null;
  aoFechar: () => void;
  aoOk: (msg: string) => void;
}) {
  const previa = usePreviaMassa(ks);
  const massa = useMassa();
  const [acao, setAcao] = useState('');
  const [prof, setProf] = useState('');
  const [erro, setErro] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: nova marcação limpa o formulário
  useEffect(() => {
    setAcao('');
    setProf('');
    setErro('');
  }, [ks]);
  const p = previa.data;
  return (
    <Dialog open={!!ks} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead
          titulo="Ação em massa"
          descricao={`${ks?.length ?? 0} ${ks?.length === 1 ? 'aula marcada' : 'aulas marcadas'}`}
        />
        <DialogBody className="grid gap-4">
          <ul className="list-disc pl-5">
            {p?.aulas.map((a) => (
              <li key={a.k}>
                {a.rot} · {a.prof}
              </li>
            ))}
          </ul>
          <div className="grid gap-1.5">
            <Label>
              O que fazer<span className="text-vermelho">*</span>
            </Label>
            <Escolha
              rotulo="O que fazer"
              todos="escolha a ação"
              destacar={false}
              valor={acao}
              aoMudar={(v) => {
                setAcao(v);
                setErro('');
              }}
              opcoes={[
                { v: 'prof', l: 'Trocar o professor' },
                { v: 'cancelar', l: 'Cancelar as aulas que ainda não aconteceram' },
                { v: 'zoom', l: 'Reenviar o link da sala aos alunos' },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Novo professor</Label>
            <Escolha
              rotulo="Novo professor"
              todos={
                p?.profs.length ? 'escolha o professor' : 'nenhum professor habilitado em todos os cursos marcados'
              }
              destacar={false}
              valor={prof}
              aoMudar={(v) => {
                setProf(v);
                setErro('');
              }}
              opcoes={(p?.profs ?? []).map((n) => ({ v: n, l: n }))}
              disabled={acao !== 'prof'}
            />
            <span className="text-apagado">
              só para Trocar o professor; aparecem os habilitados em todos os cursos marcados
            </span>
          </div>
          {p && p.futuras < p.aulas.length && (
            <p className="text-apagado">
              {p.aulas.length - p.futuras} já aconteceram ou estão canceladas: trocar professor e cancelar valem só para
              as {p.futuras} futuras.
            </p>
          )}
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={massa.isPending || !ks}
            onClick={() => {
              if (!acao) return setErro('Escolha o que fazer.');
              if (acao === 'prof' && !prof) return setErro('Escolha o novo professor.');
              massa.mutate(
                { ks: ks!, acao, prof: prof || undefined },
                { onSuccess: (r) => aoOk(r.msg), onError: (e) => setErro(e.message) },
              );
            }}
          >
            Aplicar
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
