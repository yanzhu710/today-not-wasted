// Shared actual-time range fields for records. Planning estimates intentionally do not use this.
import { h } from '../core/util.js';

function pad(n){ return String(n).padStart(2,'0'); }
export function nowTimeValue(date = new Date()){ return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
export function minutesBetween(start, end){
  if(!/^\d{2}:\d{2}$/.test(start||'') || !/^\d{2}:\d{2}$/.test(end||'')) return null;
  const [sh,sm]=start.split(':').map(Number), [eh,em]=end.split(':').map(Number);
  let a=sh*60+sm, b=eh*60+em;
  if(b<a) b+=24*60; // permit an overnight record; it still belongs to its start date.
  const diff=b-a;
  return diff>0 && diff<=24*60 ? diff : null;
}
export function timeRangeField({ start='', end='', optional=true, label='实际时间' } = {}){
  const startInput=h('input',{class:'input time-range-input',type:'time',value:start||'',step:'60','aria-label':'开始时间'});
  const endInput=h('input',{class:'input time-range-input',type:'time',value:end||'',step:'60','aria-label':'结束时间'});
  const hint=h('span',{class:'form-hint time-range-hint'},optional?'可选；填写起点和终点后自动计算时长':'请填写开始和结束时间');
  const update=()=>{
    if(!startInput.value && !endInput.value){hint.textContent=optional?'可选；填写起点和终点后自动计算时长':'';return;}
    const min=minutesBetween(startInput.value,endInput.value);
    hint.textContent=min?`自动计算 ${min} 分钟${endInput.value<startInput.value?' · 跨到次日':''}`:'开始和结束时间需要同时填写，且不能相同';
  };
  startInput.addEventListener('input',update); endInput.addEventListener('input',update); update();
  const root=h('div',{class:'form-item time-range-field'},h('span',{class:'form-label'},label),h('div',{class:'time-range-row'},h('label',null,h('span',null,'开始'),startInput),h('span',{class:'time-range-arrow','aria-hidden':'true'},'→'),h('label',null,h('span',null,'结束'),endInput)),hint);
  return {root,startInput,endInput,get(){const s=startInput.value,e=endInput.value;if(!s&&!e)return {startTime:null,endTime:null,minutes:null,ok:optional};const minutes=minutesBetween(s,e);return {startTime:s||null,endTime:e||null,minutes,ok:!!minutes};}};
}
