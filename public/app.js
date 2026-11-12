import { escapeHtml as h, flattenForecast, lineLabel, readFavorites } from './domain.js';

const $ = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('indisponível'); } }; }

const state = {
  mode: 'paradas', favorites: readFavorites(storage), stop: null, forecast: null,
  searchController: null, forecastController: null, searchId: 0, forecastId: 0,
  busy: false, lastUpdate: null
};

function message(id, text = '', isError = false) {
  $(id).textContent = text;
  $(id).classList.toggle('error', isError);
}

async function api(resource, params = {}, signal) {
  const query = new URLSearchParams({ resource, ...params });
  let response;
  try { response = await fetch('/api/sptrans?' + query, { signal, cache: 'no-store' }); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar. Confira sua internet e tente novamente.');
  }
  let body;
  try { body = await response.json(); } catch { throw new Error('Não foi possível ler a resposta do serviço.'); }
  if (!response.ok) throw new Error(body.error || 'A consulta não pôde ser concluída.');
  return body;
}

function setMode(mode) {
  state.mode = mode;
  state.searchId++;
  state.searchController?.abort();
  $('search-submit').disabled = false;
  document.querySelectorAll('[data-mode]').forEach(button => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected);
  });
  $('search-label').textContent = mode === 'paradas' ? 'Nome do ponto ou da rua' : 'Número ou nome da linha';
  $('search-input').placeholder = mode === 'paradas' ? 'Ex.: Paulista' : 'Ex.: 8000 ou Lapa';
  $('search-results').innerHTML = '';
  message('search-message');
  $('search-input').focus();
}

function renderStops(stops) {
  $('search-results').innerHTML = stops.map(stop => `<button type="button" class="result-button" data-stop="${h(stop.cp)}"><b>${h(stop.np)}</b><small>${h(stop.ed || 'Endereço não informado')} <span aria-hidden="true">→</span></small></button>`).join('');
  $('search-results').querySelectorAll('[data-stop]').forEach(button => button.addEventListener('click', () => {
    const stop = stops.find(item => String(item.cp) === button.dataset.stop);
    if (stop) selectStop(stop);
  }));
}

function renderLines(lines) {
  $('search-results').innerHTML = lines.map(line => `<button type="button" class="result-button" data-line="${h(line.cl)}"><span class="line-badge">${h(lineLabel(line))}</span><b>Destino: ${h(line.sl === 1 ? line.ts : line.tp)}</b><small>Origem: ${h(line.sl === 1 ? line.tp : line.ts)} · Ver pontos →</small></button>`).join('');
  $('search-results').querySelectorAll('[data-line]').forEach(button => button.addEventListener('click', () => {
    const line = lines.find(item => String(item.cl) === button.dataset.line);
    if (line) loadStopsForLine(line);
  }));
}

async function search(event) {
  event.preventDefault();
  const term = $('search-input').value.trim();
  if (term.length < 2 || term.length > 80) {
    message('search-message', 'Digite de 2 a 80 caracteres para buscar.', true);
    $('search-input').focus(); return;
  }
  const id = ++state.searchId;
  state.searchController?.abort();
  state.searchController = new AbortController();
  $('search-submit').disabled = true;
  $('search-results').innerHTML = '';
  message('search-message', 'Buscando na SPTrans...');
  try {
    const { data } = await api(state.mode, { termo: term }, state.searchController.signal);
    if (id !== state.searchId) return;
    if (!data.length) {
      message('search-message', 'Nenhum resultado. Tente outro nome, rua ou número. Nem todas as paradas estão cobertas pela API.');
    } else {
      message('search-message', `${data.length} resultado(s). Escolha uma opção.`);
      if (state.mode === 'linhas') renderLines(data); else renderStops(data);
    }
  } catch (error) {
    if (id === state.searchId && error.name !== 'AbortError') message('search-message', error.message, true);
  } finally {
    if (id === state.searchId) $('search-submit').disabled = false;
  }
}

