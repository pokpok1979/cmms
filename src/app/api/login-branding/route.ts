import { NextResponse } from "next/server";
import { db,Row } from "@/lib/db";
import { loginCompanyName } from "@/lib/login-preferences";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() {
  try {
    const d=await db();
    const settings=await d.collection<Row>("systemSettings").findOne({companyNameTh:{$type:"string",$ne:""}},{projection:{_id:0,companyNameTh:1},sort:{updatedAt:-1,_id:1}});
    return NextResponse.json({companyNameTh:loginCompanyName(settings?.companyNameTh, "")},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({companyNameTh:""},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}