const { execSync } = require('child_process');

console.log('--- Running Recurring Engine Tests ---');
execSync('node server/tests/test_recurring.js', { stdio: 'inherit' });

console.log('\n--- Running Excel Importer Tests ---');
execSync('node server/tests/test_importer.js', { stdio: 'inherit' });

console.log('\n--- Running API Integration Tests ---');
execSync('node server/tests/test_api.js', { stdio: 'inherit' });

console.log('\n========================================');
console.log('🎉 ALL BACKEND SUITES PASSED EFFECTIVELY!');
console.log('========================================');
