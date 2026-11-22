// Keep the device ticket encrypted at rest. GitHub credentials stay in memory.
const store = "sessions";
let opened;
function database() {
  if (!opened) opened = new Promise((resolve,reject)=>{
    const req=indexedDB.open("virtual-gallery.login",1);
    req.onupgradeneeded=()=>req.result.createObjectStore(store);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  }).catch(error=>{opened=null;throw error;});
  return opened;
}
async function access(mode,operation) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode);
    const req=operation(tx.objectStore(store));
    tx.oncomplete=()=>resolve(req.result);
    tx.onabort=tx.onerror=()=>reject(tx.error || Error("裝置儲存空間暫時無法使用。"));
  });
}
export async function remember(ticket,expire) {
  const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const box=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(ticket));
  await access("readwrite",s=>s.put({iv,key,box,expire},"current"));
}
export async function recall() {
  const record=await access("readonly",s=>s.get("current"));
  if (!record || record.expire<=Date.now())return;
  const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:record.iv},record.key,record.box);
  return new TextDecoder().decode(clear);
}
export function forget() {
  return access("readwrite",s=>s.delete("current"));
}
