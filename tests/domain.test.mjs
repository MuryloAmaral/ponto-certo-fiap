import test from 'node:test';
import assert from 'node:assert/strict';
import { minutesUntil, flattenForecast, escapeHtml, readFavorites, lineLabel } from '../public/domain.js';

test('minutos usam o horário da API, inclusive virada do dia', () => {
  assert.equal(minutesUntil('10:15', '10:21'), 6);
  assert.equal(minutesUntil('23:58', '00:03'), 5);
  assert.equal(minutesUntil('10:15', '10:15'), 0);
  assert.equal(minutesUntil('10:15', '10:14'), null);
  assert.equal(minutesUntil('xx', '10:14'), null);
  assert.equal(minutesUntil('25:00', '10:14'), null);
});

test('ordena veículos e conserva acessibilidade e destino', () => {
  const result = flattenForecast({ hr: '10:00', p: { l: [{ c: '8000-10', lt0: 'Destino', vs: [{ p: '1', t: '10:07', a: false }, { p: '2', t: '10:02', a: true }] }] } });
  assert.equal(result[0].prefix, '2');
  assert.equal(result[0].minutes, 2);
  assert.equal(result[0].accessible, true);
  assert.equal(result[0].destination, 'Destino');
  assert.deepEqual(flattenForecast({ hr: '10:00', p: null }), []);
});

test('não transforma resposta externa em HTML executável', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('favoritos corrompidos ou inválidos não quebram a página', () => {
  const from = value => readFavorites({ getItem: () => value });
  assert.deepEqual(from('{quebrado'), []);
  assert.deepEqual(from('{}'), []);
  assert.deepEqual(from('[{"cp":1,"np":"A"},{"cp":1,"np":"A"},{"cp":-1,"np":"B"}]'), [{ cp: 1, np: 'A', ed: '' }]);
  assert.deepEqual(readFavorites({ getItem: () => { throw Error(); } }), []);
  assert.equal(lineLabel({ lt: '8000', tl: 10 }), '8000-10');
});
