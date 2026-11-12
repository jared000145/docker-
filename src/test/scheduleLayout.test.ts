import {expect,it} from 'vitest';
import {layoutScheduleDay,scheduleDayKey,projectScheduleWeek,scheduleTimestamp,scheduleInputTimestamp,intersectsScheduleRange,editableScheduleOccurrences} from '@/lib/scheduleLayout';
const event=(id:string,start:string,end:string)=>({id,start_time:`2026-11-09T${start}:00+01:00`,end_time:`2026-11-09T${end}:00+01:00`});
it('places half-hour sessions at their actual minute',()=>{
 const [item]=layoutScheduleDay([event('a','08:30','10:15')],'2026-11-09');
 expect(item.start).toBe(510);expect(item.end).toBe(615);
});
it('keeps every overlapping session and allocates separate columns',()=>{
 const items=layoutScheduleDay([event('a','08:00','10:00'),event('b','09:00','11:00'),event('c','10:00','12:00')],'2026-11-09');
 expect(items).toHaveLength(3);expect(items.map(item=>item.columns)).toEqual([2,2,2]);expect(items[0].column).not.toBe(items[1].column);expect(items[2].column).toBe(items[0].column);
});
it('uses the institution clock regardless of the viewer time zone',()=>{
 expect(scheduleDayKey('2026-11-08T23:30:00Z')).toBe('2026-11-09');
 const [item]=layoutScheduleDay([{id:'night',start_time:'2026-11-08T23:30:00Z',end_time:'2026-11-09T00:30:00Z'}],'2026-11-09');expect(item.start).toBe(30);
});
it('clips an overnight session and does not invent a midnight session on the following day',()=>{
 const overnight={id:'a',start_time:'2026-11-09T23:00:00+01:00',end_time:'2026-11-10T01:00:00+01:00'};
 expect(layoutScheduleDay([overnight],'2026-11-09')[0]).toMatchObject({start:1380,end:1440});
 expect(layoutScheduleDay([overnight],'2026-11-10')[0]).toMatchObject({start:0,end:60});
 expect(layoutScheduleDay([{...overnight,end_time:'2026-11-10T00:00:00+01:00'}],'2026-11-10')).toEqual([]);
});
it('rejects invalid and reversed intervals',()=>{
 expect(layoutScheduleDay([event('a','10:00','09:00'),{id:'b',start_time:'invalid',end_time:'invalid'}],'2026-11-09')).toEqual([]);
});
it('projects a weekly model in institution time without merging different classes',()=>{
 const events=[{...event('a','08:30','10:00'),classe_id:'class-a',subject_id:'s1'},{...event('b','08:30','10:00'),classe_id:'class-b',subject_id:'s1'},{...event('c','08:30','10:00'),classe_id:'class-a',subject_id:'s1'}];
 const projected=projectScheduleWeek(events,['2026-11-16']);expect(projected).toHaveLength(2);expect(projected[0].start_time).toBe('2026-11-16T08:30:00+01:00');expect(projected[0]._source_event.id).toBe('a');
});
it('saves the same institutional clock in summer and winter',()=>{
 expect(scheduleTimestamp('2026-07-15','08:30').toISOString()).toBe('2026-07-15T07:30:00.000Z');
 expect(scheduleInputTimestamp('2026-11-09T08:30').toISOString()).toBe('2026-11-09T07:30:00.000Z');
});
it('keeps invalid time inputs invalid rather than silently moving them to the next day',()=>{
 expect(Number.isNaN(scheduleTimestamp('2026-11-09','25:00').getTime())).toBe(true);
 expect(Number.isNaN(scheduleInputTimestamp('').getTime())).toBe(true);
});
it('includes Sunday sessions in the weekly range',()=>{
 expect(intersectsScheduleRange({id:'sunday',start_time:'2026-11-15T14:00:00+01:00',end_time:'2026-11-15T16:00:00+01:00'},'2026-11-09','2026-11-16')).toBe(true);
});
it('keeps sessions crossing into the week and excludes those ending exactly at the boundary',()=>{
 const event={id:'night',start_time:'2026-11-08T23:00:00+01:00',end_time:'2026-11-09T01:00:00+01:00'};
 expect(intersectsScheduleRange(event,'2026-11-09','2026-11-16')).toBe(true);
 expect(intersectsScheduleRange({...event,end_time:'2026-11-09T00:00:00+01:00'},'2026-11-09','2026-11-16')).toBe(false);
});
it('restricts series edits to the selected cohort and never groups unrelated lessons by their subject alone',()=>{
 const first={...event('a','08:30','10:00'),recurrence_group_id:'series-a',classe_id:'class-a',level:'L1'};
 const next={...first,id:'b',start_time:'2026-11-16T08:30:00+01:00',end_time:'2026-11-16T10:00:00+01:00'};
 const differentClass={...first,id:'c',classe_id:'class-b'},differentSeries={...first,id:'d',recurrence_group_id:'series-b'};
 expect(editableScheduleOccurrences(first,[first,next,differentClass,differentSeries]).map(item=>item.id)).toEqual(['a','b']);
 const oneOff={...first,recurrence_group_id:null};expect(editableScheduleOccurrences(oneOff,[oneOff,{...oneOff,id:'other'}])).toEqual([oneOff]);
});
