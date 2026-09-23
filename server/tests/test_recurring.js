const assert = require('assert');
const { calculateNextServiceDate } = require('../services/recurringEngine');

console.log('Testing Recurring Date Engine Calculations:');

// Test Monthly
const nextMonthly = calculateNextServiceDate('2026-09-10', 'MONTHLY');
console.log('Monthly (2026-09-10):', nextMonthly);
assert.strictEqual(nextMonthly, '2026-10-10', 'Monthly should advance by 1 month');

// Test Weekly
const nextWeekly = calculateNextServiceDate('2026-09-07', 'WEEKLY', 'MON');
console.log('Weekly (2026-09-07 MON):', nextWeekly);
assert.strictEqual(nextWeekly, '2026-09-14', 'Weekly should advance by 7 days');

// Test Fortnightly
const nextFortnightly = calculateNextServiceDate('2026-09-10', 'FORTNIGHTLY');
console.log('Fortnightly (2026-09-10):', nextFortnightly);
assert.strictEqual(nextFortnightly, '2026-09-24', 'Fortnightly should advance by 14 days');

// Test Daily
const nextDaily = calculateNextServiceDate('2026-09-10', 'DAILY');
console.log('Daily (2026-09-10):', nextDaily);
assert.strictEqual(nextDaily, '2026-09-11', 'Daily should advance by 1 day');

// Test 3 Monthly
const next3Monthly = calculateNextServiceDate('2026-06-15', '3 MONTHLY');
console.log('3 Monthly (2026-06-15):', next3Monthly);
assert.strictEqual(next3Monthly, '2026-09-15', '3 Monthly should advance by 3 months');

console.log('✅ ALL RECURRING ENGINE DATE TESTS PASSED!');
