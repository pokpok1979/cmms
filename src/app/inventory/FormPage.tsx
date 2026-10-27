'use client';
import type { ReactNode } from 'react';

export default function FormPage({title,busy=false,onClose,children}:{title:string;busy?:boolean;onClose:()=>void;children:ReactNode}) {
  return <section className="p3-panel inv-form-page" aria-label={title}>
    <header className="p3-section-title"><h2>{title}</h2><button type="button" disabled={busy} onClick={onClose}>← กลับรายการ</button></header>
    {children}
  </section>;
}