async function loadStopsForLine(line) {
  const id = ++state.searchId;
  state.searchController?.abort();
  state.searchController = new AbortController();
  $('search-submit').disabled = true;
  $('search-results').innerHTML = '';
  message('search-message', 'Carregando os pontos da linha ' + lineLabel(line) + '...');
  try {
    const { data } = await api('paradas-linha', { codigo: String(line.cl) }, state.searchController.signal);
    if (id !== state.searchId) return;
    renderStops(data);
    message('search-message', data.length ? `Linha ${lineLabel(line)}: ${data.length} ponto(s). Escolha onde vai embarcar.` : 'A API não retornou pontos para este sentido da linha. Tente uma busca por rua ou outro sentido.');
  } catch (error) {
    if (id === state.searchId && error.name !== 'AbortError') message('search-message', error.message, true);
  } finally {
    if (id === state.searchId) $('search-submit').disabled = false;
  }
}

function favoriteLabel() {
  const saved = state.stop && state.favorites.some(stop => stop.cp === state.stop.cp);
  $('favorite-toggle').textContent = saved ? '★ Ponto salvo' : '☆ Salvar ponto';
  $('favorite-toggle').setAttribute('aria-pressed', Boolean(saved));
}

async function selectStop(stop) {
  state.stop = { cp: Number(stop.cp), np: String(stop.np), ed: String(stop.ed || '') };
  state.forecast = null;
  $('stop-header').hidden = false;
  $('forecast-controls').hidden = false;
  $('stop-name').textContent = state.stop.np;
  $('stop-address').textContent = state.stop.ed;
  $('updated-at').textContent = '';
  favoriteLabel();
  if (window.matchMedia('(max-width: 760px)').matches) {
    $('arrivals-title').setAttribute('tabindex', '-1');
    $('arrivals-title').focus({ preventScroll: true });
    $('arrivals-title').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  await refreshForecast();
}

async function refreshForecast() {
  if (!state.stop) return;
  const id = ++state.forecastId;
  state.forecastController?.abort();
  state.forecastController = new AbortController();
  state.busy = true;
  $('refresh-button').disabled = true;
  message('forecast-message', 'Consultando as próximas chegadas...');
  $('arrivals-list').setAttribute('aria-busy', 'true');
  try {
    const result = await api('previsao', { codigo: String(state.stop.cp) }, state.forecastController.signal);
    if (id !== state.forecastId) return;
    state.forecast = result.data;
    state.lastUpdate = result.consultedAt;
    message('forecast-message');
    renderArrivals();
  } catch (error) {
    if (id !== state.forecastId || error.name === 'AbortError') return;
    state.forecast = null;
    $('arrivals-list').innerHTML = '';
    $('updated-at').textContent = '';
    message('forecast-message', error.message, true);
  } finally {
    if (id === state.forecastId) {
      state.busy = false;
      $('refresh-button').disabled = false;
      $('arrivals-list').setAttribute('aria-busy', 'false');
    }
  }
}

function renderArrivals() {
  if (!state.forecast) return;
  let buses = flattenForecast(state.forecast);
  const onlyAccessible = $('only-accessible').checked;
  if (onlyAccessible) buses = buses.filter(bus => bus.accessible === true);
  if (!buses.length) {
    $('arrivals-list').innerHTML = `<div class="empty-arrivals"><h3>${onlyAccessible ? 'Sem previsão de veículo acessível' : 'Sem previsão disponível agora'}</h3><p>A SPTrans não retornou ${onlyAccessible ? 'veículos acessíveis para este ponto' : 'chegadas para este ponto'} nesta consulta.<br>Tente atualizar em alguns instantes.</p></div>`;
  } else {
    $('arrivals-list').innerHTML = buses.map(bus => `<article class="arrival-card"><div class="arrival-info"><span class="line-badge">${h(bus.line)}</span><h3>${h(bus.destination)}</h3><p>Veículo ${h(bus.prefix)}</p><span class="accessible">${bus.accessible === true ? '♿ Acessível' : bus.accessible === false ? 'Acessibilidade não indicada para este veículo' : 'Acessibilidade não informada'}</span></div><div class="arrival-time"><strong>${bus.minutes === null ? h(bus.arrival) : bus.minutes === 0 ? 'Agora' : `${bus.minutes} <small>min</small>`}</strong><span>Chegada: ${h(bus.arrival)}</span></div></article>`).join('');
  }
  const date = new Date(state.lastUpdate);
  const consulted = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('updated-at').textContent = `Referência da SPTrans: ${state.forecast.hr || '--:--'}. Consulta: ${consulted}. Tempos em minutos calculados a partir da referência da API.`;
}

function saveFavorites(next) {
  try { storage.setItem('ponto-certo-favoritos', JSON.stringify(next)); }
  catch {
    message('forecast-message', 'O navegador não permitiu salvar favoritos. A consulta continua disponível.', true);
    return false;
  }
  state.favorites = next;
  renderFavorites();
  favoriteLabel();
  return true;
}

function renderFavorites() {
  $('favorites-count').textContent = state.favorites.length;
  $('favorites-list').innerHTML = state.favorites.length ? state.favorites.map(stop => `<div class="favorite-item"><button type="button" class="result-button" data-open="${h(stop.cp)}"><b>${h(stop.np)}</b><small>${h(stop.ed)}</small></button><button type="button" class="favorite-remove" data-remove="${h(stop.cp)}" aria-label="Remover ${h(stop.np)} dos favoritos">×</button></div>`).join('') : '<p class="help">Nenhum ponto salvo. Escolha um ponto e toque em “Salvar ponto”.</p>';
  $('favorites-list').querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => selectStop(state.favorites.find(stop => String(stop.cp) === button.dataset.open))));
  $('favorites-list').querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
    saveFavorites(state.favorites.filter(stop => String(stop.cp) !== button.dataset.remove));
  }));
}

