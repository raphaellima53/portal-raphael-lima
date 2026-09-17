/**
 * Os e-mails do seed são fictícios: todo domínio vira `<primeiro rótulo>.teste` (TLD que não existe na internet)
 * e os provedores pessoais viram `pessoal.teste`. As conferências aplicam a mesma troca no lado do portal,
 * para comparar o que importa — nome, curso, situação — sem carregar endereço de ninguém.
 */
const PESSOAIS = new Set(['gmail', 'hotmail', 'outlook', 'yahoo', 'live', 'icloud', 'uol', 'bol', 'terra']);
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** um e-mail com domínio fictício, sempre o mesmo para o mesmo endereço */
export function emailFalso(email: string) {
  const [local, dominio = ''] = email.split('@');
  const rotulo = dominio.split('.')[0].toLowerCase();
  if (dominio.endsWith('.teste')) return email;
  return `${local}@${PESSOAIS.has(rotulo) ? 'pessoal' : rotulo}.teste`;
}

/** troca todos os e-mails de um texto (JSON do portal, seed, código) */
export const anonimizaEmails = (texto: string) => texto.replace(EMAIL, (e) => emailFalso(e));
