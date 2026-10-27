"use client";
import { Fragment, ReactNode, useEffect, useRef, useState } from "react";
import type { User } from "@/lib/domain";
import { permitted } from "@/lib/permissions";
import { userRoleLabels } from "@/lib/admin-users-policy";
import {
  guideCanOpen,
  guideCanUseStep,
  guideLinkAllowed,
  guidePMDetails,
  guideFlows,
  guideApprovalFlows,
  guideModules,
  guideRoles,
  guideTips,
  guideServiceDetails,
  guideSystemFlows,
} from "@/lib/guide-data";
import type { GuideView } from "@/lib/guide-data";
import "./guide.css";
function FlowArrow({ index }: { index: number }) {
  return (
    <span className="cg-flow-arrow" aria-hidden="true">
      <svg viewBox="0 0 40 20" width="40" height="20" fill="none">
        <path className="cg-arrow-dashes" d="M2 10h32" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 4" style={{ animationDelay: `${(index - 1) * 180}ms` }} />
        <path d="m31 7 4 3-4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    mail: "M3 5h18v14H3z M3 5l9 8 9-8",
    device: "M7 2h10v20H7z M10 18h4",
    calendar: "M8 3v4M16 3v4M4 10h16M5 5h14v16H4V5h1M8 14h3M8 17h6",
    diagram:
      "M9 3h6v5H9z M2 17h6v5H2z M16 17h6v5h-6z M12 8v5 M5 13h14 M5 13v4 M19 13v4",
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    tools: "M14 4a6 6 0 0 0-7 7L2 16v5h5l5-5a6 6 0 0 0 8-8l-4 4-4-4 2-4z",
    work: "M8 3h8v4H8z M7 5H5v16h14V5h-2 M8 12l3 3 5-5 M8 18h8",
    assets: "M4 7h16v14H4z M8 7V3h8v4 M4 12h16 M10 12v3h4v-3",
    location:
      "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z M9 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    users: "M15 7a3 3 0 1 0-6 0a3 3 0 1 0 6 0 M5 21v-4a7 7 0 0 1 14 0v4",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    audit: "M3 12a9 9 0 1 1 3 7 M3 4v8h8 M12 7v5l3 2",
    settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
    search: "M21 21l-6-6 M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0",
    lock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4",
    book: "M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1v15",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.book} />
    </svg>
  );
}
function GuideLink({
  allowed,
  view,
  filter,
  className,
  title,
  children,
  onNavigate,
}: {
  allowed: boolean;
  view: GuideView;
  filter?: string;
  className?: string;
  title?: string;
  children: ReactNode;
  onNavigate: (view: string, filter?: string) => void;
}) {
  if (!allowed)
    return (
      <span
        className={`${className || ""} cg-disabled`}
        aria-disabled="true"
        title={`${title || ""} · ขั้นตอนนี้ต้องใช้สิทธิ์ตามหน้าที่`}
      >
        {children}
        <span className="cg-lock">
          <Icon name="lock" />
        </span>
      </span>
    );
  const params = new URLSearchParams({ view });
  if (filter) params.set("status", filter);
  return (
    <a
      className={className}
      href={`/?${params}`}
      title={title}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        onNavigate(view, filter);
      }}
    >
      {children}
    </a>
  );
}
export default function Guide({
  user,
  onNavigate,
  mode = "guide",
}: {
  mode?: "guide" | "flow";
  user: User;
  onNavigate: (view: string, filter?: string) => void;
}) {
  const modulesRef = useRef<HTMLDivElement>(null);
  const [modulesVisible, setModulesVisible] = useState(false);
  useEffect(() => {
    if (!modulesRef.current) return;
    if (!window.IntersectionObserver) { setModulesVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setModulesVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.05 });
    observer.observe(modulesRef.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="cmms-guide">
      <div className="cg-heading">
        <span className="cg-heading-icon">
          <Icon name={mode === "flow" ? "diagram" : "book"} />
        </span>
        <div>
          <h1>{mode === "flow" ? "Flow ระบบ" : "คู่มือการใช้งาน"}</h1>
          <p>{mode === "flow"
            ? "กระบวนการทำงานและขั้นตอนอนุมัติของ AGE CMMS"
            : "วิธีใช้งานโมดูลหลักและคำแนะนำตามบทบาทของ AGE CMMS"}</p>
        </div>
        <span className="cg-current-role">{userRoleLabels[user.role]}</span>
      </div>
      <nav className="cg-section-nav" aria-label={mode === "flow" ? "หัวข้อ Flow ระบบ" : "หัวข้อคู่มือ"}>
        {mode === "flow" ? <>
          <a href="#guide-process">แผนผังกระบวนการ</a>
          <a href="#guide-approval">Workflow การอนุมัติตามบทบาท</a>
          <a href="#guide-system">อีเมลและ PWA</a>
        </> : <>
          <a href="#guide-pm">PM และการดูแลเครื่องจักร</a>
          <a href="#guide-services">PWA อีเมล และคลังอะไหล่</a>
          <a href="#guide-modules">โมดูลหลัก</a>
          <a href="#guide-roles">คู่มือตามบทบาท</a>
          <a href="#guide-tips">วิธีใช้งานทั่วไป</a>
        </>}
      </nav>
      {mode === "guide" && <section className="cg-panel" id="guide-services">
        <header><Icon name="device" /><h2>PWA อีเมล และคลังอะไหล่</h2></header>
        <div className="cg-service-intro">ติดตั้งแอป รับการแจ้งเตือน และติดตามอะไหล่ โดยใช้บัญชีและสิทธิ์เดิมของคุณ</div>
        <div className="cg-tips">{guideServiceDetails.map(item => <article key={item.title}>
          <span className="cg-tip-icon"><Icon name={item.icon} /></span>
          <h3>{item.title}</h3><p>{item.description}</p>
        </article>)}</div>
        <div className="cg-service-links">
          <GuideLink allowed={guideLinkAllowed(user, "notifications")} view="notifications" onNavigate={onNavigate}>เปิดการแจ้งเตือน</GuideLink>
          <GuideLink allowed={guideLinkAllowed(user, "inventory")} view="inventory" onNavigate={onNavigate}>เปิดคลังอะไหล่</GuideLink>
          <GuideLink allowed={guideLinkAllowed(user, "smtp")} view="smtp" onNavigate={onNavigate}>ตั้งค่า SMTP</GuideLink>
        </div>
      </section>}
      {mode === "flow" && <section className="cg-panel" id="guide-system">
        <header><Icon name="diagram" /><h2>Flow อีเมลและการใช้งาน PWA</h2></header>
        <div className="cg-system-flows">{guideSystemFlows.map(flow => <article key={flow.id}>
          <h3><Icon name={flow.icon} />{flow.title}</h3>
          <ol className="cg-system-steps">{flow.steps.map(step => <li key={step.label}>
            <strong>{step.label}</strong><p>{step.description}</p>
          </li>)}</ol>
          <p className="cg-flow-note">{flow.note}</p>
        </article>)}</div>
      </section>}
      {mode === "flow" && (
      <section className="cg-panel" id="guide-process">
        <header>
          <Icon name="diagram" />
          <h2>แผนผังกระบวนการทำงาน</h2>
          <span>
            <Icon name="lock" />
            ขั้นตอนที่จางต้องใช้สิทธิ์ตามหน้าที่
          </span>
        </header>
        <div className="cg-flows">
          {guideFlows.map((flow) => (
            <article className={`cg-flow cg-flow-${flow.id}`} key={flow.id}>
              <div className="cg-flow-name">
                <span className="cg-flow-icon">
                  <Icon name={flow.icon} />
                </span>
                <div>
                  <h3>{flow.title}</h3>
                  <small>{flow.subtitle}</small>
                </div>
              </div>
              <div className="cg-flow-body">
                <div className="cg-flow-steps">
                  {flow.steps.map((step, index) => (
                    <Fragment key={`${step.label}:${index}`}>
                      {index > 0 && <FlowArrow index={index} />}
                      <GuideLink
                        className="cg-flow-step"
                        allowed={guideCanUseStep(user.role, step) && guideLinkAllowed(user, step.view, step.action || "view")}
                        view={step.view}
                        filter={step.filter}
                        title={step.description}
                        onNavigate={onNavigate}
                      >
                        <em>{index + 1}</em>
                        <span>{step.label}</span>
                      </GuideLink>
                    </Fragment>
                  ))}
                </div>
                {flow.note && <p className="cg-flow-note">{flow.note}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
      )}
      {mode === "guide" && (
      <section className="cg-panel" id="guide-pm">
        <header><Icon name="calendar" /><h2>คู่มือ PM และทะเบียนเครื่องจักร</h2></header>
        <div className="cg-tips">{guidePMDetails.map(item=><article key={item.title}><span className="cg-tip-icon"><Icon name={item.icon}/></span><h3>{item.title}</h3><p>{item.description}</p></article>)}
          <article><span className="cg-tip-icon"><Icon name="assets"/></span><h3>เปลี่ยนบริษัทของเครื่องจักร</h3><p>ทะเบียนเครื่องจักร → เปิดรายละเอียด → แก้ไขเครื่องจักร → เลือกบริษัท → เลือกสาขา → เลือกสถานที่ → บันทึก ต้องมีสิทธิ์แก้ไขและเข้าถึงทั้งต้นทาง/ปลายทาง เมื่อเปลี่ยนบริษัทหรือสาขาจะต้องเลือกสถานที่ใหม่ เครื่องจักรที่มีข้อมูลอ้างอิง เช่น งานซ่อมหรือ PM จะย้ายบริษัท/สาขาไม่ได้ แต่แก้ข้อมูลทั่วไปได้</p></article>
        </div>
      </section>
      )}
      {mode === "flow" && (
      <section className="cg-panel" id="guide-approval">
        <header>
          <Icon name="diagram" />
          <h2>Workflow การอนุมัติตามบทบาท</h2>
          <span><Icon name="lock" />ขั้นตอนที่จางเป็นหน้าที่ของบทบาทอื่นหรือไม่มีสิทธิ์</span>
        </header>
        <p className="cg-approval-summary">แจ้งซ่อม → อนุมัติ → มอบหมาย → ซ่อม → ตรวจรับ → ประเมินและปิดงาน</p>
        <div className="cg-flows">
          {guideApprovalFlows.map(flow => (
            <article className={`cg-flow cg-approval-row${flow.role === user.role ? " cg-approval-current" : ""}`} key={flow.role}>
              <div className="cg-flow-name">
                <span className="cg-flow-icon"><Icon name={flow.icon} /></span>
                <div><h3>{flow.title}</h3><small>{flow.subtitle}</small>{flow.role === user.role && <span className="cg-approval-badge">บทบาทของคุณ</span>}</div>
              </div>
              <div className="cg-flow-body">
                <div className="cg-flow-steps">
                  {flow.steps.map((step, index) => (
                    <Fragment key={step.label}>
                      {index > 0 && <FlowArrow index={index} />}
                      {step.waiting ? (
                        <span className="cg-flow-step cg-approval-wait" title={step.description}><em>{index + 1}</em><span>{step.label}<small>รอขั้นตอนจากผู้เกี่ยวข้อง</small></span></span>
                      ) : (
                        <GuideLink className="cg-flow-step" allowed={flow.role === user.role && guideCanOpen(user.role, step.view) && permitted(user, step.view === "new" ? "repairRequests" : step.view, step.action || "view")} view={step.view} filter={step.filter} title={step.description} onNavigate={onNavigate}>
                          <em>{index + 1}</em><span>{step.label}</span>
                        </GuideLink>
                      )}
                    </Fragment>
                  ))}
                </div>
                <p className="cg-flow-note">{flow.note}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      )}
      {mode === "guide" && <>
      <div className="cg-bottom-grid">
        <section className="cg-panel" id="guide-modules">
          <header>
            <Icon name="dashboard" />
            <h2>{guideModules.length} โมดูลหลักของระบบ</h2>
          </header>
          <div ref={modulesRef} className={`cg-modules${modulesVisible ? " cg-modules-visible" : ""}`}>
            {guideModules.map((module, index) => (
              <article className="cg-module" key={module.view} style={{animationDelay: `${index * 55}ms`}}>
                <div className="cg-module-top">
                  <span className="cg-module-icon">
                    <Icon name={module.icon} />
                  </span>
                  <em>{String(index + 1).padStart(2, "0")}</em>
                </div>
                <h3>{module.title}</h3>
                <small>{module.subtitle}</small>
                <p>{module.description}</p>
                <GuideLink
                  className="cg-module-link"
                  allowed={guideLinkAllowed(user, module.view)}
                  view={module.view}
                  onNavigate={onNavigate}
                >
                  {guideCanOpen(user.role, module.view)
                    ? "เปิดหน้าจอ →"
                    : "สิทธิ์เฉพาะตามบทบาท"}
                </GuideLink>
              </article>
            ))}
          </div>
        </section>
        <section className="cg-panel" id="guide-roles">
          <header>
            <Icon name="users" />
            <h2>คู่มือการใช้งานตามบทบาท</h2>
          </header>
          <div className="cg-roles">
            {guideRoles.map((role) => (
              <details
                className={`cg-role ${role.role === user.role ? "cg-your-role" : ""}`}
                key={role.role}
                open={role.role === user.role ? true : undefined}
              >
                <summary>
                  <span className="cg-role-icon">
                    <Icon
                      name={
                        role.role === "technician"
                          ? "tools"
                          : role.role === "admin"
                            ? "settings"
                            : "users"
                      }
                    />
                  </span>
                  <b>{role.title}</b>
                  {role.role === user.role && (
                    <span className="cg-role-badge">บทบาทของคุณ</span>
                  )}
                  <code>{role.role}</code>
                </summary>
                <p>{role.description}</p>
                <ol>
                  {role.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
          <p className="cg-access-note">
            ผู้ใช้ทุกบทบาทอ่านคู่มือนี้ได้
            การเปิดหน้าจอและดำเนินงานเป็นไปตามบทบาทและสิทธิ์อาคาร/โรงงาน
          </p>
        </section>
      </div>
      <section className="cg-panel" id="guide-tips">
        <header>
          <Icon name="book" />
          <h2>วิธีใช้งานและฟีเจอร์ทั่วไป</h2>
        </header>
        <div className="cg-tips">
          {guideTips.map((tip) => (
            <article key={tip.title}>
              <span className="cg-tip-icon">
                <Icon name={tip.icon} />
              </span>
              <h3>{tip.title}</h3>
              <p>{tip.description}</p>
            </article>
          ))}
        </div>
      </section>
      </>}
    </div>
  );
}
