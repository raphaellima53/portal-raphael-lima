/** Salas do Zoom = contas (30/09/2026): cada conta recebe até 2 aulas simultâneas, nunca 3; a próxima vai para a conta seguinte. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEM_CONTA_ZOOM, ZOOM_POR_CONTA, zoomDistribui } from '../src/domain/agenda.ts';

const sala = (n: string, zoom = true) => ({ name: n, atende: '—', tipo: '', zoom, active: true, zoomEmail: `${n}@x.com` });
const aula = (k: string, h: number, m = 0, extra: object = {}) =>
  ({ k, quando: new Date(2026, 9, 6, h, m), duracao: 60, sala: 'Zoom 01', estado: 'comAlunos', prod: 'Curso', ...extra }) as never;

test('até 2 aulas simultâneas por conta; a 3ª vai para a próxima conta e, sem conta, fica sinalizada', () => {
  const b = { salas: [sala('Zoom 01'), sala('Zoom 02'), sala('Sala 12', false)], cursos: [], ajustes: {} } as never;
  const aulas: { k: string; sala: string; quando: Date }[] = [
    aula('a', 10),
    aula('b', 10),
    aula('c', 10),
    aula('d', 10),
    aula('e', 10),
    aula('f', 10, 30),
    aula('g', 11),
    aula('p', 10, 0, { sala: 'Sala 12' }),
    aula('x', 10, 0, { estado: 'cancelada' }),
  ];
  zoomDistribui(b, aulas as never);
  const de = (k: string) => aulas.find((a) => a.k === k)!.sala;
  assert.equal(ZOOM_POR_CONTA, 2);
  assert.deepEqual(['a', 'b', 'c', 'd'].map(de), ['Zoom 01', 'Zoom 01', 'Zoom 02', 'Zoom 02']);
  assert.equal(de('e'), SEM_CONTA_ZOOM);
  assert.equal(de('f'), SEM_CONTA_ZOOM, 'às 10h30 as aulas das 10h ainda estão abertas');
  assert.equal(de('g'), 'Zoom 01', 'às 11h as contas estão livres de novo');
  assert.equal(de('p'), 'Sala 12', 'aula presencial não entra na conta');
  /* nunca 3 aulas ao mesmo tempo numa conta (a cancelada não conta) */
  for (const conta of ['Zoom 01', 'Zoom 02']) {
    const ativas = aulas.filter((a) => a.sala === conta && a.k !== 'x' && +a.quando === +new Date(2026, 9, 6, 10));
    assert.ok(ativas.length <= 2, `${conta} com ${ativas.length} aulas às 10h`);
  }
});
