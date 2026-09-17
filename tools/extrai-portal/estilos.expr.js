(() => {
  // Estilos calculados dos elementos da base (menu, cabeçalho, cartões, dashboard), para replicar no front.
  const props = [
    'display',
    'width',
    'height',
    'minHeight',
    'margin',
    'padding',
    'background',
    'backgroundColor',
    'color',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'borderRadius',
    'border',
    'borderBottom',
    'boxShadow',
    'gap',
    'gridTemplateColumns',
    'position',
    'top',
    'left',
    'bottom',
    'fontFamily',
  ];
  const pega = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const cs = getComputedStyle(e),
      r = e.getBoundingClientRect();
    const o = { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
    props.forEach((p) => {
      const v = cs[p];
      if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') o[p] = v;
    });
    return o;
  };
  const sels = [
    'body',
    '.app',
    '.sidebar',
    '.brand',
    '.brand *',
    '#nav',
    '.nav-item',
    '.nav-item.active',
    '.nav-item svg',
    '.sb-tools',
    '.sb-tools button',
    '#sbAlertasN',
    '.acct-foot',
    '#acctBtn',
    '#acctBtn .avatar',
    '#acctBtn b',
    '#acctBtn span',
    '.main',
    '#view',
    '.page-head',
    'h1',
    '.dash-info',
    '.stats',
    '.stat',
    '.stat .val',
    '.stat .lbl',
    '.dash-grid',
    '.dash-b.card',
    '.pane-head',
    '.pane-title',
    '.dash-d',
    '.dash-bd',
    '.dash-l',
    '.dash-l .nm',
    '.dash-l .vl',
    '.dash-l .sb',
    '.track',
    '.track i',
    '.dash-kpis',
    '.dash-kpis b',
    '.dash-pe',
    '.dash-sel > .btn',
    '.btn-ghost',
    '.badge',
  ];
  const r = {};
  sels.forEach((s) => (r[s] = pega(s)));
  r.brandHtml = (document.querySelector('.brand') || {}).outerHTML;
  r.acctHtml = (document.querySelector('.acct-foot') || {}).outerHTML;
  r.sbToolsHtml = (document.querySelector('.sb-tools') || {}).outerHTML;
  return r;
})();
