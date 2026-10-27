export const AUDIT_PAGE_SIZE = 20;
export function auditPageNumbers(
  page: number,
  pageCount: number,
): (number | "ellipsis")[] {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const start =
    page <= 2 ? 1 : page >= pageCount - 1 ? pageCount - 2 : page - 1;
  const end = Math.min(pageCount, start + 2);
  const numbers: (number | "ellipsis")[] = [];
  if (start > 1) {
    numbers.push(1);
    if (start > 2) numbers.push("ellipsis");
  }
  for (let n = start; n <= end; n++) numbers.push(n);
  if (end < pageCount) {
    if (end < pageCount - 1) numbers.push("ellipsis");
    numbers.push(pageCount);
  }
  return numbers;
}
