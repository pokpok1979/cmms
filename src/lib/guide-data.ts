import type { Role, User } from "./domain";
import { permitted, type PermissionAction } from "./permissions";
export const guideViews=["inventory","pm","dashboard","new","repairRequests","workOrders","assets","locations","notifications","profile","users","roles","ldap","smtp","auditLogs","settings","workTypes","companies","sites","guide","flow"] as const;
export type GuideView=typeof guideViews[number];
export function guideCanOpen(role:Role,view:string) {
  if(!guideViews.includes(view as GuideView))return false;
  if(["users","roles","ldap","smtp","auditLogs","settings","workTypes","companies","sites"].includes(view))return role==="admin";
  if(view==="inventory")return role!=="requester";
  if(view==="pm")return role!=="requester";
  if(view==="locations")return role==="admin";
  if(view==="new")return role!=="executive";
  return true;
}
export type GuideStep={label:string;description:string;view:GuideView;filter?:string;roles?:Role[];action?:PermissionAction};
export function guideCanUseStep(role:Role,step:GuideStep){return guideCanOpen(role,step.view)&&(!step.roles||step.roles.includes(role));}
export function guideLinkAllowed(user:User,view:GuideView,action:PermissionAction='view') {
  const module=view==='new'?'repairRequests':view==='roles'?'users':view;
  return guideCanOpen(user.role,view) && (['guide','flow','notifications','profile'].includes(view) || permitted(user,module,view==='new'?'create':action));
}
const managers:Role[]=["admin","supervisor"];
const creators:Role[]=["admin","supervisor","technician","requester"];
export const guideFlows:{id:string;title:string;subtitle:string;icon:string;note?:string;steps:GuideStep[]}[]=[
  {id:"inventory",title:"อะไหล่และต้นทุนงานซ่อม",subtitle:"Inventory & Work Order Cost",icon:"assets",note:"เบิกได้เฉพาะใบงานที่รับงานแล้ว กำลังดำเนินการ หรือรออะไหล่/ผู้รับเหมา ช่างเบิกได้เฉพาะงานที่ได้รับมอบหมาย คืนได้ไม่เกินยอดที่เบิก และระบบไม่อนุญาตให้สต็อกติดลบ",steps:[
    {label:"เพิ่มทะเบียนอะไหล่",description:"กำหนดบริษัท สาขา หน่วย จุดเก็บ และจุดสั่งซื้อ",view:"inventory",roles:managers,action:"create"},
    {label:"รับเข้าอะไหล่",description:"บันทึกจำนวนและราคาต่อหน่วย ระบบคำนวณต้นทุนถัวเฉลี่ยเคลื่อนที่",view:"inventory",roles:managers,action:"edit"},
    {label:"เบิกใช้ / คืน",description:"อ้างอิงใบงานซ่อมและรายการเบิกเดิมเมื่อต้องการคืน",view:"inventory",roles:["admin","supervisor","technician"],action:"edit"},
    {label:"ติดตามยอดและต้นทุน",description:"ดูคงเหลือ การเคลื่อนไหว ต้นทุนใบงาน และดาวน์โหลด Excel",view:"inventory",roles:["admin","supervisor","technician","executive"]},
    {label:"ตรวจแจ้งเตือนอะไหล่",description:"ผู้เกี่ยวข้องรับการแจ้งเตือนเมื่อคงเหลือถึงจุดสั่งซื้อ",view:"notifications",roles:managers},
  ]},
  {id:"repair",title:"แจ้งซ่อมจนปิดงาน",subtitle:"Repair Request to Completion",icon:"tools",steps:[
    {label:"แจ้งซ่อม",description:"เลือกโรงงาน สถานที่ และเครื่องจักร พร้อมระบุอาการและความเร่งด่วน",view:"new",roles:creators,action:"create"},
    {label:"อนุมัติคำขอ",description:"หัวหน้าหรือ admin อนุมัติคำขอ ระบบสร้างใบงานซ่อมอัตโนมัติ",view:"repairRequests",filter:"pending",roles:managers,action:"approve"},
    {label:"มอบหมายช่าง",description:"เลือกช่างที่มีสิทธิ์ในโรงงาน และตรวจวันกำหนดเสร็จ",view:"workOrders",filter:"unassigned",roles:managers,action:"edit"},
    {label:"รับงานและซ่อม",description:"ช่างรับงาน เริ่มดำเนินการ และบันทึกผลการซ่อม",view:"workOrders",filter:"assigned",roles:["technician"]},
    {label:"ตรวจรับงาน",description:"หัวหน้าหรือ admin ตรวจผลซ่อม แล้วอนุมัติเสร็จสิ้นหรือส่งกลับแก้ไข",view:"workOrders",filter:"review",roles:managers,action:"approve"},
    {label:"ยืนยันและปิดคำขอ",description:"เจ้าของคำขอประเมิน 1–5 คะแนน และยืนยันเมื่อใบงานเสร็จครบ",view:"repairRequests",filter:"awaiting_acceptance",roles:creators,action:"edit"},
  ]},
  {id:"technician",title:"การปฏิบัติงานของช่าง",subtitle:"Technician Workflow",icon:"work",note:"หากต้องรออะไหล่หรือผู้รับเหมา ให้เปลี่ยนเป็นสถานะรอที่เกี่ยวข้อง แล้วกลับมากำลังดำเนินการเมื่อพร้อมซ่อมต่อ",steps:[
    {label:"รับงานที่มอบหมาย",description:"เปิดใบงานที่มอบหมายให้ตนเอง และกดรับงาน",view:"workOrders",filter:"assigned",roles:["technician"]},
    {label:"เริ่มดำเนินการ",description:"เปลี่ยนจากรับงานแล้วเป็นกำลังดำเนินการ",view:"workOrders",filter:"accepted",roles:["technician"]},
    {label:"บันทึกผลซ่อม",description:"ระบุสาเหตุ วิธีแก้ไข ผลทดสอบ เวลาเริ่ม–สิ้นสุด และค่าใช้จ่าย",view:"workOrders",filter:"in_progress",roles:["technician"]},
    {label:"ส่งตรวจรับ",description:"ต้องมีบันทึกผลซ่อมก่อนเปลี่ยนเป็นรอตรวจรับ",view:"workOrders",filter:"in_progress",roles:["technician"]},
    {label:"อนุมัติเสร็จสิ้น",description:"หัวหน้าหรือ admin ตรวจและเปลี่ยนใบงานเป็นเสร็จสิ้น",view:"workOrders",filter:"review",roles:managers},
  ]},
  {id:"pm",title:"บำรุงรักษาเชิงป้องกัน (PM)",subtitle:"PM Advanced — Phase 3",icon:"calendar",note:"PM แยกจากใบงานซ่อม ช่างที่รับผิดชอบยืนยันผลแล้วเสร็จสิ้นทันที ยังไม่มีขั้นตอนอนุมัติ/ตรวจรับ PM งานที่มีข้อไม่ผ่านสามารถกดสร้างใบแจ้งซ่อมพร้อมยืนยันข้อมูล ระบบไม่สร้างให้เองโดยไม่มีการยืนยัน",steps:[
    {label:"สร้างแผน PM",description:"เลือกเครื่องจักร ช่างที่มีสิทธิ์พื้นที่เดียวกัน วันเริ่ม รอบทุก N วัน/เดือน และ Checklist หนึ่งข้อต่อบรรทัด",view:"pm",roles:managers,action:"create"},
    {label:"สร้างงานถึงกำหนด",description:"กดสร้างงาน / ตรวจแจ้งเตือน หรือรอ worker สร้างงานตามจำนวนวันเตือนล่วงหน้าและรอบย้อนหลัง โดยไม่สร้างซ้ำ",view:"pm",roles:managers,action:"create"},
    {label:"ตรวจตาม Checklist",description:"ช่างเปิดงานของตน แนบรูปก่อน/หลังให้ครบก่อนปิดงาน เลือกผ่าน/ไม่ผ่านทุกข้อและระบุหมายเหตุ",view:"pm",roles:["technician"],action:"edit"},
    {label:"ยืนยันผลตรวจ",description:"บันทึกผลได้ครั้งเดียว งานเปลี่ยนเป็นเสร็จสิ้น แม้มีข้อไม่ผ่าน",view:"pm",roles:["technician"],action:"edit"},
    {label:"ติดตามประวัติ PM",description:"ค้นหา กรองวันครบกำหนด/สถานะ ดูปฏิทิน เปิดผลตรวจและส่งออก Excel จากหน้าบำรุงรักษา PM",view:"pm",roles:["admin","supervisor","technician","executive"]},
  ]},
  {id:"assets",title:"ดูแลเครื่องจักรและสถานที่",subtitle:"Asset Care",icon:"assets",note:"การเปลี่ยนบริษัท/สาขาทำได้เมื่อมีสิทธิ์ทั้งต้นทางและปลายทาง และเครื่องจักรยังไม่มีข้อมูลอ้างอิง เช่น ประวัติซ่อมหรือ PM หากมีประวัติแล้วแก้ข้อมูลทั่วไปได้ แต่ย้ายบริษัท/สาขาไม่ได้",steps:[
    {label:"พื้นที่ / อาคาร",description:"จัดการสถานที่ภายในบริษัทและโรงงานที่มีสิทธิ์",view:"locations"},
    {label:"ทะเบียนเครื่องจักร",description:"ดูข้อมูลเครื่องจักร รหัส ยี่ห้อ รุ่น และ Serial Number",view:"assets"},
    {label:"แก้ไขบริษัท / สาขา",description:"เปิดเครื่องจักร > แก้ไขเครื่องจักร เลือกบริษัท สาขา และสถานที่ใหม่ แล้วบันทึก ระบบล้างตัวเลือกเดิมเมื่อเปลี่ยนบริษัท/สาขา",view:"assets",roles:managers,action:"edit"},
    {label:"QR เครื่องจักร",description:"เปิดรายละเอียดเครื่องจักรเพื่อดู QR สำหรับแจ้งซ่อม",view:"assets"},
    {label:"แจ้งซ่อมเครื่องนี้",description:"แจ้งซ่อมจากหน้าเครื่องจักร ระบบเลือกสถานที่และเครื่องให้",view:"assets",roles:creators},
    {label:"ประวัติใบงาน",description:"เปิดรายละเอียดเครื่องจักรเพื่อดูใบงานซ่อมที่ผ่านมา",view:"assets"},
  ]},
  {id:"admin",title:"บริหารระบบและติดตามกิจกรรม",subtitle:"Administration & Audit",icon:"settings",steps:[
    {label:"จัดการผู้ใช้",description:"กำหนดบทบาท สถานะ และสิทธิ์อาคาร/โรงงาน/สาขาของผู้ใช้",view:"users"},
    {label:"ตั้งค่าระบบ",description:"ตั้งค่าข้อมูลบริษัท โรงงาน และระยะเวลากำหนดเสร็จตามความเร่งด่วน",view:"settings"},
    {label:"ประวัติการเปลี่ยนแปลง",description:"ตรวจผู้กระทำ รายละเอียด เอกสารอ้างอิง และ IP ที่บันทึก",view:"auditLogs"},
    {label:"ภาพรวมงานซ่อม",description:"ติดตามคำขอ ใบงานคงค้าง งานเกินกำหนด และค่าใช้จ่าย",view:"dashboard"},
  ]},
];
export const guideModules:{view:GuideView;title:string;subtitle:string;description:string;icon:string}[]=[
  {view:"inventory",title:"คลังอะไหล่",subtitle:"Inventory",description:"ทะเบียนอะไหล่ รับเข้า เบิกใช้/คืนตามใบงาน ต้นทุนถัวเฉลี่ย จุดสั่งซื้อ และรายงาน Excel ตามสิทธิ์",icon:"assets"},
  {view:"dashboard",title:"แดชบอร์ด",subtitle:"Overview",description:"ภาพรวมงานซ่อม ตัวเลขสรุป และกราฟแนวโน้ม 6 เดือน",icon:"dashboard"},
  {view:"repairRequests",title:"ใบแจ้งซ่อม",subtitle:"Repair Requests",description:"ติดตามคำขอ อนุมัติ และยืนยันปิดงานของตนเอง",icon:"tools"},
  {view:"workOrders",title:"ใบงานซ่อม",subtitle:"Work Orders",description:"มอบหมาย รับงาน บันทึกผลซ่อม และตรวจรับตามสิทธิ์",icon:"work"},
  {view:"pm",title:"บำรุงรักษา PM",subtitle:"Preventive Maintenance",description:"แผนพร้อมเวอร์ชัน รูปก่อน/หลัง ปฏิทิน เตือนล่วงหน้า/เกินกำหนด รายงาน Excel และสร้างใบแจ้งซ่อมจากข้อไม่ผ่าน",icon:"calendar"},
  {view:"roles",title:"บทบาท & สิทธิ์",subtitle:"Roles & Permissions",description:"กำหนดสิทธิ์ดู/สร้าง/แก้ไข PM และโมดูลอื่นภายใต้ขอบเขตบทบาท",icon:"lock"},
  {view:"ldap",title:"ตั้งค่า LDAP / AD",subtitle:"Directory Login",description:"Admin ตั้งค่าการเชื่อมต่อและซิงก์ผู้ใช้ตามบริษัท",icon:"users"},
  {view:"smtp",title:"ตั้งค่า SMTP",subtitle:"Email Settings",description:"Admin ตั้งค่า SMTP ของแต่ละบริษัทสำหรับกู้คืนรหัสผ่านและส่งอีเมลจากรายการแจ้งเตือน เมื่อเปิดบริการส่งอีเมลแล้ว",icon:"settings"},
  {view:"companies",title:"บริษัท",subtitle:"Companies",description:"Admin เพิ่ม แก้ไข และลบบริษัท พร้อมสร้างโรงงาน / สาขาเริ่มต้น",icon:"assets"},
  {view:"sites",title:"อาคาร/โรงงาน/สาขา",subtitle:"Buildings & Factories",description:"Admin จัดการอาคาร/โรงงาน/สาขา เลือกบริษัท และค้นหารายการตามบริษัท",icon:"assets"},
  {view:"locations",title:"สถานที่",subtitle:"Locations",description:"Admin จัดการสถานที่และชั้นภายในอาคาร/โรงงาน/สาขา พร้อมค้นหาและกรองรายการ",icon:"location"},
  {view:"assets",title:"ทะเบียนเครื่องจักร",subtitle:"Assets",description:"ข้อมูลเครื่องจักร QR ประวัติใบงาน และแก้ไขบริษัท/สาขาเมื่อยังไม่มีประวัติอ้างอิง",icon:"assets"},
  {view:"workTypes",title:"ประเภทงาน",subtitle:"Work Types",description:"เพิ่ม แก้ไข และลบประเภทงานที่ใช้ในใบแจ้งซ่อม",icon:"tools"},
  {view:"notifications",title:"การแจ้งเตือน",subtitle:"Notifications",description:"ติดตามงานซ่อม งาน PM และอะไหล่ถึงจุดสั่งซื้อ เปิดรายละเอียดตามสิทธิ์ และรับอีเมลเมื่อบริษัทเปิดใช้งาน",icon:"bell"},
  {view:"profile",title:"โปรไฟล์ของฉัน",subtitle:"My Profile",description:"แก้ไขชื่อและรหัสผ่านของบัญชีตนเอง",icon:"users"},
  {view:"users",title:"จัดการผู้ใช้",subtitle:"User Management",description:"Admin จัดการบัญชี แผนก บทบาท และสิทธิ์เข้าถึงอาคาร/โรงงาน/สาขา",icon:"users"},
  {view:"auditLogs",title:"ประวัติการเปลี่ยนแปลง",subtitle:"Audit Trail",description:"ค้นหากิจกรรม กรองผู้ใช้/โมดูล/วันที่ รวมสร้างแผน เปิด/พักแผน และยืนยันผลตรวจ PM",icon:"audit"},
  {view:"settings",title:"ตั้งค่าระบบ",subtitle:"System Settings",description:"ข้อมูลบริษัท โรงงาน และกฎกำหนดเสร็จงานซ่อม",icon:"settings"},
];
export const guideRoles:{role:Role;title:string;description:string;steps:string[]}[]=[
  {role:"requester",title:"ผู้แจ้งซ่อม",description:"แจ้งปัญหาและยืนยันผลการซ่อม",steps:["เลือกสถานที่หรือเปิด QR เครื่องจักร แล้วสร้างใบแจ้งซ่อมพร้อมอาการและความเร่งด่วน","ติดตามคำขอของตนเอง และเพิ่มความคิดเห็นหรือไฟล์แนบเมื่อจำเป็น","รอหัวหน้าอนุมัติและมอบหมายช่าง ระบบแจ้งการเปลี่ยนสถานะให้เจ้าของคำขอ","เมื่อรอผู้แจ้งยืนยัน ให้ตรวจผลซ่อม ประเมิน 1–5 คะแนน แล้วปิดคำขอ"]},
  {role:"technician",title:"ช่าง / ผู้รับผิดชอบ",description:"รับงาน ซ่อม และบันทึกผล",steps:["เปิดงานที่มอบหมายให้ตนเอง กดรับงาน แล้วเริ่มดำเนินการ","บันทึกสาเหตุ วิธีแก้ไข ผลทดสอบ เวลาเริ่ม–สิ้นสุด และค่าใช้จ่าย","ใช้สถานะรออะไหล่หรือรอผู้รับเหมาเมื่อจำเป็น และกลับมาดำเนินการเมื่อพร้อม","ส่งตรวจรับหลังมีบันทึกผลซ่อม หากหัวหน้าส่งกลับให้แก้ไขและส่งตรวจอีกครั้ง","งาน PM: แนบรูปก่อน/หลังและตรวจ Checklist ก่อนยืนยันผล ไม่ต้องส่งตรวจรับ หากมีข้อไม่ผ่านให้กดสร้างใบแจ้งซ่อมและยืนยันข้อมูล"]},
  {role:"supervisor",title:"หัวหน้างานซ่อมบำรุง",description:"อนุมัติ มอบหมาย และตรวจรับ",steps:["ตรวจคำขอรออนุมัติ เมื่ออนุมัติระบบจะสร้างใบงานพร้อมกำหนดเสร็จ","มอบหมายช่างที่มีสิทธิ์ในโรงงาน และปรับวันกำหนดเสร็จตามงาน","ตรวจใบงานรอตรวจรับ อนุมัติเสร็จสิ้น หรือส่งกลับดำเนินการพร้อมเหตุผล","ติดตามงานคงค้างและเกินกำหนด และดูแลทะเบียนเครื่องจักรตามสิทธิ์","สร้าง/แก้แผน PM เปลี่ยนช่าง รอบ Checklist และวันเตือนล่วงหน้า เก็บประวัติเวอร์ชันและมีผลเฉพาะงานที่ยังไม่สร้าง ดูปฏิทินและส่งออก Excel ได้"]},
  {role:"executive",title:"ผู้บริหาร",description:"ติดตามภาพรวมและข้อมูลในขอบเขตสิทธิ์",steps:["ดูแดชบอร์ดเพื่อประเมินคำขอ งานคงค้าง งานเกินกำหนด และค่าใช้จ่าย","ชี้กราฟเพื่อเปรียบเทียบจำนวนคำขอและใบงานที่เสร็จรายเดือน","เปิดใบแจ้งซ่อม ใบงาน และทะเบียนเครื่องจักรเพื่ออ่านรายละเอียด","เปิดบำรุงรักษา PM เพื่อดูแผน งานค้าง งานเกินกำหนด และผลตรวจ โดยไม่เปลี่ยนสถานะ","ติดตามการเปลี่ยนแปลงจากข้อมูลและการแจ้งเตือน โดยสิทธิ์ผู้บริหารเป็นการดูข้อมูล"]},
  {role:"admin",title:"ผู้ดูแลระบบ",description:"จัดการบัญชี การตั้งค่า และประวัติกิจกรรม",steps:["สร้างหรือแก้ไขผู้ใช้ กำหนดบทบาทและสิทธิ์อาคาร/โรงงาน/สาขาให้ตรงกับหน้าที่","ตั้งค่าข้อมูลบริษัท โรงงาน และชั่วโมงกำหนดเสร็จงานแต่ละระดับความเร่งด่วน","คลิกตัวเลขกิจกรรมของผู้ใช้เพื่อเปิดประวัติที่กรองผู้ใช้นั้น","ตรวจประวัติการตั้งค่าและเอกสารอ้างอิง พร้อมดูภาพรวมงานซ่อมและตรวจรับงาน","จัดการแผน PM และสิทธิ์โมดูล PM ตรวจประวัติสร้าง/เปิด/พักแผนและยืนยันผลตรวจ","เปลี่ยนบริษัท/สาขาของเครื่องจักรที่ยังไม่มีประวัติ โดยเลือกสถานที่ปลายทางใหม่ตามสิทธิ์"]},
];
export type ApprovalStep = { label: string; description: string; view: GuideView; filter?: string; action?: "create" | "edit" | "approve"; waiting?: boolean };
export const guideApprovalFlows: { role: Role; title: string; subtitle: string; icon: string; note: string; steps: ApprovalStep[] }[] = [
  { role: "requester", title: "ผู้แจ้งซ่อม", subtitle: "Requester", icon: "users", note: "ปิดคำขอของตนเองเมื่อซ่อมครบ พร้อมให้คะแนน 1–5 • ยกเลิกได้ก่อนอนุมัติ โดยระบุเหตุผล", steps: [
    { label: "แจ้งซ่อม", description: "สร้างคำขอพร้อมระบุอาการและความเร่งด่วน", view: "new", action: "create" },
    { label: "รออนุมัติ", description: "หัวหน้าหรือผู้ดูแลระบบพิจารณาคำขอ", view: "repairRequests", filter: "pending", waiting: true },
    { label: "ติดตามผลซ่อม", description: "ติดตามสถานะและการแจ้งเตือนของคำขอตนเอง", view: "repairRequests" },
    { label: "รอตรวจรับ", description: "หัวหน้า / Admin ตรวจรับก่อนผู้แจ้งปิดคำขอ", view: "repairRequests", filter: "review", waiting: true },
    { label: "ประเมินและปิดคำขอ", description: "ตรวจผลซ่อม ให้คะแนน และยืนยันปิดคำขอ", view: "repairRequests", filter: "awaiting_acceptance", action: "edit" },
  ] },
  { role: "technician", title: "ช่าง / ผู้รับผิดชอบ", subtitle: "Technician", icon: "tools", note: "เฉพาะงานที่ได้รับมอบหมาย • หากส่งกลับ ให้แก้ไขแล้วส่งตรวจใหม่", steps: [
    { label: "รับงาน", description: "รับใบงานที่ได้รับมอบหมาย", view: "workOrders", filter: "assigned", action: "edit" },
    { label: "เริ่มซ่อม", description: "เปลี่ยนเป็นกำลังดำเนินการ", view: "workOrders", filter: "accepted", action: "edit" },
    { label: "บันทึกผลซ่อม", description: "บันทึกสาเหตุ วิธีแก้ไข และผลทดสอบก่อนส่งตรวจ", view: "workOrders", filter: "in_progress", action: "edit" },
    { label: "ส่งตรวจรับ", description: "บันทึกผลซ่อมก่อนส่งให้หัวหน้า / Admin ตรวจรับ", view: "workOrders", filter: "in_progress", action: "edit" },
    { label: "รอผลตรวจรับ", description: "หัวหน้า / Admin อนุมัติหรือส่งกลับแก้ไข", view: "workOrders", filter: "review", waiting: true },
  ] },
  ...(["supervisor", "admin"] as const).map(role => ({ role, title: role === "admin" ? "ผู้ดูแลระบบ" : "หัวหน้างานซ่อมบำรุง", subtitle: role === "admin" ? "Administrator" : "Supervisor", icon: role === "admin" ? "settings" : "work", note: "อนุมัติได้ตามสิทธิ์บริษัท/โรงงาน • ไม่อนุมัติ ยกเลิก หรือส่งกลับ ต้องระบุเหตุผล", steps: [
    { label: "พิจารณาคำขอ", description: "อนุมัติเพื่อสร้างใบงาน หรือไม่อนุมัติพร้อมเหตุผล", view: "repairRequests", filter: "pending", action: "approve" },
    { label: "มอบหมายช่าง", description: "เลือกช่างที่เปิดใช้งานและมีสิทธิ์ในบริษัท/โรงงานของใบงาน", view: "workOrders", filter: "unassigned", action: "edit" },
    { label: "รอช่างส่งตรวจ", description: "ช่างดำเนินการและบันทึกผลซ่อม", view: "workOrders", filter: "in_progress", waiting: true },
    { label: "ตรวจรับ / ส่งกลับ", description: "ผ่าน: เสร็จสิ้น • ไม่ผ่าน: ส่งกลับพร้อมเหตุผล", view: "workOrders", filter: "review", action: "approve" },
    { label: "รอผู้แจ้งปิดงาน", description: "เจ้าของคำขอประเมินและยืนยันปิด", view: "repairRequests", filter: "awaiting_acceptance", waiting: true },
  ] as ApprovalStep[] })),
  { role: "executive", title: "ผู้บริหาร", subtitle: "Executive", icon: "dashboard", note: "ดูข้อมูลตามสิทธิ์ ไม่อนุมัติหรือเปลี่ยนสถานะ", steps: [
    { label: "ดูภาพรวม", description: "ติดตามงานคงค้าง งานเกินกำหนด และค่าใช้จ่าย", view: "dashboard" },
    { label: "ติดตามคำขอ", description: "ดูสถานะและรายละเอียดใบแจ้งซ่อม", view: "repairRequests" },
    { label: "ติดตามใบงาน", description: "ดูผลซ่อมและสถานะตรวจรับ", view: "workOrders" },
  ] },
];
export const guideTips=[
  {title:"ค้นหาเมนูและรายการ",description:"ใช้ช่องค้นหาเมนูในแถบด้านข้าง หรือค้นหาหัวข้อและกรองสถานะในหน้ารายการ",icon:"search"},
  {title:"ติดตามการแจ้งเตือน",description:"กดกระดิ่งเพื่อดูงานซ่อมและงาน PM ถึงกำหนด แล้วกดเปิดรายการ ระบบตรวจสิทธิ์และผู้รับผิดชอบปัจจุบันทุกครั้ง",icon:"bell"},
  {title:"ตรวจประวัติเอกสาร",description:"เปิดรายละเอียดใบแจ้งซ่อมหรือใบงานเพื่อดู Timeline และความคิดเห็น ผู้ดูแลระบบตรวจรวมได้ในประวัติการเปลี่ยนแปลง",icon:"audit"},
  {title:"QR และไฟล์แนบ",description:"สแกน QR เพื่อเปิดเครื่องจักรหลังเข้าสู่ระบบ ใบแจ้งซ่อม/ใบงานซ่อมแนบ JPG, PNG หรือ PDF ไม่เกิน 8 MB; PM แนบ JPG/PNG ก่อน/หลังได้สูงสุด 20 รูป รูปละ 8 MB ก่อนปิดงาน ต้องตั้งค่าที่เก็บรูปก่อน",icon:"assets"},
];

