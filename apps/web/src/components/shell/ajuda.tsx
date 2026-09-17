'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { useUI } from '@/stores/ui';

export const ATALHOS: [string, string][] = [
  ['/', 'Buscar na tela'],
  ['?', 'Abrir esta ajuda'],
  ['g depois i', 'Ir para o Início'],
  ['g depois a', 'Ir para a Agenda'],
  ['g depois l', 'Ir para Alunos'],
  ['g depois p', 'Ir para Professores'],
  ['g depois c', 'Ir para Cursos'],
  ['g depois r', 'Ir para Relatórios'],
  ['[', 'Minimizar ou expandir o menu'],
  ['Esc', 'Fechar popup, menu ou calendário'],
  ['Alt + ↓', 'Abrir o calendário de um campo de data'],
  ['← → na aba', 'Trocar de aba'],
];

/** Ajuda e atalhos: o portal funciona inteiro pelo teclado. */
export function Ajuda() {
  const aberto = useUI((s) => s.ajuda);
  const setAberto = useUI((s) => s.setAjuda);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent tamanho="sm">
        <DialogHead titulo="Ajuda e atalhos" descricao="O portal funciona inteiro pelo teclado." />
        <DialogBody>
          <div className="overflow-hidden rounded-lg border border-borda">
            <Table aria-label="Atalhos de teclado">
              <THead>
                <Tr>
                  <Th>Tecla</Th>
                  <Th>O que faz</Th>
                </Tr>
              </THead>
              <TBody>
                {ATALHOS.map(([tecla, faz]) => (
                  <Tr key={tecla}>
                    <Td className="py-2.5 whitespace-nowrap">
                      {tecla.split(' depois ').map((t, i) => (
                        <span key={t}>
                          {i > 0 && ' depois '}
                          <kbd>{t}</kbd>
                        </span>
                      ))}
                    </Td>
                    <Td className="py-2.5">{faz}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
          <p className="mt-3 text-apagado">
            Filtros ficam salvos enquanto você navega; <b>Limpar filtros</b> volta a lista ao começo. Ações que apagam
            dados pedem confirmação, e fechar um formulário alterado pergunta antes de descartar.
          </p>
        </DialogBody>
        <DialogFoot>
          <DialogClose asChild>
            <Button variant="primary">Entendi</Button>
          </DialogClose>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
