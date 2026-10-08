(() => {
  'use strict';
  /* Interactive charts for the thesis page, in the same style as the breakeven letter:
     cream panel, black text, light grid, tooltips and keyboard navigation. */
  const NS = 'http://www.w3.org/2000/svg';
  const data = window.THESIS_DATA;
  if (!data) return;
  const INK = '#000000';
  const C = {green:'#233d2c', brown:'#a46a3b', moss:'#9a9478', bar:'#b6bcb3'};
  const REGIONS = [
    ['sudeste','Southeast',C.green,''],
    ['sul','South',C.brown,''],
    ['centrooeste','Center-West',C.moss,''],
    ['norte','North',C.green,'4 3'],
    ['nordeste','Northeast',C.brown,'4 3']
  ];
  const STATES = {SP:'São Paulo',MG:'Minas Gerais',ES:'Espírito Santo',RS:'Rio Grande do Sul',PR:'Paraná',GO:'Goiás',RJ:'Rio de Janeiro',PA:'Pará',PE:'Pernambuco',MT:'Mato Grosso',BA:'Bahia',SE:'Sergipe',CE:'Ceará',AM:'Amazonas',SC:'Santa Catarina',DF:'Distrito Federal',RN:'Rio Grande do Norte',MS:'Mato Grosso do Sul',PI:'Piauí',TO:'Tocantins',AC:'Acre',PB:'Paraíba',RO:'Rondônia',AP:'Amapá',AL:'Alagoas',RR:'Roraima',MA:'Maranhão'};
  const GROUPS = [['sul_sudeste','South and Southeast',C.green],['centro_oeste','Center-West',C.moss],['norte_nordeste','North and Northeast',C.brown]];
  const fmt = (v, d) => new Intl.NumberFormat('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d}).format(v).replace(/^-/,'−');
  const signed = (v, d) => (v > 0 ? '+' : '') + fmt(v, d);
  const el = (name, attrs = {}, text = '') => {const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text) n.textContent = text; return n;};

  const states = data.g6_estados.map(r => {const g = GROUPS.find(([k]) => r[k] !== null); return {uf:r.uf, name:STATES[r.uf], value:r[g[0]], group:g[1], color:g[2]};});
  const specs = {
    port:{type:'lines', rows:data.g2_port_regioes, min:.62, max:.69, ticks:[.62,.64,.66,.68], digits:2, tipDigits:4},
    flex:{type:'lines', rows:data.g4_flex_regioes, min:0, max:4, ticks:[0,1,2,3,4], digits:0, tipDigits:3},
    mis:{type:'lines', rows:data.g5_descasamento, min:0, max:1.05, ticks:[0,.25,.5,.75,1], digits:2, tipDigits:3},
    occ:{type:'hbar', rows:data.g1_portabilidade.map(r => ({y:r.y, label:r.ocupacao, value:r.indice, color:r.indice > .9 ? C.green : C.bar})), min:0, max:1.1, ticks:[0,.2,.4,.6,.8,1], digits:1, tipDigits:3, labelWidth:150},
    probit:{type:'hbar', rows:data.g3_probit.map(r => ({y:r.y, label:r.variavel, value:r.coef, color:r.coef > 0 ? C.green : C.brown})), min:-5.2, max:5.2, ticks:[-4,-2,0,2,4], digits:0, tipDigits:3, signed:true, labelWidth:118},
    states:{type:'vbar', rows:states, min:0, max:12, ticks:[0,2,4,6,8,10,12], digits:0, tipDigits:2},
    wage:{type:'ci', rows:data.g7_curva.map((r, i) => ({y:r.y, label:r.grupo, value:r.alpha, se:r.ep, lo:r.lo, hi:r.hi, color:i ? C.brown : C.green})), min:-.11, max:0, ticks:[-.1,-.08,-.06,-.04,-.02,0], digits:2, tipDigits:4, labelWidth:110}
  };

  /* "View data" tables, built on first open */
  const tables = {
    port:['g2_port_regioes','Year',REGIONS.map(r => [r[0], r[1], 4])],
    flex:['g4_flex_regioes','Year',REGIONS.map(r => [r[0], r[1], 3])],
    mis:['g5_descasamento','Year',REGIONS.map(r => [r[0], r[1], 3])],
    occ:['g1_portabilidade','Occupation',[['indice','Portability index',3]]],
    probit:['g3_probit','Variable',[['coef','Coefficient',3]]],
    states:[null,'State',[['value','Allocative flexibility',2],['group','Macro-region',null]]],
    wage:['g7_curva','Group',[['alpha','Elasticity',4],['ep','Standard error',4],['lo','95% CI, lower',4],['hi','95% CI, upper',4]]]
  };
  for (const details of document.querySelectorAll('[data-table]')) {
    details.addEventListener('toggle', () => {
      if (!details.open || details.querySelector('table')) return;
      const [file, first, cols] = tables[details.dataset.table];
      const rows = file ? data[file] : states;
      const keyOf = r => r.ano ?? r.ocupacao ?? r.variavel ?? r.grupo ?? r.name;
      const sorted = rows[0].y !== undefined ? [...rows].sort((a, b) => b.y - a.y) : rows;
      const table = document.createElement('table'), head = table.createTHead().insertRow();
      for (const label of [first, ...cols.map(c => c[1])]) {const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; head.append(th);}
      const body = table.createTBody();
      for (const r of sorted) {
        const tr = body.insertRow(), th = document.createElement('th'); th.scope = 'row'; th.textContent = String(keyOf(r)); tr.append(th);
        for (const [field, , d] of cols) tr.insertCell().textContent = d === null ? r[field] : fmt(r[field], d);
      }
      details.querySelector('.table-scroll').append(table);
    });
  }

  for (const host of document.querySelectorAll('[data-chart]')) {
    const key = host.dataset.chart, spec = specs[key];
    if (!spec) continue;
    host.classList.add('interactive-ready');
    const fallback = host.querySelector('.chart-fallback');
    const rows = spec.rows;
    let active = spec.type === 'lines' ? rows.length - 1 : 0, svg, overlay, width, height, bounds, X, Y;
    const visible = REGIONS.map(() => true);

    const legend = document.createElement('div'); legend.className = 'chart-legend';
    const swatch = (color, dash, kind) => {
      const s = el('svg', {width:kind === 'line' ? 20 : 10, height:10, 'aria-hidden':'true'});
      if (kind === 'line') s.append(el('line', {x1:0, x2:20, y1:5, y2:5, stroke:color, 'stroke-width':2, 'stroke-dasharray':dash}));
      else s.append(el('rect', {x:0, y:0, width:10, height:10, fill:color}));
      return s;
    };
    if (spec.type === 'lines') REGIONS.forEach(([, label, color, dash], i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'legend-item'; b.setAttribute('aria-pressed', 'true');
      b.append(swatch(color, dash, 'line'), document.createTextNode(label));
      b.addEventListener('click', () => {visible[i] = !visible[i]; b.setAttribute('aria-pressed', String(visible[i])); draw();});
      legend.append(b);
    });
    if (spec.type === 'vbar') for (const [, label, color] of GROUPS) {
      const s = document.createElement('span'); s.className = 'legend-item legend-static'; s.append(swatch(color, '', 'box'), document.createTextNode(label)); legend.append(s);
    }
    if (legend.children.length) host.append(legend);
    const canvas = document.createElement('div'); canvas.className = 'chart-canvas'; host.append(canvas);
    const tip = document.createElement('div'); tip.className = 'chart-tooltip'; tip.hidden = true; tip.setAttribute('role', 'status'); tip.setAttribute('aria-live', 'polite'); canvas.append(tip);
    const hint = document.createElement('p'); hint.className = 'sr-only'; hint.id = 'chart-hint-' + key; hint.textContent = 'Use the arrow keys to read values.'; host.append(hint);

    function draw() {
      if (svg) svg.remove();
      width = Math.max(260, Math.round(canvas.getBoundingClientRect().width));
      const narrow = width < 420;
      const n = rows.length;
      if (spec.type === 'hbar' || spec.type === 'ci') height = (spec.type === 'ci' ? 54 : 24) * n + 40;
      else height = narrow ? 230 : 260;
      const lw = spec.labelWidth ? (narrow ? spec.labelWidth - 22 : spec.labelWidth) : 0;
      const pad = spec.type === 'lines' ? {l:narrow ? 40 : 46, r:14, t:10, b:34}
        : spec.type === 'vbar' ? {l:narrow ? 30 : 36, r:8, t:22, b:34}
        : {l:lw, r:spec.type === 'hbar' ? 52 : 18, t:6, b:34};
      bounds = {l:pad.l, r:width - pad.r, t:pad.t, b:height - pad.b};
      let xmin, xmax;
      if (spec.type === 'lines') {xmin = 2009.6; xmax = 2023.4;}
      else if (spec.type === 'vbar') {xmin = -.7; xmax = n - .3;}
      else {xmin = spec.min; xmax = spec.max;}
      const vertical = spec.type === 'lines' || spec.type === 'vbar';
      const lo = vertical ? spec.min : .4, hi = vertical ? spec.max : n + .6;
      X = x => bounds.l + (x - xmin) / (xmax - xmin) * (bounds.r - bounds.l);
      Y = y => bounds.b - (y - lo) / (hi - lo) * (bounds.b - bounds.t);
      svg = el('svg', {viewBox:`0 0 ${width} ${height}`, width:'100%', height, tabindex:'0', role:'img', 'aria-label':host.dataset.title, 'aria-describedby':hint.id});
      canvas.insertBefore(svg, tip);
      svg.append(el('title', {}, host.dataset.title));
      const grid = el('g'), plot = el('g'), axes = el('g', {stroke:'#8a8a84', 'stroke-width':'.7', fill:'none'});
      svg.append(grid, plot, axes);
      const gridline = (x1, y1, x2, y2) => grid.append(el('line', {x1, y1, x2, y2, stroke:INK, 'stroke-opacity':'.08', 'stroke-width':'.7'}));
      const label = (x, y, text, anchor = 'middle', parent = svg) => parent.append(el('text', {x, y, 'text-anchor':anchor, class:'axis-label'}, text));

      if (vertical) {
        for (const t of spec.ticks) {if (t !== spec.min) gridline(bounds.l, Y(t), bounds.r, Y(t)); label(bounds.l - 7, Y(t) + 4, fmt(t, spec.digits), 'end');}
        axes.append(el('line', {x1:bounds.l, x2:bounds.r, y1:bounds.b, y2:bounds.b}));
      } else {
        for (const t of spec.ticks) {gridline(X(t), bounds.t, X(t), bounds.b); label(X(t), bounds.b + 19, fmt(t, spec.digits));}
        axes.append(el('line', {x1:bounds.l, x2:bounds.r, y1:bounds.b, y2:bounds.b}));
        for (const t of spec.ticks) axes.append(el('line', {x1:X(t), x2:X(t), y1:bounds.b, y2:bounds.b + 4}));
      }

      if (spec.type === 'lines') {
        for (const [a, b] of [[2014.25, 2017], [2020, 2020.5]]) grid.append(el('rect', {x:X(a), y:bounds.t, width:X(b) - X(a), height:bounds.b - bounds.t, fill:INK, 'fill-opacity':'.07'}));
        const step = narrow ? 3 : 2;
        for (let y = 2010; y <= 2023; y++) {
          axes.append(el('line', {x1:X(y), x2:X(y), y1:bounds.b, y2:bounds.b + (y % step === 0 ? 4 : 2)}));
          if (y % step === 0) label(X(y), bounds.b + 19, String(y));
        }
        REGIONS.forEach(([field, , color, dash], i) => {
          if (!visible[i]) return;
          plot.append(el('path', {d:rows.map((r, j) => (j ? 'L' : 'M') + X(r.ano).toFixed(2) + ',' + Y(r[field]).toFixed(2)).join(' '), fill:'none', stroke:color, 'stroke-width':1.6, 'stroke-dasharray':dash, 'stroke-linejoin':'round', 'stroke-linecap':'round'}));
        });
      } else if (spec.type === 'vbar') {
        const bw = (bounds.r - bounds.l) / (xmax - xmin) * .66;
        rows.forEach((r, i) => {
          plot.append(el('rect', {x:X(i) - bw / 2, y:Y(r.value), width:bw, height:Y(0) - Y(r.value), fill:r.color}));
          if (!narrow || i % 2 === 0) label(X(i), bounds.b + 15, r.uf);
        });
        label(X(0), Y(rows[0].value) - 5, fmt(rows[0].value, 2));
        label(X(n - 1), Y(rows[n - 1].value) - 5, fmt(rows[n - 1].value, 2));
      } else if (spec.type === 'hbar') {
        const bh = 14, zero = X(Math.max(0, spec.min));
        rows.forEach(r => {
          const y = Y(r.y ?? 0);
          const x0 = Math.min(zero, X(r.value)), w = Math.abs(X(r.value) - zero);
          plot.append(el('rect', {x:x0, y:y - bh / 2, width:Math.max(w, .8), height:bh, fill:r.color}));
          label(bounds.l - 8, y + 4, r.label, 'end');
          const right = r.value >= 0;
          label(right ? X(r.value) + 5 : X(r.value) - 5, y + 4, spec.signed ? signed(r.value, spec.tipDigits) : fmt(r.value, spec.tipDigits), right ? 'start' : 'end');
        });
        if (spec.min < 0) axes.append(el('line', {x1:zero, x2:zero, y1:bounds.t, y2:bounds.b, stroke:INK, 'stroke-opacity':'.55'}));
      } else {
        rows.forEach(r => {
          const y = Y(r.y);
          plot.append(el('line', {x1:X(r.lo), x2:X(r.hi), y1:y, y2:y, stroke:r.color, 'stroke-width':2}));
          for (const v of [r.lo, r.hi]) plot.append(el('line', {x1:X(v), x2:X(v), y1:y - 5, y2:y + 5, stroke:r.color, 'stroke-width':1.4}));
          plot.append(el('circle', {cx:X(r.value), cy:y, r:5, fill:r.color, stroke:'#ffffff', 'stroke-width':1.2}));
          label(X(r.value), y - 11, fmt(r.value, 3));
          label(bounds.l - 8, y + 4, r.label, 'end');
        });
      }
      overlay = el('g', {'pointer-events':'none'}); svg.append(overlay);
      svg.addEventListener('pointermove', pick); svg.addEventListener('pointerdown', pick);
      svg.addEventListener('pointerleave', hide); svg.addEventListener('blur', hide); svg.addEventListener('focus', show);
      svg.addEventListener('keydown', e => {
        const prev = vertical ? 'ArrowLeft' : 'ArrowUp', next = vertical ? 'ArrowRight' : 'ArrowDown';
        if (e.key === prev || e.key === next) {e.preventDefault(); active = Math.min(n - 1, Math.max(0, active + (e.key === prev ? -1 : 1))); show();}
        if (e.key === 'Escape') hide();
      });
      tip.hidden = true; if (fallback) fallback.hidden = true;
    }
    function order() {return spec.type === 'hbar' || spec.type === 'ci' ? [...rows].sort((a, b) => b.y - a.y) : rows;}
    function pick(event) {
      const box = svg.getBoundingClientRect(), px = (event.clientX - box.left) * width / box.width, py = (event.clientY - box.top) * height / box.height;
      const list = order(); let min = Infinity;
      list.forEach((r, i) => {
        const d = spec.type === 'lines' ? Math.abs(X(r.ano) - px) : spec.type === 'vbar' ? Math.abs(X(i) - px) : Math.abs(Y(r.y) - py);
        if (d < min) {min = d; active = i;}
      });
      show();
    }
    function hide() {tip.hidden = true; overlay.replaceChildren();}
    function show() {
      if (!svg) return;
      const list = order(), r = list[active];
      overlay.replaceChildren(); tip.replaceChildren();
      const title = document.createElement('strong');
      const line = text => {const d = document.createElement('div'); d.textContent = text; tip.append(d);};
      let x, y;
      if (spec.type === 'lines') {
        title.textContent = String(r.ano); tip.append(title);
        REGIONS.forEach(([field, label], i) => {if (visible[i]) line(`${label}: ${fmt(r[field], spec.tipDigits)}`);});
        x = X(r.ano); y = bounds.t + 4;
        overlay.append(el('line', {x1:x, x2:x, y1:bounds.t, y2:bounds.b, stroke:INK, 'stroke-opacity':'.45', 'stroke-width':.8, 'stroke-dasharray':'2 3'}));
      } else if (spec.type === 'vbar') {
        title.textContent = r.name; tip.append(title);
        line(`Allocative flexibility: ${fmt(r.value, 2)}`); line(r.group);
        x = X(active); y = Math.max(bounds.t, Y(r.value) - 10);
        overlay.append(el('line', {x1:x, x2:x, y1:bounds.t, y2:bounds.b, stroke:INK, 'stroke-opacity':'.45', 'stroke-width':.8, 'stroke-dasharray':'2 3'}));
      } else {
        title.textContent = r.label; tip.append(title);
        if (spec.type === 'ci') {line(`Elasticity: ${fmt(r.value, 4)}`); line(`Standard error: ${fmt(r.se, 4)}`); line(`95% interval: ${fmt(r.lo, 3)} to ${fmt(r.hi, 3)}`);}
        else line(key === 'occ' ? `Portability index: ${fmt(r.value, 3)}` : `Coefficient: ${signed(r.value, 3)}`);
        x = X(r.value); y = Y(r.y) + 12;
        overlay.append(el('rect', {x:2, y:Y(r.y) - 11, width:width - 4, height:22, fill:INK, 'fill-opacity':'.05'}));
      }
      tip.hidden = false; tip.style.left = '0px';
      const scale = canvas.clientWidth / width, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(canvas.clientWidth - tw, x * scale + (x > width * .55 ? -tw - 14 : 14))) + 'px';
      tip.style.top = Math.max(0, y * scale) + 'px';
    }
    new ResizeObserver(draw).observe(canvas);
    draw();
  }
})();
