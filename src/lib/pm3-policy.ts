import type { User } from './domain';
import { permitted, type PermissionAction } from './permissions';
import { ApiError } from './auth';
export function requirePMAccess(u:User,action:PermissionAction='view'){if(!permitted(u,'pm')||!permitted(u,'pm',action))throw new ApiError(403,'ไม่มีสิทธิ์ดำเนินการ PM');}
export function canCreateDefect(u:User){return permitted(u,'pm')&&permitted(u,'pm','edit')&&permitted(u,'repairRequests')&&permitted(u,'repairRequests','create');}
export function addDays(day:string,days:number){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function occurrenceId(planId:string,version:number,index:number){return version===0?`pm:${planId}:${index}`:`pm:${planId}:v${version}:${index}`;}
export function canRecordPM(u:User,job:{assigneeId:string;status:string}){return permitted(u,'pm')&&permitted(u,'pm','edit')&&u.role==='technician'&&u._id===job.assigneeId&&job.status==='pending';}
export function canSeePM(u:User,job:{assigneeId:string}){return permitted(u,'pm')&&(u.role!=='technician'||job.assigneeId===u._id);}
export function photoType(b:Uint8Array){if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';return null;}
export function onTime(job:{status:string;due:string;completedAt?:Date|string}){return job.status==='completed'&&!!job.completedAt&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(job.completedAt))<=job.due;}
export function plannedDays(plan:{start:string;unit:'day'|'month';interval:number;nextIndex?:number},from:string,to:string){const start=new Date(plan.start+'T00:00:00Z'),lower=new Date(from+'T00:00:00Z');let estimate=plan.unit==='day'?Math.floor((lower.getTime()-start.getTime())/86400000/plan.interval):Math.floor(((lower.getUTCFullYear()-start.getUTCFullYear())*12+lower.getUTCMonth()-start.getUTCMonth())/plan.interval);estimate=Math.max(plan.nextIndex||0,estimate-1,0);const days:string[]=[];for(let i=estimate,n=0;n<400;n++,i++){const due=calendarDay(plan.start,plan.unit,plan.interval,i);if(due>to)break;if(due>=from)days.push(due);}return days;}
import { cycleDay as calendarDay } from './pm-calendar';
