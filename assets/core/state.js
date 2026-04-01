export function createEmptySite(n = 1){
  return {
    id: crypto.randomUUID(),
    name: `Site ${n}`,
    type: 'Bureaux tertiaires',
    project: 'Neuf',
    zone: 'H2',
    surface: 10000,
    zones: 10,
    baseKwh: 3500000,
    priceKwh: 0.16,
    systems: { heat:true, cool:false, vent:false, ecs:false, light:false, other:false },
    powerMode: 'total',
    powerKw: 320,
    powerDetail: { heat:320, cool:0, vent:0, ecs:0, light:0, other:0 },
    existing: { interop:false, hourly:false, logging:false, manual:false },
    targetClass: 'B',
    supervision: 'non',
    ceePrice: 6,
    usages: { heat:true, ecs:false, cool:false, light:false, aux:false }
  };
}
export function createEmptyProject(){
  return {
    meta: { createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
    sites: [createEmptySite(1)],
    activeSiteId: null,
    contact: { firstName:'', lastName:'', company:'', email:'', phone:'', message:'' },
    proposal: { client:'', reference:'', feeHt:0, delay:'À confirmer' }
  };
}
