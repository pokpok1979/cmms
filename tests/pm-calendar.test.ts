import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleDay,bangkokDay,validDay } from '../src/lib/pm-calendar';
test('month end remains anchored, including leap year',()=>{assert.equal(cycleDay('2024-01-31','month',1,1),'2024-02-29');assert.equal(cycleDay('2024-01-31','month',1,2),'2024-03-31');assert.equal(cycleDay('2025-01-31','month',1,1),'2025-02-28');});
test('day cycles cross year',()=>assert.equal(cycleDay('2025-12-31','day',7,1),'2026-01-07'));
test('Bangkok due day at UTC boundary',()=>assert.equal(bangkokDay(new Date('2026-10-21T18:00:00Z')),'2026-10-22'));
test('reject invalid dates',()=>{assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2026-02-28'),true);});
