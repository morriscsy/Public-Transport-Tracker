self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("push", function(e){
  var data={title:"StationWise", body:"到站提醒"};
  try{ if(e.data) data=Object.assign(data, e.data.json()); }catch(err){}
  e.waitUntil(self.registration.showNotification(data.title||"StationWise", {
    body:data.body||"",
    icon:"icon-192.png",
    badge:"icon-192.png",
    tag:data.tag||data.body||"sw",
    renotify:false,
    data:data
  }));
});
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  e.waitUntil(clients.matchAll({type:"window", includeUncontrolled:true}).then(function(list){
    if(list.length) return list[0].focus();
    return clients.openWindow("./");
  }));
});
