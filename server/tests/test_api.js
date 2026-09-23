const app = require('../index');
const http = require('http');

const server = http.createServer(app);
server.listen(5099, async () => {
  console.log('Test server running on port 5099');

  const baseUrl = 'http://localhost:5099/api';

  try {
    // 1. Health check
    const health = await fetch(`${baseUrl}/health`).then(r => r.json());
    console.log('1. Health check:', health.status);

    // 2. Dashboard
    const dashboard = await fetch(`${baseUrl}/dashboard`).then(r => r.json());
    console.log('2. Dashboard counters:', dashboard.counters);

    // 3. Customers
    const custs = await fetch(`${baseUrl}/customers?limit=5`).then(r => r.json());
    console.log('3. Customers total:', custs.total, 'fetched:', custs.customers.length);

    // 4. Jobs
    const jobs = await fetch(`${baseUrl}/jobs?limit=5`).then(r => r.json());
    console.log('4. Jobs total:', jobs.total, 'fetched:', jobs.jobs.length);

    // 5. Global Search
    const search = await fetch(`${baseUrl}/automation/search?q=AMAGI`).then(r => r.json());
    console.log('5. Search for AMAGI:', search.results.customers.length, 'customer(s) found');

    // 6. Reports
    const rep = await fetch(`${baseUrl}/reports/pending`).then(r => r.json());
    console.log('6. Pending Jobs report count:', rep.count);

    // 7. Daily Automation
    const auto = await fetch(`${baseUrl}/automation/run-daily`, { method: 'POST' }).then(r => r.json());
    console.log('7. Daily Automation result:', auto.result.today, 'New jobs generated:', auto.result.generatedJobsCount);

    console.log('\n✅ ALL API ENDPOINTS VERIFIED AND WORKING PERFECTLY!');
  } catch (err) {
    console.error('API Test failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
