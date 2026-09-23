async function verify() {
  const indexHtml = await fetch('http://localhost:5000').then(r => r.text());
  console.log('Index HTML served successfully! Length:', indexHtml.length);
  const match = indexHtml.match(/src="(\/assets\/[^"]+)"/);
  console.log('Script tag in index.html:', match ? match[1] : 'NOT FOUND');

  if (match) {
    const jsRes = await fetch(`http://localhost:5000${match[1]}`);
    console.log(`Bundle ${match[1]} HTTP Status:`, jsRes.status, 'Type:', jsRes.headers.get('content-type'));
  }
}

verify().catch(console.error);
