export default async function handler(req, res) {
  const app = decodeURIComponent(req.query.app);
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

  const state = await redis(["GET", "state:" + app]);

  if (state === "open") {
    const openTime = parseInt(await redis(["GET", "opentime:" + app]));
    const duration = Math.round((now - openTime) / 1000);
    let usage = await redis(["GET", "usage:" + today]);
    usage = usage ? JSON.parse(usage) : {};
    if (!usage[app]) usage[app] = { count: 0, total: 0 };
    usage[app].count += 1;
    usage[app].total += duration;
    await redis(["SET", "usage:" + today, JSON.stringify(usage)]);
    await redis(["SET", "state:" + app, "close"]);
    await redis(["SADD", "apps", app]);
    return res.status(200).json({ app, action: "close", duration });
  } else {
    await redis(["SET", "state:" + app, "open"]);
    await redis(["SET", "opentime:" + app, String(now)]);
    await redis(["SADD", "apps", app]);
    return res.status(200).json({ app, action: "open" });
  }
}
