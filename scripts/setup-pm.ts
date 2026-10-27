import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
async function main(){const {db,connection}=await import('../src/lib/db');try{const d=await db();await d.collection('pmPlans').createIndex({active:1,nextDue:1});await d.collection('pmPlans').createIndex({companyId:1,siteId:1,createdAt:-1});await d.collection('pmOccurrences').createIndex({companyId:1,siteId:1,due:-1});await d.collection('pmOccurrences').createIndex({planId:1,due:1},{unique:true});console.log('PM indexes ready');}finally{await connection().close();}}
main().catch(e=>{console.error('Setup PM failed:',e instanceof Error?e.message:'unknown');process.exitCode=1;});
