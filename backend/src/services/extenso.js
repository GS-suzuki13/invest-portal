// Converte um valor em reais para texto por extenso (pt-BR).
// Ex.: 25000 -> "vinte e cinco mil reais"
//      1234.5 -> "mil duzentos e trinta e quatro reais e cinquenta centavos"
//      1000000 -> "um milhão de reais"

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
  "dezoito", "dezenove",
];
const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa",
];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

function ateCem(n) {
  if (n < 20) return UNIDADES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
}

function ateMil(n) {
  if (n === 100) return "cem";
  if (n < 100) return ateCem(n);
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} e ${ateCem(resto)}`;
}

// Junta os grupos (milhões / milhares / centenas) seguindo a regra do "e":
// usa "e" antes do último grupo quando ele é menor que 100 ou múltiplo de 100.
function juntarGrupos(grupos) {
  const preenchidos = grupos.filter((g) => g.texto);
  if (preenchidos.length === 0) return "zero";
  if (preenchidos.length === 1) return preenchidos[0].texto;

  const ultimo = preenchidos[preenchidos.length - 1];
  const inicio = preenchidos.slice(0, -1).map((g) => g.texto).join(", ");
  const conector = ultimo.valor < 100 || ultimo.valor % 100 === 0 ? " e " : ", ";
  return inicio + conector + ultimo.texto;
}

function porExtensoInteiro(n) {
  if (n === 0) return "zero";

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const centenas = n % 1000;

  return juntarGrupos([
    {
      valor: milhoes,
      texto: milhoes === 0 ? "" : milhoes === 1 ? "um milhão" : `${ateMil(milhoes)} milhões`,
    },
    {
      valor: milhares,
      texto: milhares === 0 ? "" : milhares === 1 ? "mil" : `${ateMil(milhares)} mil`,
    },
    { valor: centenas, texto: centenas === 0 ? "" : ateMil(centenas) },
  ]);
}

function valorPorExtenso(valor) {
  const numero = Math.round(Number(valor || 0) * 100) / 100;
  const reais = Math.floor(numero);
  const centavos = Math.round((numero - reais) * 100);

  // "de reais" quando o número termina em milhão/milhões/bilhão (nada depois)
  const terminaEmMilhao = reais >= 1_000_000 && reais % 1_000_000 === 0;
  const unidadeReais = reais === 1 ? "real" : terminaEmMilhao ? "de reais" : "reais";
  const parteReais = `${porExtensoInteiro(reais)} ${unidadeReais}`;

  if (centavos === 0) return parteReais;

  const parteCentavos =
    centavos === 1 ? "um centavo" : `${porExtensoInteiro(centavos)} centavos`;

  return `${parteReais} e ${parteCentavos}`;
}

module.exports = { valorPorExtenso };
