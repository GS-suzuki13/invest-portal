// Próximo repasse = 30 dias úteis depois do fim do último repasse (ou do
// cadastro, se ainda não houve repasse) — a mesma regra do backend ao fechar.
//
// Conta só com a DATA (UTC), sem fuso: `new Date("2026-05-18")` no navegador
// em Brasília vira 17/05 21h e o resultado saía um dia útil antes.

const diaUTC = (valor: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor || '');
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? null
    : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

const somarDiasUteis = (inicio: Date, diasUteis: number) => {
  const r = new Date(inicio);
  let somados = 0;
  while (somados < diasUteis) {
    r.setUTCDate(r.getUTCDate() + 1);
    const dia = r.getUTCDay();
    if (dia !== 0 && dia !== 6) somados++;
  }
  return r;
};

/** Próximo repasse em YYYY-MM-DD (null se a data base for inválida). */
export const proximoRepasseISO = (dataCadastro: string, repasses: { end: string }[] = []) => {
  const base = diaUTC(repasses.length ? repasses[repasses.length - 1].end : dataCadastro);
  return base ? somarDiasUteis(base, 30).toISOString().slice(0, 10) : null;
};

/** "YYYY-MM-DD" → "DD/MM/AAAA" */
export const isoParaBR = (iso: string) => iso.split('-').reverse().join('/');

/** Próximo repasse em DD/MM/AAAA (formato usado nas telas). */
export const calculateNextRepasseBusinessDays = (
  dataCadastro: string,
  repasses: { end: string }[] = []
) => {
  const iso = proximoRepasseISO(dataCadastro, repasses);
  return iso ? isoParaBR(iso) : '—';
};
