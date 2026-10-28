// Índices de mercado (CDI e poupança) de fontes públicas e gratuitas, sem chave.
//
// Fonte principal: Ipeadata (IPEA), que espelha as séries do Banco Central:
//   SGS366_CDI366 → Taxa CDI diária (% ao dia útil) — a mesma SGS 12 do BCB
//   BM12_RNDPO12  → Rendimento da poupança (% ao mês, um valor por mês)
// Reserva: API SGS do próprio Banco Central (séries 12 e 195). Em out/2026 o
// firewall do BCB passou a rejeitar consultas automatizadas ("Requisição
// inválida") ou deixá-las sem resposta, por isso ela virou só reserva.
//
// Usado para mostrar ao investidor quanto o aporte dele teria rendido no CDI e
// na poupança no mesmo período de um repasse.
//
// Obs.: o Tesouro Selic acompanha o CDI quase exatamente (mesma linha do
// gráfico), por isso a segunda referência é a poupança, que é o parâmetro de
// comparação clássico e que de fato difere.

const IPEA = "https://www.ipeadata.gov.br/api/odata4";
const IPEA_CDI = "SGS366_CDI366";
const IPEA_POUPANCA = "BM12_RNDPO12";

const BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";
const SGS_CDI = 12;
const SGS_POUPANCA = 195;
// sem um User-Agent de navegador o firewall do BCB nem responde
const BCB_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

// Série histórica de período fechado não muda — cache generoso.
const cache = new Map(); // chave -> { valor, expira }
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE = 500; // cada período pedido vira uma entrada: sem teto, a memória só cresce
const TIMEOUT_MS = 10_000; // fonte fora do ar não pode prender a requisição
const TIMEOUT_IPEA_MS = 20_000; // o Ipeadata devolve a série inteira (~1,3 MB)

function guardar(key, valor) {
  if (cache.size >= MAX_CACHE) {
    const agora = Date.now();
    for (const [k, v] of cache) if (v.expira <= agora) cache.delete(k);
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value); // a mais antiga
  }
  cache.set(key, { valor, expira: Date.now() + TTL_MS });
  return valor;
}

function doCache(key) {
  const hit = cache.get(key);
  return hit && hit.expira > Date.now() ? hit.valor : null;
}

const dataValida = (r) => /^\d{4}-\d{2}-\d{2}$/.test(r.data) && Number.isFinite(r.taxa);

// Série completa do Ipeadata (a API ignora filtros de data: vem tudo, uma vez,
// e fica em cache). VALDATA vem como "2026-10-15T00:00:00-03:00".
async function serieIpea(codigo) {
  const key = `ipea:${codigo}`;
  const hit = doCache(key);
  if (hit) return hit;

  const res = await fetch(`${IPEA}/ValoresSerie(SERCODIGO='${codigo}')`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_IPEA_MS),
  });
  if (!res.ok) throw new Error(`Ipeadata ${codigo} respondeu HTTP ${res.status}`);

  const raw = await res.json();
  if (!Array.isArray(raw?.value)) throw new Error(`Ipeadata ${codigo}: formato de resposta inesperado`);

  const serie = raw.value
    .map((v) => ({ data: String(v.VALDATA || "").slice(0, 10), taxa: Number(v.VALVALOR) }))
    .filter(dataValida)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  return guardar(key, serie);
}

// Poupança mensal (% ao mês, data = 1º dia do mês) → um ponto por dia-calendário
// do período, com a taxa do mês daquele dia (ou a última publicada, se o mês
// ainda não saiu). Mesmo formato que a série 195 do BCB entrega.
function poupancaPorDia(mensal, inicioIso, fimIso) {
  const pontos = [];
  let i = 0;
  let taxa = null;
  for (let dia = inicioIso; dia <= fimIso; dia = somarDias(dia, 1)) {
    while (i < mensal.length && mensal[i].data <= dia) taxa = mensal[i++].taxa;
    if (taxa != null) pontos.push({ data: dia, taxa });
  }
  return pontos;
}

// CDI do período: Ipeadata; se falhar, o BCB.
async function cdiDoPeriodo(inicioIso, fimIso) {
  try {
    const serie = await serieIpea(IPEA_CDI);
    return { fonte: "Ipeadata", serie: serie.filter((p) => p.data >= inicioIso && p.data <= fimIso) };
  } catch (err) {
    console.warn(`[indices] Ipeadata (CDI) indisponível — tentando o BCB: ${err.message}`);
    return { fonte: "BCB", serie: await serieSGS(SGS_CDI, inicioIso, fimIso) };
  }
}

