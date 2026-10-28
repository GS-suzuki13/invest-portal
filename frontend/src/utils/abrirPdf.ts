/**
 * Abre um PDF (blob vindo da API) numa nova aba.
 *
 * A aba é aberta já no clique: se esperar o download, o navegador não
 * considera mais um clique do usuário e o bloqueador de pop-up barra. E sem
 * `noopener` na abertura: o Chrome isola blobs por aba, e uma aba "noopener"
 * não consegue ler o blob criado aqui (abria em branco). Se a aba não abrir
 * (bloqueada), baixa o arquivo.
 */
export async function abrirPdfEmNovaAba(
  carregar: () => Promise<string>,
  nomeArquivo: string
): Promise<void> {
  const aba = window.open('', '_blank');
  if (aba) {
    aba.document.title = 'Carregando PDF…';
    aba.document.body.style.cssText = 'font-family: system-ui, sans-serif; color: #555; padding: 24px;';
    aba.document.body.textContent = 'Carregando PDF…';
  }

  let url: string;
  try {
    url = await carregar();
  } catch (err) {
    aba?.close();
    throw err;
  }

  if (aba && !aba.closed) {
    aba.opener = null; // o PDF aberto não tem acesso a esta página
    aba.location.href = url;
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  // tempo de sobra para a aba carregar o arquivo antes de liberar a memória
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
