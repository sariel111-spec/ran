import {useSyncExternalStore} from 'react';

export type Kind='plot'|'fic'|'art'|'comic'|'ao3'|'misc';
export const kinds:{id:Kind;name:string}[]=[
  {id:'plot',name:'剧情'},{id:'fic',name:'同人文'},{id:'art',name:'同人画'},
  {id:'comic',name:'漫剧'},{id:'ao3',name:'AO3'},{id:'misc',name:'杂食'},
];
export const kindName=(k:Kind)=>kinds.find(x=>x.id===k)?.name??'';

export type Status='want'|'eating'|'done';
export const statuses:{id:Status;name:string}[]=[{id:'want',name:'想吃'},{id:'eating',name:'在吃'},{id:'done',name:'吃完'}];

type Base={id:string;who:string[];site:string;url:string;note:string;sample?:boolean;created:number;updated:number};
export type Item=Base&{kind:Kind;title:string;by:string;taste:number;status:Status;cover?:string};
export type Series=Base&{title:string;by:string;seen:number;total:number;state:'on'|'end'|'pit';visited:number};
export type Chef=Base&{name:string;visited:number};
export type State={items:Item[];series:Series[];chefs:Chef[];flips:Record<string,string[]>;dead:Record<string,number>};

const DB='ran-site',STORE='kv';
let db:Promise<IDBDatabase>|null=null;
const open=()=>db??=new Promise<IDBDatabase>((ok,no)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE);
  r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
});
const idb=async<T>(mode:IDBTransactionMode,fn:(s:IDBObjectStore)=>IDBRequest):Promise<T>=>{
  const d=await open();
  return new Promise<T>((ok,no)=>{const q=fn(d.transaction(STORE,mode).objectStore(STORE));q.onsuccess=()=>ok(q.result as T);q.onerror=()=>no(q.error);});
};
export const getKey=<T,>(k:string)=>idb<T|undefined>('readonly',s=>s.get(k)).catch(()=>undefined);
const setKey=(k:string,v:unknown)=>idb('readwrite',s=>s.put(v,k)).catch(()=>undefined);
const delKey=(k:string)=>idb('readwrite',s=>s.delete(k)).catch(()=>undefined);

const empty=():State=>({items:[],series:[],chefs:[],flips:{},dead:{}});
let state:State=empty();
let ready=false;
const subs=new Set<()=>void>();
const emit=()=>subs.forEach(f=>f());
let pushTimer=0;
const commit=(next:State)=>{state=next;emit();void setKey('state',next);clearTimeout(pushTimer);pushTimer=window.setTimeout(()=>{void syncNow();},2500);};

export const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

export async function boot(){
  const saved=await getKey<State>('state');
  if(saved&&Array.isArray(saved.items))state=clean(saved);
  remote=(await getKey<Remote>('remote'))??null;
  if(remote)sync={state:'idle',message:'已连接',at:0};
  ready=true;emit();
  if(remote)void syncNow();
  addEventListener('online',()=>{void syncNow();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void syncNow();});
  // 另一台设备可能正在用：这台亮着的时候，隔一会儿去看看它有没有新东西
  setInterval(()=>{if(remote&&document.visibilityState==='visible'&&navigator.onLine!==false)void syncNow(true);},20000);
  addEventListener('pagehide',()=>{void setKey('state',state);});
}
export const isReady=()=>ready;
export function useStore():State{
  return useSyncExternalStore(f=>{subs.add(f);return()=>{subs.delete(f);};},()=>state);
}

export function flip(id:string){
  const d=today(),had=state.flips[d]??[];
  if(had.includes(id))return;
  // 只留最近六十天
  const keep=Object.fromEntries(Object.entries(state.flips).sort().slice(-59));
  commit({...state,flips:{...keep,[d]:[...had,id]}});
}
export const flippedToday=(s:State)=>s.flips[today()]??[];