// Poupança do período (um ponto por dia): Ipeadata; se falhar, o BCB.
async function poupancaDoPeriodo(inicioIso, fimIso) {
  try {
    return { fonte: "Ipeadata", serie: poupancaPorDia(await serieIpea(IPEA_POUPANCA), inicioIso, fimIso) };
  } catch (err) {
    console.warn(`[indices] Ipeadata (poupança) indisponível — tentando o BCB: ${err.message}`);
    // a poupança do "aniversário" usa a taxa de ~1 mês antes; pega uma folga
    const serie = await serieSGS(SGS_POUPANCA, somarDias(inicioIso, -35), fimIso);
    return { fonte: "BCB", serie: serie.filter((p) => p.data >= inicioIso && p.data <= fimIso) };
  }
}

const isoParaBR = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const brParaIso = (br) => {
  const [d, m, y] = br.split("/");
  return `${y}-${m}-${d}`;
};
const somarDias = (iso, n) => {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

async function serieSGS(codigo, inicioIso, fimIso) {
  const key = `${codigo}:${inicioIso}:${fimIso}`;
  const hit = doCache(key);
  if (hit) return hit;

  const url =
    `${BASE}.${codigo}/dados?formato=json` +
    `&dataInicial=${isoParaBR(inicioIso)}&dataFinal=${isoParaBR(fimIso)}`;

  const res = await fetch(url, {
    headers: BCB_HEADERS,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`BCB SGS ${codigo} respondeu HTTP ${res.status}`);

  // bloqueado, o BCB responde 200 com uma página HTML ("Requisição inválida")
  const raw = await res.json().catch(() => null);
  if (!Array.isArray(raw)) {
    throw new Error(`BCB SGS ${codigo}: resposta não é a série (bloqueio ou erro do BCB)`);
  }

  const serie = raw
    .map((r) => ({
      data: brParaIso(String(r.data)),
      taxa: Number(String(r.valor).replace(",", ".")),
    }))
    .filter(dataValida);

  return guardar(key, serie);
}

// CDI: taxa é % ao dia útil -> fator diário (1 + taxa/100).
function acumularCDI(serie) {
  let fator = 1;
  return serie.map((p) => {
    fator *= 1 + p.taxa / 100;
    return { data: p.data, fator };
  });
}

// Poupança: `taxa` é o rendimento MENSAL vigente naquele dia. Aproxima o
// acúmulo diário como (1 + mensal/100) ^ (1/30) por dia-calendário.
function acumularPoupanca(serie) {
  let fator = 1;
  return serie.map((p) => {
    fator *= Math.pow(1 + p.taxa / 100, 1 / 30);
    return { data: p.data, fator };
  });
}

const ultimoFator = (arr) => (arr.length ? arr[arr.length - 1].fator : 1);

/**
 * Acumulado de CDI e poupança entre duas datas (YYYY-MM-DD).
 */
async function comparativo(inicioIso, fimIso) {
  const [cdiRaw, poupRaw] = await Promise.all([
    cdiDoPeriodo(inicioIso, fimIso),
    poupancaDoPeriodo(inicioIso, fimIso),
  ]);
  if (!cdiRaw.serie.length) throw new Error("CDI sem dados para o período");

  const cdi = acumularCDI(cdiRaw.serie);
  const poupanca = acumularPoupanca(poupRaw.serie);

  const montar = (rotulo, arr) => ({
    rotulo,
    serie: arr,
    fator: ultimoFator(arr),
    percentual: (ultimoFator(arr) - 1) * 100,
  });

  return {
    inicio: inicioIso,
    fim: fimIso,
    dias_uteis: cdi.length,
    fonte:
      cdiRaw.fonte === "Ipeadata" && poupRaw.fonte === "Ipeadata"
        ? "Banco Central do Brasil, via Ipeadata (CDI diário e rendimento da poupança)"
        : "Banco Central do Brasil — SGS (séries 12 e 195)",
    cdi: montar("CDI", cdi),
    poupanca: montar("Poupança", poupanca),
  };
}

module.exports = { comparativo, serieSGS, acumularCDI, acumularPoupanca };
