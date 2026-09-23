'use client';

import { useEffect, useState } from 'react';
import { CampoData, CampoHora } from '@/components/campos-data';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CADENCIA_ROT, type Cartao, type Opcoes, useAtividade, useAtvAcao } from '@/lib/atividades';

const vazio = (setor: string, tipo: string, eu: string, pessoas: string[]) => ({
  modeloId: '',
  titulo: '',
  descricao: '',
  setor,
  tipo,
  responsavel: pessoas.includes(eu) ? eu : '',
  prioridade: 'Média',
  data: '',
  hora: '',
  situacao: 'afazer',
  relTipo: '',
  relId: '',
});
type Form = ReturnType<typeof vazio>;
const doCartao = (c: Cartao): Form => ({
  modeloId: c.modelo ? String(c.modelo.id) : '',
  titulo: c.titulo,
  descricao: c.descricao,
  setor: c.setor,
  tipo: c.tipo,
  responsavel: c.responsavel,
  prioridade: c.prioridade,
  data: c.prazoIso,
  hora: c.prazoHora,
  situacao: c.situacao === 'expirada' || c.situacao === 'cancelada' ? 'afazer' : c.situacao,
  relTipo: c.rel?.tipo ?? '',
  relId: c.rel?.id ?? '',
});

const Campo = ({
  rotulo,
  req,
  id,
  cheio,
  ajuda,
  children,
}: {
  rotulo: string;
  req?: boolean;
  id?: string;
  cheio?: boolean;
  ajuda?: string;
  children: React.ReactNode;
}) => (
  <div className={`grid content-start gap-1.5 ${cheio ? 'sm:col-span-2' : ''}`}>
    <Label htmlFor={id}>
      {rotulo}
      {req && <span className="text-vermelho">*</span>}
    </Label>
    {children}
    {ajuda && <span className="text-apagado">{ajuda}</span>}
  </div>
);

/**
 * Cadastro de atividades (Nova atividade) e a edição do cartão, com o histórico.
 * Do catálogo preenche título, descrição, setor, tipo, responsável e prioridade; tudo continua editável.
 */
