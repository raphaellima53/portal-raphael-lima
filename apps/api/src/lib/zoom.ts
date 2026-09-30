/**
 * Zoom (24/09/2026): transcrição automática da aula gravada na nuvem do Zoom.
 * Usa um app Server-to-Server OAuth (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET no .env); sem essas
 * variáveis o portal responde "Zoom não conectado". A transcrição vem do arquivo TRANSCRIPT (.vtt) da gravação.
 */
import { createHmac } from 'node:crypto';
import { env } from '../env.ts';

export const zoomConectado = () => !!(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET);

let token: { valor: string; ate: number } | null = null;
async function acesso() {
  if (token && token.ate > Date.now() + 60_000) return token.valor;
  const basic = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(env.ZOOM_ACCOUNT_ID)}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
  );
  if (!r.ok) throw new Error(`O Zoom recusou as credenciais (${r.status}). Confira o app Server-to-Server.`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { valor: j.access_token, ate: Date.now() + j.expires_in * 1000 };
  return token.valor;
}

/** "https://zoom.us/j/912345678" → "912345678" */
export const reuniaoDoLink = (url: string) => /\/j\/(\d{9,12})/.exec(url)?.[1] ?? null;

/** WEBVTT → linhas "00:01:02 Fulano: texto" */
const deVtt = (vtt: string) =>
  vtt
    .replace(/\r/g, '')
    .split('\n\n')
    .map((bloco) => {
      const ls = bloco.split('\n').filter(Boolean);
      const tempo = ls.find((l) => l.includes('-->'));
      if (!tempo) return null;
      const texto = ls.slice(ls.indexOf(tempo) + 1).join(' ');
      return { tempo: tempo.split(' --> ')[0].slice(0, 8), texto };
    })
    .filter((x): x is { tempo: string; texto: string } => !!x?.texto);

export type Transcricao = { ok: true; linhas: { tempo: string; texto: string }[] } | { ok: false; motivo: string };

/** transcrição da reunião do dia (a gravação na nuvem precisa ter "Audio transcript" ligado no Zoom) */
export async function transcricao(reuniao: string): Promise<Transcricao> {
  if (!zoomConectado())
    return {
      ok: false,
      motivo:
        'O Zoom ainda não está conectado ao portal. Um Admin precisa cadastrar o app Server-to-Server do Zoom (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID e ZOOM_CLIENT_SECRET).',
    };
  const t = await acesso();
  const r = await fetch(`https://api.zoom.us/v2/meetings/${reuniao}/recordings`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (r.status === 404) return { ok: false, motivo: 'O Zoom não tem gravação na nuvem desta reunião.' };
  if (!r.ok) return { ok: false, motivo: `O Zoom respondeu ${r.status} ao buscar a gravação.` };
  const j = (await r.json()) as { recording_files?: { file_type: string; download_url: string; status: string }[] };
  const arq = j.recording_files?.find((f) => f.file_type === 'TRANSCRIPT');
  if (!arq)
    return {
      ok: false,
      motivo: 'A gravação existe, mas ainda sem transcrição (o Zoom leva alguns minutos depois do fim da aula).',
    };
  const v = await fetch(arq.download_url, { headers: { Authorization: `Bearer ${t}` } });
  if (!v.ok) return { ok: false, motivo: `O Zoom respondeu ${v.status} ao baixar a transcrição.` };
  return { ok: true, linhas: deVtt(await v.text()) };
}

/* ---------------- 30/09/2026: aula dentro do portal (Meeting SDK) ---------------- */

/** o Meeting SDK precisa do app do SDK (assinatura) e do Server-to-Server (criar a reunião e o token de anfitrião) */
export const sdkConectado = () => zoomConectado() && !!(env.ZOOM_SDK_KEY && env.ZOOM_SDK_SECRET);

const b64url = (x: string | Buffer) => Buffer.from(x).toString('base64url');
/** assinatura do Meeting SDK (JWT HS256): role 1 = anfitrião, 0 = participante; vale 2 horas */
export function assinatura(reuniao: string, role: 0 | 1) {
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 2 * 3600;
  const cab = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corpo = b64url(
    JSON.stringify({ appKey: env.ZOOM_SDK_KEY, sdkKey: env.ZOOM_SDK_KEY, mn: reuniao, role, iat, exp, tokenExp: exp }),
  );
  const sig = createHmac('sha256', env.ZOOM_SDK_SECRET).update(`${cab}.${corpo}`).digest('base64url');
  return `${cab}.${corpo}.${sig}`;
}

/** cria a reunião da aula na conta (usuário do Zoom) da sala */
export async function criaReuniao(conta: string, topico: string, inicio: Date, minutos: number) {
  const t = await acesso();
  const r = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(conta)}/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      topic: topico.slice(0, 200),
      type: 2,
      start_time: inicio.toISOString(),
      duration: minutos,
      timezone: 'America/Sao_Paulo',
      settings: { join_before_host: false, waiting_room: false, auto_recording: 'cloud', mute_upon_entry: true },
    }),
  });
  if (!r.ok) throw new Error(`O Zoom recusou criar a reunião na conta ${conta} (${r.status}).`);
  const j = (await r.json()) as { id: number; password?: string };
  return { id: String(j.id), senha: j.password ?? '' };
}

/** token de anfitrião (ZAK) da conta: o professor abre a aula como anfitrião sem fazer login no Zoom */
export async function tokenAnfitriao(conta: string) {
  const t = await acesso();
  const r = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(conta)}/token?type=zak`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!r.ok) throw new Error(`O Zoom não deu o token de anfitrião da conta ${conta} (${r.status}).`);
  return ((await r.json()) as { token: string }).token;
}
