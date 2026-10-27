import { test } from "node:test";
import assert from "node:assert/strict";
import { smtpFailure } from "../src/lib/smtp-errors";

test("SMTP diagnostics distinguish authentication, DNS, connection, timeout, TLS and configuration failures", () => {
  for (const [error, expected] of [
    [{code:"EAUTH"},"SMTP_AUTH_ERROR"],
    [{code:"EDNS"},"SMTP_DNS_ERROR"],
    [{code:"ESOCKET",originalCode:"ENOTFOUND"},"SMTP_DNS_ERROR"],
    [{code:"ESOCKET",originalCode:"ECONNREFUSED"},"SMTP_CONNECTION_ERROR"],
    [{code:"ETIMEDOUT"},"SMTP_TIMEOUT"],
    [{code:"ESOCKET",originalCode:"CERT_HAS_EXPIRED"},"SMTP_CERTIFICATE_ERROR"],
    [{code:"ESOCKET",message:"ssl routines:wrong version number"},"SMTP_TLS_ERROR"],
    [{code:"ETLS"},"SMTP_TLS_ERROR"],
    [{name:"MongoServerSelectionError"},"SMTP_DATABASE_ERROR"],
    [{message:"Unsupported state or unable to authenticate data"},"SMTP_SECRET_ERROR"],
    [{message:"Password recovery email is not configured"},"SMTP_NOT_CONFIGURED"],
  ] as const) assert.equal(smtpFailure(error).code,expected);
});

test("SMTP diagnostics never return raw server responses, credentials or unexpected error properties", () => {
  for (const error of [null, undefined, {code:"EAUTH",message:"secret-password",response:"secret-password",command:"secret-password"}, {code:"secret-password",message:"secret-password"}]) {
    const result=smtpFailure(error);
    assert.equal(JSON.stringify(result).includes("secret-password"),false);
    assert.ok(result.status>=400);
  }
});
