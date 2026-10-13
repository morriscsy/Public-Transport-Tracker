const { Redis } = require("@upstash/redis");
function redis(){
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}
module.exports = async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  const body = typeof req.body==="string" ? JSON.parse(req.body||"{}") : (req.body||{});
  if(!body.endpoint || !body.keys) return res.status(400).json({error:"bad subscription"});
  const r = redis();
  const id = Buffer.from(body.endpoint).toString("base64").slice(0,80);
  await r.set("sub:"+id, JSON.stringify({
    endpoint: body.endpoint,
    keys: body.keys,
    watches: body.watches||[],
    updated: Date.now()
  }));
  await r.sadd("subs", id);
  return res.status(200).json({ok:true, id});
};
