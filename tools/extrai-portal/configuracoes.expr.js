(function(){
  // Configurações no portal: usuários, personas, catálogos com uso, feriados nacionais, alertas, prestadores, mapa de telas.
  const dt = d => DS.fmt.data(d);
  const out = {};
  out.usuarios = AC.usuarios.map(u => ({ nome: u[0], email: u[1], perfil: u[2], resumo: u[3], status: u[4], mfa: u[5] }));
  out.personas = PERSONAS.map(p => ({ letra: p.letra, nome: p.nome, login: p.login, resumo: p.tipo === 'Aluno' ? 'Visualizador · área do aluno' : personaResumo(p) + ' · ' + acessoTelas({ nivel: p.nivel, areas: p.areas }) + ' telas' }));
  out.catalogos = {};
  Object.keys(CAT).forEach(k => { out.catalogos[k] = CAT[k].lista().map(x => [CAT[k].nome(x), catUso(k, CAT[k].nome(x))]) });
  out.departamentosPessoas = CAD.departments.map(d => [d.name, CAD.employees.filter(e => e.dept === d.name).length]);
  out.feriados = { 2026: ferNacionais(2026).map(([d, n]) => [dt(d), n]), 2027: ferNacionais(2027).map(([d, n]) => [dt(d), n]) };
  out.alertas = { ocioso: alertaConta('ocioso'), contrato: alertaConta('contrato', 30), saldo: alertaConta('saldo', 10), semProf: alertaConta('semProf', 7), inad: alertaConta('inad', 5) };
  const ofs = agOfertas();
  out.prestadores = CAD.teachers.map(t => [t.name, (t.cursos || []).join(', '), ofs.filter(o => o.prof === t.name).reduce((s, o) => s + o.dias.length, 0), t.teto || 24, !!t.active]);
  out.telas = docLinhas().map(l => ({ id: l.id, label: l.label, area: l.area, caminho: l.caminho, tipo: l.tipo, mostra: l.mostra, acoes: l.acoes.join(' · '), vai: l.vai.map(docTitulo).join(' · '), sub: l.sub.join(' · ') }));
  out.curriculos = CUR.map(c => [c.grupo, c.tipo, c.nome, c.conteudos.length, curSemMat(c)]);
  return out;
})()
