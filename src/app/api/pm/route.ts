import { POST as advancedPOST } from '../pm3/route';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { user,origin,ApiError } from '@/lib/auth';
import { db,tx,Row } from '@/lib/db';
import { scope,inScope,manager } from '@/lib/domain';
import { validDay,bangkokDay } from '@/lib/pm-calendar';
import { permitted } from '@/lib/permissions';
import { generatePM } from '@/lib/pm-engine';
export const runtime='nodejs';export const dynamic='force-dynamic';
const day=z.string().refine(s=>{try{return validDay(s);}catch{return false;}});
const plan=z.object({title:z.string().trim().min(1).max(200),assetId:z.string().min(1).max(100),assigneeId:z.string().min(1).max(100),start:day,unit:z.enum(['day','month']),interval:z.number().int().min(1).max(365),checklist:z.array(z.string().trim().min(1).max(300)).min(1).max(50)});
function fail(e:unknown){if(e instanceof ApiError)return NextResponse.json({error:e.message},{status:e.status});if(e instanceof z.ZodError||e instanceof SyntaxError)return NextResponse.json({error:'กรุณาตรวจสอบข้อมูล'},{status:400});console.error('[PM]',e instanceof Error?e.name:'unknown');return NextResponse.json({error:'ดำเนินการไม่สำเร็จ'},{status:500});}
export async function GET(req:Request){try{const u=await user(req),d=await db();const filter=scope(u);const [plans,jobs,assets,staff]=await Promise.all([d.collection<Row>('pmPlans').find(filter).sort({createdAt:-1}).limit(200).toArray(),d.collection<Row>('pmOccurrences').find({...filter,...(u.role==='technician'?{assigneeId:u._id}:{})}).sort({due:-1}).limit(500).toArray(),d.collection<Row>('assets').find({...filter,deletedAt:null},{projection:{name:1,code:1,companyId:1,siteId:1}}).limit(500).toArray(),manager(u)?d.collection<Row>('users').find({active:true,role:'technician'},{projection:{name:1,grants:1}}).limit(500).toArray():[]]);return NextResponse.json({plans,jobs,assets,staff:staff.filter(t=>t.grants?.some((g:{companyId:string;siteId:string})=>inScope(u,g))),canManage:manager(u),canCreate:manager(u)&&permitted(u,"pm","create"),canEdit:permitted(u,"pm","edit"),userId:u._id,today:bangkokDay()});}catch(e){return fail(e);}}
export async function POST(req:Request){try{const value=await req.clone().json();if(value.action==='create'){value.action='save';value.leadDays=3;}return advancedPOST(new Request(req,{body:JSON.stringify(value)}));}catch(e){return fail(e);}}
