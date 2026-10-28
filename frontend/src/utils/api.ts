import type { LoggedUser } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

const TOKEN_KEY = 'accessToken';
const USER_KEY = 'loggedUser';

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSession(accessToken: string, user?: LoggedUser) {
  try {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

/** Lê o payload de um JWT sem validar assinatura (só p/ checar expiração). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    let base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Token existe e (se tiver `exp`) ainda não expirou. */
export function isTokenValid(token: string | null): token is string {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  const exp = payload.exp;
  if (typeof exp !== 'number') return true; // sem exp declarado: não afirmamos que expirou
  return exp * 1000 > Date.now();
}

function readStoredUser(): LoggedUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (
      u &&
      typeof u.id === 'string' &&
      (u.role === 'admin' || u.role === 'user')
    ) {
      return u as LoggedUser;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fonte ÚNICA de verdade da sessão.
 *
 * Só devolve o usuário quando `loggedUser` é válido E existe um token E o
 * token não expirou. Qualquer estado parcial ou antigo (ex.: build anterior
 * que gravava `loggedUser` sem token) é apagado aqui mesmo — o app se
 * recupera sozinho no primeiro carregamento, sem o usuário precisar limpar
 * o cache do navegador.
 */
export function getSession(): LoggedUser | null {
  const user = readStoredUser();
  const token = getAccessToken();

  if (user && isTokenValid(token)) return user;

  // estado inconsistente / expirado → limpa para não entrar em loop
  if (user || token) clearSession();
  return null;
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

let redirecting = false;

/** Vai para /login uma única vez, mesmo que várias requisições deem 401 juntas. */
export function redirectToLogin() {
  if (redirecting) return;
  redirecting = true;
  clearSession();
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  } else {
    redirecting = false;
  }
}

/**
 * Wrapper de fetch que injeta o JWT e trata expiração de sessão.
 * Aceita caminho relativo ("/users"), já com a base da API ("/api/users") ou URL absoluta.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const jaTemBase = /^https?:\/\//i.test(input) || (Boolean(API_URL) && input.startsWith(`${API_URL}/`));
  const url = jaTemBase ? input : `${API_URL}${input}`;

  const headers = new Headers(init.headers || {});
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // erro de rede propaga normalmente (sem derrubar a sessão)
  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    redirectToLogin();
  }

  return res;
}