$('favorite-toggle').addEventListener('click', () => {
  if (!state.stop) return;
  const saved = state.favorites.some(stop => stop.cp === state.stop.cp);
  if (!saved && state.favorites.length >= 20) {
    message('forecast-message', 'Você já salvou 20 pontos. Remova um para adicionar outro.', true); return;
  }
  saveFavorites(saved ? state.favorites.filter(stop => stop.cp !== state.stop.cp) : [...state.favorites, state.stop]);
});
$('search-form').addEventListener('submit', search);
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('refresh-button').addEventListener('click', refreshForecast);
$('only-accessible').addEventListener('change', renderArrivals);
$('contrast').addEventListener('click', () => {
  const active = document.documentElement.classList.toggle('high-contrast');
  $('contrast').setAttribute('aria-pressed', active);
  try { storage.setItem('ponto-certo-contraste', String(active)); } catch { /* A consulta funciona sem persistência. */ }
});
try {
  const active = storage.getItem('ponto-certo-contraste') === 'true';
  document.documentElement.classList.toggle('high-contrast', active);
  $('contrast').setAttribute('aria-pressed', active);
} catch { /* O padrão tem contraste suficiente para leitura. */ }

setInterval(() => {
  if (state.stop && $('auto-refresh').checked && !document.hidden && navigator.onLine && !state.busy) refreshForecast();
}, 30000);
window.addEventListener('offline', () => {
  $('service-note').hidden = false;
  $('service-note').textContent = 'Você está sem conexão. Aguarde a internet voltar para fazer novas consultas.';
});
window.addEventListener('online', () => {
  $('service-note').hidden = true;
  if (state.stop) refreshForecast();
});
renderFavorites();
api('status').then(result => {
  if (!result.configured) {
    $('service-note').hidden = false;
    $('service-note').textContent = 'As consultas ainda aguardam a configuração do serviço. Nenhuma previsão será exibida sem dados da SPTrans.';
  }
}).catch(() => { /* A busca apresenta o erro se o usuário tentar consultar. */ });
