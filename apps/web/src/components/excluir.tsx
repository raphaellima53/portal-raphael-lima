'use client';

import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Aviso } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { useEhAdmin, useExcluir, usePrevia } from '@/lib/lixeira';

/**
 * Excluir do Admin (24/09/2026): um botão só para qualquer registro. A confirmação mostra o que vai junto
 * (ex.: 31 matrículas, 2 turmas); tudo vai para Configurações › Lixeira, de onde dá para restaurar.
 * Não aparece para quem não é Admin.
 *
 * `tipo` é a chave da Lixeira na API (curso, aluno, usuario, professor, colaborador, empresa, atividade…).
 */
export function Excluir({
  tipo,
  id,
  nome,
  aoExcluido,
  icone = false,
  rotulo = 'Excluir',
  className,
}: {
  tipo: string;
  id: string | number;
  /** nome no botão de ícone (aria-label "Excluir <nome>") */
  nome: string;
  aoExcluido?: (msg: string) => void;
  /** botão só de ícone (linha de tabela) */
  icone?: boolean;
  rotulo?: string;
  className?: string;
}) {
  const admin = useEhAdmin();
  const [aberto, setAberto] = useState(false);
  if (!admin) return null;
  return (
    <>
      {icone ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Excluir ${nome}`}
          className={className}
          onClick={() => setAberto(true)}
        >
          <Trash2Icon />
        </Button>
      ) : (
        <Button type="button" className={className} onClick={() => setAberto(true)}>
          <Trash2Icon /> {rotulo}
        </Button>
      )}
      <ConfirmaExcluir
        tipo={tipo}
        id={aberto ? String(id) : null}
        aoFechar={() => setAberto(false)}
        aoExcluido={aoExcluido}
      />
    </>
  );
}

/** o diálogo sozinho, para quem já tem o próprio botão (ex.: item de menu) */
export function ConfirmaExcluir({
  tipo,
  id,
  aoFechar,
  aoExcluido,
}: {
  tipo: string;
  id: string | null;
  aoFechar: () => void;
  aoExcluido?: (msg: string) => void;
}) {
  const p = usePrevia(tipo, id);
  const excluir = useExcluir();
  const fecha = () => {
    excluir.reset();
    aoFechar();
  };
  const d = p.data;
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && fecha()}>
      <DialogContent>
        <DialogHead
          titulo={d ? `Excluir ${d.nome}?` : 'Excluir'}
          descricao={d ? `${d.rotulo} · vai para Configurações › Lixeira` : undefined}
        />
        <DialogBody className="grid gap-3">
          {p.isPending && <p className="m-0 text-apagado">Conferindo o que vai junto…</p>}
          {p.isError && (
            <Aviso tom="red" icone="alerta">
              {p.error.message}
            </Aviso>
          )}
          {d?.recusa && (
            <Aviso tom="red" icone="alerta">
              {d.recusa}
            </Aviso>
          )}
          {d && !d.recusa && (
            <>
              {d.junto.length > 0 ? (
                <div>
                  <p className="m-0 font-medium text-texto">Vai junto:</p>
                  <ul className="m-0 mt-1 pl-5">
                    {d.junto.map((j) => (
                      <li key={j}>{j}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="m-0">Nada mais depende deste registro.</p>
              )}
              <p className="m-0 text-apagado">
                Some das telas agora. Em Configurações › Lixeira dá para restaurar tudo igual ou apagar de vez.
              </p>
            </>
          )}
        </DialogBody>
        <DialogFoot>
          {excluir.isError && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {excluir.error.message}
            </span>
          )}
          <Button type="button" onClick={fecha}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="perigo"
            disabled={!d || !!d.recusa || excluir.isPending}
            onClick={() =>
              id &&
              excluir.mutate(
                { tipo, id },
                {
                  onSuccess: (r) => {
                    fecha();
                    aoExcluido?.(r.msg);
                  },
                },
              )
            }
          >
            {excluir.isPending ? 'Excluindo…' : 'Mover para a Lixeira'}
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