export function DialogoAtividade({
  op,
  aberto,
  id,
  frente,
  aoFechar,
  aoSalvo,
}: {
  op: Opcoes;
  aberto: boolean;
  /** null = Nova atividade */
  id: number | null;
  frente?: string;
  aoFechar: () => void;
  aoSalvo: (msg: string, frente?: string) => void;
}) {
  const acao = useAtvAcao();
  const um = useAtividade(aberto ? id : null);
  const c = id != null ? um.data : undefined;
  const setores = op.frentes.filter((f) => !frente || f.frente === frente).flatMap((f) => f.setores);
  const todos = op.frentes.flatMap((f) => f.setores);
  const [v, setV] = useState<Form>(vazio(setores[0] ?? todos[0] ?? '', 'Tarefa', op.eu, op.pessoas));
  const [erro, setErro] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir e quando o cartão chega
  useEffect(() => {
    if (!aberto) return;
    setErro('');
    setV(
      c
        ? doCartao(c)
        : vazio(setores[0] ?? todos[0] ?? '', frente === 'Comercial' ? 'Ligação' : 'Tarefa', op.eu, op.pessoas),
    );
  }, [aberto, c?.id]);
  const m = (k: keyof Form) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const doCatalogo = (mid: string) => {
    const mo = op.modelos.find((x) => String(x.id) === mid);
    if (!mo) return setV((o) => ({ ...o, modeloId: '' }));
    setV((o) => ({
      ...o,
      modeloId: mid,
      titulo: mo.nome,
      descricao: mo.descricao,
      setor: mo.setor,
      tipo: mo.tipo,
      prioridade: mo.prioridade,
      responsavel: mo.responsavel || o.responsavel,
    }));
  };
  const leitura = !op.podeOperar;
  const enviar = () => {
    if (v.titulo.trim().length < 3) return setErro('Informe o título (3 letras ou mais).');
    if (!v.setor) return setErro('Escolha o setor.');
    if (v.hora && !v.data) return setErro('Informe a data do prazo, ou apague a hora.');
    if (v.relTipo && !v.relId) return setErro('Escolha o registro de quem está na atividade, ou marque Ninguém.');
    acao.mutate(
      {
        caminho: id != null ? `/${id}` : '',
        method: id != null ? 'PATCH' : 'POST',
        json: { ...v, modeloId: v.modeloId ? Number(v.modeloId) : null },
      },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo(r.msg, r.frente);
        },
        onError: (e) => setErro(e.message),
      },
    );
  };
  const cancelar = () =>
    acao.mutate(
      { caminho: `/${id}/situacao`, json: { situacao: 'cancelada' } },
      {
        onSuccess: (r) => {
          aoFechar();
          aoSalvo(r.msg);
        },
        onError: (e) => setErro(e.message),
      },
    );
  const grupos = op.frentes
    .map((f) => ({ rot: f.frente, opcoes: f.setores.map((s) => ({ v: s, l: s })) }))
    .filter((g) => g.opcoes.length);
  const modelos = op.modelos.filter((x) => x.cadencia === 'eventual' || x.cadencia === 'projeto');
  const titulo = id != null ? `Atividade #${id}` : 'Nova atividade';
  const descricao = c
    ? [
        c.frente,
        c.setor,
        c.modelo ? `${CADENCIA_ROT[c.modelo.cadencia]} do catálogo` : null,
        `criada por ${c.criadoPor} em ${c.criado}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'o cartão entra no quadro da frente do setor escolhido';

  return (
    <Dialog open={aberto} onOpenChange={(x) => !x && aoFechar()}>
      <DialogContent tamanho="lg">
        <DialogHead titulo={titulo} descricao={descricao} />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          {id == null && (
            <Campo
              rotulo="Do catálogo"
              cheio
              ajuda="as eventuais e os projetos; as recorrentes nascem sozinhas no período"
            >
              <Escolha
                rotulo="Atividade do catálogo"
                todos="Atividade avulsa (fora do catálogo)"
                destacar={false}
                valor={v.modeloId}
                aoMudar={doCatalogo}
                grupos={['eventual', 'projeto'].map((k) => ({
                  rot: CADENCIA_ROT[k],
                  opcoes: modelos
                    .filter((x) => x.cadencia === k)
                    .map((x) => ({ v: String(x.id), l: `${x.nome} · ${x.setor}` })),
                }))}
              />
            </Campo>
          )}
          <Campo rotulo="Título" req id="atv-titulo" cheio>
            <Input id="atv-titulo" value={v.titulo} disabled={leitura} onChange={(e) => m('titulo')(e.target.value)} />
          </Campo>
          <Campo rotulo="Setor" req ajuda="Comercial e Marketing vão para Comercial; os demais, para Operações">
            <Escolha
              rotulo="Setor"
              destacar={false}
              valor={v.setor}
              aoMudar={m('setor')}
              grupos={grupos}
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Tipo" req>
            <Escolha
              rotulo="Tipo"
              destacar={false}
              valor={v.tipo}
              aoMudar={m('tipo')}
              opcoes={op.tipos.map((x) => ({ v: x, l: x }))}
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Responsável">
            <Escolha
              rotulo="Responsável"
              todos="Sem responsável"
              destacar={false}
              valor={v.responsavel}
              aoMudar={m('responsavel')}
              opcoes={op.pessoas.map((x) => ({ v: x, l: x }))}
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Prioridade">
            <Escolha
              rotulo="Prioridade"
              destacar={false}
              valor={v.prioridade}
              aoMudar={m('prioridade')}
              opcoes={op.prioridades.map((x) => ({ v: x, l: x }))}
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Prazo" id="atv-data" ajuda="em branco = sem prazo">
            <CampoData id="atv-data" rotulo="Data do prazo" valor={v.data} aoMudar={m('data')} />
          </Campo>
          <Campo rotulo="Hora" id="atv-hora">
            <CampoHora id="atv-hora" rotulo="Hora do prazo" valor={v.hora} aoMudar={m('hora')} />
          </Campo>
          <Campo rotulo="Com quem">
            <Escolha
              rotulo="Com quem"
              todos="Ninguém"
              destacar={false}
              valor={v.relTipo}
              aoMudar={(x) => setV((o) => ({ ...o, relTipo: x, relId: '' }))}
              opcoes={op.rels.map((r) => ({ v: r.k, l: r.t }))}
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Registro">
            <Escolha
              rotulo="Registro"
              todos={v.relTipo ? 'Escolha o registro' : '—'}
              destacar={false}
              valor={v.relId}
              aoMudar={m('relId')}
              opcoes={op.registros[v.relTipo] ?? []}
              disabled={leitura || !v.relTipo}
            />
          </Campo>
          <Campo rotulo="Situação">
            <Escolha
              rotulo="Situação"
              destacar={false}
              valor={v.situacao}
              aoMudar={m('situacao')}
              opcoes={op.situacoes.map((s) => ({ v: s.k, l: s.t }))}
              disabled={leitura}
            />
          </Campo>
          <Campo rotulo="Descrição" id="atv-desc" cheio>
            <textarea
              id="atv-desc"
              rows={3}
              value={v.descricao}
              disabled={leitura}
              onChange={(e) => m('descricao')(e.target.value)}
              placeholder="o que precisa ser feito, combinado ou registrado"
              className="w-full rounded-md border border-borda-forte bg-card px-3 py-2.5 text-sm text-texto placeholder:text-apagado-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
            />
          </Campo>
          {c && (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Histórico</Label>
              <ul className="m-0 max-h-48 list-none overflow-auto rounded-md border border-borda p-0">
                {c.hist.map((h, i) => (
                  <li key={i} className="border-b border-borda-suave px-3 py-2 last:border-b-0">
                    <b className="text-texto">{h.acao}</b>
                    {h.det ? ` · ${h.det}` : ''}
                    <span className="block text-apagado">
                      {h.quando} · {h.quem}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogBody>
        <DialogFoot>
          {erro && (
            <span role="alert" className="mr-auto font-medium text-vermelho">
              {erro}
            </span>
          )}
          {c && !leitura && c.situacao !== 'cancelada' && (
            <Button variant="ghost" className="mr-auto text-vermelho" disabled={acao.isPending} onClick={cancelar}>
              Cancelar atividade
            </Button>
          )}
          <Button onClick={aoFechar}>Fechar</Button>
          {!leitura && (
            <Button variant="primary" disabled={acao.isPending || (id != null && !c)} onClick={enviar}>
              {id != null ? 'Salvar alterações' : 'Criar atividade'}
            </Button>
          )}
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
