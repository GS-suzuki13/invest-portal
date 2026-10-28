/** Data local (fuso do navegador) em AAAA-MM-DD. toISOString() usa UTC: depois das 21h em Brasília já é amanhã. */
export const dataLocalISO = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseDateLocal = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match
    ? new Date(+match[1], +match[2] - 1, +match[3])
    : new Date(dateStr);
};
