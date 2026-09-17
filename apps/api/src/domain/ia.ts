/**
 * Engenharia › IA: os três provedores chamados por fetch — Anthropic, OpenAI e Google Gemini.
 * A chave mora só no .env da API e nunca vai para o navegador; a tela mostra apenas se está configurada.
 */
import { env } from '../env.ts';

export type ProvedorK = 'anthropic' | 'openai' | 'gemini';
export type Provedor = {
  k: ProvedorK;
  nome: string;
  modeloPadrao: string;
  docs: string;
  chaveEnv: string;
  modeloEnv: string;
};
export const PROVEDORES: Provedor[] = [
  {
    k: 'anthropic',
    nome: 'Anthropic',
    modeloPadrao: 'claude-sonnet-5',
    docs: 'https://docs.anthropic.com/en/api/messages',
    chaveEnv: 'ANTHROPIC_API_KEY',
    modeloEnv: 'ANTHROPIC_MODEL',
  },
  {
    k: 'openai',
    nome: 'OpenAI',
    modeloPadrao: 'gpt-4.1-mini',
    docs: 'https://platform.openai.com/docs/api-reference/chat',
    chaveEnv: 'OPENAI_API_KEY',
    modeloEnv: 'OPENAI_MODEL',
  },
  {
    k: 'gemini',
    nome: 'Google Gemini',
    modeloPadrao: 'gemini-2.0-flash',
    docs: 'https://ai.google.dev/api/generate-content',
    chaveEnv: 'GEMINI_API_KEY',
    modeloEnv: 'GEMINI_MODEL',
  },
];

const chave = (k: ProvedorK) =>
  k === 'anthropic' ? env.ANTHROPIC_API_KEY : k === 'openai' ? env.OPENAI_API_KEY : env.GEMINI_API_KEY;
export const modeloDe = (p: Provedor) => {
  const v = p.k === 'anthropic' ? env.ANTHROPIC_MODEL : p.k === 'openai' ? env.OPENAI_MODEL : env.GEMINI_MODEL;
  return v || p.modeloPadrao;
};
export const configurado = (k: ProvedorK) => !!chave(k);

export class ErroIA extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export type Resposta = { provedor: string; modelo: string; texto: string; ms: number; tokens: number | null };

const MAX = 1024;
const corpo = (p: Provedor, modelo: string, prompt: string, sistema: string): { url: string; init: RequestInit } => {
  if (p.k === 'anthropic')
    return {
      url: 'https://api.anthropic.com/v1/messages',
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': chave(p.k),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: MAX,
          system: sistema || undefined,
          messages: [{ role: 'user', content: prompt }],
        }),
      },
    };
  if (p.k === 'openai')
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${chave(p.k)}` },
        body: JSON.stringify({
          model: modelo,
          max_completion_tokens: MAX,
          messages: [...(sistema ? [{ role: 'system', content: sistema }] : []), { role: 'user', content: prompt }],
        }),
      },
    };
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': chave(p.k) },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
        generationConfig: { maxOutputTokens: MAX },
      }),
    },
  };
};

type RespAnthropic = { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
type RespOpenAI = { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
type RespGemini = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { totalTokenCount?: number };
};

const leTexto = (p: Provedor, j: unknown): { texto: string; tokens: number | null } => {
  if (p.k === 'anthropic') {
    const r = j as RespAnthropic;
    const u = r.usage;
    return {
      texto: (r.content ?? [])
        .map((c) => c.text ?? '')
        .join('')
        .trim(),
      tokens: u ? (u.input_tokens ?? 0) + (u.output_tokens ?? 0) : null,
    };
  }
  if (p.k === 'openai') {
    const r = j as RespOpenAI;
    return { texto: (r.choices?.[0]?.message?.content ?? '').trim(), tokens: r.usage?.total_tokens ?? null };
  }
  const r = j as RespGemini;
  return {
    texto: (r.candidates?.[0]?.content?.parts ?? [])
      .map((x) => x.text ?? '')
      .join('')
      .trim(),
    tokens: r.usageMetadata?.totalTokenCount ?? null,
  };
};

/** manda o prompt para o provedor e devolve a resposta em texto */
export async function pergunta(p: Provedor, prompt: string, sistema = ''): Promise<Resposta> {
  if (!configurado(p.k))
    throw new ErroIA(`${p.nome} sem chave: preencha ${p.chaveEnv} no .env da API e reinicie.`, 400);
  const modelo = modeloDe(p);
  const { url, init } = corpo(p, modelo, prompt, sistema);
  const t = Date.now();
  let r: Response;
  try {
    r = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    throw new ErroIA(`Não deu para falar com a ${p.nome}: ${(e as Error).message}`);
  }
  const bruto = await r.text();
  let j: unknown;
  try {
    j = JSON.parse(bruto);
  } catch {
    j = null;
  }
  if (!r.ok) {
    const msg =
      (j as { error?: { message?: string } } | null)?.error?.message ??
      (j as { message?: string } | null)?.message ??
      bruto.slice(0, 200);
    throw new ErroIA(`${p.nome} respondeu ${r.status}: ${msg}`, r.status === 401 || r.status === 403 ? 400 : 502);
  }
  const { texto, tokens } = leTexto(p, j);
  return { provedor: p.nome, modelo, texto: texto || '(resposta vazia)', ms: Date.now() - t, tokens };
}
