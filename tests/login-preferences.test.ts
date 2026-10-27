import test from "node:test";
import assert from "node:assert/strict";
import { loginCompanyName } from "../src/lib/login-preferences";

test("login branding uses configured Thai company name and a plain name fallback",()=>{
  assert.equal(loginCompanyName(" บริษัททดสอบ ","Fallback"),"บริษัททดสอบ");
  assert.equal(loginCompanyName(" ","บริษัทตัวอย่าง"),"บริษัทตัวอย่าง");
  assert.equal(loginCompanyName({taxId:"private"},null),"");
  assert.equal(loginCompanyName("x".repeat(250),null).length,200);
});
