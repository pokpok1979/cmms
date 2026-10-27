const paths = {
  plan: 'M8 4h8v4H8z M8 6H5v15h14V6h-3 M8 12h8 M8 16h5',
  asset: 'M4 21V9l8-5 8 5v12H4z M8 21v-6h8v6 M8 10h1 M15 10h1',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 11h16 M8 15h2 M14 15h2',
  repeat: 'M20 8H7a4 4 0 0 0-4 4 M17 5l3 3-3 3 M4 16h13a4 4 0 0 0 4-4 M7 13l-3 3 3 3',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  checklist: 'M9 5h12 M9 12h12 M9 19h12 M2 5l2 2 3-4 M2 12l2 2 3-4 M2 19l2 2 3-4',
  save: 'M4 3h13l4 4v14H3V3h1 M7 3v6h10V3 M7 21v-8h10v8',
  cancel: 'M6 6l12 12 M18 6 6 18',
};
export default function PlanIcon({name}:{name:keyof typeof paths}) {
  return <svg className="pm-plan-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
