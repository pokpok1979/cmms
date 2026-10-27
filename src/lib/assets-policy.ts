import type { User } from './domain';
import { inScope, manager } from './domain';
import { permitted } from './permissions';
export const assetReferenceCollections = ['repairRequests','workOrders','pmPlans','pmOccurrences','pmResults','assetMeterReadings','downtimeEvents'] as const;
export function assetScopeChange(actor: User, before: {companyId:string;siteId:string}, after: {companyId:string;siteId:string}, referenced: boolean) {
  if (!manager(actor) || !permitted(actor,'assets','edit') || !inScope(actor,before) || !inScope(actor,after)) return 'forbidden';
  if ((before.companyId!==after.companyId || before.siteId!==after.siteId) && referenced) return 'has-history';
  return null;
}
