import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (senha: string, sal: Buffer, tam: number) => Promise<Buffer>;

/** scrypt$<sal hex>$<hash hex> */
export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const h = await scryptAsync(senha, sal, 64);
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`;
}

export async function confereSenha(senha: string, guardado: string | null | undefined): Promise<boolean> {
  if (!guardado) return false;
  const [alg, salHex, hHex] = guardado.split('$');
  if (alg !== 'scrypt' || !salHex || !hHex) return false;
  const esperado = Buffer.from(hHex, 'hex');
  const h = await scryptAsync(senha, Buffer.from(salHex, 'hex'), esperado.length);
  return timingSafeEqual(h, esperado);
}
