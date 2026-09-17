(function(){
  // Professores no portal: a linha da lista e, para cada professor, resumo, escala, habilitação, disponibilidade,
  // agenda, histórico, avaliações geradas e o log da base.
  const ofsTodas = agOfertas();
  const out = { professores: [] };
  CAD.teachers.forEach(t => {
    const ofs = prOfertas(t), aulas = ofs.reduce((s, o) => s + o.dias.length, 0);
    const r = { id: t.id, nome: t.name };
    r.linha = [t.name, t.email, (t.cursos || []).slice(), aulas, t.teto, !!t.active];
    const disp = prDisp(t).slice().sort();
    r.resumo = [ofs.length, aulas, new Set([].concat(...ofs.map(o => o.alunos))).size, dispConflitos(prDisp(t), ofs).length];
    r.habilitacao = CAD.courses.map(c => {
      const on = (t.cursos || []).includes(c.name), itens = crsItens(c), eTurma = c.estrutura === 'turmas';
      const perm = on ? (t.habil && t.habil[c.name] ? t.habil[c.name] : itens) : [];
      const titular = eTurma ? (c.turmas || []).filter(x => x.professor === t.name).map(x => x.name) : [];
      return [c.name, on, perm, titular, ofsTodas.filter(o => o.prod === c.name && o.prof === t.name).length];
    });
    r.disp = { horas: disp, conflitos: dispConflitos(disp, ofs).map(({ o, d }) => DN[d] + ' ' + agHH(o.hora) + ' · ' + o.prod + (o.mod ? ' · ' + o.mod : '')) };
    r.proximas = fxProximas(x => x.prof === t.name).map(x => x.k + ' ' + x.estado + ' ' + x.n + '/' + x.vagas);
    const todas = fxPassadas(x => x.prof === t.name || x.sub === t.name);
    r.passadas = todas.map(x => x.k + ' ' + x.estado + ' ' + (x.sub === t.name ? 'substituído por ' + x.prof : x.sub ? 'deu no lugar de ' + x.sub : ''));
    r.histStats = [todas.filter(x => x.prof === t.name && ['executada', 'substituida'].includes(x.estado)).length, todas.filter(x => x.sub === t.name).length,
      todas.filter(x => x.prof === t.name && x.sub).length, todas.filter(x => x.estado === 'naoFinalizada').length, todas.filter(x => x.estado === 'cancelada').length];
    r.dadas = fxDadas(t.name).length;
    r.avaliacoes = fbProf(t).map(x => [x.quando.toISOString(), x.aluno, x.curso, x.aula, x.nota, x.texto]);
    r.logBase = fxLogDe('prof', t).map(x => [x.acao, x.detalhe, x.quem]);
    out.professores.push(r);
  });
  return out;
})()
