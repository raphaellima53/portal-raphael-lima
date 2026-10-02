'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Escolha } from '@/components/escolha';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFoot, DialogHead } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type Conteudo, useAcaoCurriculo, useCurriculoFormOpcoes } from '@/lib/cursos';
import { cn } from '@/lib/utils';

const Erro = ({ t }: { t: string }) =>
  t ? (
    <span role="alert" className="mr-auto font-medium text-vermelho">
      {t}
    </span>
  ) : null;

/** Novo currículo (de um curso ou acervo) e Editar currículo (nome e onde se aplica). */
export function CurriculoFormDialog({
  abre,
  aoFechar,
  aoSalvo,
}: {
  abre: { id?: string; grupo?: string } | null;
  aoFechar: () => void;
  aoSalvo?: (r: { id?: string; msg: string }) => void;
}) {
  const router = useRouter();
  const op = useCurriculoFormOpcoes(abre);
  const acao = useAcaoCurriculo();
  const ed = !!abre?.id;
  const [nome, setNome] = useState('');
  const [aplicado, setAplicado] = useState<string[]>([]);
  const [grupo, setGrupo] = useState('');
  const [grupoNovo, setGrupoNovo] = useState('');
  const [idioma, setIdioma] = useState('Inglês');
  const [copia, setCopia] = useState('');
  const [erro, setErro] = useState('');
  const d = op.data;
  useEffect(() => {
    if (!d) return;
    setNome(d.atual?.nome ?? (d.curso ? `${d.curso.nome} · ` : ''));
    setAplicado(d.atual?.aplicado ?? []);
    setGrupo('');
    setGrupoNovo('');
    setCopia('');
    setErro('');
  }, [d]);

  const enviar = () => {
    if (!nome.trim() || /·\s*$/.test(nome)) return setErro('Dê um nome ao currículo.');
    const json = {
      nome: nome.trim(),
      aplicado: d?.curso?.itens.length ? aplicado : undefined,
      ...(ed ? {} : { curso: d?.curso?.nome, grupo, grupoNovo, idioma, copia: copia || undefined }),
    };
    acao.mutate(
      { caminho: ed ? `/${abre!.id}` : '', method: ed ? 'PUT' : 'POST', json },
      {
        onSuccess: (r) => {
          aoFechar();
          if (!ed && r.id) router.push(`/cursos/curriculos/${r.id}?msg=${encodeURIComponent(r.msg)}`);
          else aoSalvo?.({ id: r.id, msg: r.msg });
        },
        onError: (e) => setErro(e.message),
      },
    );
  };

  return (
    <Dialog open={!!abre} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead
          titulo={ed ? 'Editar currículo' : 'Novo currículo'}
          descricao={ed ? d?.atual?.nome : d?.curso ? `currículo de produto de ${d.curso.nome}` : 'acervo de conteúdo'}
        />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="cur-nome">
              Nome<span className="text-vermelho">*</span>
            </Label>
            <Input
              id="cur-nome"
              autoFocus
              value={nome}
              placeholder="Ex.: Community live classes · Essential 5"
              onChange={(e) => {
                setNome(e.target.value);
                setErro('');
              }}
            />
          </div>
          {!ed && d && !d.curso && (
            <>
              <div className="grid gap-1.5">
                <Label>Acervo</Label>
                <Escolha
                  rotulo="Acervo"
                  todos="escolha o acervo"
                  destacar={false}
                  valor={grupo}
                  aoMudar={setGrupo}
                  opcoes={[...d.acervos.map((g) => ({ v: g, l: g })), { v: '__novo', l: 'novo acervo…' }]}
                />
                {(grupo === '__novo' || !grupo) && (
                  <Input
                    aria-label="Nome do novo acervo"
                    placeholder="nome do novo acervo"
                    value={grupoNovo}
                    onChange={(e) => setGrupoNovo(e.target.value)}
                  />
                )}
                <span className="text-apagado">Careers, Grammar Practice, Private for Business ou um novo</span>
              </div>
              <div className="grid gap-1.5">
                <Label>Idioma</Label>
                <Escolha
                  rotulo="Idioma"
                  destacar={false}
                  valor={idioma}
                  aoMudar={setIdioma}
                  opcoes={['Inglês', 'Espanhol'].map((x) => ({ v: x, l: x }))}
                />
              </div>
            </>
          )}
          {d?.curso && d.curso.itens.length > 0 && (
            <fieldset className="grid gap-1.5 sm:col-span-2">
              <legend className="font-semibold text-texto-2">Aplicado em</legend>
              <span className="text-apagado">
                {d.curso.estrutura === 'turmas' ? 'turmas' : 'módulos'} que leem este currículo; um item marcado aqui
                sai do currículo em que estava
              </span>
              <div className="mt-1 flex flex-wrap gap-2">
                {d.curso.itens.map((it) => {
                  const on = aplicado.includes(it);
                  return (
                    <button
                      key={it}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAplicado(on ? aplicado.filter((x) => x !== it) : [...aplicado, it])}
                      className={cn(
                        'h-9 cursor-pointer rounded-full bg-[#eceff5] px-3.5 text-[#4b5568] dark:bg-hover',
                        on && 'bg-azul-suave font-semibold text-azul shadow-[inset_0_0_0_1px_#cfdcfa]',
                      )}
                    >
                      {it}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {!ed && d && d.copiar.length > 0 && (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Começar com</Label>
              <Escolha
                rotulo="Começar com"
                todos="currículo vazio"
                destacar={false}
                valor={copia}
                aoMudar={setCopia}
                opcoes={d.copiar.map((x) => ({ v: x.id, l: `cópia dos conteúdos de ${x.nome}` }))}
              />
              <span className="text-apagado">o novo currículo nasce como v1 em rascunho</span>
            </div>
          )}
        </DialogBody>
        <DialogFoot>
          <Erro t={erro} />
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending || !d} onClick={enviar}>
            {ed ? 'Salvar currículo' : 'Criar currículo'}
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

const MOMENTOS: [keyof Conteudo['links'], string, string][] = [
  ['pre', 'Pre-class', 'o aluno recebe 24 h antes, no app, em “Prepare-se”'],
  ['in', 'In-class', 'o professor abre na sala; o aluno não vê antes'],
  ['post', 'Post-class', 'liberado quando a aula é finalizada'],
];

export { MOMENTOS };

const linkOk = (u: string) => {
  if (!u) return true;
  try {
    return ['https:', 'http:'].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};

/** Novo conteúdo, Editar conteúdo e Editar links: grava no rascunho */
export function ConteudoDialog({
  abre,
  aoFechar,
  curId,
  nomeCur,
  lista,
  produto,
  aoOk,
}: {
  abre: { k: number | null; soLinks?: boolean } | null;
  aoFechar: () => void;
  curId: string;
  nomeCur: string;
  lista: Conteudo[];
  produto: boolean;
  aoOk: (r: { versao?: number; msg: string; k: number }) => void;
}) {
  const acao = useAcaoCurriculo();
  const x = abre?.k != null ? lista[abre.k] : null;
  const [v, setV] = useState({
    titulo: '',
    formato: 'Interativa',
    gram: '',
    voc: '',
    pre: '',
    in: '',
    post: '',
    pos: '',
  });
  const [erro, setErro] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: reinicia ao abrir
  useEffect(() => {
    if (!abre) return;
    setErro('');
    setV({
      titulo: x?.titulo ?? '',
      formato: x?.formato ?? 'Interativa',
      gram: x?.gram ?? '',
      voc: (x?.voc ?? []).map(([w, cl]) => (cl ? `${w} (${cl})` : w)).join('; '),
      pre: x?.links.pre ?? '',
      in: x?.links.in ?? '',
      post: x?.links.post ?? '',
      pos: String(lista.length),
    });
  }, [abre]);
  const muda = (p: Partial<typeof v>) => {
    setV({ ...v, ...p });
    setErro('');
  };
  const soLinks = !!abre?.soLinks;

  const enviar = () => {
    if (!soLinks && !v.titulo.trim()) return setErro('Dê um título ao conteúdo.');
    for (const [m, rot] of MOMENTOS)
      if (!linkOk(v[m].trim()))
        return setErro(`O link de ${rot} precisa ser um endereço completo, começando com https://.`);
    const k = abre!.k;
    const req = soLinks
      ? { caminho: `/${curId}/conteudos/${k}/links`, method: 'PUT', json: { pre: v.pre, in: v.in, post: v.post } }
      : k == null
        ? { caminho: `/${curId}/conteudos`, method: 'POST', json: { ...v, pos: produto ? Number(v.pos) : undefined } }
        : { caminho: `/${curId}/conteudos/${k}`, method: 'PUT', json: { ...v, pos: undefined } };
    acao.mutate(req, {
      onSuccess: (r) => {
        aoFechar();
        aoOk({ ...r, k: k ?? (produto ? Number(v.pos) : lista.length) });
      },
      onError: (e) => setErro(e.message),
    });
  };

  return (
    <Dialog open={!!abre} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent tamanho="md">
        <DialogHead
          titulo={soLinks ? 'Links dos materiais' : abre?.k == null ? 'Novo conteúdo' : 'Editar conteúdo'}
          descricao={`${nomeCur}${abre?.k != null ? ` · conteúdo ${abre.k + 1}${soLinks && x ? ` · ${x.titulo}` : ''}` : ''}`}
        />
        <DialogBody className="grid gap-4 sm:grid-cols-2">
          {!soLinks && (
            <>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="ct-titulo">
                  Título<span className="text-vermelho">*</span>
                </Label>
                <Input
                  id="ct-titulo"
                  autoFocus
                  value={v.titulo}
                  placeholder="Ex.: A day at the office"
                  onChange={(e) => muda({ titulo: e.target.value })}
                />
                <span className="text-apagado">aparece na agenda, no convite da aula e no app do aluno</span>
              </div>
              <div className="grid gap-1.5">
                <Label>Formato da aula</Label>
                <Escolha
                  rotulo="Formato da aula"
                  destacar={false}
                  valor={v.formato}
                  aoMudar={(f) => muda({ formato: f })}
                  opcoes={[
                    { v: 'Interativa', l: 'Interativa' },
                    { v: 'Simples', l: 'Simples' },
                  ]}
                />
                <span className="text-apagado">
                  Interativa: o aluno participa com atividade · Simples: exposição com prática guiada
                </span>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ct-gram">Gramática</Label>
                <Input
                  id="ct-gram"
                  value={v.gram}
                  placeholder="Ex.: Present perfect"
                  onChange={(e) => muda({ gram: e.target.value })}
                />
                <span className="text-apagado">vazio = aula de vocabulário e conversação</span>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="ct-voc">Vocabulário</Label>
                <textarea
                  id="ct-voc"
                  rows={3}
                  value={v.voc}
                  placeholder="forecast (n); get along (v); under the weather (id)"
                  onChange={(e) => muda({ voc: e.target.value })}
                  className="resize-y rounded-md border border-borda-forte bg-card px-3 py-2 focus:border-azul focus:shadow-anel focus-visible:outline-none"
                />
                <span className="text-apagado">
                  separe os termos com ponto e vírgula; a classe entre parênteses: n, v, adj, col ou id
                </span>
              </div>
              {abre?.k == null && produto && lista.length > 0 && (
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Posição na sequência</Label>
                  <Escolha
                    rotulo="Posição na sequência"
                    destacar={false}
                    valor={v.pos}
                    aoMudar={(p) => muda({ pos: p })}
                    opcoes={[
                      { v: String(lista.length), l: `no fim — aula ${lista.length + 1}` },
                      ...lista.map((y, j) => ({ v: String(j), l: `antes de ${j + 1}. ${y.titulo}` })),
                    ]}
                  />
                  <span className="text-apagado">qual aula do módulo ou turma recebe este conteúdo</span>
                </div>
              )}
            </>
          )}
          {MOMENTOS.map(([m, rot, quem]) => (
            <div key={m} className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`ct-${m}`}>{rot}</Label>
              <Input
                id={`ct-${m}`}
                type="url"
                value={v[m]}
                placeholder="https://"
                onChange={(e) => muda({ [m]: e.target.value })}
              />
              <span className="text-apagado">{quem} · vazio quando não houver material</span>
            </div>
          ))}
        </DialogBody>
        <DialogFoot>
          <Erro t={erro} />
          <Button onClick={aoFechar}>Cancelar</Button>
          <Button variant="primary" disabled={acao.isPending} onClick={enviar}>
            {soLinks ? 'Salvar links' : abre?.k == null ? 'Adicionar conteúdo' : 'Salvar conteúdo'}
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}

/** confirmação simples (remover conteúdo, excluir currículo) */
export function Confirma({
  aberto,
  titulo,
  descricao,
  texto,
  rotulo,
  aoFechar,
  aoConfirmar,
  ocupado,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  texto: React.ReactNode;
  rotulo: string;
  aoFechar: () => void;
  aoConfirmar: () => void;
  ocupado?: boolean;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent tamanho="sm">
        <DialogHead titulo={titulo} descricao={descricao} />
        <DialogBody>
          <p className="leading-relaxed">{texto}</p>
        </DialogBody>
        <DialogFoot>
          <Button onClick={aoFechar}>Voltar</Button>
          <Button variant="perigo" disabled={ocupado} onClick={aoConfirmar}>
            {rotulo}
          </Button>
        </DialogFoot>
      </DialogContent>
    </Dialog>
  );
}