export function saveItem(it:Partial<Item>&{title:string}){
  const now=Date.now();
  if(it.id&&state.items.some(x=>x.id===it.id))
    commit({...state,items:state.items.map(x=>x.id===it.id?{...x,...it,sample:false,updated:now} as Item:x)});
  else commit({...state,items:[{kind:'misc',who:[],by:'',site:'',url:'',note:'',taste:0,status:'want',created:now,updated:now,...it,id:uid()} as Item,...state.items]});
}
export function saveSeries(it:Partial<Series>&{title:string}){
  const now=Date.now();
  if(it.id&&state.series.some(x=>x.id===it.id))
    commit({...state,series:state.series.map(x=>x.id===it.id?{...x,...it,sample:false,updated:now} as Series:x)});
  else commit({...state,series:[{who:[],by:'',site:'',url:'',note:'',seen:0,total:0,state:'on',visited:0,created:now,updated:now,...it,id:uid()} as Series,...state.series]});
}
export function saveChef(it:Partial<Chef>&{name:string}){
  const now=Date.now();
  if(it.id&&state.chefs.some(x=>x.id===it.id))
    commit({...state,chefs:state.chefs.map(x=>x.id===it.id?{...x,...it,sample:false,updated:now} as Chef:x)});
  else commit({...state,chefs:[{who:[],site:'',url:'',note:'',visited:0,created:now,updated:now,...it,id:uid()} as Chef,...state.chefs]});
}
export function remove(type:'items'|'series'|'chefs',id:string){
  // 删掉的东西留一个记号，别的设备同步时才知道它是被删了，而不是还没收到
  commit({...state,[type]:(state[type] as Base[]).filter(x=>x.id!==id),dead:{...state.dead,[id]:Date.now()}} as State);
}
export function step(id:string,by:number){
  commit({...state,series:state.series.map(x=>x.id===id?{...x,seen:Math.max(0,x.seen+by),visited:Date.now(),updated:Date.now()}:x)});
}
export const days=(n:number)=>{const out:string[]=[];for(let i=n-1;i>=0;i--){const d=new Date(Date.now()-i*864e5);out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);}return out;};
export function visited(type:'series'|'chefs',id:string){
  commit({...state,[type]:(state[type] as (Series|Chef)[]).map(x=>x.id===id?{...x,visited:Date.now()}:x)} as State);
}
export function setStatus(id:string,status:Status){
  commit({...state,items:state.items.map(x=>x.id===id?{...x,status,updated:Date.now()}:x)});
}
export function clearSamples(){
  commit({...state,items:state.items.filter(x=>!x.sample),series:state.series.filter(x=>!x.sample),chefs:state.chefs.filter(x=>!x.sample)});
}
export const hasSamples=(s:State)=>s.items.some(x=>x.sample)||s.series.some(x=>x.sample)||s.chefs.some(x=>x.sample);

// 图片：缩到 900px 以内存进本机，连上仓库后也会传上去
export async function putCover(file:File):Promise<string>{
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise<HTMLImageElement>((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url;});
    const k=Math.min(1,900/Math.max(img.width,img.height));
    const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);
    const id=uid()+'.jpg';await setKey('asset:'+id,c.toDataURL('image/jpeg',.86));
    await setKey('dirty',[...((await getKey<string[]>('dirty'))??[]),id]);
    return id;
  }finally{URL.revokeObjectURL(url);}
}
export async function getCover(id:string):Promise<string|undefined>{
  const here=await getKey<string>('asset:'+id);
  if(here||!remote)return here;
  try{
    const r=await api('assets/'+encodeURIComponent(id));
    if(!r.ok)return undefined;
    const j=await r.json();
    const data='data:image/jpeg;base64,'+String(j.content??'').replace(/\s/g,'');
    if(data.length<40)return undefined;
    await setKey('asset:'+id,data);return data;
  }catch{return undefined;}
}

export function exportJson(){return JSON.stringify({app:APP,...state},null,1);}
export function importJson(text:string){
  const j=JSON.parse(text);
  if(j.app!==APP||!Array.isArray(j.items))throw new Error('这不是「染」的备份文件');
  commit(merge(state,clean(j)));
}

/* ───────── 同步：数据放在自己的私有仓库里 ───────── */

