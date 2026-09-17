(() => {
  // Tudo o que o portal tem de cadastro, no estado inicial (sem login, sem mexer em nada).
  const alunos = DB.alunos.map((a) =>
    Object.assign({}, a, {
      company: a.company ? a.company.name : null,
      enrollments: (a.enrollments || []).map((e) =>
        Object.assign({}, e, {
          course: e.course ? e.course.name : null,
          currentModule: e.currentModule ? e.currentModule.name : null,
        }),
      ),
    }),
  );
  const pega = (n) => {
    try {
      return eval(n);
    } catch (e) {
      return undefined;
    }
  };
  const extras = {};
  [
    'FB_ALUNO',
    'FB_PROF',
    'AG_EVENTOS',
    'FX_LOG',
    'AGD',
    'MODULOS',
    'CURSOS',
    'TIPOS',
    'EMPRESAS',
    'EMP',
    'AC',
    'CUR',
    'PERSONAS',
    'DASH_GRUPOS',
    'DASH_BLOCOS',
    'TELAS_MAPA',
    'NAV',
    'MENU_PERFIS',
    'AREA_TELAS',
    'RECORTES',
    'MATRIZ',
    'PERFIS',
    'NIVEIS',
    'ACOES',
    'AREAS',
    'TIPOS_PERFIL',
    'FEC_ESTADO',
    'BLACK_VALOR_PADRAO',
    'FB_TIPOS',
    'QR_QUAL',
    'AG_QUAL',
    'AUD_ENT',
    'FLUXO',
    'AG_SEM_MAX',
    'HOME_ID',
    'TELA_HOME',
    'MENU_SECOES',
  ].forEach((n) => {
    const v = pega(n);
    if (v !== undefined && typeof v !== 'function') extras[n] = v;
  });
  let leads;
  try {
    leads = funilLeads();
  } catch (e) {
    leads = String(e);
  }
  return Object.assign({ geradoEm: new Date().toISOString(), alunos, CAD, LEADS: leads }, extras);
})();
