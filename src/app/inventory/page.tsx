import { user } from '@/lib/auth';
import { requireInventory } from '@/lib/inventory-service';
import Workspace from './Workspace';
export const dynamic='force-dynamic';
export default async function Page(){try{const u=await user();requireInventory(u);}catch{return <main style={{padding:32}}>กรุณาเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์คลังอะไหล่ <a href="/">กลับหน้าหลัก</a></main>;}return <Workspace/>;}
