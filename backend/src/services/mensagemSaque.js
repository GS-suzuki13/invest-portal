// Mensagem enviada automaticamente pelo chat do site quando o admin registra
// um saque do investidor (informe da nova posição).

const brl = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dataBR = (iso) => {
  const [a, m, d] = String(iso || "").split("-");
  return d ? `${d}/${m}/${a}` : String(iso || "");
};

/**
 * @param {object} dados
 * @param {string} dados.nome
 * @param {string} dados.data      data do saque (AAAA-MM-DD)
 * @param {number} dados.valorAnterior
 * @param {number} dados.valorSaque
 * @param {number} dados.valorAtual
 * @returns {string}
 */
function montarMensagemSaque(dados) {
  return [
    `Prezado(a) ${dados.nome},`,
    "",
    `Confirmamos o processamento do seu saque realizado em ${dataBR(dados.data)}.`,
    "",
    "Atualização da sua posição:",
    "",
    `• Valor anterior: ${brl(dados.valorAnterior)}`,
    `• Valor do saque: ${brl(dados.valorSaque)}`,
    `• Valor Atual Investido: ${brl(dados.valorAtual)}`,
    "",
    "A partir de agora, os rendimentos passam a ser calculados sobre o novo valor investido. Permanecemos à disposição para esclarecer qualquer dúvida.",
    "",
    "Atenciosamente,",
    "Equipe InvestPortal",
  ].join("\n");
}

module.exports = { montarMensagemSaque };