export const guidePMDetails = [
 {title:"สร้างและแก้ไขแผน PM",icon:"calendar",description:"Admin/หัวหน้าที่มีสิทธิ์ เปิดจัดการแผน PM เพิ่มหรือแก้ชื่อ ช่าง รอบทุก N วัน/เดือน Checklist และวันเตือนล่วงหน้า 0–30 วัน การแก้แผนเก็บเวอร์ชันและมีผลเฉพาะงานที่ยังไม่สร้าง หากเปลี่ยนรอบให้เลือกวันเริ่มตั้งแต่วันนี้ เปลี่ยนทรัพย์สินของแผนเดิมไม่ได้"},
 {title:"สร้างงานและแจ้งเตือน",icon:"bell",description:"กดสร้างงาน / ตรวจแจ้งเตือน หรือรอ worker ทุก 5 นาที งานจะถูกสร้างเมื่อเข้าสู่ช่วงแจ้งล่วงหน้า แผนเดิมใช้ 3 วันถ้ายังไม่กำหนด ส่งแจ้งเตือนล่วงหน้า/ถึงกำหนด/เกินกำหนดประเภทละหนึ่งครั้งต่องาน การพักแผนไม่ยกเลิกงานเดิมหรือการแจ้งเตือนงานค้าง"},
 {title:"รูปก่อน–หลังและผลตรวจ",icon:"tools",description:"ช่างเปิดงานของตน แนบรูป JPG/PNG ไม่เกินรูปละ 8 MB รวมสูงสุด 20 รูป เลือกก่อนหรือหลังการบำรุง แนบให้ครบก่อนยืนยันปิดงาน กรอกผ่าน/ไม่ผ่านทุกข้อและหมายเหตุ ยืนยันได้ครั้งเดียว ไม่มีตรวจรับ PM หากยังไม่ตั้งค่าที่เก็บรูป จะใช้ Checklist ได้แต่แนบรูปไม่ได้"},
 {title:"สร้างใบแจ้งซ่อมจากข้อไม่ผ่าน",icon:"work",description:"หลังปิดงานที่มีผลไม่ผ่าน ช่างผู้รับผิดชอบหรือ Admin/หัวหน้าที่มีสิทธิ์สร้างใบแจ้งซ่อม กดสร้างใบแจ้งซ่อมจากข้อที่ไม่ผ่าน ระบุรายละเอียด ผู้ติดต่อ แผนก และความเร่งด่วน แล้วยืนยัน ระบบเพิ่มรายการที่ไม่ผ่านให้และส่งเข้ารออนุมัติตามขั้นตอนเดิม ป้องกันซ้ำหนึ่งใบต่อหนึ่งงาน PM"},
 {title:"ปฏิทิน PM",icon:"calendar",description:"เลือกแท็บปฏิทินรายเดือนและเดือนที่ต้องการ เส้นประคือแผนล่วงหน้าที่ยังไม่เป็นงานจริง จึงยังบันทึกผลไม่ได้ คลิกงานจริงเพื่อดูรายละเอียดหรือกรอกผล ปฏิทินใช้ตัวกรองชื่อและสถานะ แต่ใช้เดือนที่เลือกแทนช่วงวันที่รายงาน"},
 {title:"Dashboard และรายงาน Excel",icon:"dashboard",description:"ค้นหาและกรองวันครบกำหนดได้ไม่เกิน 366 วัน แบ่งหน้าละ 30 งาน ตัวเลขงานสรุปจากฐานข้อมูลตามตัวกรอง ไม่จำกัดเฉพาะหน้าปัจจุบัน จำนวนแผนที่ใช้งานนับทุกแผนในพื้นที่ที่มีสิทธิ์ ดาวน์โหลด Excel ทุกหน้าสูงสุด 10,000 งาน ไม่รวมรูปจริงและแผนล่วงหน้า"},
 {title:"สิทธิ์ ประวัติ และเวอร์ชัน",icon:"lock",description:"Admin/หัวหน้าจัดการแผน ช่างยืนยันเฉพาะงานของตน ผู้บริหารดูข้อมูล ผู้แจ้งซ่อมไม่มีสิทธิ์ PM ทุกคนอยู่ภายใต้บริษัท/พื้นที่และสิทธิ์ที่กำหนด ประวัติแผนเก็บชื่อ รอบ ช่าง Checklist และผู้แก้ไข งานเดิมเก็บข้อมูลเดิม Audit บันทึกแก้แผน แนบรูป และสร้างใบแจ้งซ่อมจากผลตรวจด้วย"},
 {title:"ระบบอัตโนมัติและขอบเขต",icon:"settings",description:"บริการสร้างงาน PM ต้องทำงานตามรอบที่ผู้ดูแลกำหนด ปิด browser ได้ เมื่อกลับมาทำงานจะทยอยสร้างรอบย้อนหลัง PM แยกจากใบงานซ่อม ยกเว้นคำขอที่สร้างจากข้อไม่ผ่าน อีเมลแจ้งเตือนใช้ SMTP และบริการส่งอีเมลแยกต่างหาก ติดตั้ง PWA ได้แต่ดูข้อมูลและบันทึกผลต้องออนไลน์ ยังไม่มีรอบมิเตอร์ ตรวจรับ PM หรือ Teams/LINE"},
];

