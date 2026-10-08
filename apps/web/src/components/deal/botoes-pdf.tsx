import { DownloadIcon, FileTextIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_URL } from '@/lib/api';

/** Decisão 3.5.3.2 (05/10/2026): visualizar (abre no navegador) e baixar o contrato ou o pedido em PDF */
export function BotoesPdf({ caminho, nome }: { caminho: string; nome: string }) {
  return (
    <>
      <Button asChild>
        <a
          href={`${API_URL}${caminho}?ver=1`}
          target="_blank"
          rel="noopener"
          aria-label={`Visualizar ${nome} em PDF (abre em nova aba)`}
        >
          <FileTextIcon /> Visualizar PDF
        </a>
      </Button>
      <Button asChild>
        <a href={`${API_URL}${caminho}`} download aria-label={`Baixar ${nome} em PDF`}>
          <DownloadIcon /> Baixar PDF
        </a>
      </Button>
    </>
  );
}
