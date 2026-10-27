export function workOrderStatusFilter(status: string) {
  if (status === "waiting") return { $in: ["waiting_parts", "waiting_contractor"] };
  return (status === "outstanding" || status === "overdue")
    ? { $nin: ["completed", "cancelled"] }
    : status;
}

export function workOrderListFilter(status: string, now = new Date()) {
  return {
    ...(status ? { status: workOrderStatusFilter(status) } : {}),
    ...(status === "overdue" ? { dueAt: { $lt: now } } : {}),
  };
}
