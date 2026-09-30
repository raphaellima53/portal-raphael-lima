/**
 * Cifra simétrica (30/09/2026) para segredos guardados no banco, como a senha das contas do Zoom.
 * AES-256-GCM; a chave vem de CIFRA_CHAVE (ou, sem ela, do COOKIE_SECRET), derivada por SHA-256.
 * Formato guardado: v1:<iv base64>:<tag base64>:<cifrado base64>.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../env.ts';

const chave = () =>
  createHash('sha256')
    .update(env.CIFRA_CHAVE || env.COOKIE_SECRET)
    .digest();

export function cifra(texto: string) {
  if (!texto) return '';
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), dados.toString('base64')].join(':');
}

export function decifra(guardado: string) {
  if (!guardado) return '';
  const [v, iv, tag, dados] = guardado.split(':');
  if (v !== 'v1' || !iv || !tag || !dados) throw new Error('Segredo em formato desconhecido.');
  const d = createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dados, 'base64')), d.final()]).toString('utf8');
}
