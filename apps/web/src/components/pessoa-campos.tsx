'use client';

import { useRef, useState } from 'react';
import { CampoData } from '@/components/campos-data';
import { Campo } from '@/components/config/comum';
import { Escolha } from '@/components/escolha';
import { GENEROS, mascaraContato } from '@/components/mascaras';
import { Input } from '@/components/ui/input';
import type { Endereco, PessoaExtra } from '@/lib/cadastros';

/* máscaras pt-BR (regras de UI: campos formatados pelo contexto) */
const dig = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);
/** contato no formato +xx (xx) xxxxx-xxxx (24/09/2026) */
export const mascaraTelefone = mascaraContato;
const mascaraCep = (v: string) => {
  const d = dig(v, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/**
 * Contato, nascimento e gênero: os dados pessoais que aluno, professor e colaborador têm em comum.
 * 24/09/2026: contato +xx (xx) xxxxx-xxxx (obrigatório nos cadastros novos) e gênero com as quatro opções.
 */
export function CamposPessoa({
  prefixo,
  valor,
  aoMudar,
  obrigatorio = false,
  semGenero = false,
}: {
  prefixo: string;
  valor: PessoaExtra;
  aoMudar: (v: PessoaExtra) => void;
  /** @deprecated o gênero usa as quatro opções fixas */
  generos?: string[];
  obrigatorio?: boolean;
  semGenero?: boolean;
}) {
  const set = <K extends keyof PessoaExtra>(k: K, x: PessoaExtra[K]) => aoMudar({ ...valor, [k]: x });
  return (
    <>
      <Campo id={`${prefixo}-tel`} rotulo="Contato" req={obrigatorio}>
        <Input
          id={`${prefixo}-tel`}
          inputMode="tel"
          placeholder="+55 (00) 00000-0000"
          value={valor.telefone}
          onChange={(e) => set('telefone', mascaraTelefone(e.target.value))}
        />
      </Campo>
      <Campo id={`${prefixo}-nasc`} rotulo="Data de nascimento">
        <CampoData
          id={`${prefixo}-nasc`}
          rotulo="Nascimento"
          valor={valor.nascimento}
          aoMudar={(v) => set('nascimento', v)}
        />
      </Campo>
      {!semGenero && (
        <Campo rotulo="Gênero">
          <Escolha
            rotulo="Gênero"
            todos="não informado"
            destacar={false}
            valor={valor.genero}
            aoMudar={(v) => set('genero', v)}
            opcoes={[...new Set([...GENEROS, ...(valor.genero ? [valor.genero] : [])])].map((g) => ({ v: g, l: g }))}
          />
        </Campo>
      )}
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
  /* CEP com auto preenchimento (05/10/2026, decisão 3.2.3.3): com 8 dígitos busca no ViaCEP e preenche
     rua, bairro, cidade e UF; número e complemento ficam com quem digita. */
  const [busca, setBusca] = useState<'' | 'buscando' | 'nao-achou' | 'falhou'>('');
  const ultimo = useRef(valor);
  ultimo.current = valor;
  const mudaCep = async (texto: string) => {
    const cep = mascaraCep(texto);
    const comCep = { ...valor, cep };
    aoMudar(comCep);
    const d = cep.replace(/\D/g, '');
    if (d.length !== 8) return setBusca('');
    setBusca('buscando');
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = (await r.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (ultimo.current.cep !== cep) return; /* o CEP mudou enquanto buscava */
      if (!r.ok || j.erro) return setBusca('nao-achou');
      aoMudar({
        ...ultimo.current,
        rua: j.logradouro || ultimo.current.rua,
        bairro: j.bairro || ultimo.current.bairro,
        cidade: j.localidade || ultimo.current.cidade,
        uf: j.uf || ultimo.current.uf,
      });
      setBusca('');
    } catch {
      setBusca('falhou');
    }
  };
  const campo = (k: keyof Endereco, rotulo: string, extra: React.ComponentProps<typeof Input> = {}, cls = '') => (
    <Campo id={`${prefixo}-${k}`} rotulo={rotulo} className={cls}>
      <Input id={`${prefixo}-${k}`} value={valor[k]} onChange={(e) => set(k, e.target.value)} {...extra} />
    </Campo>
  );
  return (
    <>
      <Campo id={`${prefixo}-cep`} rotulo="CEP">
        <Input
          id={`${prefixo}-cep`}
          value={valor.cep}
          inputMode="numeric"
          placeholder="00000-000"
          aria-describedby={busca ? `${prefixo}-cep-st` : undefined}
          onChange={(e) => mudaCep(e.target.value)}
        />
        {busca && (
          <span
            id={`${prefixo}-cep-st`}
            role="status"
            className={busca === 'buscando' ? 'text-apagado' : 'font-medium text-vermelho'}
          >
            {busca === 'buscando'
              ? 'Buscando o endereço…'
              : busca === 'nao-achou'
                ? 'CEP não encontrado: preencha o endereço.'
                : 'Não deu para buscar o CEP agora: preencha o endereço.'}
          </span>
        )}
      </Campo>
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
