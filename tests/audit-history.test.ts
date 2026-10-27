import { auditOverviewWindow, buildAuditOverview } from "../src/lib/audit-overview";
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditDateRange } from "../src/lib/audit-query";
import { auditDescription, auditModule } from "../src/lib/audit-display";
import { auditContext, normalizeAuditIPv4 } from "../src/lib/audit-context";
test("audit dates include the entire final day in Bangkok",()=>{
  const dates=auditDateRange("2026-10-14","2026-10-14");
  assert.equal(dates.$gte?.toISOString(),"2026-10-13T17:00:00.000Z");
  assert.equal(dates.$lt?.toISOString(),"2026-10-14T17:00:00.000Z");
  assert.deepEqual(auditDateRange(null,null),{});
});
test("audit rejects impossible dates and reversed date ranges",()=>{
  for(const date of ["2026-02-30","2026-13-01","invalid"]) assert.throws(()=>auditDateRange(date,null));
  assert.throws(()=>auditDateRange("2026-10-15","2026-10-14"));
});
test("audit descriptions translate transitions and preserve notes and cost",()=>{
  assert.equal(auditDescription("status.changed","workOrders","WO-1",{from:"assigned",to:"accepted",note:"รับงาน"}),"เปลี่ยนสถานะใบงานซ่อม WO-1: มอบหมายแล้ว → รับงานแล้ว · รับงาน");
  assert.equal(auditDescription("login","login","admin"),"เข้าสู่ระบบ");
  assert.equal(auditDescription("log.added","workOrders","WO-1",{costSatang:73830}),"บันทึกการทำงาน WO-1 · ค่าใช้จ่าย 738.3 บาท");
  assert.equal(auditModule("attachment.added","workOrders"),"workOrders");
});
test("audit records request IP without inventing missing values",()=>{
  assert.equal(auditContext(new Request("https://cmms.test/api/admin-users",{headers:{"x-forwarded-for":"192.0.2.1, 10.0.0.1"}})).ip,"192.0.2.1");
  assert.equal(auditContext(new Request("https://cmms.test/api/admin-users")).entityType,"users");
  assert.equal(auditContext(new Request("https://cmms.test/api/workOrders")).ip,"");
});
test("audit converts IPv4-mapped IPv6 and rejects native IPv6 or invalid addresses",()=>{
  assert.equal(normalizeAuditIPv4(" ::ffff:192.0.2.1 "),"192.0.2.1");
  assert.equal(normalizeAuditIPv4("::ffff:c000:201"),"192.0.2.1");
  assert.equal(normalizeAuditIPv4("0:0:0:0:0:ffff:c000:201"),"192.0.2.1");
  for (const value of ["2001:db8::1","::1","999.0.0.1","::ffff:999.0.0.1","invalid",null]) {
    assert.equal(normalizeAuditIPv4(value),"");
  }
  assert.equal(auditContext(new Request("https://cmms.test/api/workOrders",{headers:{"x-real-ip":"::ffff:192.0.2.2"}})).ip,"192.0.2.2");
  assert.equal(auditContext(new Request("https://cmms.test/api/workOrders",{headers:{"x-forwarded-for":"2001:db8::1, 192.0.2.1"}})).ip,"");
});

test("audit overview uses Bangkok days across year boundaries",()=>{
  const window=auditOverviewWindow(new Date("2026-12-31T18:00:00Z"));
  assert.equal(window.dates.length,14);
  assert.equal(window.dates.at(-1),"2027-01-01");
  assert.equal(window.start.toISOString(),"2026-12-18T17:00:00.000Z");
  assert.equal(window.end.toISOString(),"2027-01-01T17:00:00.000Z");
  const selected=auditOverviewWindow(new Date("2026-10-14T12:00:00Z"),"2026-10-05");
  assert.equal(selected.dates.at(-1),"2026-10-05");
});
test("audit overview fills empty days and counts users and logins correctly",()=>{
  const now=new Date("2026-10-14T12:00:00Z"),window=auditOverviewWindow(now);
  const data=buildAuditOverview(window.dates,[
    {_id:"2026-10-01",activities:100,logins:4,users:2,count:104},
    {_id:"2026-10-13",activities:10,logins:2,users:1,count:12},
    {_id:"2026-10-14",activities:15,logins:3,users:2,count:19},
  ],[{_id:"workOrders",count:125}],now);
  assert.equal(data.days.length,14);
  assert.deepEqual(data.days[1],{date:"2026-10-02",activities:0,logins:0,users:0});
  assert.equal(data.todayActivities,15);
  assert.equal(data.todayUsers,2);
  assert.equal(data.loginsWeek,5);
  assert.equal(data.total,135);
  assert.equal(data.changePercent,50);
  assert.deepEqual(data.modules,[{module:"workOrders",count:125}]);
});
test("empty audit overview never fabricates activity or a percentage increase",()=>{
  const now=new Date("2026-10-14T12:00:00Z"),window=auditOverviewWindow(now);
  const data=buildAuditOverview(window.dates,[],[],now);
  assert.equal(data.total,0);
  assert.equal(data.changePercent,null);
  assert.ok(data.days.every(day=>day.activities===0&&day.logins===0&&day.users===0));
});