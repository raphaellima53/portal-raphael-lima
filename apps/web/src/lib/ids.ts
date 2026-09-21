/**
 * ID do cadastro como aparece nas listas (21/09/2026): 5 dígitos. Aluno e colaborador são números (00035);
 * professor e empresa têm prefixo de letra, que vira maiúscula com 4 dígitos (p1 → P0001, e3 → E0003).
 */
export function idCadastro(id: number | string): string {
  const s = String(id);
  if (/^\d+$/.test(s)) return s.padStart(5, '0');
  const m = /^([a-z]+)(\d+)$/i.exec(s);
  return m ? m[1].toUpperCase() + m[2].padStart(5 - m[1].length, '0') : s;
}
