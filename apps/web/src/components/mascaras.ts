/* máscaras pt-BR dos cadastros de pessoa (24/09/2026): um lugar só, para aluno, time e empresa */
const dig = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);

/** CPF: xxx.xxx.xxx-xx */
export const mascaraCpf = (v: string) => {
  const d = dig(v, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
};

/** CNPJ: xx.xxx.xxx/xxxx-xx */
export const mascaraCnpj = (v: string) => {
  const d = dig(v, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

/**
 * Contato: +xx (xx) xxxxx-xxxx. Quem digita sem o "+" está no Brasil (entra o +55);
 * número antigo guardado sem país (10 ou 11 dígitos) também ganha o +55.
 */
export const mascaraContato = (v: string) => {
  if (!v) return '';
  const temPais = v.trim().startsWith('+');
  let d = v.replace(/\D/g, '');
  if (!temPais) d = `55${d}`;
  d = d.slice(0, 13);
  const pais = d.slice(0, 2);
  const ddd = d.slice(2, 4);
  const num = d.slice(4);
  if (!ddd) return `+${pais}`;
  if (!num) return `+${pais} (${ddd}`;
  const meio = num.length > 8 ? 5 : 4;
  return num.length > 4 ? `+${pais} (${ddd}) ${num.slice(0, meio)}-${num.slice(meio)}` : `+${pais} (${ddd}) ${num}`;
};

/** gênero do Novo aluno */
export const GENEROS = ['Masculino', 'Feminino', 'Não binário', 'Outro'];
