import { prisma } from '../db.ts';

/**
 * Dias e horários de funcionamento (Configurações). Base sem cadastro (a de produção foi zerada na adequação)
 * usa o padrão abaixo, para a grade do módulo e a tela de Configurações não ficarem sem dias.
 */
export const FUNCIONAMENTO_PADRAO = [
  { dia: 0, nome: 'Domingo', aberto: false, inicio: '07:00', fim: '22:00' },
  { dia: 1, nome: 'Segunda-feira', aberto: true, inicio: '07:00', fim: '22:00' },
  { dia: 2, nome: 'Terça-feira', aberto: true, inicio: '07:00', fim: '22:00' },
  { dia: 3, nome: 'Quarta-feira', aberto: true, inicio: '07:00', fim: '22:00' },
  { dia: 4, nome: 'Quinta-feira', aberto: true, inicio: '07:00', fim: '22:00' },
  { dia: 5, nome: 'Sexta-feira', aberto: true, inicio: '07:00', fim: '22:00' },
  { dia: 6, nome: 'Sábado', aberto: true, inicio: '08:00', fim: '13:00' },
];

/** os 7 dias: o cadastrado vale; o que faltar vem do padrão */
export async function funcionamento() {
  const salvos = await prisma.funcionamento.findMany();
  return FUNCIONAMENTO_PADRAO.map((p) => {
    const s = salvos.find((x) => x.dia === p.dia);
    return s ? { dia: s.dia, nome: s.nome, aberto: s.aberto, inicio: s.inicio, fim: s.fim } : p;
  });
}
