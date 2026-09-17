import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
