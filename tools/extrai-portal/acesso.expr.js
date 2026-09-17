(() => {
  // Menu e chaves liberadas de cada persona no portal, para comparar com a API.
  const chaves = [...new Set(['inicio', 'aluno.alocacao'].concat(TELAS_MAPA.map((n) => n.chave)))];
  const out = PERSONAS.map((p) => {
    personaAplica(p);
    const menu = [...document.querySelectorAll('#nav .nav-item')].map((x) => x.textContent.replace(/\s+/g, ' ').trim());
    const secoes = {};
    ['acoes', 'relatorios', 'config'].forEach((m) => {
      secoes[m] = secFolhas(m).map((n) => n.tela);
    });
    const libera = p.tipo === 'Aluno' ? [] : chaves.filter((c) => ACESSO.pode(c));
    return { login: p.login, menu, secoes, chaves: libera };
  });
  loginSair();
  return out;
})();
