(function(){
  // Auditoria no portal (sessão recém-aberta: só o histórico da base)
  return audLinhas().map(x => [x.quando ? fxDataHora(x.quando) : '—', x.quem, x.ent, x.acao, x.reg, x.det, x.vivo]);
})()