const APP='ran-site';
export type Remote={owner:string;repo:string;token:string};
export type SyncInfo={state:'local'|'idle'|'syncing'|'error';message:string;at:number};
let remote:Remote|null=null;
let sync:SyncInfo={state:'local',message:'只保存在这台设备上',at:0};
export const getSync=()=>sync;
export function useSync():SyncInfo{return useSyncExternalStore(f=>{subs.add(f);return()=>{subs.delete(f);};},()=>sync);}
export const getRemote=()=>remote?{owner:remote.owner,repo:remote.repo}:null;
const setSync=(st:SyncInfo['state'],message:string)=>{sync={state:st,message,at:st==='idle'?Date.now():sync.at};emit();};

const api=(path:string,init:RequestInit={})=>fetch(`https://api.github.com/repos/${remote!.owner}/${remote!.repo}/contents/${path}`,
  {cache:'no-store',...init,headers:{Authorization:`Bearer ${remote!.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(init.headers||{})}});
const b64=(u:Uint8Array)=>{let t='';for(let i=0;i<u.length;i+=0x8000)t+=String.fromCharCode(...u.subarray(i,i+0x8000));return btoa(t);};
const utf8=(t:string)=>b64(new TextEncoder().encode(t));

const isRec=(r:unknown)=>!!r&&typeof r==='object'&&typeof (r as Base).id==='string'&&typeof (r as Base).updated==='number'&&Array.isArray((r as Base).who);
// 只认得自己的东西：形状不对的一律丢掉；翻牌记录只留最近六十天
function clean(j:unknown):State{
  const o=(j&&typeof j==='object'?j:{}) as Record<string,unknown>;
  const list=<T,>(v:unknown)=>(Array.isArray(v)?v.filter(isRec):[]) as T[];
  const edge=days(60)[0];
  const flips:Record<string,string[]>={};
  if(o.flips&&typeof o.flips==='object')for(const [d,v] of Object.entries(o.flips as Record<string,unknown>))
    if(/^\d{4}-\d\d-\d\d$/.test(d)&&d>=edge&&Array.isArray(v))flips[d]=[...new Set(v.filter(x=>typeof x==='string'))] as string[];
  const dead:Record<string,number>={};
  if(o.dead&&typeof o.dead==='object')for(const [k,v] of Object.entries(o.dead as Record<string,unknown>))if(typeof v==='number')dead[k]=v;
  return {items:list<Item>(o.items),series:list<Series>(o.series),chefs:list<Chef>(o.chefs),flips,dead};
}
// 两边一样新时留仓库里那份，这样每台设备最后都落在同一份上
const newer=<T extends {updated:number}>(a:T,b:T|undefined)=>!b||a.updated>b.updated?a:b;
export function merge(mine:State,theirs:State):State{
  const dead:Record<string,number>={...theirs.dead};
  for(const k in mine.dead)dead[k]=Math.max(mine.dead[k],dead[k]??0);
  const join=<T extends Base>(a:T[],b:T[])=>{
    const by=new Map(b.map(r=>[r.id,r]));
    for(const r of a)by.set(r.id,newer(r,by.get(r.id)));
    return [...by.values()].filter(r=>!(dead[r.id]>=r.updated));
  };
  const flips:Record<string,string[]>={...theirs.flips};
  for(const d in mine.flips)flips[d]=[...new Set([...(flips[d]??[]),...mine.flips[d]])];
  return {items:join(mine.items,theirs.items),series:join(mine.series,theirs.series),chefs:join(mine.chefs,theirs.chefs),flips,dead};
}
// 两台设备存的顺序不一样，比较时不看顺序
const canon=(st:State)=>{
  const sort=(v:unknown):unknown=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v as object).sort().map(k=>[k,sort((v as Record<string,unknown>)[k])])):v;
  const byId=<T extends {id:string}>(a:T[])=>[...a].sort((x,y)=>x.id<y.id?-1:1);
  return JSON.stringify(sort({...st,items:byId(st.items),series:byId(st.series),chefs:byId(st.chefs),flips:Object.fromEntries(Object.entries(st.flips).map(([d,v])=>[d,[...v].sort()]))}));
};
// 同一个账号下还有别的网站用同样的文件位置。不是「染」写的文件，既不合并也不覆盖。
const FOREIGN='这个仓库里存的是另一个网站的数据，不能用来同步「染」。请把仓库名改成 ran-data，并使用为它生成的令牌。';
const foreign=(j:unknown)=>{
  if(!j||typeof j!=='object')return true;
  const o=j as Record<string,unknown>;
  return o.app!==APP||!Array.isArray(o.items);
};
class ForeignRepo extends Error{}
let running:Promise<void>|null=null,again=false;
export function syncNow(quiet=false):Promise<void>{
  if(!remote)return Promise.resolve();
  if(running){again=true;return running;}
  running=(async()=>{
    if(!quiet)setSync('syncing','正在同步…');
    try{
      let saved=false;
      for(let attempt=0;attempt<4&&!saved;attempt++){
        const head=await api('data/state.json');
        let sha:string|undefined,theirs:State|null=null;
        if(head.status===200){
          const j=await head.json();sha=j.sha;
          const text=j.content?new TextDecoder().decode(Uint8Array.from(atob(String(j.content).replace(/\s/g,'')),c=>c.charCodeAt(0)))
            :await (await api('data/state.json',{headers:{Accept:'application/vnd.github.raw+json'}})).text();
          const parsed=JSON.parse(text);
          if(foreign(parsed))throw new ForeignRepo();
          theirs=clean(parsed);
        }else if(head.status!==404)throw new Error(head.status===401?'令牌失效了，请在设置里重新填写':head.status===403?'令牌没有这个仓库的读写权限':`读取失败（${head.status}）`);
        const merged=theirs?merge(state,theirs):state;
        if(canon(merged)!==canon(state)){state=merged;await setKey('state',state);emit();}
        for(const id of (await getKey<string[]>('dirty'))??[]){
          const data=await getKey<string>('asset:'+id);
          if(data){
            const r=await api('assets/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({message:'add '+id,content:data.slice(data.indexOf(',')+1)})});
            if(!r.ok&&r.status!==422)throw new Error(`有一张图没传上去（${r.status}）`);
          }
          await setKey('dirty',((await getKey<string[]>('dirty'))??[]).filter(x=>x!==id));
        }
        if(theirs&&canon(merged)===canon(theirs)){saved=true;break;}
        const w=await api('data/state.json',{method:'PUT',body:JSON.stringify({message:'sync',content:utf8(JSON.stringify({app:APP,...merged})),sha})});
        if(w.ok)saved=true;else if(w.status!==409&&w.status!==422)throw new Error(`保存失败（${w.status}）`);
      }
      if(!saved)throw new Error('另一台设备正在同时保存，过一会儿会再试');
      setSync('idle','已同步');
    }catch(e){
      if(e instanceof ForeignRepo){remote=null;await delKey('remote');setSync('error','已停止同步：'+FOREIGN);}
      else setSync('error',(e as Error).message||'同步失败，稍后会再试');
    }
  })().finally(()=>{running=null;if(again){again=false;void syncNow();}});
  return running;
}
export async function connect(r:Remote){
  const h={Authorization:`Bearer ${r.token}`,Accept:'application/vnd.github+json'};
  const probe=await fetch(`https://api.github.com/repos/${r.owner}/${r.repo}`,{headers:h,cache:'no-store'});
  if(probe.status===401)throw new Error('令牌不对，或已经过期');
  if(probe.status===404)throw new Error('找不到这个仓库，或令牌没有选中它');
  if(!probe.ok)throw new Error(`连接失败（${probe.status}）`);
  const j=await probe.json();
  if(!j.permissions?.push)throw new Error('令牌只有读取权限，需要 Contents: Read and write');
  if(!j.private)throw new Error('这个仓库是公开的。为了不让收藏被别人看到，请换一个私有仓库');
  const has=await fetch(`https://api.github.com/repos/${r.owner}/${r.repo}/contents/data/state.json`,{cache:'no-store',headers:{...h,Accept:'application/vnd.github.raw+json'}});
  if(has.ok){let body:unknown=null;try{body=await has.json();}catch{/* 读不出来就当不是自己的 */}if(foreign(body))throw new Error(FOREIGN);}
  remote=r;await setKey('remote',r);await syncNow();
}
// 连接可以用一串码带到另一台设备，不用再找令牌
export const linkCode=()=>remote?'ran1.'+btoa(JSON.stringify([remote.owner,remote.repo,remote.token])):'';
export const readLinkCode=(code:string):Remote|null=>{
  try{const m=/ran1\.([A-Za-z0-9+/=]+)/.exec(code);if(!m)return null;const [owner,repo,token]=JSON.parse(atob(m[1]));return owner&&repo&&token?{owner,repo,token}:null;}catch{return null;}
};
export async function disconnect(){remote=null;await delKey('remote');sync={state:'local',message:'只保存在这台设备上',at:0};emit();}

// 链接是哪家的
export function siteOf(url:string):string{
  const u=url.toLowerCase();
  if(/xiaohongshu\.com|xhslink\.com/.test(u))return '小红书';
  if(/douyin\.com/.test(u))return '抖音';
  if(/bilibili\.com|b23\.tv/.test(u))return 'B站';
  if(/archiveofourown\.org|ao3\.org/.test(u))return 'AO3';
  if(/lofter\.com/.test(u))return 'LOFTER';
  if(/weibo\.(com|cn)/.test(u))return '微博';
  return u?'别处':'';
}
// 把 App 里「分享」复制出来的那一整段拆开
export function readShare(text:string):{url:string;title:string;by:string;site:string}{
  const m=text.match(/https?:\/\/[^\s，。】）]+/);
  const url=m?m[0]:'';
  let rest=(m?text.replace(m[0],' '):text).replace(/\s+/g,' ').trim();
  let title='',by='';
  const dy=rest.match(/【(.+?)的作品】\s*(.*)/);
  const bracket=rest.match(/【(.+?)】/);
  if(dy){by=dy[1];title=dy[2];}
  else if(bracket){
    const parts=bracket[1].split(/\s[-|｜]\s/);
    title=parts[0];
    if(parts[1]&&!/小红书|哔哩哔哩|bilibili/i.test(parts[1]))by=parts[1];
  }else title=rest;
  title=title.replace(/复制(此链接|打开抖音).*$/,'').replace(/[#＃]\s?\S+/g,'').replace(/\s[\w.]+@[\w.]+.*$/,'').replace(/^\d+(\.\d+)?\s+/,'').trim().slice(0,80);
  return {url,title,by:by.trim(),site:siteOf(url)};
}
// 翻牌时一声很轻的木头响，设置里可以关
export const soundOn=()=>{try{return localStorage.getItem('ran-sound')!=='0';}catch{return true;}};
export const setSound=(on:boolean)=>{try{localStorage.setItem('ran-sound',on?'1':'0');}catch{/* 存不了就算了 */}};
let ac:AudioContext|null=null;
export function tock(){
  if(!soundOn())return;
  try{
    ac??=new AudioContext();
    const t=ac.currentTime;
    const o=ac.createOscillator(),g=ac.createGain();
    o.type='triangle';o.frequency.setValueAtTime(520,t);o.frequency.exponentialRampToValueAtTime(190,t+.07);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.16,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+.11);
    o.connect(g).connect(ac.destination);o.start(t);o.stop(t+.13);
    const n=ac.createBufferSource(),b=ac.createBuffer(1,Math.floor(ac.sampleRate*.03),ac.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
    const f=ac.createBiquadFilter(),ng=ac.createGain();f.type='bandpass';f.frequency.value=2400;ng.gain.value=.07;
    n.buffer=b;n.connect(f).connect(ng).connect(ac.destination);n.start(t);
  }catch{/* 没有声音也不要紧 */}
}
export function ago(t:number):string{
  if(!t)return '还没去看过';
  const d=Math.floor((Date.now()-t)/864e5);
  if(d<=0)return '今天看过';
  if(d===1)return '昨天看过';
  if(d<30)return `${d} 天前看过`;
  return `${Math.floor(d/30)} 个月没去了`;
}
