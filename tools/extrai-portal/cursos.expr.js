(function(){
  // Cursos no portal: catálogo e, para cada curso, os números e as linhas das abas Visão geral, Regras, Currículo e Grade.
  const lim = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const stats = () => [...document.querySelectorAll('#view .stats .stat')].map(s => lim(s.querySelector('.val').textContent) + ' ' + lim(s.querySelector('.lbl').textContent));
  const linhas = () => [...document.querySelectorAll('#view tbody tr')].filter(r => r.style.display !== 'none').map(r => [...r.querySelectorAll('td')].map(td => lim(td.textContent)).filter(Boolean).join(' | '));
  const out = { catalogo: CAD.courses.map(c => [c.name, crsItens(c).length, crsProfs(c.name), crsAlunos(c.name)]), cursos: [] };
  CAD.courses.forEach((c, i) => {
    const r = { nome: c.name };
    go('curso:' + i + ':geral'); r.geral = { stats: stats(), linhas: linhas() };
    go('curso:' + i + ':curriculo'); r.curriculo = { stats: stats(), linhas: linhas() };
    go('curso:' + i + ':grade'); r.grade = { stats: stats(), linhas: linhas() };
    const rg = crsRegras(c); r.regras = [rg.vagas, rg.duracao, rg.modalidades.join('/'), rg.pacote, rg.cancelamento, !!c.autoAgenda, !!rg.exigeDisp, finValorAula(c)];
    out.cursos.push(r);
  });
  return out;
})()
