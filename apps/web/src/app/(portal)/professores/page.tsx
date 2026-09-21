import { redirect } from 'next/navigation';

/** a lista de professores virou a Equipe (professores e colaboradores juntos) */
export default function ProfessoresPage() {
  redirect('/equipe');
}
