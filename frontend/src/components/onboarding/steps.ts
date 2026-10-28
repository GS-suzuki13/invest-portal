// Versão do tutorial. Ao lançar uma "grande atualização" no futuro, troque este
// valor para reexibir o onboarding a todos os clientes uma vez.
export const ONBOARDING_VERSION = '1';

export interface TourStep {
  /** seletor do elemento REAL a destacar (data-tour) */
  target: string;
  title: string;
  body: string;
  /** onde encostar o balão; 'auto' escolhe o melhor lado */
  placement?: 'top' | 'bottom' | 'auto';
  /** marca novidades desta versão */
  novo?: boolean;
}

// Conteúdo: O que é → Para que serve → Como usar. Curto e sem termos técnicos.
export const CLIENT_DASHBOARD_STEPS: TourStep[] = [
  {
    target: '[data-tour="patrimonio"]',
    title: 'Patrimônio estimado',
    body: 'É quanto seu dinheiro vale hoje: o valor que você aportou mais o rendimento líquido acumulado. Use como uma visão rápida da sua evolução.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="rendimentos"]',
    title: 'Rendimento bruto e líquido',
    body: 'O bruto é o total que sua carteira rendeu no período. O líquido é o que fica com você, já descontada a taxa de gestão. Acompanhe aqui o resultado dos seus investimentos.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="proximo-repasse"]',
    title: 'Próximo repasse',
    body: 'A data prevista do próximo pagamento dos seus rendimentos. Fique de olho para saber quando o valor entra na sua conta.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="menu"]',
    title: 'Menu: extrato',
    body: 'Toque no ☰ para abrir o menu. Lá fica o extrato de aportes, saques e rendimentos.',
    placement: 'bottom',
    novo: true,
  },
  {
    target: '[data-tour="periodo"]',
    title: 'Filtrar por período',
    body: 'Escolha ver os rendimentos de um repasse específico ou de todo o período. Os cards e os gráficos se ajustam à sua escolha.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="grafico"]',
    title: 'Evolução dos rendimentos',
    body: 'O gráfico mostra como seus rendimentos evoluíram ao longo do tempo, e ao lado fica o histórico dia a dia. Passe o mouse ou o dedo sobre a linha para ver o valor de cada data.',
    placement: 'top',
  },
  {
    target: '[data-tour="comparativo"]',
    title: 'Comparação com CDI e Poupança',
    body: 'Veja quanto seu dinheiro teria rendido no CDI ou na Poupança no mesmo período — e compare com o resultado da carteira. Os índices vêm do Banco Central.',
    placement: 'top',
    novo: true,
  },
  {
    target: '[data-tour="mensagens"]',
    title: 'Fale com a gestora',
    body: 'Precisa de ajuda ou quer tirar uma dúvida? Toque no sino para conversar direto com o nosso time. Você também é avisado por aqui quando houver novidade.',
    placement: 'bottom',
    novo: true,
  },
];
