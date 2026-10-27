// Hide internal site UUIDs in legacy document numbers.
export function displayDocumentNumber(value: string): string {
  return value.replace(/^(RR|WO)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(\d{4})-(\d+)$/i, "$1-$2-$3");
}
