(function(){
  // Empresas no portal: gerentes, ordem da lista, e para cada conta os números, alertas, cobrança, alunos (ou turmas) e o registro da base.
  const hoje = new Date(), ini30 = empDia(-30), ps = agAulasEntre(ini30, hoje).filter(a => a.quando <= hoje);
  const presDe = n => { let p = 0, f = 0; ps.forEach(a => { if (!a.alunos.includes(n)) return; const r = fxPresenca(n, a); if (r === 'presente') p++; else if (r === 'falta') f++ }); return p + f ? Math.round(p / (p + f) * 100) + '%' : '—' };
  const out = {
    gerentes: EMP_GERENTES(),
    ordem: EMP.slice().sort((a, b) => empDias(a) - empDias(b)).map(e => e.nome),
    semEmpresa: DB.alunos.filter(a => !alEmpresa(a) && alSit(a) !== 'Inativo').sort((a, b) => a.name.localeCompare(b.name)).map(a => a.name),
    empresas: []
  };
  EMP.forEach(e => {
    const d = empDados(e);
    const paga = e.modelo === 'B2B' ? 'Empresa' : e.subsidio ? `Empresa ${e.subsidio}% · aluno ${100 - e.subsidio}%` : 'Aluno';
    out.empresas.push({
      id: e.id, nome: e.nome, sit: empSit(e)[0], dias: empDias(e), cobranca: empCobranca(e),
      dados: [d.turma, d.ativos, d.licUsadas, d.licContr, d.consumo, d.contratadas, d.presenca, d.receitaEmpresa, d.receitaAluno, d.inad],
      alertas: empAlertas(e, d).map(x => x.join('|')),
      alunos: d.turma ? [] : d.alunos.map(a => { const ms = alMat(a); return [a.name, ms.map(m => alCurso(m)).join(', ') || '—', ms.reduce((s, m) => s + (+m.usedLessons || 0), 0) + '/' + ms.reduce((s, m) => s + (+m.totalLessons || 0), 0), presDe(a.name), paga, alSit(a)] }),
      turmas: d.turma ? d.ts.map(t => [t.name, t.grupo || '—', t.professor || '—', t.grade || '—', t.modalidade || '—', (t.ocupadas || 0) + '/' + (t.vagas || 0)]) : []
    });
  });
  return out;
})()
