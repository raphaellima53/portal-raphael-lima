(() => {
  // Texto de cada bloco do Dashboard do portal, para comparar com a API (scripts/compara-portal.ts).
  const c = dashCtx();
  const limpa = (h) => {
    const d = document.createElement('div');
    d.innerHTML = h;
    d.querySelectorAll('span,b,i,div,small').forEach((x) => x.insertAdjacentText('afterend', ' '));
    return d.textContent.replace(/\s+/g, ' ').trim();
  };
  return {
    agora: new Date().toISOString(),
    blocos: DASH_BLOCOS.map((b) => {
      let t;
      try {
        t = limpa(b.html(c));
      } catch (e) {
        t = 'ERRO ' + e.message;
      }
      return { k: b.k, t };
    }),
  };
})();