export const guideServiceDetails = [
  {title:"ติดตั้ง AGE CMMS เป็นแอป",icon:"device",description:"เปิดระบบผ่าน HTTPS ด้วย Chrome หรือ Edge แล้วกดติดตั้ง AGE CMMS เมื่อมีปุ่มแสดง หรือเลือกติดตั้งแอปจากเมนู browser บน iPhone/iPad เปิดด้วย Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม จากนั้นเปิดผ่านไอคอน AGE และเข้าสู่ระบบตามปกติ"},
  {title:"เมื่อไม่มีอินเทอร์เน็ต",icon:"device",description:"หน้าต่างที่เปิดอยู่จะแสดงแถบออฟไลน์ หากเปิดหน้าใหม่ไม่ได้จะแสดงหน้าสำรอง กดลองเชื่อมต่ออีกครั้งเมื่อออนไลน์ การดูข้อมูลและบันทึกงานยังต้องเชื่อมต่อระบบ ไม่มีคิวบันทึกงานออฟไลน์ จึงควรเก็บข้อความที่ยังไม่บันทึกก่อนปิดหน้าต่าง"},
  {title:"รับการแจ้งเตือนทางอีเมล",icon:"mail",description:"อีเมลส่งจากรายการแจ้งเตือนในแอป เช่น งานซ่อม งาน PM และอะไหล่ถึงจุดสั่งซื้อ ผู้รับต้องเปิดใช้งาน มีอีเมลถูกต้อง และยังมีสิทธิ์เข้าถึงงาน ระบบใช้อีเมลและ SMTP ของบริษัทเจ้าของรายการ ลิงก์ในอีเมลเปิดหน้าการแจ้งเตือนและต้องเข้าสู่ระบบ"},
  {title:"เปิดใช้งานอีเมลสำหรับบริษัท",icon:"settings",description:"Admin ตั้งค่าและเปิด SMTP ของบริษัท พร้อมที่อยู่ผู้ส่งและ URL ระบบ แล้วตรวจอีเมลในบัญชีผู้ใช้ ให้ผู้ดูแลเซิร์ฟเวอร์เปิดบริการส่งอีเมลแยกจาก API ระบบเริ่มส่งเฉพาะรายการที่เกิดหลังเปิดบริการครั้งแรก ไม่ส่งรายการเก่าย้อนหลัง"},
  {title:"เมื่ออีเมลยังไม่มาถึง",icon:"bell",description:"ตรวจการแจ้งเตือนในแอปและโฟลเดอร์สแปมก่อน หาก SMTP ขัดข้องระบบจะทยอยลองส่งใหม่โดยไม่ขัดขวางการบันทึกงาน หากลบการแจ้งเตือนก่อนบริการนำไปส่ง อีเมลรายการนั้นจะไม่ถูกส่ง การติดตั้ง PWA ไม่ได้เปิด Push Notification บนอุปกรณ์"},
  {title:"ใช้งานคลังอะไหล่",icon:"assets",description:"Admin/หัวหน้าตามสิทธิ์เพิ่มอะไหล่และรับเข้า ช่างเบิกใช้หรือคืนสำหรับใบงานที่ได้รับมอบหมายในสถานะที่อนุญาต ตรวจแท็บคงเหลือ การเคลื่อนไหว และต้นทุนใบงาน พร้อมดาวน์โหลด Excel ผู้บริหารดูข้อมูลได้ ผู้แจ้งซ่อมไม่มีสิทธิ์คลังอะไหล่"},
];

