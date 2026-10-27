import { NextResponse } from 'next/server';
import { z } from 'zod';
import { user,origin,ApiError } from '@/lib/auth';
import { db,Row } from '@/lib/db';
import { scope,manager,inScope } from '@/lib/domain';
import { bangkokDay } from '@/lib/pm-calendar';
import { permitted } from '@/lib/permissions';
import { addDays,plannedDays,requirePMAccess } from '@/lib/pm3-policy';
import { querySchema,scopedJob,savePlan,togglePlan,completePM,defectRequest,report,jobFilter } from '@/lib/pm3-service';
import { generatePM3 } from '@/lib/pm3-engine';
import { pmWorkbook } from '@/lib/pm3-xlsx';
export const runtime='nodejs';export const dynamic='force-dynamic';
function failure(e:unknown){if(e instanceof ApiError)return NextResponse.json({error:e.message},{status:e.status});if(e instanceof z.ZodError||e instanceof SyntaxError)return NextResponse.json({error:'กรุณาตรวจสอบข้อมูลและช่วงวันที่ (ไม่เกิน 366 วัน)'},{status:400});console.error('[PM3]',e instanceof Error?e.name:'unknown');return NextResponse.json({error:'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'},{status:500});}
export async function GET(req:Request){try{const u=await user(req);requirePMAccess(u);const d=await db(),url=new URL(req.url),mode=url.searchParams.get('mode')||'report';
 if(mode==='lookups'){const [plans,assets,staff]=await Promise.all([d.collection<Row>('pmPlans').find(scope(u)).sort({createdAt:-1}).limit(500).toArray(),d.collection<Row>('assets').find({...scope(u),deletedAt:null},{projection:{name:1,code:1,companyId:1,siteId:1}}).limit(1000).toArray(),manager(u)?d.collection<Row>('users').find({active:true,role:'technician'},{projection:{name:1,grants:1}}).limit(1000).toArray():[]]);return NextResponse.json({plans,assets,staff:staff.filter(t=>t.grants?.some((g:{companyId:string;siteId:string})=>inScope(u,g))).map(t=>({_id:t._id,name:t.name})),canManage:manager(u),canCreate:manager(u)&&permitted(u,'pm','create'),canEdit:permitted(u,'pm','edit'),canDefect:permitted(u,'pm','edit')&&permitted(u,'repairRequests')&&permitted(u,'repairRequests','create'),activePlans:await d.collection<Row>('pmPlans').countDocuments({...scope(u),active:true}),storageReady:['R2_ENDPOINT','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'].every(k=>!!process.env[k]),userId:u._id,role:u.role,today:bangkokDay()});}
 if(mode==='history'){if(!manager(u))throw new ApiError(403,'ไม่มีสิทธิ์');const id=z.string().min(1).max(100).parse(url.searchParams.get('id'));if(!await d.collection<Row>('pmPlans').findOne({_id:id,...scope(u)}))throw new ApiError(404,'ไม่พบแผน');const versions=await d.collection<Row>('pmPlanVersions').find({planId:id,...scope(u)}).sort({version:-1}).limit(100).toArray();return NextResponse.json({versions});}
 if(mode==='job'){const id=z.string().min(1).max(200).parse(url.searchParams.get('id'));return NextResponse.json({job:await scopedJob(u,id),photos:await d.collection<Row>('pmPhotos').find({jobId:id,...scope(u)},{projection:{key:0}}).sort({at:1}).toArray()});}
 const q=querySchema.parse({from:url.searchParams.get('from')||addDays(bangkokDay(),-30),to:url.searchParams.get('to')||addDays(bangkokDay(),30),q:url.searchParams.get('q')||'',status:url.searchParams.get('status')||'all',page:url.searchParams.get('page')||1});
 if(mode==='calendar'){const jobs=await d.collection<Row>('pmOccurrences').find(jobFilter(u,q),{projection:{title:1,assetName:1,due:1,status:1,planId:1}}).sort({due:1}).limit(2001).toArray();if(jobs.length>2000)throw new ApiError(400,'ปฏิทินเกิน 2,000 งาน กรุณากรองชื่อแผน');
 const projected:Row[]=[];
 if(q.status==='all'||q.status==='pending'){
 const plans=await d.collection<Row>('pmPlans').find({...scope(u),active:true,...(u.role==='technician'?{assigneeId:u._id}:{})}).limit(501).toArray();if(plans.length>500)throw new ApiError(400,'ปฏิทินรองรับสูงสุด 500 แผนต่อพื้นที่ที่มีสิทธิ์');
 const seen=new Set(jobs.map(j=>j.planId+':'+j.due));
 for(const p of plans){if(q.q&&!`${p.title} ${p.assetName}`.toLowerCase().includes(q.q.toLowerCase()))continue;
 for(const due of plannedDays({start:p.start,unit:p.unit,interval:p.interval,nextIndex:p.nextIndex},q.from,q.to)){if(!seen.has(p._id+':'+due))projected.push({_id:`planned:${p._id}:${due}`,title:p.title,assetName:p.assetName,due,status:'planned',projected:true});}}
 }
 if(jobs.length+projected.length>2000)throw new ApiError(400,'ปฏิทินเกิน 2,000 งาน กรุณากรองชื่อแผน');return NextResponse.json({jobs:[...jobs,...projected]});}
 if(mode==='export'){const {jobs}=await report(u,q,true);const file=pmWorkbook([['ชื่องาน','ทรัพย์สิน','วันครบกำหนด','สถานะ','ผลตรวจ','วันที่เสร็จ (เวลาไทย)','หมายเหตุ','เลขใบแจ้งซ่อม','ผ่าน (ข้อ)','ไม่ผ่าน (ข้อ)'],...jobs.map(j=>[String(j.title),String(j.assetName),String(j.due),j.status==='completed'?'เสร็จสิ้น':'รอดำเนินการ',j.results?j.results.includes('fail')?'พบข้อบกพร่อง':'ผ่าน':'ยังไม่ตรวจ',j.completedAt?new Date(j.completedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'',String(j.note||''),String(j.defectRequestNumber||''),(j.results||[]).filter((r:string)=>r==='pass').length,(j.results||[]).filter((r:string)=>r==='fail').length])]);return new Response(new Uint8Array(file),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="CMMS_PM_Report.xlsx"','Cache-Control':'no-store'}});}
 if(mode!=='report')throw new ApiError(400,'คำสั่งไม่ถูกต้อง');return NextResponse.json(await report(u,q));}catch(e){return failure(e);}}
export async function POST(req:Request){try{origin(req);const u=await user(req);requirePMAccess(u);const v=await req.json();
 const id=()=>z.string().min(1).max(200).parse(v.id);
 if(v.action==='save')return NextResponse.json(await savePlan(u,v,v.id?z.string().min(1).max(100).parse(v.id):undefined,v.id?z.number().int().nonnegative().parse(v.version):undefined));
 if(v.action==='toggle')return NextResponse.json(await togglePlan(u,id(),z.boolean().parse(v.active)));
 if(v.action==='generate'){if(!manager(u))throw new ApiError(403,'ไม่มีสิทธิ์');return NextResponse.json(await generatePM3(new Date(),scope(u)));}
 if(v.action==='complete')return NextResponse.json(await completePM(u,id(),z.array(z.enum(['pass','fail'])).min(1).max(50).parse(v.results),z.string().trim().max(3000).parse(v.note)));
 if(v.action==='defect')return NextResponse.json(await defectRequest(u,id(),z.object({description:z.string().trim().min(1).max(2000),priority:z.enum(['normal','high','urgent']),contact:z.string().trim().min(1).max(200),department:z.string().trim().min(1).max(200)}).parse(v)));
 throw new ApiError(400,'คำสั่งไม่ถูกต้อง');}catch(e){return failure(e);}}
