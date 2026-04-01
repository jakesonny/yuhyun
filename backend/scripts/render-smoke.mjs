const baseUrl = process.env.RENDER_BASE_URL;

if (!baseUrl) {
  console.error('RENDER_BASE_URL is required. Example: https://your-api.onrender.com');
  process.exit(1);
}

async function check(pathname) {
  const url = new URL(pathname, baseUrl).toString();
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) ${url}\n${text}`);
  }

  console.log(`OK ${res.status} ${url}`);
  console.log(text);
}

async function main() {
  console.log('[smoke] checking render endpoints...');
  await check('/api/health');
  await check('/api/ingest/stats');
  console.log('[smoke] done');
}

main().catch((err) => {
  console.error('[smoke] failed');
  console.error(err.message);
  process.exit(1);
});
