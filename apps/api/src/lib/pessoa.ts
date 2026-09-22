import { z } from 'zod';

/**
 * Dados pessoais e endereço que aluno, professor e colaborador ganharam na adequação ao Portal Alumni
 * (telefone, nascimento, gênero e endereço). Um esquema só, para os três cadastros validarem igual.
 */
export const EnderecoIn = z
  .object({
    cep: z
      .string()
      .trim()
      .regex(/^(\d{5}-?\d{3})?$/, 'CEP inválido.')
      .default(''),
    rua: z.string().trim().max(200).default(''),
    numero: z.string().trim().max(20).default(''),
    complemento: z.string().trim().max(120).default(''),
    bairro: z.string().trim().max(120).default(''),
    cidade: z.string().trim().max(120).default(''),
    uf: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-Z]{2})?$/, 'UF com duas letras.')
      .default(''),
  })
  .default({ cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' });
export type Endereco = z.infer<typeof EnderecoIn>;

export const PessoaIn = z.object({
  telefone: z
    .string()
    .trim()
    .max(30)
    .refine((s) => !s || s.replace(/\D/g, '').length >= 10, 'Telefone com DDD: pelo menos 10 dígitos.')
    .default(''),
  nascimento: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Data de nascimento inválida.')
    .default(''),
  genero: z.string().trim().max(80).default(''),
  endereco: EnderecoIn,
});
export type Pessoa = z.infer<typeof PessoaIn>;

const p2 = (n: number) => String(n).padStart(2, '0');
/** @db.Date chega à meia-noite UTC */
export const isoUTC = (d: Date | null | undefined) =>
  d ? `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}` : '';
export const dataUTC = (d: Date | null | undefined) =>
  d ? `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` : '';
export const diaUTC = (iso: string) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

const vazio = (e: Endereco) => !Object.values(e).some(Boolean);

/** do formulário para as colunas do banco */
export const pessoaParaBanco = (p: Pessoa) => ({
  telefone: p.telefone,
  nascimento: diaUTC(p.nascimento),
  genero: p.genero || null,
  endereco: vazio(p.endereco) ? undefined : p.endereco,
});

/** das colunas do banco para o formulário */
export const pessoaDoBanco = (x: {
  telefone?: string | null;
  nascimento?: Date | null;
  genero?: string | null;
  endereco?: unknown;
}): Pessoa => ({
  telefone: x.telefone ?? '',
  nascimento: isoUTC(x.nascimento),
  genero: x.genero ?? '',
  endereco: EnderecoIn.parse(x.endereco ?? {}),
});

/** endereço numa linha: Rua, 10 · Bairro · Cidade/UF */
export const enderecoTxt = (e: unknown) => {
  const x = EnderecoIn.safeParse(e ?? {});
  if (!x.success || vazio(x.data)) return '';
  const a = x.data;
  return [
    [a.rua, a.numero].filter(Boolean).join(', ') + (a.complemento ? ` (${a.complemento})` : ''),
    a.bairro,
    [a.cidade, a.uf].filter(Boolean).join('/'),
    a.cep,
  ]
    .filter(Boolean)
    .join(' · ');
};
