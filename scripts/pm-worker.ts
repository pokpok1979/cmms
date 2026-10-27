import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
async function main(){const {generatePM}=await import('../src/lib/pm-engine');const {connection}=await import('../src/lib/db');try{console.log(JSON.stringify(await generatePM()));}finally{await connection().close();}}
main().catch(e=>{console.error('PM worker failed:',e instanceof Error?e.message:'unknown');process.exitCode=1;});
