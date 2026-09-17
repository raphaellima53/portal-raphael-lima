(function(){
  // Aulas do mês e da semana no portal (chave, estado, professor, substituto, alunos) e o Kanban da semana, para comparar com a API.
  const agora = new Date(), r = new Date(agora); r.setHours(0,0,0,0);
  const ini = new Date(r.getFullYear(), r.getMonth(), 1), fim = new Date(r.getFullYear(), r.getMonth()+1, 0);
  const lin = a => [a.k, a.estado, a.prof, a.sub||'', a.n, a.vagas, a.sala].join('~');
  const s0 = agInicioSemana(r), s6 = new Date(s0); s6.setDate(s0.getDate()+6);
  const evs = agEvEntre(s0, s6).map(e => [e.id, e.titulo, e.ini.getDay(), evHora(e.ini), evHora(e.fim)].join('~'));
  return { agora: agora.toISOString(), mes: agAulasEntre(ini, fim).map(lin), semanaEventos: evs, regua: agRegua(),
    qual: AG_QUAL.map(q => [q[0], agAulasEntre(s0, s6).filter(q[2]).length]) };
})()
