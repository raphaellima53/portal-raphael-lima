'use client';

import { useState } from 'react';
import { Escolha } from '@/components/escolha';
import { Input } from '@/components/ui/input';
import { type AcessoSetor, type NivelEd, type PerfilEd, type PerfisEdicao, useAcaoCfg } from '@/lib/config';
import { Campo, Chave, FormDialog, type Msg, textareaCls } from './comum';

type PerfilForm = {
  id: number | null;
  tipo: string;
  cargo: string;
  area: string;
  nivel: number;
  areas: Record<string, AcessoSetor>;
  ativo: boolean;
  aplicar: boolean;
};
export const perfilVazio = (): PerfilForm => ({
  id: null,
  tipo: 'Colaborador',
  cargo: '',
  area: '',
  nivel: 4,
  areas: {},
  ativo: true,
  aplicar: false,
});
export const perfilDoCadastro = (p: PerfilEd): PerfilForm => ({
  id: p.id,
  tipo: p.tipo,
  cargo: p.cargo,
  area: p.area,
  nivel: p.nivel,
  areas: { ...p.areas },
  ativo: p.ativo,
  aplicar: false,
});

/** o acesso de um setor no select: '' sem acesso, 'total', ou 'restrito:<recorte>' */
const valorSetor = (a?: AcessoSetor) => (!a ? '' : a.acesso === 'total' ? 'total' : `restrito:${a.rotulo}`);

