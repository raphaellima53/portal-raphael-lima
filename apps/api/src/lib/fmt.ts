/** Formatos pt-BR do design system do portal (DS.fmt). Hora local do servidor (TZ da escola). */
const p2 = (n: number) => String(n).padStart(2, '0');
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export const fmt = {
  data: (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`,
  iso: (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
  hora: (d: Date, seg = false) => `${p2(d.getHours())}:${p2(d.getMinutes())}${seg ? `:${p2(d.getSeconds())}` : ''}`,
  dataHora: (d: Date, seg = false) => `${fmt.data(d)} ${fmt.hora(d, seg)}`,
  semana: (d: Date) => `${SEMANA[d.getDay()]}, ${fmt.data(d)}`,
  mes: (d: Date) => `${MESES[d.getMonth()]} de ${d.getFullYear()}`,
  numero: (n: number, casas = 0) =>
    Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }),
};

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
