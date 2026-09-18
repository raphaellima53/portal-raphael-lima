/** Fetch na API (apps/api) pelo rewrite /api do Next, com o cookie de sessão. Sem Route Handlers no Next.
 *  NEXT_PUBLIC_API_URL só é preciso para falar com a API direto, sem o rewrite. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export async function api<T>(caminho: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...resto } = init;
  const r = await fetch(`${API_URL}${caminho}`, {
    credentials: 'include',
    ...resto,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : resto.body,
  });
  if (!r.ok) {
    let msg = 'Não foi possível falar com o servidor.';
    try {
      msg = ((await r.json()) as { erro?: string }).erro ?? msg;
    } catch {}
    throw new ErroApi(r.status, msg);
  }
  return (await r.json()) as T;
}
