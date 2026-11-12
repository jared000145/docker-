import {useMemo,useState} from 'react';
import {MapPin,User,Layers,CalendarDays} from 'lucide-react';
import {format} from 'date-fns';
import '@/styles/school-planner.css';
import {fr} from 'date-fns/locale';
import {layoutScheduleDay,scheduleDayKey,clockLabel} from '@/lib/scheduleLayout';
const eventColors:Record<string,{bg:string;border:string;text:string}>={cours:{bg:'bg-blue-50',border:'border-blue-500',text:'text-blue-800'},td:{bg:'bg-amber-50',border:'border-amber-500',text:'text-amber-900'},tp:{bg:'bg-emerald-50',border:'border-emerald-500',text:'text-emerald-900'},exam:{bg:'bg-violet-50',border:'border-violet-500',text:'text-violet-900'},rattrapage:{bg:'bg-rose-50',border:'border-rose-500',text:'text-rose-900'}};
interface Props{weekDays:Date[];weekEvents:any[];allEvents:any[];onEventClick?:(event:any)=>void;showFiliere?:boolean;showProfessor?:boolean;template?:boolean}
export default function ScheduleWeeklyGrid({weekDays,weekEvents,allEvents,onEventClick,showFiliere=false,showProfessor=true,template=false}:Props){
 const [relief,setRelief]=useState(false);
 const days=useMemo(()=>weekDays.map(day=>({date:day,key:format(day,'yyyy-MM-dd'),items:layoutScheduleDay(weekEvents,format(day,'yyyy-MM-dd'))})).filter(day=>day.date.getDay()!==0||day.items.length>0),[weekDays,weekEvents]);
 const entries=days.flatMap(day=>day.items);
 const start=Math.max(0,Math.floor(Math.min(480,...entries.map(item=>item.start))/60)*60);
 const end=Math.min(1440,Math.ceil(Math.max(1080,...entries.map(item=>item.end))/60)*60);
 const hours=Array.from({length:(end-start)/60+1},(_,index)=>start+index*60);
 const today=template?'':scheduleDayKey(new Date().toISOString());
 const sessionCount=(event:any)=>allEvents.filter(item=>event.recurrence_group_id?item.recurrence_group_id===event.recurrence_group_id:item.id===event.id).length;
 const eventContent=(item:typeof entries[number])=>{const event=item.event;return <><span className="schedule-event-time">{clockLabel(item.start)} – {clockLabel(item.end)}</span><strong>{event.title}</strong>{showProfessor&&event.subjects?.professor&&<span className="schedule-event-meta"><User/>{event.subjects.professor}</span>}{showFiliere&&event.filieres?.name&&<span className="schedule-event-meta">{event.filieres.name} · {event.level}</span>}{event.location&&<span className="schedule-event-meta"><MapPin/>{event.location}</span>}{sessionCount(event)>1&&<span className="schedule-event-meta"><Layers/>{sessionCount(event)} séances</span>}</>;};
 return <section className={`schedule-board ${relief?'schedule-relief':''}`} aria-label="Emploi du temps hebdomadaire">
  <div className="schedule-board-toolbar"><div><span className="flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5 text-primary"/>{template?'Semaine type':'Vue de la semaine'}</span><p className="text-xs text-muted-foreground mt-1">Heure de Libreville (UTC+1) · sélectionnez une séance pour ses détails</p></div><button type="button" className="schedule-relief-toggle" aria-pressed={relief} onClick={()=>setRelief(value=>!value)}><Layers className="h-4 w-4"/>Relief {relief?'activé':'désactivé'}</button></div>
  <div className="schedule-legend">{Object.entries(eventColors).map(([kind,color])=><span key={kind}><i className={color.bg+' '+color.border}/>{({cours:'Cours',td:'TD',tp:'TP',exam:'Examen',rattrapage:'Rattrapage'} as Record<string,string>)[kind]}</span>)}</div>
  {entries.length===0&&<p className="schedule-empty" role="status">Aucune séance pour cette semaine et ces filtres.</p>}
  <div className="schedule-desktop" tabIndex={0} role="region" aria-label="Grille de la semaine, défilement horizontal et vertical"><div className="schedule-timeline" style={{gridTemplateColumns:`60px repeat(${days.length},minmax(130px,1fr))`}}><div className="schedule-time-heading">Heure</div>{days.map(day=><div key={day.key} className={`schedule-day-heading ${day.key===today?'schedule-today':''}`}><span>{format(day.date,'EEEE',{locale:fr})}</span>{!template&&<><strong>{format(day.date,'dd')}</strong><small>{format(day.date,'MMM',{locale:fr})}</small></>}</div>)}
   <div className="schedule-time-axis" style={{height:(end-start)*1.1}}>{hours.map(hour=><span key={hour} style={{top:(hour-start)*1.1}}>{clockLabel(hour)}</span>)}</div>
   {days.map(day=><div key={day.key} className={`schedule-day-lane ${day.key===today?'schedule-today':''}`} style={{height:(end-start)*1.1}}>{hours.map(hour=><div key={hour} className="schedule-hour-line" style={{top:(hour-start)*1.1}}/>)}{day.items.map(item=>{const color=eventColors[item.event.event_type]||eventColors.cours;return <button type="button" key={item.event.id} disabled={!onEventClick} aria-label={`${item.event.title}, ${clockLabel(item.start)} à ${clockLabel(item.end)}`} title={`${item.event.title} · ${clockLabel(item.start)} – ${clockLabel(item.end)}${item.event.location?' · '+item.event.location:''}`} onClick={()=>onEventClick?.(item.event)} className={`schedule-event ${color.bg} ${color.border} ${color.text}`} style={{top:(item.start-start)*1.1+2,height:Math.max(18,(item.end-item.start)*1.1-4),left:`calc(${item.column/item.columns*100}% + 3px)`,width:`calc(${100/item.columns}% - 6px)`}}>{eventContent(item)}</button>;})}</div>)}
  </div></div>
  <div className="schedule-mobile-agenda">{days.map(day=><section key={day.key}><h3 className={day.key===today?'text-primary':''}>{format(day.date,template?'EEEE':'EEEE d MMMM',{locale:fr})}</h3>{day.items.length===0?<p className="text-sm text-muted-foreground">Aucune séance</p>:day.items.map(item=>{const color=eventColors[item.event.event_type]||eventColors.cours;return <button type="button" key={item.event.id} disabled={!onEventClick} onClick={()=>onEventClick?.(item.event)} className={`schedule-agenda-event ${color.bg} ${color.border} ${color.text}`}>{eventContent(item)}</button>;})}</section>)}</div>
 </section>;
}
export {eventColors};
