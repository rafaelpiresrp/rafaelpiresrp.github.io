(() => {
  'use strict';
  const raw = window.BRENT_DATA;
  if (!Array.isArray(raw) || !raw.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  const rows = raw.map(([date,p0,p12,p24]) => ({
    date, x:Date.parse(date+'T00:00:00Z'),p0,p12,p24,
    spread:p12-p0,slope:100*Math.log(p12/p0)
  }));
  const recent = rows.filter(r => r.date >= '2026-01-01');
  const colors = {p0:'#213024',p12:'#a8693a',p24:'#aea78f',spread:'#213024',slope:'#213024'};
  const labels = {p0:'Nearby',p12:'12 months',p24:'24 months',spread:'Spread',slope:'Slope'};
  const specs = {
    spread:{rows,fields:['spread'],min:-50,max:25,ticks:[-40,-30,-20,-10,0,10,20],unit:'USD per barrel'},
    slope:{rows,fields:['slope'],min:-50,max:70,ticks:[-40,-20,0,20,40,60],unit:'log points'},
    prices:{rows:recent,fields:['p0','p12','p24'],min:50,max:130,ticks:[60,80,100,120],unit:'USD per barrel'}
  };
  const element = (name,attributes={},text='') => {
    const e=document.createElementNS(NS,name);
    for(const [key,value] of Object.entries(attributes)) e.setAttribute(key,value);
    if(text) e.textContent=text;
    return e;
  };
  const format = (value,digits=2) => new Intl.NumberFormat('en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value).replace(/^-/,'−');
  const dateFormat = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const fullDate = r => dateFormat.format(new Date(r.x));

  for(const host of document.querySelectorAll('[data-chart]')) {
    const key=host.dataset.chart, spec=specs[key];
    if(!spec) continue;
    let selected=spec.rows,active=selected.length-1,svg,overlay,width,height,bounds,X,Y;
    const visible=new Set(spec.fields);
    const fallback=host.querySelector('.chart-fallback');
    host.classList.add('interactive-ready');

    if(key==='prices') {
      const legend=document.createElement('div');legend.className='chart-legend';
      for(const field of spec.fields) {
        const button=document.createElement('button');button.type='button';button.className='legend-item';button.setAttribute('aria-pressed','true');
        const line=document.createElement('span');line.className='legend-dot legend-line';line.style.background=colors[field];
        button.append(line,document.createTextNode(labels[field]));
        button.addEventListener('click',()=>{
          if(visible.has(field)) visible.delete(field); else visible.add(field);
          button.setAttribute('aria-pressed',String(visible.has(field)));draw();
        });
        legend.append(button);
      }
      host.append(legend);
    } else {
      const periods=document.createElement('div');periods.className='chart-period';periods.setAttribute('role','group');periods.setAttribute('aria-label','Chart period');
      for(const [label,isRecent] of [['Full history',false],['2026',true]]) {
        const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(!isRecent));
        button.addEventListener('click',()=>{
          selected=isRecent?recent:spec.rows;active=selected.length-1;
          for(const b of periods.children) b.setAttribute('aria-pressed',String(b===button));
          draw();
        });periods.append(button);
      }
      host.append(periods);
    }
    const canvas=document.createElement('div');canvas.className='chart-canvas';host.append(canvas);
    const tooltip=document.createElement('div');tooltip.className='chart-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','status');tooltip.setAttribute('aria-live','polite');canvas.append(tooltip);
    const hint=document.createElement('p');hint.className='sr-only';hint.id='brent-hint-'+key;hint.textContent='Hover or touch to read daily values. Use the left and right arrow keys to change the date.';host.append(hint);

    function hide() { tooltip.hidden=true;if(overlay) overlay.replaceChildren(); }
    function show() {
      const row=selected[active];if(!row||!svg) return;
      overlay.replaceChildren();tooltip.replaceChildren();
      const title=document.createElement('strong');title.textContent=fullDate(row);tooltip.append(title);
      for(const field of spec.fields) if(visible.has(field)) {
        const p=document.createElement('div');p.textContent=labels[field]+': '+format(row[field])+' '+spec.unit;tooltip.append(p);
      }
      const x=X(row.x);
      overlay.append(element('line',{x1:x,x2:x,y1:bounds.top,y2:bounds.bottom,stroke:'#666','stroke-width':.7,'stroke-dasharray':'2 3'}));
      tooltip.hidden=false;tooltip.style.top='12px';tooltip.style.left='0px';
      const available=canvas.clientWidth,tw=tooltip.offsetWidth,px=x*available/width;
      tooltip.style.left=Math.max(0,Math.min(available-tw,px+(px>available*.6?-tw-12:12)))+'px';
    }
    function nearest(event) {
      const box=svg.getBoundingClientRect(),px=(event.clientX-box.left)*width/box.width;
      let lo=0,hi=selected.length-1;
      while(lo<hi) { const mid=(lo+hi)>>1;if(X(selected[mid].x)<px)lo=mid+1;else hi=mid; }
      active=lo>0&&Math.abs(X(selected[lo-1].x)-px)<Math.abs(X(selected[lo].x)-px)?lo-1:lo;
      show();
    }
    function draw() {
      if(svg) svg.remove();hide();
      width=Math.max(240,Math.round(canvas.getBoundingClientRect().width));height=width<420?230:260;
      bounds={left:width<420?38:48,right:width-14,top:key==='prices'?34:10,bottom:height-32};
      const oneYear=selected[0].date.startsWith('2026');
      const xmin=oneYear?Date.UTC(2026,0,1):Date.UTC(1998,0,1);
      const xmax=oneYear?Date.UTC(2026,11,12):Date.UTC(2027,7,1);
      X=x=>bounds.left+(x-xmin)/(xmax-xmin)*(bounds.right-bounds.left);
      Y=y=>bounds.bottom-(y-spec.min)/(spec.max-spec.min)*(bounds.bottom-bounds.top);
      svg=element('svg',{viewBox:`0 0 ${width} ${height}`,width:'100%',height,tabindex:0,role:'img','aria-label':host.dataset.title,'aria-describedby':hint.id});
      canvas.insertBefore(svg,tooltip);svg.append(element('title',{},host.dataset.title));
      const clipId='brent-clip-'+key;
      const defs=element('defs'),clip=element('clipPath',{id:clipId});
      clip.append(element('rect',{x:bounds.left,y:bounds.top,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top}));defs.append(clip);svg.append(defs);
      for(const value of spec.ticks) {
        svg.append(element('line',{x1:bounds.left,x2:bounds.right,y1:Y(value),y2:Y(value),stroke:value===0?'#777':'#e0e0da','stroke-width':value===0?.7:.55}));
        svg.append(element('text',{x:bounds.left-7,y:Y(value)+4,'text-anchor':'end',class:'axis-label'},format(value,0)));
      }
      svg.append(element('line',{x1:bounds.left,x2:bounds.right,y1:bounds.bottom,y2:bounds.bottom,stroke:'#777','stroke-width':.6}));
      const ticks=oneYear?[0,2,4,6,8].map(m=>[Date.UTC(2026,m,1),new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,m,1)))+' 26']):Array.from({length:Math.ceil(29/(width<420?6:4))},(_,i)=>{const y=1998+i*(width<420?6:4);return [Date.UTC(y,0,1),String(y)];});
      for(const [date,label] of ticks) {
        const x=X(date);svg.append(element('line',{x1:x,x2:x,y1:bounds.bottom,y2:bounds.bottom+4,stroke:'#777','stroke-width':.6}));
        svg.append(element('text',{x,y:bounds.bottom+20,'text-anchor':'middle',class:'axis-label'},label));
      }
      if(key==='prices') {
        const eventX=X(Date.UTC(2026,1,28));
        svg.append(element('line',{x1:eventX,x2:eventX,y1:bounds.top,y2:bounds.bottom,stroke:'#aea78f','stroke-width':.85,'stroke-dasharray':'4 3',class:'event-line'}));
        const label=element('text',{x:eventX+5,y:12,class:'event-label'});
        label.append(element('tspan',{x:eventX+5,dy:0},'Iran war begins'),element('tspan',{x:eventX+5,dy:14},'28 Feb'));svg.append(label);
      }
      const plot=element('g',{'clip-path':`url(#${clipId})`});svg.append(plot);
      for(const field of spec.fields) if(visible.has(field)) {
        const d=selected.map((r,i)=>(i?'L':'M')+X(r.x).toFixed(2)+','+Y(r[field]).toFixed(2)).join(' ');
        plot.append(element('path',{d,fill:'none',stroke:colors[field],'stroke-width':1.5,'stroke-linejoin':'round','stroke-linecap':'round','data-series':field}));
        if(key==='prices') {
          const last=selected.at(-1);
          svg.append(element('text',{x:X(last.x)+8,y:Y(last[field])+4,class:'latest-label'},format(last[field])));
        }
      }
      overlay=element('g',{'pointer-events':'none'});svg.append(overlay);
      svg.addEventListener('pointermove',nearest);svg.addEventListener('pointerdown',nearest);svg.addEventListener('pointerleave',hide);
      svg.addEventListener('focus',show);svg.addEventListener('blur',hide);
      svg.addEventListener('keydown',event=>{
        if(event.key==='ArrowLeft'||event.key==='ArrowRight') {event.preventDefault();active=Math.max(0,Math.min(selected.length-1,active+(event.key==='ArrowLeft'?-1:1)));show();}
        if(event.key==='Home') {event.preventDefault();active=0;show();}
        if(event.key==='End') {event.preventDefault();active=selected.length-1;show();}
        if(event.key==='Escape') hide();
      });
      if(fallback) fallback.hidden=true;
    }
    new ResizeObserver(draw).observe(canvas);draw();
  }
})();
