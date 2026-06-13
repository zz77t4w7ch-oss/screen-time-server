export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const URL = process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const now = Date.now();
  const today = new Date(now + 8 * 3600000).toISOString().split('T')[0];

  async function redis(cmd) {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(cmd)
    });
    return (await r.json()).result;
  }

  let usage = await redis(["GET", "usage:" + today]);
  usage = usage ? JSON.parse(usage) : {};

  const apps = await redis(["SMEMBERS", "apps"]) || [];
  for (const app of apps) {
    const state = await redis(["GET", "state:" + app]);
    if (state === "open") {
      const openTime = parseInt(await redis(["GET", "opentime:" + app]));
      const ongoing = Math.round((now - openTime) / 1000);
      if (!usage[app]) usage[app] = { count: 0, total: 0 };
      usage[app].ongoing = ongoing;
    }
  }

  const result = {};
  for (const [app, d] of Object.entries(usage)) {
    const totalMin = Math.round((d.total + (d.ongoing || 0)) / 60);
    result[app] = {
      count: d.count,
      totalMinutes: totalMin,
      ...(d.ongoing && { status: "正在使用" })
    };
  }

  return res.status(200).json({ date: today, apps: result });
}
