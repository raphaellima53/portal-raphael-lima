'use client';

import { CampoData } from '@/components/campos-data';
import { Campo } from '@/components/config/comum';
import { Escolha } from '@/components/escolha';
import { Input } from '@/components/ui/input';
import type { Endereco, PessoaExtra } from '@/lib/cadastros';

/* máscaras pt-BR (regras de UI: campos formatados pelo contexto) */
const dig = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);
export const mascaraTelefone = (v: string) => {
  const d = dig(v, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};
const mascaraCep = (v: string) => {
  const d = dig(v, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/** Telefone, nascimento e gênero: os dados pessoais que aluno, professor e colaborador têm em comum */
export function CamposPessoa({
  prefixo,
  valor,
  aoMudar,
  generos,
}: {
  prefixo: string;
  valor: PessoaExtra;
  aoMudar: (v: PessoaExtra) => void;
  generos: string[];
}) {
  const set = <K extends keyof PessoaExtra>(k: K, x: PessoaExtra[K]) => aoMudar({ ...valor, [k]: x });
  return (
    <>
      <Campo id={`${prefixo}-tel`} rotulo="Telefone">
        <Input
          id={`${prefixo}-tel`}
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={valor.telefone}
          onChange={(e) => set('telefone', mascaraTelefone(e.target.value))}
        />
      </Campo>
      <Campo id={`${prefixo}-nasc`} rotulo="Nascimento">
        <CampoData
          id={`${prefixo}-nasc`}
          rotulo="Nascimento"
          valor={valor.nascimento}
          aoMudar={(v) => set('nascimento', v)}
        />
      </Campo>
      <Campo rotulo="Gênero">
        <Escolha
          rotulo="Gênero"
          todos="não informado"
          destacar={false}
          valor={valor.genero}
          aoMudar={(v) => set('genero', v)}
          opcoes={[...new Set([...generos, ...(valor.genero ? [valor.genero] : [])])].map((g) => ({ v: g, l: g }))}
        />
      </Campo>
    </>
  );
}

/** Endereço em campos separados (CEP, rua, número, complemento, bairro, cidade e UF) */
export function CamposEndereco({
  prefixo,
  valor,
  aoMudar,
}: {
  prefixo: string;
  valor: Endereco;
  aoMudar: (v: Endereco) => void;
}) {
  const set = (k: keyof Endereco, x: string) => aoMudar({ ...valor, [k]: x });
  const campo = (k: keyof Endereco, rotulo: string, extra: React.ComponentProps<typeof Input> = {}, cls = '') => (
    <Campo id={`${prefixo}-${k}`} rotulo={rotulo} className={cls}>
      <Input id={`${prefixo}-${k}`} value={valor[k]} onChange={(e) => set(k, e.target.value)} {...extra} />
    </Campo>
  );
  return (
    <>
      {campo('cep', 'CEP', {
        inputMode: 'numeric',
        placeholder: '00000-000',
        onChange: (e) => set('cep', mascaraCep(e.target.value)),
      })}
      {campo('rua', 'Rua')}
      {campo('numero', 'Número')}
      {campo('complemento', 'Complemento')}
      {campo('bairro', 'Bairro')}
      {campo('cidade', 'Cidade')}
      {campo('uf', 'UF', {
        placeholder: 'SP',
        maxLength: 2,
        onChange: (e) => set('uf', e.target.value.replace(/[^a-z]/gi, '').toUpperCase()),
      })}
    </>
  );
}
