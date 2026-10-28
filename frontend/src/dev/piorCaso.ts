/**
 * SÓ DESENVOLVIMENTO (importado em main.tsx atrás de import.meta.env.DEV; não vai pro build).
 *
 * Dados de pior caso (skill break-ui): troca as respostas de GET /users e GET /users/me
 * — a mesma fronteira dos dados reais — por valores realistas que quebram layout.
 * Escolha pela barra no rodapé ou por ?dados=pior|vazio|um|mil (fica na URL).
 */
import type { User } from '../types';

type Modo = 'demo' | 'pior' | 'vazio' | 'um' | 'mil';
const MODOS: { id: Modo; rotulo: string }[] = [
  { id: 'demo', rotulo: 'Demo' },
  { id: 'pior', rotulo: 'Pior caso' },
  { id: 'vazio', rotulo: 'Vazio' },
  { id: 'um', rotulo: 'Um' },
  { id: 'mil', rotulo: '1.000' },
];

const base = (i: number, extra: Partial<User>): User => ({
  id: `pior-${i}`,
  user: `cliente.${i}`,
  token: 'user',
  name: 'Cliente',
  cpf: `000.000.000-${String(i).padStart(2, '0')}`,
  email: `cliente${i}@exemplo.com.br`,
  data_cadastro: '2026-03-14',
  data_modificacao: '2026-10-17T22:41:09.000Z',
  valor_aportado: 50000,
  percentual_contrato: 3,
  ...extra,
});

// cada linha quebra uma coisa diferente (como dado real faz), as primeiras são as que aparecem
const PIOR: User[] = [
  base(1, { name: 'Maria Aparecida dos Santos Albuquerque Cavalcanti de Oliveira Montenegro', valor_aportado: 12_345_678.9 }),
  base(2, { name: 'Bartholomew Fitzgerald', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com' }),
  base(3, { name: 'Jo', email: 'jo@x.co', valor_aportado: 0, percentual_contrato: 0 }),
  base(4, { name: '🌻 Flor de Lis Nguyễn', valor_aportado: 0.1 + 0.2, percentual_contrato: 2.75 }),
  base(5, { name: 'JOSÉ CARLOS DA SILVA FILHO', data_cadastro: null as unknown as string, data_modificacao: null as unknown as string }),
  base(6, { name: 'Ana', valor_aportado: 1_000_000_000, percentual_contrato: 12.5 }),
];

function lista(modo: Modo): User[] | null {
  if (modo === 'pior') return PIOR;
  if (modo === 'vazio') return [];
  if (modo === 'um') return [PIOR[0]];
  if (modo === 'mil')
    return Array.from({ length: 1000 }, (_, i) => base(i + 1, { name: `Cliente de teste ${i + 1}`, valor_aportado: 1000 * (i + 1) }));
  return null;
}

const modoAtual = (): Modo => {
  const m = new URLSearchParams(location.search).get('dados') as Modo | null;
  return MODOS.some((x) => x.id === m) ? (m as Modo) : 'demo';
};

export function instalarPiorCaso() {
  const modo = modoAtual();

  if (modo !== 'demo') {
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = async (entrada, init) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const metodo = (init?.method ?? 'GET').toUpperCase();
      const caminho = new URL(url, location.href).pathname;
      if (metodo === 'GET' && (caminho.endsWith('/users') || caminho.endsWith('/users/me'))) {
        const resp = await fetchOriginal(entrada, init);
        if (!resp.ok) return resp;
        const real = await resp.json();
        const dados = lista(modo)!;
        // /users/me: mantém id e login reais (o resto da tela depende deles), troca o que é exibido
        const corpo = caminho.endsWith('/users/me') ? { ...real, ...(dados[0] ?? {}), id: real.id, user: real.user } : dados;
        return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return fetchOriginal(entrada, init);
    };
  }

  // barra Demo / Pior caso / Vazio / Um / 1.000 — cromo neutro, fora do design testado
  const barra = document.createElement('div');
  barra.setAttribute('data-sem-pressao', '');
  barra.style.cssText =
    'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147483647;display:flex;gap:2px;padding:3px;border-radius:999px;background:#d4d4d8;font:500 12px/1 system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)';
  for (const { id, rotulo } of MODOS) {
    const b = document.createElement('button');
    b.textContent = rotulo;
    b.style.cssText = `border:0;border-radius:999px;padding:6px 10px;cursor:pointer;color:#18181b;background:${id === modo ? '#fff' : 'transparent'}`;
    b.onclick = () => {
      const u = new URL(location.href);
      if (id === 'demo') u.searchParams.delete('dados');
      else u.searchParams.set('dados', id);
      location.href = u.toString();
    };
    barra.appendChild(b);
  }
  document.body.appendChild(barra);
}
