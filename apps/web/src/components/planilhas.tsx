'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronDownIcon, DownloadIcon, FileSpreadsheetIcon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Aviso } from '@/components/ds';
import { usePaginacao } from '@/components/paginacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TBody, Td, THead, Th, Tr } from '@/components/ui/table';
import { API_URL, api } from '@/lib/api';

export type EntPlanilha = 'alunos' | 'professores' | 'colaboradores';
const NOME: Record<EntPlanilha, [string, string]> = {
  alunos: ['aluno', 'alunos'],
  professores: ['professor', 'professores'],
  colaboradores: ['colaborador', 'colaboradores'],
};
type LinhaImp = { linha: number; nome: string; erros: string[]; ok?: boolean };
type Resp = { linhas: LinhaImp[]; total: number; validas?: number; criados?: number; msg?: string };

/** baixa um CSV da API (exportar ou modelo) com o cookie de sessão */
async function baixa(caminho: string, nome: string) {
  const r = await fetch(`${API_URL}${caminho}`, { credentials: 'include' });
  if (!r.ok) {
    let msg = 'Não foi possível baixar o arquivo.';
    try {
      msg = ((await r.json()) as { erro?: string }).erro ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const url = URL.createObjectURL(await r.blob());
  const el = document.createElement('a');
  el.href = url;
  el.download = nome;
  el.click();
  URL.revokeObjectURL(url);
}

/**
 * Planilhas (30/09/2026): por entidade, Exportar CSV (todos os cadastros), Baixar modelo (cabeçalho + exemplo) e
 * Importar o modelo preenchido — com prévia linha a linha antes de gravar. `extra` põe itens a mais no topo do menu.
 */
export function BotaoPlanilhas({
  ents,
  extra,
}: {
  ents: EntPlanilha[];
  extra?: { rotulo: string; aoClicar: () => void; disabled?: boolean }[];
}) {
  const [imp, setImp] = useState<EntPlanilha | null>(null);
  const [erro, setErro] = useState('');
  const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const tenta = (f: () => Promise<void>) => f().catch((e: Error) => setErro(e.message));
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <FileSpreadsheetIcon /> Planilha <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          {extra?.map((x) => (
            <DropdownMenuItem key={x.rotulo} disabled={x.disabled} onSelect={x.aoClicar}>
              <DownloadIcon /> {x.rotulo}
            </DropdownMenuItem>
          ))}
          {ents.map((e, i) => (
            <div key={e}>
              {(i > 0 || !!extra?.length) && <DropdownMenuSeparator />}
              {ents.length > 1 && (
                <DropdownMenuLabel className="px-3 pt-1.5 pb-1 font-semibold text-texto capitalize">
                  {NOME[e][1]}
                </DropdownMenuLabel>
              )}
              <DropdownMenuItem onSelect={() => tenta(() => baixa(`/planilhas/${e}/exportar`, `${e}-${hoje}.csv`))}>
                <DownloadIcon /> Exportar {NOME[e][1]} (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => tenta(() => baixa(`/planilhas/${e}/modelo`, `modelo-${e}.csv`))}>
                <FileSpreadsheetIcon /> Baixar modelo de {NOME[e][1]}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setImp(e)}>
                <UploadIcon /> Importar modelo preenchido
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {erro && (
        <span role="alert" className="font-medium text-vermelho">
          {erro}
        </span>
      )}
      <ImportarDialog ent={imp} aoFechar={() => setImp(null)} />
    </>
  );
}

function ImportarDialog({ ent, aoFechar }: { ent: EntPlanilha | null; aoFechar: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<{ nome: string; texto: string } | null>(null);
  const [res, setRes] = useState<Resp | null>(null);
  const [gravado, setGravado] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const { fatia, rodape } = usePaginacao(res?.linhas ?? []);
  const fecha = () => {
    setArquivo(null);
    setRes(null);
    setGravado(false);
    setErro('');
    aoFechar();
  };
  const envia = async (texto: string, gravar: boolean) => {
    if (!ent) return;
    setOcupado(true);
    setErro('');
    try {
      const r = await api<Resp>(`/planilhas/${ent}/importar`, { method: 'POST', json: { csv: texto, gravar } });
      setRes(r);
      if (gravar) {
        setGravado(true);
        qc.invalidateQueries();
      }
    } catch (e) {
      setErro((e as Error).message);
      setRes(null);
    } finally {
      setOcupado(false);
    }
  };
  const escolhe = async (f: File | undefined) => {
    if (!f) return;
    const texto = await f.text();
    setArquivo({ nome: f.name, texto });
    setGravado(false);
    envia(texto, false);
  };
  const validas = res?.linhas.filter((l) => !l.erros.length).length ?? 0;
  const n = ent ? NOME[ent] : ['', ''];

  return (
    <Dialog open={!!ent} onOpenChange={(v) => !v && fecha()}>
      <DialogContent tamanho="lg">
        <DialogHead
          titulo={`Importar ${n[1]}`}
          descricao="use o modelo (Planilha › Baixar modelo): uma linha por cadastro, datas em dd/mm/aaaa"
        />
        <DialogBody className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Arquivo CSV"
              onChange={(e) => {
                escolhe(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button onClick={() => input.current?.click()} disabled={ocupado}>
              <UploadIcon /> {arquivo ? 'Trocar arquivo' : 'Escolher arquivo CSV'}
            </Button>
            <span className="text-apagado">{arquivo?.nome ?? 'nenhum arquivo escolhido'}</span>
          </div>
          {erro && (
            <Aviso tom="red" icone="alerta">
              {erro}
            </Aviso>
          )}
          {res && (
            <>
              {gravado ? (
                <Aviso tom="blue" icone="ok">
                  {res.msg}
                </Aviso>
              ) : (
                <p className="m-0 text-texto-2">
                  {res.total} {res.total === 1 ? 'linha' : 'linhas'} no arquivo · <b>{validas} prontas</b> para importar
                  {res.total - validas ? ` · ${res.total - validas} com erro (ficam de fora)` : ''}
                </p>
              )}
              <div className="overflow-hidden rounded-md border border-borda">
                <Table>
                  <THead>
                    <Tr>
                      <Th className="w-20">Linha</Th>
                      <Th>Nome</Th>
                      <Th>Situação</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {fatia.map((l) => (
                      <Tr key={l.linha}>
                        <Td className="tabular-nums">{l.linha}</Td>
                        <Td>{l.nome}</Td>
                        <Td>
                          {l.erros.length ? (
                            <span className="text-vermelho">{l.erros.join(' ')}</span>
                          ) : (
                            <Badge tom="green">{l.ok ? 'importado' : 'pronto'}</Badge>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
                {rodape}
              </div>
            </>
          )}
        </DialogBody>
        <DialogFoot>
          <Button onClick={fecha}>{gravado ? 'Fechar' : 'Cancelar'}</Button>
          {!gravado && (
            <Button
              variant="primary"
              disabled={!arquivo || !validas || ocupado}
              onClick={() => arquivo && envia(arquivo.texto, true)}
            >
              {ocupado ? 'Importando…' : `Importar ${validas} ${validas === 1 ? n[0] : n[1]}`}
            </Button>
          )}
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
