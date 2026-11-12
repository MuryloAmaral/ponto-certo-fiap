import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createSptransClient } from '../lib/sptrans-client.js';
import { buildEndpoint, handleRequest } from '../api/sptrans.js';

const params = value => new URLSearchParams(value);
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

test('rotas são fechadas e o termo é codificado', () => {
  assert.equal(buildEndpoint(params({ resource: 'linhas', termo: 'São Paulo' })), '/Linha/Buscar?termosBusca=S%C3%A3o%20Paulo');
  assert.equal(buildEndpoint(params({ resource: 'previsao', codigo: '123' })), '/Previsao/Parada?codigoParada=123');
  assert.throws(() => buildEndpoint(params({ resource: 'http://example.com' })), ApiError);
  for (const codigo of ['0', '-1', '1&token=x', 'a', '12345678901']) {
    assert.throws(() => buildEndpoint(params({ resource: 'previsao', codigo })), ApiError);
  }
  assert.throws(() => buildEndpoint(params({ resource: 'linhas', termo: 'a' })), ApiError);
});

test('autentica por POST e reaproveita somente o cookie no servidor', async () => {
  const calls = [];
  const client = createSptransClient({ token: 'chave-de-teste', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return url.includes('/Login/') ? response(true, 200, { 'Set-Cookie': 'sessao=123; Path=/; HttpOnly' }) : response([]);
  } });
  await client.get('/Linha/Buscar?termosBusca=8000');
  await client.get('/Parada/Buscar?termosBusca=Paulista');
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[1].options.headers.Cookie, 'sessao=123');
  assert.equal(calls[1].url.includes('chave-de-teste'), false);
});

test('renova a sessão uma vez após 401', async () => {
  let logins = 0, gets = 0;
  const client = createSptransClient({ token: 'teste', fetchImpl: async url => {
    if (url.includes('/Login/')) { logins++; return response(true, 200, { 'Set-Cookie': `s=${logins}; Path=/` }); }
    gets++;
    return gets === 1 ? response({}, 401) : response([]);
  } });
  assert.deepEqual(await client.get('/Linha/Buscar?termosBusca=8000'), []);
  assert.equal(logins, 2);
  assert.equal(gets, 2);
});

test('não autentica várias vezes para consultas simultâneas', async () => {
  let logins = 0;
  const client = createSptransClient({ token: 'teste', fetchImpl: async url => {
    if (url.includes('/Login/')) { logins++; return response(true, 200, { 'Set-Cookie': 's=1; Path=/' }); }
    return response([]);
  } });
  await Promise.all([client.get('/Linha/Buscar?termosBusca=8000'), client.get('/Parada/Buscar?termosBusca=Paulista')]);
  assert.equal(logins, 1);
});

test('trata falta de token, chave rejeitada e sessão sem cookie', async () => {
  await assert.rejects(createSptransClient({}).get('/Linha/Buscar?termosBusca=8000'), e => e.status === 503);
  await assert.rejects(createSptransClient({ token: 'teste', fetchImpl: async () => response(false) }).get('/Linha/Buscar?termosBusca=8000'), e => e.status === 503);
  await assert.rejects(createSptransClient({ token: 'teste', fetchImpl: async () => response(true) }).get('/Linha/Buscar?termosBusca=8000'), e => e.status === 502);
});

test('trata limite de requisições e resposta inválida', async () => {
  for (const status of [429, 500]) {
    const client = createSptransClient({ token: 'teste', fetchImpl: async url => url.includes('/Login/') ? response(true, 200, { 'Set-Cookie': 's=1' }) : response({}, status) });
    await assert.rejects(client.get('/Linha/Buscar?termosBusca=8000'), e => e.status === (status === 429 ? 429 : 502));
  }
  const client = createSptransClient({ token: 'teste', fetchImpl: async url => url.includes('/Login/') ? response(true, 200, { 'Set-Cookie': 's=1' }) : new Response('<html>erro</html>') });
  await assert.rejects(client.get('/Linha/Buscar?termosBusca=8000'), e => e.status === 502);
});

test('erros de rede não expõem a URL com a chave', async () => {
  const client = createSptransClient({ token: 'segredo-123', fetchImpl: async () => { throw Error('URL contém segredo-123'); } });
  await assert.rejects(client.get('/Linha/Buscar?termosBusca=8000'), e => e.status === 503 && !e.message.includes('segredo-123'));
});

test('handler recusa métodos e formatos incompatíveis', async () => {
  await assert.rejects(handleRequest('POST', params({ resource: 'linhas', termo: 'ab' }), () => null), e => e.status === 405);
  await assert.rejects(handleRequest('GET', params({ resource: 'linhas', termo: 'ab' }), () => ({ get: async () => ({ erro: true }) })), e => e.status === 502);
  const result = await handleRequest('GET', params({ resource: 'previsao', codigo: '1' }), () => ({ get: async () => ({ hr: '10:00', p: null }) }));
  assert.equal(result.source, 'SPTrans / Olho Vivo');
  assert.equal(result.data.p, null);
});
