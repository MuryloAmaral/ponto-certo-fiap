const BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// A sessão permanece somente na memória do servidor, nunca no navegador.
export function createSptransClient({ token, fetchImpl = fetch, timeoutMs = 6000 }) {
  let cookie = '';
  let authentication = null;

  async function request(path, options = {}) {
    try {
      return await fetchImpl(BASE_URL + path, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'application/json', ...options.headers }
      });
    } catch {
      throw new ApiError(503, 'Não foi possível conectar à SPTrans. Tente novamente em instantes.');
    }
  }

  async function authenticate() {
    if (!token) throw new ApiError(503, 'O serviço ainda não foi configurado pelo responsável.');
    if (!authentication) {
      authentication = (async () => {
        const response = await request('/Login/Autenticar?token=' + encodeURIComponent(token), { method: 'POST' });
        if (!response.ok) throw new ApiError(503, 'Não foi possível autenticar na SPTrans.');
        let accepted;
        try { accepted = await response.json(); } catch { throw new ApiError(502, 'Resposta de autenticação inválida.'); }
        if (accepted !== true) throw new ApiError(503, 'A chave da SPTrans não foi aceita. O responsável precisa conferir a configuração.');
        const cookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
        cookie = cookies.map(item => item.split(';')[0]).filter(Boolean).join('; ');
        if (!cookie) throw new ApiError(502, 'A SPTrans não devolveu uma sessão de acesso.');
      })().finally(() => { authentication = null; });
    }
    await authentication;
  }

  async function get(path) {
    if (!cookie) await authenticate();
    let response = await request(path, { headers: { Cookie: cookie } });
    if (response.status === 401 || response.status === 403) {
      cookie = '';
      await authenticate();
      response = await request(path, { headers: { Cookie: cookie } });
    }
    if (response.status === 429) throw new ApiError(429, 'Muitas consultas. Aguarde alguns segundos antes de tentar de novo.');
    if (!response.ok) throw new ApiError(502, 'A SPTrans não conseguiu responder à consulta. Tente novamente.');
    let data;
    try { data = await response.json(); } catch { throw new ApiError(502, 'A SPTrans enviou uma resposta que não pôde ser lida.'); }
    if (data === false) {
      cookie = '';
      throw new ApiError(502, 'A sessão da SPTrans expirou. Faça uma nova consulta.');
    }
    return data;
  }

  return { get };
}
