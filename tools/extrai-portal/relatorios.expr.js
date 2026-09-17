(function(){
  // Relatórios no portal: os 6 relatórios (sem filtro, com cada filtro de qualidade e por curso), seletores e o financeiro.
  const out = { rp: {}, seletores: {}, financeiro: {} };
  const tira = ls => ls.map(l => { const o = {}; Object.keys(l).forEach(k => { if (k[0] !== '_') o[k] = l[k] }); return o });
  const le = k => {
    const r = RP[k], ls = rpLinhas(k);
    return { cols: r.cols().map(c => c[1]), linhas: tira(ls), resumo: r.resumo ? r.resumo(ls).map(x => [String(x[0]), x[1]]) : [] };
  };
  Object.keys(RP).forEach(k => {
    UI.qr = { dias: 30, curso: '', grupo: 'curso', qual: {} };
    const base = le(k);
    const quals = {};
    QR_QUAL[RP[k].pers].forEach(([q]) => { UI.qr.qual = { [k]: q }; quals[q] = rpLinhas(k).length });
    UI.qr = { dias: 60, curso: 'Community live classes', grupo: 'item', qual: {} };
    out.rp[k] = { base, quals, cursoItem60: le(k) };
  });
  UI.qr = { dias: 30, curso: '', grupo: 'curso', qual: {} };
  ['aluno', 'professor', 'curso'].forEach(p => {
    const quals = {};
    const m = p === 'aluno' ? qrQualAlunos(true) : p === 'professor' ? qrQualProfs(true) : qrQualCursos();
    QR_QUAL[p].forEach(([q]) => { quals[q] = relLinhas(p).filter(l => (m[l.nome] || {})[q]).length });
    out.seletores[p] = { linhas: relLinhas(p), quals };
  });
  const meses = fecMeses();
  out.financeiro.serie = meses.slice().reverse().map(m => { const d = finCompetencia(m); return [m, Math.round(d.receita * 100) / 100, Math.round(d.custo * 100) / 100, d.dadas, d.min, Math.round(d.perdida * 100) / 100, d.parcial]; });
  const d = finCompetencia(meses[0]);
  out.financeiro.cursos = d.cursos.map(c => [c.curso, c.valor, c.dadas, c.alunosAula, Math.round(c.receita * 100) / 100, Math.round(c.custo * 100) / 100, c.canc]);
  out.financeiro.profs = d.profs.map(p => [p.prof, p.dadas, Math.round(p.horas * 100) / 100, p.valorHora, Math.round(p.custo * 100) / 100]);
  const da = finCompetencia(meses[1], new Date().getDate());
  out.financeiro.anteriorParcial = [Math.round(da.receita * 100) / 100, Math.round(da.custo * 100) / 100];
  const cobs = finCobrancas(), ym = meses[0], noMes = x => finMesDe(x) === ym;
  const carteira = DB.alunos.reduce((s, a) => s + alMat(a).filter(e => !finPorTurma(alCurso(e))).reduce((t, e) => t + Math.max(0, (+e.totalLessons || 0) - (+e.usedLessons || 0)) * finValorCurso(alCurso(e)), 0), 0)
    + cobs.filter(c => c.tipo === 'turma' && !c.pago).reduce((s, c) => s + c.valor, 0);
  out.financeiro.cob = {
    vencidas: cobs.filter(c => c.sit === 'vencida').length,
    aVencer: cobs.filter(c => !c.pago && noMes(c.venc) && c.sit === 'aVencer').length,
    pagas: cobs.filter(c => c.pago && noMes(c.pago)).length,
    carteira: Math.round(carteira * 100) / 100
  };
  return out;
})()
