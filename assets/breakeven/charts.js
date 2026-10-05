(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const lang = document.documentElement.lang.startsWith('pt') ? 'pt' : 'en';
  const pt = lang === 'pt';
  const data = window.BREAKEVEN_DATA;
  if (!data) return;
  const words = pt ? {
    jobs:'Geração de empregos', be:'Breakeven', dem:'Componente demográfico', part:'Participação', total:'Breakeven total', pop:'Crescimento da população', gap:'Folga', change:'Variação do desemprego', full:'Todo o período', recent:'Desde 2023', date:'Data', thousand:'mil empregos/mês', percent:'%', points:'p.p.', annual:'12 meses até ago/26', hint:'Use as setas do teclado para consultar os valores.', rule:'Regra prática', last:'ago/26'
  } : {
    jobs:'Job creation', be:'Breakeven', dem:'Demographic component', part:'Participation', total:'Total breakeven', pop:'Population growth', gap:'Employment gap', change:'Unemployment change', full:'Full period', recent:'Since 2023', date:'Date', thousand:'thousand jobs/month', percent:'%', points:'p.p.', annual:'12 months to Aug 26', hint:'Use the arrow keys to read values.', rule:'Rule of thumb', last:'Aug 26'
  };
  const colors={jobs:'#aeb9a3',be:'#f4ebd6',dem:'#d8a474',part:'#849965',total:'#f4ebd6',pop:'#d8a474',gap:'#d8a474'};
  const number = (value, digits=1) => new Intl.NumberFormat(pt?'pt-BR':'en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
  const date = key => new Intl.DateTimeFormat(pt?'pt-BR':'en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-15T12:00:00Z'));
  const el = (name,attrs={},text='') => {const n=document.createElementNS(NS,name); for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v); if(text)n.textContent=text;return n;};
  function tickStep(span,count=5){const raw=span/count,p=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/p;return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p;}
  const specs={
    hist:{rows:data.hist,type:'series',series:[['geracao','jobs','bar'],['breakeven','be','line'],['breakeven_dem','dem','line']],min:-1050,max:850},
    recente:{rows:data.recente,type:'series',series:[['geracao','jobs','bar'],['breakeven','be','line'],['breakeven_dem','dem','line']],min:-110,max:310},
    decomp:{rows:data.decomp,type:'components',series:[['demografia','dem','bar'],['participacao','part','bar'],['total','total','dot']],min:-560,max:480},
    pia:{rows:data.pia,type:'series',series:[['cresc_12m','pop','line']],min:.55,max:1.6},
    regra:{rows:data.regra,type:'scatter',series:[['folga','gap','dot']],min:-6.5,max:5.5}
  };
  for(const details of document.querySelectorAll('[data-table]')){
    details.addEventListener('toggle',()=>{
      if(!details.open||details.querySelector('table'))return;
      const key=details.dataset.table,spec=specs[key];
      const entries=key==='regra'? [['folga',words.gap+' ('+words.thousand+')',2],['var_desemprego',words.change+' ('+words.points+')',3]] : spec.series.map(([field,term])=>[field,words[term]+' ('+(key==='pia'?'%':words.thousand)+')',key==='pia'?3:2]);
      const table=document.createElement('table'),thead=table.createTHead(),heading=thead.insertRow();
      for(const label of [words.date,...entries.map(item=>item[1])]){const th=document.createElement('th');th.scope='col';th.textContent=label;heading.append(th);}
      const tbody=table.createTBody();
      spec.rows.forEach((row,i)=>{
        const tr=tbody.insertRow(),th=document.createElement('th');th.scope='row';
        th.textContent=key==='decomp'?(i===spec.rows.length-1?words.annual:row.periodo):date(row.mes);tr.append(th);
        for(const [field,,digits] of entries)tr.insertCell().textContent=number(row[field],digits);
      });
      details.querySelector('.table-scroll').append(table);
    });
  }
  const jobs=document.getElementById('in-jobs'),breakeven=document.getElementById('in-be');
  if(jobs&&breakeven){
    const presets=document.querySelectorAll('[data-be]');
    function updateCalculator(){
      const gap=Number(jobs.value)-Number(breakeven.value),change=-1200*gap/109262,initial=5.2946;
      document.getElementById('out-jobs').textContent=number(Number(jobs.value),0);
      document.getElementById('out-be').textContent=number(Number(breakeven.value),0);
      for(const button of presets)button.setAttribute('aria-pressed',String(Number(button.dataset.be)===Number(breakeven.value)));
      const output=document.getElementById('calc-out');
      const direction=change<0?(pt?'cai':'falls'):(pt?'sobe':'rises');
      output.textContent=pt?
        `Folga de ${number(gap,0)} mil empregos por mês. Em 12 meses, `+(gap===0?`o desemprego permanece próximo de ${number(initial,1)}%.`:`o desemprego ${direction} cerca de ${number(Math.abs(change),1)} p.p., de ${number(initial,1)}% para ${number(initial+change,1)}%.`):
        `A gap of ${number(gap,0)} thousand jobs per month. Over 12 months, `+(gap===0?`unemployment stays near ${number(initial,1)}%.`:`unemployment ${direction} by about ${number(Math.abs(change),1)} p.p., from ${number(initial,1)}% to ${number(initial+change,1)}%.`);
    }
    jobs.addEventListener('input',updateCalculator);breakeven.addEventListener('input',updateCalculator);
    for(const button of presets)button.addEventListener('click',()=>{breakeven.value=button.dataset.be;updateCalculator();});
    updateCalculator();
  }
  for(const host of document.querySelectorAll('[data-chart]')){
    const key=host.dataset.chart,spec=specs[key];if(!spec)continue;
    let rows=spec.rows,active=rows.length-1,visible=spec.series.map(()=>true),svg,plot,overlay,width,height=340,bounds;
    host.classList.add('interactive-ready');
    const fallback=host.querySelector('.chart-fallback');
    const legend=document.createElement('div');legend.className='chart-legend';
    if(spec.type!=='scatter')spec.series.forEach((series,i)=>{
      const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed','true');button.className='legend-item';
      const dot=document.createElement('span');dot.className='legend-dot';dot.style.background=colors[series[1]];
      button.append(dot,document.createTextNode(words[series[1]]));
      button.addEventListener('click',()=>{visible[i]=!visible[i];button.setAttribute('aria-pressed',String(visible[i]));draw();});
      legend.append(button);
    });
    host.append(legend);
    if(key==='hist'){
      const period=document.createElement('div');period.className='chart-period';
      [words.full,words.recent].forEach((label,i)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(i===0));button.addEventListener('click',()=>{rows=i?spec.rows.filter(r=>r.mes>='2023-01'):spec.rows;active=rows.length-1;for(const b of period.children)b.setAttribute('aria-pressed',String(b===button));draw();});period.append(button);});
      host.append(period);
    }
    const canvas=document.createElement('div');canvas.className='chart-canvas';host.append(canvas);
    const tip=document.createElement('div');tip.className='chart-tooltip';tip.hidden=true;tip.setAttribute('role','status');tip.setAttribute('aria-live','polite');canvas.append(tip);
    const status=document.createElement('p');status.className='sr-only';status.id='chart-hint-'+key;status.textContent=words.hint;host.append(status);
    function draw(){
      if(svg)svg.remove();
      width=Math.max(260,Math.round(canvas.getBoundingClientRect().width));height=width<420?320:350;
      const pad={l:key==='regra'?64:(width<420?42:52),r:16,t:12,b:key==='regra'?64:46};
      bounds={l:pad.l,r:width-pad.r,t:pad.t,b:height-pad.b};
      let xmin,xmax;
      if(spec.type==='scatter'){xmin=-450;xmax=520;}
      else if(spec.type==='components'){xmin=-.7;xmax=14.35;}
      else {xmin=rows[0].t-.07;xmax=rows.at(-1).t+.08;}
      const ymin=key==='hist'&&rows.length<100?-110:spec.min,ymax=key==='hist'&&rows.length<100?310:spec.max;
      const X=x=>bounds.l+(x-xmin)/(xmax-xmin)*(bounds.r-bounds.l),Y=y=>bounds.b-(y-ymin)/(ymax-ymin)*(bounds.b-bounds.t);
      host._scales={X,Y};
      svg=el('svg',{viewBox:`0 0 ${width} ${height}`,width:'100%',height,tabindex:'0',role:'img','aria-label':host.dataset.title,'aria-describedby':status.id});
      canvas.insertBefore(svg,tip);
      svg.append(el('title',{},host.dataset.title));
      const clip=el('clipPath',{id:'clip-'+key});clip.append(el('rect',{x:bounds.l,y:bounds.t,width:bounds.r-bounds.l,height:bounds.b-bounds.t}));const defs=el('defs');defs.append(clip);svg.append(defs);
      const bg=el('g',{'clip-path':`url(#clip-${key})`});svg.append(bg);
      if(key==='hist'||key==='pia')for(const [a,b] of [[2014.25,2017],[2020,2020.5]])bg.append(el('rect',{x:X(a),y:bounds.t,width:X(b)-X(a),height:bounds.b-bounds.t,fill:'#ffffff','fill-opacity':'.045'}));
      let ticks;
      if(key==='pia')ticks=[.6,.8,1,1.2,1.4,1.6];
      else {const step=tickStep(ymax-ymin);ticks=[];for(let y=Math.ceil(ymin/step)*step;y<=ymax;y+=step)ticks.push(y);}
      for(const y of ticks){svg.append(el('line',{x1:bounds.l,x2:bounds.r,y1:Y(y),y2:Y(y),stroke:y===0?'#86917e':'#52604d','stroke-opacity':y===0?'.6':'.3','stroke-width':'.7'}));svg.append(el('text',{x:bounds.l-9,y:Y(y)+4,'text-anchor':'end',class:'axis-label'},number(y,key==='pia'?1:0)));}
      if(spec.type==='scatter'){
        svg.append(el('text',{transform:'rotate(-90)',x:-(bounds.t+bounds.b)/2,y:13,'text-anchor':'middle',class:'axis-label'},pt?'Variação do desemprego (p.p.)':'Unemployment change (p.p.)'));
        const xticks=width<420?[-300,0,300]:[-450,-300,-150,0,150,300,450];
        for(const x of xticks)svg.append(el('text',{x:X(x),y:bounds.b+22,'text-anchor':'middle',class:'axis-label'},number(x,0)));
        svg.append(el('text',{x:(bounds.l+bounds.r)/2,y:height-8,'text-anchor':'middle',class:'axis-label'},pt?'Folga, mil empregos/mês':'Gap, thousand jobs/month'));
        bg.append(el('line',{x1:X(-450),y1:Y(-1200*(-450)/109262),x2:X(520),y2:Y(-1200*520/109262),stroke:colors.part,'stroke-width':1.3}));
      }else if(spec.type==='components'){
        for(const [i,r] of rows.entries()){
          if(width<420&&i%2===1&&i!==rows.length-1)continue;
          const txt=i===rows.length-1?'12m':r.periodo.slice(2);
          svg.append(el('text',{x:X(r.x),y:bounds.b+22,'text-anchor':'middle',class:'axis-label'},txt));
        }
      }else{
        const span=xmax-xmin,step=span>8?(width<500?3:2):1;
        for(let y=Math.ceil(xmin);y<xmax;y+=step)svg.append(el('text',{x:X(y),y:bounds.b+22,'text-anchor':'middle',class:'axis-label'},String(y)));
      }
      plot=el('g',{'clip-path':`url(#clip-${key})`});svg.append(plot);
      if(spec.type==='scatter'){
        rows.forEach((r,i)=>plot.append(el('circle',{cx:X(r.folga),cy:Y(r.var_desemprego),r:i===rows.length-1?4.5:2.6,fill:i===rows.length-1?colors.dem:colors.jobs,'fill-opacity':i===rows.length-1?1:.6})));
      }else if(spec.type==='components'){
        const bw=(bounds.r-bounds.l)/(xmax-xmin)*.65;
        rows.forEach(r=>{
          if(visible[0])plot.append(el('rect',{x:X(r.x)-bw/2,y:Y(r.demografia),width:bw,height:Y(0)-Y(r.demografia),fill:colors.dem}));
          if(visible[1]){const bottom=r.participacao>0?(visible[0]?r.demografia:0):0,top=bottom+r.participacao;plot.append(el('rect',{x:X(r.x)-bw/2,y:Math.min(Y(top),Y(bottom)),width:bw,height:Math.abs(Y(top)-Y(bottom)),fill:colors.part}));}
          if(visible[2])plot.append(el('circle',{cx:X(r.x),cy:Y(r.total),r:3.4,fill:colors.total,stroke:'#213024','stroke-width':1}));
        });
      }else{
        spec.series.forEach(([field,color,type],j)=>{
          if(!visible[j])return;
          if(type==='bar'){
            const bw=Math.max(1,(bounds.r-bounds.l)/(xmax-xmin)*.06);
            for(const r of rows)plot.append(el('rect',{x:X(r.t)-bw/2,y:Math.min(Y(r[field]),Y(0)),width:bw,height:Math.abs(Y(r[field])-Y(0)),fill:colors[color],'fill-opacity':'.62'}));
          }else plot.append(el('path',{d:rows.map((r,i)=>(i?'L':'M')+X(r.t).toFixed(2)+','+Y(r[field]).toFixed(2)).join(' '),fill:'none',stroke:colors[color],'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round'}));
        });
      }
      overlay=el('g',{'pointer-events':'none'});svg.append(overlay);
      function nearest(event){const box=svg.getBoundingClientRect(),px=(event.clientX-box.left)*width/box.width,py=(event.clientY-box.top)*height/box.height;let min=Infinity,idx=0;rows.forEach((r,i)=>{const x=spec.type==='scatter'?r.folga:spec.type==='components'?r.x:r.t;const dist=Math.pow(X(x)-px,2)+(spec.type==='scatter'?Math.pow(Y(r.var_desemprego)-py,2):0);if(dist<min){min=dist;idx=i;}});active=idx;show();}
      svg.addEventListener('pointermove',nearest);svg.addEventListener('pointerdown',nearest);
      svg.addEventListener('pointerleave',()=>{tip.hidden=true;overlay.replaceChildren();});
      svg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();active=Math.min(rows.length-1,Math.max(0,active+(e.key==='ArrowLeft'?-1:1)));show();}if(e.key==='Escape'){tip.hidden=true;overlay.replaceChildren();}});
      svg.addEventListener('focus',show);svg.addEventListener('blur',()=>{tip.hidden=true;overlay.replaceChildren();});
      tip.hidden=true;if(fallback)fallback.hidden=true;
    }
    function show(){
      if(!svg)return;
      const r=rows[active],{X,Y}=host._scales;
      overlay.replaceChildren();tip.replaceChildren();
      const title=document.createElement('strong');title.textContent=spec.type==='components'?(active===rows.length-1?words.annual:r.periodo):date(r.mes);tip.append(title);
      const entries=spec.type==='scatter'?[[words.gap,r.folga,words.thousand,2],[words.change,r.var_desemprego,words.points,3]]:spec.series.map(([field,color],i)=>visible[i]?[words[color],r[field],key==='pia'?words.percent:words.thousand,key==='pia'?3:2]:null).filter(Boolean);
      for(const [label,value,unit,digits] of entries){const line=document.createElement('div');line.textContent=`${label}: ${number(value,digits)} ${unit}`;tip.append(line);}
      const x=X(spec.type==='scatter'?r.folga:spec.type==='components'?r.x:r.t);
      if(spec.type==='scatter')overlay.append(el('circle',{cx:x,cy:Y(r.var_desemprego),r:6,fill:'none',stroke:colors.total,'stroke-width':1.5}));
      else overlay.append(el('line',{x1:x,x2:x,y1:bounds.t,y2:bounds.b,stroke:'#ece4d3','stroke-opacity':'.5','stroke-width':1,'stroke-dasharray':'3 4'}));
      tip.hidden=false;tip.style.left='0px';tip.style.top='14px';
      const available=canvas.clientWidth,tw=tip.offsetWidth;
      const scale=available/width;
      tip.style.left=Math.max(0,Math.min(available-tw,x*scale+(x>width*.6?-tw-14:14)))+'px';
    }
    new ResizeObserver(draw).observe(canvas);
    draw();
  }
})();
