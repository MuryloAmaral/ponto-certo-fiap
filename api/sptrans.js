import { ApiError, createSptransClient } from '../lib/sptrans-client.js';

let client;
let configuredToken;

export function buildEndpoint(query) {
  const resource = query.get('resource');
  if (resource === 'linhas' || resource === 'paradas') {
    const term = (query.get('termo') || '').trim();
    if (term.length < 2 || term.length > 80) throw new ApiError(400, 'Digite de 2 a 80 caracteres na busca.');
    return (resource === 'linhas' ? '/Linha/Buscar' : '/Parada/Buscar') + '?termosBusca=' + encodeURIComponent(term);
  }
  if (resource === 'paradas-linha' || resource === 'previsao') {
    const code = query.get('codigo') || '';
    if (!/^\d{1,10}$/.test(code) || Number(code) <= 0) throw new ApiError(400, 'Código inválido para a consulta.');
    return resource === 'paradas-linha' ? '/Parada/BuscarParadasPorLinha?codigoLinha=' + code : '/Previsao/Parada?codigoParada=' + code;
  }
  throw new ApiError(400, 'Consulta não reconhecida.');
}

export async function handleRequest(method, query, getClient) {
  if (method !== 'GET') throw new ApiError(405, 'Método não permitido.');
  if (query.get('resource') === 'status') return { configured: Boolean(process.env.SPTRANS_TOKEN?.trim()) };
  const endpoint = buildEndpoint(query);
  const data = await getClient().get(endpoint);
  const isForecast = query.get('resource') === 'previsao';
  if (isForecast ? (!data || typeof data !== 'object' || Array.isArray(data) || !('hr' in data)) : !Array.isArray(data)) {
    throw new ApiError(502, 'O formato da resposta da SPTrans não é o esperado.');
  }
  return { data, consultedAt: new Date().toISOString(), source: 'SPTrans / Olho Vivo' };
}

function getClient() {
  const token = process.env.SPTRANS_TOKEN?.trim();
  if (!client || token !== configuredToken) {
    configuredToken = token;
    client = createSptransClient({ token });
  }
  return client;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const query = new URL(req.url, 'https://local.invalid').searchParams;
    const payload = await handleRequest(req.method, query, getClient);
    res.statusCode = 200;
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.statusCode = error instanceof ApiError ? error.status : 500;
    if (res.statusCode === 405) res.setHeader('Allow', 'GET');
    if (res.statusCode === 429) res.setHeader('Retry-After', '30');
    res.end(JSON.stringify({ error: error instanceof ApiError ? error.message : 'Ocorreu um erro ao consultar o serviço.' }));
  }
}