export const guideSystemFlows = [
  {id:"email",title:"แจ้งเตือนในแอป → อีเมล",icon:"mail",note:"ต้องเปิด SMTP ของบริษัทและบริการส่งอีเมล อีเมลใช้ผู้รับจากรายการแจ้งเตือนเดิม หากส่งไม่สำเร็จจะลองใหม่ การบันทึกงานยังดำเนินต่อได้",steps:[
    {label:"เกิดเหตุการณ์ในงาน",description:"งานซ่อม งาน PM หรืออะไหล่ถึงจุดสั่งซื้อ สร้างรายการแจ้งเตือนตามเงื่อนไขเดิม"},
    {label:"บันทึกการแจ้งเตือน",description:"ระบบระบุผู้รับ บริษัท และสาขาของรายการ"},
    {label:"ตรวจผู้รับก่อนส่ง",description:"ตรวจบัญชี อีเมล สิทธิ์ปัจจุบัน และผู้รับผิดชอบงาน"},
    {label:"ส่งผ่าน SMTP บริษัท",description:"บริการส่งอีเมลประมวลผลรายการใหม่และลองใหม่เมื่อขัดข้อง"},
    {label:"เปิดระบบจากอีเมล",description:"ผู้รับเข้าสู่ระบบและเปิดรายละเอียดจากหน้าการแจ้งเตือน"},
  ]},
  {id:"pwa",title:"ติดตั้งและใช้งาน PWA",icon:"device",note:"ใช้สิทธิ์และบัญชีเดิม การติดตั้งไม่ได้ทำให้บันทึกงานออฟไลน์ได้ เวอร์ชันใหม่รอให้ปิดหน้าต่างแอปเดิมก่อนใช้งาน",steps:[
    {label:"เปิดระบบผ่าน HTTPS",description:"ใช้ Chrome/Edge หรือ Safari บน iPhone/iPad"},
    {label:"ติดตั้ง / เพิ่มหน้าจอโฮม",description:"เลือกปุ่มติดตั้งหรือเมนูของ browser ตามอุปกรณ์"},
    {label:"เปิดแอปและเข้าสู่ระบบ",description:"ใช้งานซ่อม PM และคลังอะไหล่ตามสิทธิ์เดิมขณะออนไลน์"},
    {label:"หากขาดการเชื่อมต่อ",description:"แสดงแถบออฟไลน์หรือหน้าสำรอง ยังดูข้อมูลและบันทึกงานไม่ได้"},
    {label:"ออนไลน์แล้วลองใหม่",description:"ตรวจรายการในระบบก่อนทำรายการซ้ำ และบันทึกเมื่อเชื่อมต่อได้"},
  ]},
];
