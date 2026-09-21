import {
  BookOpenIcon,
  Building2Icon,
  CalendarIcon,
  CircleHelpIcon,
  Code2Icon,
  FileTextIcon,
  GraduationCapIcon,
  HomeIcon,
  LayoutGridIcon,
  type LucideIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UserIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react';

/** Os ícones do menu do portal (I.home, I.cal…) em lucide-react. */
export const ICONES: Record<string, LucideIcon> = {
  home: HomeIcon,
  cal: CalendarIcon,
  bookOpen: BookOpenIcon,
  user: UserIcon,
  building: Building2Icon,
  cap: GraduationCapIcon,
  zap: ZapIcon,
  shield: ShieldCheckIcon,
  report: FileTextIcon,
  sliders: SlidersHorizontalIcon,
  code: Code2Icon,
  users: UsersIcon,
  help: CircleHelpIcon,
};

export const iconeDe = (nome: string): LucideIcon => ICONES[nome] ?? LayoutGridIcon;
