// Mensagem enviada automaticamente pelo chat do site quando o admin reinveste
// o rendimento líquido de um repasse no valor aportado do investidor.

const brl = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * @param {object} dados
 * @param {string} dados.nome
 * @param {number} dados.valorAnterior
 * @param {number} dados.valorBruto
 * @param {number} dados.valorLiquido
 * @param {number} dados.valorAtual
 * @returns {string}
 */
function montarMensagemReinvestimento(dados) {
  return [
    `Prezado(a) ${dados.nome},`,
    "",
    "É com grande satisfação que apresentamos a atualização do seu investimento referente aos últimos 30 dias úteis.",
    "",
    "Antes de tudo, gostaríamos de agradecer pela confiança depositada em nosso trabalho e por permanecer conosco durante mais este ciclo. É uma satisfação tê-lo(a) como nosso(a) investidor(a), e seguimos comprometidos em conduzir sua gestão com transparência, responsabilidade e dedicação.",
    "",
    "Atualização da sua posição:",
    "",
    `• Valor anterior: ${brl(dados.valorAnterior)}`,
    `• Valor Ciclo Repasse Bruto: ${brl(dados.valorBruto)}`,
    `• Valor Ciclo Repasse Líquido: ${brl(dados.valorLiquido)}`,
    `• Valor Atual Investido: ${brl(dados.valorAtual)}`,
    "",
    "Agradecemos mais uma vez pela parceria e confiança. Permanecemos à disposição para esclarecer qualquer dúvida e apresentar mais detalhes sobre a evolução do seu investimento sempre que desejar.",
    "",
    "Atenciosamente,",
    "Equipe InvestPortal",
  ].join("\n");
}

module.exports = { montarMensagemReinvestimento };
