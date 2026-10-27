export type Part={_id:string;companyId:string;siteId:string;code:string;name:string;unit:string;bin:string;qtyMilli:number;valueSatang:number;reorderMilli:number;active:boolean;revision:number;hasMovements?:boolean};
export type Order={_id:string;number:string;title:string;companyId:string;siteId:string;costSatang?:number;partsCostSatang?:number;status:string};
export type Movement={_id:string;number:string;kind:'receipt'|'issue'|'return';partId:string;partCode:string;partName:string;unit:string;qtyMilli:number;deltaQtyMilli:number;deltaValueSatang:number;costSatang:number;returnedQtyMilli:number;workOrderNumber?:string;note:string;actorName:string;at:string};
export type Lookups={sites:{_id:string;companyId:string;siteId:string;name:string}[];parts:Part[];orders:Order[];canManage:boolean;canCreate:boolean;canPost:boolean;userId:string;today:string};
export type Listing={items:(Part&Movement&Order)[];total:number;page:number;totals:{parts:number;valueSatang:number;low:number}};
export const qty=(n:number)=>(n/1000).toLocaleString('th-TH',{maximumFractionDigits:3});
export const money=(n:number)=>(n/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export function newKey(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
