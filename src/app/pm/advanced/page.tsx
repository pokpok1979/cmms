import { redirect } from 'next/navigation';
export default async function Page({searchParams}:{searchParams:Promise<{job?:string|string[]}>}){const {job}=await searchParams;const params=new URLSearchParams({view:'pm'});if(typeof job==='string')params.set('job',job);redirect('/?'+params.toString());}
