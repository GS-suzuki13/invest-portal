// Nomes de pessoas para exibição. Funcionam com emoji, acentos e nomes de uma letra:
// cortam por grafema (o que a pessoa vê como um caractere), nunca por unidade UTF-16.

const segmentador =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }) : null;

const primeiroGrafema = (s: string) =>
  segmentador ? (segmentador.segment(s)[Symbol.iterator]().next().value?.segment ?? '') : Array.from(s)[0] ?? '';

/** palavras que têm pelo menos uma letra ("🌻 Flor de Lis" → ["Flor", "de", "Lis"]) */
const palavras = (nome: string) =>
  nome
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{L}]+/u, ''))
    .filter((p) => /\p{L}/u.test(p));

export function primeiroNome(nome?: string | null): string {
  return palavras(nome ?? '')[0] ?? '';
}

/** primeira letra do primeiro e do último nome ("Maria … Montenegro" → "MM"; "Jo" → "J") */
export function iniciais(nome?: string | null): string {
  const ps = palavras(nome ?? '');
  if (ps.length === 0) return '';
  const letras = ps.length === 1 ? [ps[0]] : [ps[0], ps[ps.length - 1]];
  return letras.map((p) => primeiroGrafema(p).toLocaleUpperCase('pt-BR')).join('');
}
