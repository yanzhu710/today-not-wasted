// Mobile statistics: real period filtering, correct SVG namespace, truthful zero values.
import { h, todayKey, addDaysKey, addMonthsKey } from './util.js';
import { catName, catColor } from './catalog.js';
import { aggregatePeriod, loadAnalyticsSource, loadRepairStyles, isDateKey } from './analytics.js';
import { openSharePanel } from './share.js';

export async function renderStatsView(box, opts={}) {
  loadRepairStyles();
  let type='week', anchor=isDateKey(opts.anchor)?opts.anchor:todayKey(), metric='count', sequence=0;
  const root=h('div',{class:'repair-stats'}), controls=h('div',{class:'card repair-controls'}), body=h('div');
  box.append(root);root.append(controls,body);
  const periods=h('div',{class:'seg'}, ['day','week','month'].map((value,i)=>h('button',{type:'button',class:type===value?'on':'',onclick:()=>{type=value;refresh();}},['日','周','月'][i])));
  const input=h('input',{class:'input',type:'date',value:anchor,'aria-label':'统计日期',onchange:()=>{if(isDateKey(input.value)){anchor=input.value;refresh();}}});
  const move=n=>{anchor=type==='month'?addMonthsKey(anchor,n):addDaysKey(anchor,n*(type==='week'?7:1));input.value=anchor;refresh();};
  const measures=h('div',{class:'seg'},['count','minutes'].map((value,i)=>h('button',{type:'button',class:metric===value?'on':'',onclick:()=>{metric=value;refresh();}},['按记录次数','按已记录时长'][i])));
  controls.append(periods,h('div',{class:'repair-date-row'},h('button',{class:'btn btn-ghost','aria-label':'上一个时间段',onclick:()=>move(-1)},'‹'),input,h('button',{class:'btn btn-ghost','aria-label':'下一个时间段',onclick:()=>move(1)},'›')),measures);
  async function refresh() {
    const ticket=++sequence;
    [...periods.children].forEach((b,i)=>b.classList.toggle('on',['day','week','month'][i]===type));
    [...measures.children].forEach((b,i)=>b.classList.toggle('on',['count','minutes'][i]===metric));
    try {
      const source=await loadAnalyticsSource();if(ticket!==sequence)return;
      const data=aggregatePeriod(source,type,anchor), heat=aggregatePeriod(source,'month',anchor);
      body.replaceChildren();
      const summary=h('div',{class:'card'},h('div',{class:'card-title'},'生活统计'),h('p',{class:'repair-caption'},data.range.label),
        h('div',{class:'repair-metrics'},metricTile(data.recordDays,'记录日'),metricTile(data.completedCount,'完成事项'),metricTile(formatMin(data.focusMin),'有效专注'),metricTile(data.badgeCount,'新徽章')),
        h('p',{class:'repair-caption'},'记录日按内容日期统计；摸宠物和兑换不计入。完成事项含任务、习惯、快捷记录和清单。'),
        h('button',{class:'btn btn-soft',onclick:()=>openSharePanel({type,dateKey:anchor})},'生成这段时间的分享卡'));
      const merged=h('section',{class:'data-merged-stack'},summary,donut(data,metric),trend(data,metric),heatmap(heat));body.append(merged);
    } catch(error) {
      if(ticket!==sequence)return;
      body.replaceChildren(h('div',{class:'card'},h('p',null,'统计加载失败，请重试。'),h('button',{class:'btn btn-primary',onclick:refresh},'重试')));
      console.error(error);
    }
  }
  await refresh();
}
function metricTile(value,label){return h('div',null,h('strong',null,String(value)),h('span',null,label));}
const formatMin=n=>`${Math.round(n*10)/10} 分钟`;
function donut(data,metric){
  const count=metric==='count',values=data.categories.filter(c=>c[metric]>0),total=values.reduce((n,c)=>n+c[metric],0);
  const card=h('div',{class:'card'},h('div',{class:'card-title'},count?'生活分类 · 记录次数':'生活分类 · 已记录时长'));
  if(!total){card.append(h('div',{class:'empty'},count?'这段时间还没有生活记录。':'没有填写时长的记录不会被换算成分钟。'));return card;}
  const circle=2*Math.PI*70;let offset=0;
  const svg=h('svg',{viewBox:'0 0 220 220',width:220,height:220,role:'img','aria-label':`分类分布：总计 ${total} ${count?'条':'分钟'}`,class:'repair-donut'});
  svg.append(h('circle',{cx:110,cy:110,r:70,fill:'none',stroke:'var(--surface2)','stroke-width':27}));
  for(const v of values){const length=v[metric]/total*circle;svg.append(h('circle',{cx:110,cy:110,r:70,fill:'none',stroke:catColor(v.id),'stroke-width':27,'stroke-dasharray':`${length} ${circle-length}`,'stroke-dashoffset':-offset,transform:'rotate(-90 110 110)'}));offset+=length;}
  const number=h('text',{x:110,y:106,'text-anchor':'middle',class:'repair-chart-total'},String(Math.round(total*10)/10));
  const label=h('text',{x:110,y:130,'text-anchor':'middle',class:'repair-chart-label'},count?'条记录':'分钟');svg.append(number,label);card.append(svg);
  for(const v of values)card.append(h('button',{class:'repair-legend',onclick:()=>{number.textContent=String(Math.round(v[metric]*10)/10);label.textContent=catName(v.id);}},h('i',{style:`background:${catColor(v.id)}`}),h('span',null,catName(v.id)),h('b',null,`${Math.round(v[metric]*10)/10}${count?'次':'分'} · ${(v[metric]/total*100).toFixed(1)}%`)));
  card.append(h('p',{class:'repair-caption'},'点击分类查看对应数值。未填写分类的记录归入“其他”。'));return card;
}
function trend(data,metric){
  const values=metric==='count'?data.dayCounts:data.dayMinutes, unit=metric==='count'?'条':'分', max=Math.max(1,...Object.values(values));
  const out=h('output',{class:'repair-caption','aria-live':'polite'},'点击柱形查看当天明细');
  const dense=data.range.days.length>14;
  const chart=h('div',{class:'repair-bars'+(dense?' dense':''),style:`--columns:${data.range.days.length}`});
  data.range.days.forEach((d,index)=>{const value=values[d]||0;const show=!dense||index===0||index===data.range.days.length-1||index%5===4;chart.append(h('button',{class:'repair-bar',title:`${d}：${value}${unit}`,'aria-label':`${d} ${value}${unit}`,onclick:()=>{out.textContent=`${d}：${value}${unit}`;}},h('span',{class:'repair-bar-area'},h('i',{style:`height:${value/max*100}%`})),h('small',null,show?d.slice(8):''),h('small',{class:'repair-bar-value'},dense?'':String(Math.round(value*10)/10))));});
  return h('div',{class:'card'},h('div',{class:'card-title'},'所选时间段 · 每日趋势'),h('div',{class:'repair-chart-scroll'},chart),out);
}
function heatmap(data){
  const grid=h('div',{class:'repair-heat'}),out=h('output',{class:'repair-caption','aria-live':'polite'},'点击日期查看记录数');
  const first=new Date(`${data.range.start}T12:00:00`).getDay();const lead=(first+6)%7;
  for(const day of ['一','二','三','四','五','六','日'])grid.append(h('span',{class:'repair-heat-label'},day));
  for(let i=0;i<lead;i++)grid.append(h('span'));
  for(const d of data.range.days){const n=data.dayCounts[d]||0,level=n===0?0:n<3?1:n<6?2:3;grid.append(h('button',{class:`repair-heat-cell level-${level}`,'aria-label':`${d} ${n}条记录`,onclick:()=>out.textContent=`${d}：${n}条生活记录`},String(Number(d.slice(8)))));}
  return h('div',{class:'card'},h('div',{class:'card-title'},`${data.range.start.slice(0,7)} · 记录日历`),grid,out,h('p',{class:'repair-caption'},'颜色表示记录数：0、1–2、3–5、6条及以上。补记日期不代表当天实际打开过应用。'));
}
