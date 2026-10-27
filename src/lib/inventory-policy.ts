import type { User } from './domain';
export const MAX_QUANTITY=1_000_000_000;
export const MAX_VALUE=9_000_000_000_000;
export function quantityMilli(input:string){if(!/^\d{1,7}(\.\d{1,3})?$/.test(input))throw new Error('จำนวนต้องเป็นตัวเลขทศนิยมไม่เกิน 3 ตำแหน่ง');const [a,b='']=input.split('.'),n=Number(a)*1000+Number(b.padEnd(3,'0'));if(n<=0||n>MAX_QUANTITY)throw new Error('จำนวนต้องมากกว่า 0 และไม่เกิน 1,000,000');return n;}
export function moneySatang(input:string){if(!/^\d{1,9}(\.\d{1,2})?$/.test(input))throw new Error('ราคาต้องเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่ง');const [a,b='']=input.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
function roundedRatio(value:number,n:number,d:number){if(![value,n,d].every(Number.isSafeInteger)||value<0||n<0||d<=0)throw new Error('ข้อมูลต้นทุนไม่ถูกต้อง');return Number((BigInt(value)*BigInt(n)+BigInt(Math.floor(d/2)))/BigInt(d));}
export function receiptValue(qtyMilli:number,unitSatang:number){return roundedRatio(unitSatang,qtyMilli,1000);}
export function issueValue(stockQty:number,stockValue:number,qty:number){if(qty<=0||qty>stockQty)throw new Error('อะไหล่คงเหลือไม่เพียงพอ');return qty===stockQty?stockValue:roundedRatio(stockValue,qty,stockQty);}
export function returnValue(issueQty:number,issueCost:number,returnedQty:number,returnedCost:number,qty:number){if(qty<=0||returnedQty+qty>issueQty)throw new Error('จำนวนคืนเกินจำนวนที่เบิก');const cumulative=returnedQty+qty===issueQty?issueCost:roundedRatio(issueCost,returnedQty+qty,issueQty);return cumulative-returnedCost;}
export function canIssue(u:User,wo:{status:string;assigneeIds:string[]}){return ['accepted','in_progress','waiting_parts','waiting_contractor'].includes(wo.status)&&(['admin','supervisor'].includes(u.role)||(u.role==='technician'&&wo.assigneeIds.includes(u._id)));}
export function lowStock(qty:number,reorder:number){return qty<=reorder;}
