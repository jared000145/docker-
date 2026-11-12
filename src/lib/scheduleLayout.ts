export const SCHEDULE_TIME_ZONE='Africa/Libreville';
export type TimedEvent={id:string;start_time:string;end_time:string};
export function scheduleParts(value:string,timeZone=SCHEDULE_TIME_ZONE){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
 const get=(name:string)=>parts.find(part=>part.type===name)?.value||'';
 return {day:`${get('year')}-${get('month')}-${get('day')}`,minute:Number(get('hour'))*60+Number(get('minute'))};
}
export const scheduleDayKey=(value:string)=>Number.isFinite(Date.parse(value))?scheduleParts(value).day:'';
export const clockLabel=(minute:number)=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
export function scheduleTimestamp(day:string,time:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return new Date(NaN);
 return new Date(`${day}T${time}:00+01:00`);
}
export const scheduleInputTimestamp=(value:string)=>scheduleTimestamp(value.slice(0,10),value.slice(11,16));
export function scheduleWallDate(value:string){const part=scheduleParts(value);return new Date(part.day+'T'+clockLabel(part.minute)+':00');}
export function intersectsScheduleRange(event:TimedEvent,firstDay:string,lastDayExclusive:string){
 const start=Date.parse(event.start_time),end=Date.parse(event.end_time);
 return end>start&&start<scheduleTimestamp(lastDayExclusive,'00:00').getTime()&&end>scheduleTimestamp(firstDay,'00:00').getTime();
}
type SeriesEvent=TimedEvent&{recurrence_group_id?:string|null;classe_id?:string|null;filiere_id?:string|null;level?:string|null};
export function editableScheduleOccurrences<T extends SeriesEvent>(event:T,events:T[]){
 if(!event.recurrence_group_id)return [event];
 const start=scheduleParts(event.start_time),weekday=new Date(start.day+'T12:00:00Z').getUTCDay();
 return events.filter(candidate=>{
  if(candidate.recurrence_group_id!==event.recurrence_group_id||(candidate.classe_id||null)!==(event.classe_id||null)||(candidate.filiere_id||null)!==(event.filiere_id||null)||(candidate.level||null)!==(event.level||null))return false;
  const other=scheduleParts(candidate.start_time);
  return other.minute===start.minute&&new Date(other.day+'T12:00:00Z').getUTCDay()===weekday;
 });
}
export function projectScheduleWeek<T extends TimedEvent>(events:T[],days:string[]){
 const seen=new Set<string>();
 return events.flatMap(event=>{
  if(!Number.isFinite(Date.parse(event.start_time))||!Number.isFinite(Date.parse(event.end_time)))return [];
  const start=scheduleParts(event.start_time),end=scheduleParts(event.end_time);
  const dayIndex=(new Date(start.day+'T12:00:00Z').getUTCDay()+6)%7;
  if(!days[dayIndex])return [];
  const details=event as T&{subject_id?:string;classe_id?:string;classroom_id?:string;title?:string;event_type?:string};
  const key=JSON.stringify([dayIndex,start.minute,end.minute,details.subject_id,details.classe_id,details.classroom_id,details.title,details.event_type]);
  if(seen.has(key))return [];seen.add(key);
  const delta=Math.round((Date.parse(end.day)-Date.parse(start.day))/86400000);
  const endDay=new Date(Date.parse(days[dayIndex])+delta*86400000).toISOString().slice(0,10);
  return [{...event,_source_event:event,start_time:`${days[dayIndex]}T${clockLabel(start.minute)}:00+01:00`,end_time:`${endDay}T${clockLabel(end.minute)}:00+01:00`}];
 });
}
export function layoutScheduleDay<T extends TimedEvent>(events:T[],day:string){
 const entries=events.flatMap(event=>{
  if(!Number.isFinite(Date.parse(event.start_time))||!Number.isFinite(Date.parse(event.end_time))||Date.parse(event.end_time)<=Date.parse(event.start_time))return [];
  const start=scheduleParts(event.start_time),end=scheduleParts(event.end_time);
  if(start.day>day||end.day<day||(end.day===day&&end.minute===0))return [];
  return [{event,start:start.day<day?0:start.minute,end:end.day>day?1440:end.minute,column:0,columns:1}];
 }).sort((a,b)=>a.start-b.start||b.end-a.end||a.event.id.localeCompare(b.event.id));
 let group:typeof entries=[];let ends:number[]=[];let groupEnd=-1;
 const finish=()=>{for(const item of group)item.columns=ends.length;group=[];ends=[];};
 for(const entry of entries){
  if(entry.start>=groupEnd){finish();groupEnd=-1;}
  let lane=ends.findIndex(end=>end<=entry.start);if(lane<0)lane=ends.length;
  ends[lane]=entry.end;entry.column=lane;group.push(entry);groupEnd=Math.max(groupEnd,entry.end);
 }
 finish();return entries;
}
