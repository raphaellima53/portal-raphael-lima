(function(){
  // Alunos no portal: a linha da lista e, para cada aluno, o que a ficha lê — resumo, perfil, matrículas, alocação,
  // disponibilidade, agenda, histórico, pontos de qualidade, feedbacks gerados e o log da base.
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diasAtras = d => Math.round((hoje - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  const ofs = agOfertas();
  const out = { ordem: DB.alunos.map(a => a.id), alunos: [] };
  DB.alunos.forEach(a => {
    const ms = alMat(a), s = alSit(a), meus = ofs.filter(o => o.alunos.includes(a.name));
    const pres = fxPassadas(x => x.alunos.includes(a.name)).map(x => fxPresenca(a.name, x)).filter(p => p === 'presente' || p === 'falta');
    const r = { id: a.id, nome: a.name };
    r.linha = [a.name, ms.map(alCurso), ms.map(e => alTemMod(e) ? e.currentModule.name : '—'), ms.map(e => e.modalidade || 'Online'),
      ms.map(e => (+e.usedLessons || 0) + '/' + (+e.totalLessons || 0)), ms.length ? alSaldo(a) : '—', s];
    r.sub = [a.email, alEmpresa(a) ? 'B2B · ' + alEmpresa(a) : 'B2C', alContrato(a) ? 'contrato até ' + alData(alContrato(a)) : null].filter(Boolean).join(' · ');
    r.resumo = [ms.length, alSaldo(a), meus.reduce((q, o) => q + o.dias.length, 0), pres.length ? Math.round(pres.filter(p => p === 'presente').length / pres.length * 100) : null];
    r.matriculas = ms.map(e => {
      const m = e.currentModule ? e.currentModule.name : null, os = meus.filter(x => x.prod === alCurso(e) && x.mod === m);
      return [alCurso(e), m, os.map(x => agDiasTxt(x) + ' · ' + agFaixa(x) + ' · ' + (x.prof === '—' ? 'sem professor' : x.prof))];
    });
    r.encerradas = (a.enrollments || []).filter(e => e.deactivatedAt).map(e => [alCurso(e), e.currentModule ? e.currentModule.name : null]);
    r.alocacoes = ms.map(e => {
      const c = CAD.courses.find(x => x.name === alCurso(e)); if (!c) return null;
      const mod = e.currentModule ? e.currentModule.name : null, o = ofs.find(x => x.prod === c.name && x.mod === mod && x.alunos.includes(a.name));
      if (agIndividual(c, mod)) {
        const x = o || { prof: '—', dias: [], hora: 18 }, av = alocAvalia(a, c.name, mod, x.prof, x.dias, x.hora);
        return { ind: 1, profs: CAD.teachers.filter(t => agHabilitado(t, c.name, mod)).map(t => t.name), prof: x.prof, dias: x.dias, hora: x.hora, av };
      }
      const eTurma = c.estrutura === 'turmas';
      const opc = crsItens(c).filter(x => x !== 'Private FLOW').map(it => {
        const y = ofs.find(z => z.prod === c.name && z.mod === it && z.vagas !== 1), t = eTurma ? (c.turmas || []).find(z => z.name === it) : null;
        return [it, y ? agDiasTxt(y) + ' ' + agHH(y.hora) : null, t ? t.ocupadas + '/' + t.vagas : null, !!(t && t.ocupadas >= t.vagas && it !== mod)];
      });
      return { ind: 0, horario: o ? agDiasTxt(o) + ' · ' + agFaixa(o) : null, prof: o ? o.prof : null, sala: o ? o.sala : null,
        ocupacao: o ? (o.ocupadas != null ? o.ocupadas : o.alunos.length) + ' de ' + o.vagas : null, av: o ? alocAvalia(a, c.name, mod, o.prof, o.dias, o.hora) : null, opc };
    });
    const disp = alDisp(a).slice().sort();
    r.disp = { horas: disp, conflitos: dispConflitos(disp, meus).map(({ o, d }) => DN[d] + ' ' + agHH(o.hora) + ' · ' + o.prod + (o.mod ? ' · ' + o.mod : '')) };
    r.proximas = fxProximas(x => x.alunos.includes(a.name)).map(x => x.k + ' ' + x.estado);
    r.passadas = fxPassadas(x => x.alunos.includes(a.name)).map(x => x.k + ' ' + x.estado + ' ' + fxPresenca(a.name, x));
    r.qualidade = alQualidade(a).map(p => [p.k, p.n, p.nivel, p.d]);
    r.feedbacks = fbAluno(a).map(f => [diasAtras(f.quando), f.quando.getHours(), f.quando.getMinutes(), f.tipo, f.area, f.curso, f.canal, f.texto, f.status]);
    r.logBase = fxLogDe('aluno', a).map(x => [x.acao, x.detalhe, x.quem]);
    r.persona = alDePersona(a);
    out.alunos.push(r);
  });
  return out;
})()
