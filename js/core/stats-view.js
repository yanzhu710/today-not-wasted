import { h, todayKey, addDaysKey, addMonthsKey, weekdayOf } from './util.js';
import { catColor } from './catalog.js';
import { loadRecordSource, summarizeRecords, isDateKey } from './record-summary.js';
import { openSharePanel } from './share.js';
let state={type:'week',anchor:todayKey(),unit:'count'};
export async function renderStatsView(box) {
  const source=await loadRecordSource();
  const wrapper=h('div');box.replaceChildren(wrapper);
  function draw(){
    const s=summarizeRecords(source,state.type,state.anchor);wrapper.replaceChildren();
    const range=h('div',{class:'repair-range'},h('button',{class:'btn btn-ghost btn-sm',onclick:()=>move(-1)},'上一段'),
      h('b',null,s.range.start===s.range.end?s.range.start:`${s.range.start} — ${s.range.end}`),
      h('button',{class:'btn btn-ghost btn-sm',onclick:()=>move(1)},'下一段'));
    const modes=h('div',{class:'repair-seg'},[['day','日'],['week','周'],['month','月']].map(([id,n])=>h('button',{class:state.type===id?'on':'',onclick:()=>{state.type=id;draw();}},n)));
    const date=h('input',{class:'input',type:'date',value:state.anchor,'aria-label':'统计日期',onchange:e=>{if(isDateKey(e.target.value)){state.anchor=e.target.value;draw();}}});
    const overview=h('div',{class:'card'},h('div',{class:'card-title'},'生活统计'),modes,range,date,
      h('div',{class:'stat-row',style:'flex-wrap:wrap;margin-top:12px'},[
        [s.recordDays,'记录日'],[s.completedCount,'完成事项'],[Math.round(s.focusMin)+' 分','有效专注'],[s.badgeCount,'新徽章']
      ].map(([v,n])=>h('div',{class:'stat-cell'},h('div',{class:'v num'},v),h('div',{class:'k'},n)))),
      h('div',{class:'form-hint'},'记录日按内容日期计算；摸宠物、兑换不计入生活记录。实际保存日：'+s.actualSaveDays+' 天。'));
    const donut=h('div',{class:'card'},h('div',{class:'card-title'},'生活分类分布'));
    donut.append(h('div',{class:'repair-seg'},[['count','按次数'],['minutes','按记录时长']].map(([id,n])=>h('button',{class:state.unit===id?'on':'',onclick:()=>{state.unit=id;draw();}},n))));
    const field=state.unit, total=s.categories.reduce((v,c)=>v+c[field],0);
    const detail=h('div',{class:'form-hint',role:'status','aria-live':'polite'});
    if(!total)donut.append(h('div',{class:'empty'},field==='minutes'?'这段时间没有带时长的记录':'这段时间还没有记录'));
    else {
      const circumference=2*Math.PI*76;let offset=0;
      const rings=s.categories.filter(c=>c[field]>0).map(cat=>{
        const span=circumference*cat[field]/total;
        const arc=h('circle',{cx:110,cy:110,r:76,fill:'none',stroke:catColor(cat.id),'stroke-width':28,
          'stroke-dasharray':`${span} ${circumference-span}`,'stroke-dashoffset':-offset,transform:'rotate(-90 110 110)',
          role:'button',tabindex:0,'aria-label':`${cat.name} ${cat[field]} ${field==='minutes'?'分钟':'次'}`,
          onclick:()=>{detail.textContent=`${cat.name}：${cat[field]} ${field==='minutes'?'分钟':'次'}`;},
          onkeydown:e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();detail.textContent=`${cat.name}：${cat[field]}`;}}});
        offset+=span;return arc;
      });
      donut.append(h('svg',{viewBox:'0 0 220 220',class:'repair-stat-svg',role:'img','aria-label':'生活分类分布环形图'},rings,
        h('text',{x:110,y:110,'text-anchor':'middle',fill:'var(--text)','font-size':26,'font-weight':700},Math.round(total)),
        h('text',{x:110,y:133,'text-anchor':'middle',fill:'var(--muted)','font-size':12},field==='minutes'?'记录分钟':'条分类记录')));
      for(const cat of s.categories.filter(c=>c[field]>0))donut.append(h('div',{class:'row-item'},h('span',{class:'dot',style:`background:${catColor(cat.id)}`}),
        h('span',{class:'row-main'},cat.name),h('span',{class:'row-sub'},`${Math.round(cat[field]*10)/10}${field==='minutes'?'分钟':'次'} · ${Math.round(cat[field]/total*100)}%`)));
      donut.append(detail);
    }
    if(field==='minutes')donut.append(h('div',{class:'form-hint'},'时长来自记录填写值与有效专注，可能含重叠，不等于实际作息。无时长的记录不参与占比。'));
    const trend=h('div',{class:'card'},h('div',{class:'card-title'},'所选范围记录趋势'));
    const plot=h('div',{class:'repair-trend'}), max=Math.max(1,...Object.values(s.dayCounts));
    const plotDetail=h('div',{class:'form-hint',role:'status'});
    for(const [d,v] of Object.entries(s.dayCounts))plot.append(h('button',{'aria-label':`${d} ${v}条记录`,onclick:()=>{plotDetail.textContent=`${d}：${v}条记录`; }},
      h('span',{class:'plot'},h('i',{class:'bar-item',style:`height:${v/max*80}px`})),h('span',null,d.slice(5)),h('div',null,v)));
    trend.append(plot,plotDetail);
    const recent=summarizeRecords(source,'month',state.anchor); // 热力格明确标注自然月，不与趋势偷换时间段。
    const heat=h('div',{class:'card'},h('div',{class:'card-title'},state.anchor.slice(0,7)+' 记录日历'));
    const grid=h('div',{class:'repair-heat'}), heatDetail=h('div',{class:'form-hint',role:'status'},'点击日期查看数量；数字为记录条数。');
    for(const label of ['一','二','三','四','五','六','日']) grid.append(h('span',{class:'heat-weekday'},label));
    for(let pad=1;pad<weekdayOf(recent.range.start);pad++) grid.append(h('span',{'aria-hidden':'true'}));
    for(const [d,v] of Object.entries(recent.dayCounts))grid.append(h('button',{style:`background:${v?'var(--primary-soft)':'var(--surface2)'}`,
      title:`${d}：${v}条`, 'aria-label':`${d}：${v}条`,onclick:()=>{heatDetail.textContent=`${d}：${v}条有效记录`;}},Number(d.slice(-2)),h('small',{style:'display:block'},v)));
    heat.append(grid,heatDetail);
    wrapper.append(overview,donut,trend,heat,h('button',{class:'btn btn-primary btn-block',onclick:()=>openSharePanel({type:state.type,dateKey:state.anchor})},'生成这段时间的分享卡'));
  }
  function move(n){state.anchor=state.type==='month'?addMonthsKey(state.anchor,n):addDaysKey(state.anchor,n*(state.type==='week'?7:1));draw();}
  draw();
}