/** novo perfil ou edição: tipo, cargo, setor, hierarquia sugerida e o acesso em cada setor */
export function PerfilDialog({
  form,
  setForm,
  ed,
  aoSalvo,
}: {
  form: PerfilForm | null;
  setForm: (f: PerfilForm | null) => void;
  ed: PerfisEdicao;
  aoSalvo: (m: Msg) => void;
}) {
  const acao = useAcaoCfg();
  const [erro, setErro] = useState('');
  const atual = form?.id != null ? ed.perfis.find((p) => p.id === form.id) : undefined;
  const fechar = () => {
    setErro('');
    setForm(null);
  };
  return (
    <FormDialog
      aberto={!!form}
      aoFechar={fechar}
      titulo={form?.id != null ? `Editar perfil ${atual?.cargo ?? ''}` : 'Novo perfil'}
      descricao="A hierarquia e os setores daqui são a sugestão para quem recebe o perfil; cada usuário pode ser ajustado depois."
      erro={erro}
      ocupado={acao.isPending}
      rotuloOk={form?.id != null ? 'Salvar' : 'Criar'}
      aoSalvar={() =>
        form &&
        acao.mutate(
          {
            caminho: form.id != null ? `/perfis/${form.id}` : '/perfis',
            method: form.id != null ? 'PUT' : 'POST',
            json: form,
          },
          {
            onSuccess: (r) => {
              fechar();
              aoSalvo({ txt: r.msg });
            },
            onError: (e) => setErro(e.message),
          },
        )
      }
    >
      {form && (
        <>
          <Campo id="pf-cargo" rotulo="Cargo" req>
            <Input
              id="pf-cargo"
              autoFocus
              placeholder="Ex.: Analista de qualidade"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            />
          </Campo>
          <Campo rotulo="Tipo de perfil" req ajuda={atual?.sistema ? `fixo: usado como ${atual.sistema}` : undefined}>
            <Escolha
              rotulo="Tipo de perfil"
              destacar={false}
              disabled={!!atual?.sistema}
              valor={form.tipo}
              aoMudar={(v) => setForm({ ...form, tipo: v })}
              opcoes={[
                { v: 'Colaborador', l: 'Colaborador' },
                { v: 'Prestador', l: 'Prestador' },
              ]}
            />
          </Campo>
          <Campo rotulo="Setor do cargo">
            <Escolha
              rotulo="Setor do cargo"
              todos="Selecione…"
              destacar={false}
              valor={form.area}
              aoMudar={(v) => setForm({ ...form, area: v })}
              opcoes={ed.setores.map((s) => ({ v: s.nome, l: s.nome }))}
            />
          </Campo>
          <Campo rotulo="Hierarquia sugerida" req>
            <Escolha
              rotulo="Hierarquia sugerida"
              destacar={false}
              valor={String(form.nivel)}
              aoMudar={(v) => setForm({ ...form, nivel: Number(v) })}
              opcoes={ed.niveis.map((n) => ({ v: String(n.n), l: `${n.n} — ${n.nome}` }))}
            />
          </Campo>
          <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="mb-1 font-semibold text-texto-2">Acesso em cada setor</legend>
            {ed.setores.map((s) => {
              const v = valorSetor(form.areas[s.id]);
              const rec = v.startsWith('restrito:') ? s.recortes.find((r) => `restrito:${r.v}` === v) : undefined;
              return (
                <Campo key={s.id} rotulo={s.nome} ajuda={rec?.desc}>
                  <Escolha
                    rotulo={`Acesso em ${s.nome}`}
                    todos="Sem acesso"
                    destacar={false}
                    valor={v}
                    aoMudar={(x) => {
                      const areas = { ...form.areas };
                      if (!x) delete areas[s.id];
                      else if (x === 'total') areas[s.id] = { acesso: 'total', rotulo: 'Total' };
                      else areas[s.id] = { acesso: 'restrito', rotulo: x.slice('restrito:'.length) };
                      setForm({ ...form, areas });
                    }}
                    opcoes={[
                      { v: 'total', l: 'Total' },
                      ...s.recortes.map((r) => ({ v: `restrito:${r.v}`, l: `Restrito · ${r.l}` })),
                    ]}
                  />
                </Campo>
              );
            })}
          </fieldset>
          <Chave
            id="pf-ativo"
            className="sm:col-span-2"
            on={form.ativo}
            disabled={!!atual?.sistema}
            aoMudar={(v) => setForm({ ...form, ativo: v })}
            rotulo="Perfil ativo"
            ajuda={
              atual?.sistema
                ? `Não se inativa: é usado como ${atual.sistema}.`
                : 'Inativo, o perfil some do cadastro de usuários; quem já tem continua com ele.'
            }
          />
          {atual && atual.usuarios > 0 && (
            <Chave
              id="pf-aplicar"
              className="sm:col-span-2"
              on={form.aplicar}
              aoMudar={(v) => setForm({ ...form, aplicar: v })}
              rotulo={`Aplicar aos ${atual.usuarios} usuário(s) que já têm este perfil`}
              ajuda="Troca a hierarquia e os setores deles pelos daqui. O seu próprio usuário fica de fora: ninguém altera o próprio acesso."
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

/** o que a hierarquia pode fazer; no Administrador só o nome muda, e Usuários e Configurações são só dele */
export function NivelDialog({
  nivel,
  setNivel,
  acoes,
  aoSalvo,
}: {
  nivel: NivelEd | null;
  setNivel: (n: NivelEd | null) => void;
  acoes: string[];
  aoSalvo: (m: Msg) => void;
}) {
  const acao = useAcaoCfg();
  const [erro, setErro] = useState('');
  const fechar = () => {
    setErro('');
    setNivel(null);
  };
  const adm = nivel?.n === 1;
  return (
    <FormDialog
      aberto={!!nivel}
      aoFechar={fechar}
      titulo={`Editar hierarquia ${nivel?.n ?? ''}`}
      descricao="Vale na hora para todos os usuários desta hierarquia: os botões de criar, editar, inativar e excluir seguem esta tabela."
      erro={erro}
      ocupado={acao.isPending}
      rotuloOk="Salvar"
      aoSalvar={() =>
        nivel &&
        acao.mutate(
          { caminho: `/perfis/niveis/${nivel.n}`, method: 'PUT', json: nivel },
          {
            onSuccess: (r) => {
              fechar();
              aoSalvo({ txt: r.msg });
            },
            onError: (e) => setErro(e.message),
          },
        )
      }
    >
      {nivel && (
        <>
          <Campo id="nv-nome" rotulo="Nome" req className="sm:col-span-2">
            <Input
              id="nv-nome"
              autoFocus
              value={nivel.nome}
              onChange={(e) => setNivel({ ...nivel, nome: e.target.value })}
            />
          </Campo>
          <Campo id="nv-nota" rotulo="Observação" className="sm:col-span-2">
            <textarea
              id="nv-nota"
              rows={2}
              className={textareaCls}
              placeholder="Ex.: somente o próprio escopo"
              value={nivel.nota}
              onChange={(e) => setNivel({ ...nivel, nota: e.target.value })}
            />
          </Campo>
          {acoes.map((t, i) => {
            const fixa = adm || i >= 6;
            return (
              <Chave
                key={t}
                id={`nv-acao-${i}`}
                on={nivel.acoes[i] === 1}
                disabled={fixa}
                aoMudar={(v) => {
                  const novas = [...nivel.acoes];
                  novas[i] = v ? 1 : nivel.acoes[i] === null ? null : 0;
                  setNivel({ ...nivel, acoes: novas });
                }}
                rotulo={t}
                ajuda={adm ? 'o Administrador faz tudo' : i >= 6 ? 'só o Administrador' : undefined}
              />
            );
          })}
        </>
      )}
    </FormDialog>
  );
}

/** confirmação simples (excluir perfil, restaurar o padrão) */
export function ConfirmaDialog({
  aberto,
  titulo,
  texto,
  rotuloOk,
  caminho,
  aoFechar,
  aoSalvo,
}: {
  aberto: boolean;
  titulo: string;
  texto: string;
  rotuloOk: string;
  caminho: { caminho: string; method: 'POST' | 'DELETE' } | null;
  aoFechar: () => void;
  aoSalvo: (m: Msg) => void;
}) {
  const acao = useAcaoCfg();
  const [erro, setErro] = useState('');
  return (
    <FormDialog
      aberto={aberto}
      aoFechar={() => {
        setErro('');
        aoFechar();
      }}
      titulo={titulo}
      erro={erro}
      ocupado={acao.isPending}
      rotuloOk={rotuloOk}
      aoSalvar={() =>
        caminho &&
        acao.mutate(caminho, {
          onSuccess: (r) => {
            setErro('');
            aoFechar();
            aoSalvo({ txt: r.msg });
          },
          onError: (e) => setErro(e.message),
        })
      }
    >
      <p className="text-texto-2 sm:col-span-2">{texto}</p>
    </FormDialog>
  );
}
