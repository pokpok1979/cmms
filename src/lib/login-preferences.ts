export function loginCompanyName(configured:unknown,fallback:unknown) {
  for(const value of [configured,fallback])if(typeof value==="string"&&value.trim())return value.trim().slice(0,200);
  return "";
}
