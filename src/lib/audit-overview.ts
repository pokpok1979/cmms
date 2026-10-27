export type AuditDay = { date:string; activities:number; logins:number; users:number };
export type AuditOverviewData = {
  days:AuditDay[];
  modules:{module:string;count:number}[];
  refreshedAt:string;
  todayActivities:number;
  todayUsers:number;
  loginsWeek:number;
  total:number;
  changePercent:number|null;
};
export function auditOverviewWindow(now:Date, endDate?:string|null) {
  const endDay=endDate || new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const startOfEndDay=new Date(endDay+"T00:00:00+07:00");
  const end=new Date(startOfEndDay.getTime()+86400000);
  const start=new Date(end.getTime()-14*86400000);
  const dates=Array.from({length:14},(_,i)=>new Date(start.getTime()+i*86400000+7*3600000).toISOString().slice(0,10));
  return {start,end,dates};
}
export function buildAuditOverview(dates:string[], daily:{_id:string;activities:number;logins:number;users:number;count:number}[], modules:{_id:string;count:number}[], refreshedAt:Date):AuditOverviewData {
  const days=dates.map(date=>{const found=daily.find(row=>row._id===date);return {date,activities:found?.activities || 0,logins:found?.logins || 0,users:found?.users || 0};});
  const latest=days.at(-1), previous=days.at(-2);
  return {
    days,modules:modules.map(row=>({module:row._id,count:row.count})),refreshedAt:refreshedAt.toISOString(),
    todayActivities:latest?.activities || 0,todayUsers:latest?.users || 0,
    loginsWeek:days.slice(-7).reduce((sum,row)=>sum+row.logins,0),
    total:daily.reduce((sum,row)=>sum+row.count,0),
    changePercent:previous?.activities ? ((latest?.activities || 0)-previous.activities)/previous.activities*100 : null,
  };
}