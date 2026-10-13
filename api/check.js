const webpush = require("web-push");
const { Redis } = require("@upstash/redis");
webpush.setVapidDetails("mailto:stationwise@morriscsy.github.io", process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
function redis(){ return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }); }
async function eta(w){
  try{
    if(w.kind==="mtr") return null;
    const url = w.co==="kmb"
      ? "https://data.etabus.gov.hk/v1/transport/kmb/eta/"+encodeURIComponent(w.stopId)+"/"+encodeURIComponent(w.route)+"/"+encodeURIComponent(w.bound||"1")
      : "https://rt.data.gov.hk/v1/transport/citybus-nwfb/eta/"+encodeURIComponent(w.co==="citybus"?"CTB":"CTB")+"/"+encodeURIComponent(w.stopId)+"/"+encodeURIComponent(w.route);
    const j = await fetch(url).then(r=>r.json());
    const rows = (j.data||[]).filter(x=>x.eta).sort((a,b)=>new Date(a.eta)-new Date(b.eta));
    return rows[0]||null;
  }catch(e){ return null; }
}
module.exports = async function handler(req, res){
  if(req.headers["x-cron-secret"] && process.env.CRON_SECRET && req.headers["x-cron-secret"]!==process.env.CRON_SECRET){
    return res.status(401).json({error:"bad secret"});
  }
  const r = redis();
  const ids = await r.smembers("subs") || [];
  let sent=0;
  for(const id of ids){
    const raw = await r.get("sub:"+id);
    if(!raw) continue;
    const sub = typeof raw==="string" ? JSON.parse(raw) : raw;
    const watches = sub.watches||[];
    const alerted = sub.alerted||{};
    let changed=false;
    for(const w of watches){
      const first = await eta(w);
      if(!first || !first.eta) continue;
      const mins = Math.max(0, Math.round((new Date(first.eta)-Date.now())/60000));
      const stamp = new Date(first.eta).getTime();
      const busKey = (w.key||w.route)+"|bus";
      if(!alerted[busKey] || stamp-alerted[busKey]>180000){
        alerted[busKey]=stamp;
        [10,5,1].forEach(m=>delete alerted[(w.key||w.route)+"|"+m]);
        changed=true;
      }
      for(const mark of [10,5,1]){
        const aid=(w.key||w.route)+"|"+mark;
        if(mins<mark-1){ alerted[aid]=1; changed=true; continue; }
        if(mins<=mark && mins>=mark-1 && !alerted[aid]){
          alerted[aid]=1; changed=true;
          const title=(w.route||"")+" 往 "+(first.dest||w.dest||"");
          const body="第 1 班剩約 "+mark+" 分鐘";
          try{
            await webpush.sendNotification({endpoint:sub.endpoint, keys:sub.keys}, JSON.stringify({title:"StationWise", body:title+" · "+body, tag:aid}));
            sent++;
          }catch(e){
            if(e.statusCode===404 || e.statusCode===410){ await r.srem("subs", id); await r.del("sub:"+id); }
          }
        }
      }
    }
    if(changed){
      sub.alerted=alerted;
      await r.set("sub:"+id, JSON.stringify(sub));
    }
  }
  return res.status(200).json({ok:true, sent, subs:ids.length});
};
