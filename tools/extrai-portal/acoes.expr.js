(function(){
  // Ações no portal: pendências de alocação, folha da competência anterior, cobranças, fluxos semeados e alertas.
  const meses = fecMeses(), ym = meses[1], d = folhaDados(ym);
  const out = {
    meses,
    alocacao: acAlocItens().map(x => [x.tipo, x.curso, x.quem, x.oque, x.quando, x.det]),
    fechamento: {
      ym, parcial: d.parcial, naoFin: d.naoFin,
      folha: d.folha.map(p => [p.nome, p.pagas, p.presenca, p.falta, p.descontadas, p.pendentes, p.min, Math.round(p.bruto * 100) / 100, Math.round(p.desconto * 100) / 100, Math.round(p.liquido * 100) / 100]),
      tot: d.tot
    },
    cobrancas: finCobrancas().map(c => [c.key, c.parcela, c.sit, c.atraso, Math.round(c.valor * 100) / 100, c.pagador, c.curso, c.item]),
    fluxos: {},
    alertas: alertasLista().map(a => [a.k, a.n, a.t, a.d]),
    leads: funilLeads().map(l => [l.id, l.nome, l.etapa, l.curso, l.origem, l.consultor, l.motivo, Math.round((new Date() - l.mudou) / 6e4)]),
    atendimentosAbertos: [].concat(...DB.alunos.map(a => fbAluno(a))).filter(f => f.status === 'Aberto').length
  };
  Object.keys(FLUXO).forEach(k => {
    const F = FLUXO[k];
    out.fluxos[k] = flCards(k).map(c => [c.etapa, F.titulo(c.v), F.sub(c.v)]);
  });
  return out;
})()
