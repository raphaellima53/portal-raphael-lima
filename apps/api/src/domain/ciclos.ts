/**
 * Ciclos de aprendizagem (02/10/2026): o ciclo vale para um módulo ou turma de um curso e diz qual conteúdo do
 * currículo publicado cai em cada data de aula.
 *
 * Definição: data de início · Período (até a data de fim) ou Número de conteúdos · conteúdos por semana ·
 * Repetição ou Livre. As datas são os dias da semana em que o módulo ou turma tem aula (grade ou dias da turma).
 *
 * - Repetição: na semana, os dias de aula se dividem em blocos seguidos, um por conteúdo.
 *   2 por semana, seg a sáb → seg, ter, qua = conteúdo 1 · qui, sex, sáb = conteúdo 2.
 * - Livre: os conteúdos da semana se intercalam dia a dia (1, 2, 1, 2…); a tela de validação deixa trocar.
 *
 * Cada data guarda `s`, a posição dela na sequência de conteúdos (as datas de um mesmo bloco têm o mesmo `s`), e `i`,
 * o conteúdo do currículo (`s` dá a volta quando o currículo acaba). "Replicar" na validação usa `s` para levar a
 * troca de uma data às seguintes.
 */
import { fmt } from '../lib/fmt.ts';
import { agOfertas, type Oferta } from './agenda.ts';
import type { Base, CurriculoB } from './base.ts';

export type CicloDef = {
  inicio: string;
  modo: 'periodo' | 'quantidade';
  fim: string;
  quantidade: number | null;
  porSemana: number;
  distribuicao: 'repeticao' | 'livre';
};
export type DataCiclo = { data: string; s: number; i: number };

/** no máximo um ano de datas por ciclo */
const MAX_DIAS = 366;

/** dias da semana (0 = domingo) em que o módulo ou turma tem aula */
export const diasDoItem = (b: Base, curso: string, item: string, ofs: Oferta[] = agOfertas(b)) =>
  [...new Set(ofs.filter((o) => o.prod === curso && o.mod === item).flatMap((o) => o.dias))].sort((x, y) => x - y);

/** o currículo publicado aplicado no módulo ou turma */
export const curriculoDoItem = (b: Base, curso: string, item: string): CurriculoB | null =>
  b.curriculos.find((c) => c.grupo === curso && c.aplicado.includes(item) && c.conteudos.length) ?? null;

const dia = (iso: string) => new Date(`${iso}T00:00:00`);
/** segunda-feira da semana da data (a semana vai de segunda a domingo) */
const semanaDe = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return fmt.iso(x);
};

/** monta as datas do ciclo; erro em texto quando a definição não fecha */
export function geraDatas(def: CicloDef, dias: number[], total: number): { erro: string } | { datas: DataCiclo[] } {
  if (!dias.length) return { erro: 'O módulo ou turma não tem dias de aula na grade.' };
  if (!total) return { erro: 'O módulo ou turma não tem currículo publicado com conteúdos.' };
  const ini = dia(def.inicio);
  const limite = new Date(ini);
  limite.setDate(limite.getDate() + MAX_DIAS);
  const fim = def.modo === 'periodo' ? dia(def.fim) : limite;
  if (def.modo === 'periodo' && fim < ini) return { erro: 'A data de fim precisa ser depois do início.' };
  if (def.modo === 'periodo' && fim > limite) return { erro: 'O ciclo vai até um ano depois do início.' };
  const quantos = def.modo === 'quantidade' ? (def.quantidade ?? 0) : Number.POSITIVE_INFINITY;

  /* as datas de aula, agrupadas por semana */
  const semanas: string[][] = [];
  let atual = '';
  for (const d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    if (!dias.includes(d.getDay())) continue;
    const w = semanaDe(d);
    if (w !== atual) {
      semanas.push([]);
      atual = w;
    }
    semanas[semanas.length - 1].push(fmt.iso(d));
  }

  const out: DataCiclo[] = [];
  let s = 0;
  for (const ds of semanas) {
    if (s >= quantos) break;
    /* semana com menos dias que conteúdos (a primeira, por exemplo): um conteúdo por dia, sem pular nenhum */
    const n = Math.min(def.porSemana, ds.length, quantos - s);
    ds.forEach((data, k) => {
      const j = def.distribuicao === 'livre' ? k % n : Math.floor((k * n) / ds.length);
      out.push({ data, s: s + j, i: (s + j) % total });
    });
    s += n;
  }
  if (!out.length) return { erro: 'Nenhum dia de aula no período escolhido.' };
  return { datas: out };
}
