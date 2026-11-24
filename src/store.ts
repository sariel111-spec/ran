import {useSyncExternalStore} from 'react';
import {guessWho,who as whoIs} from './people';

export type Kind='plot'|'fic'|'art'|'comic'|'ao3'|'misc';
export const kinds:{id:Kind;name:string}[]=[
  {id:'plot',name:'剧情'},{id:'fic',name:'同人文'},{id:'art',name:'同人画'},
  {id:'comic',name:'漫剧'},{id:'ao3',name:'AO3'},{id:'misc',name:'杂食'},
];
export const kindName=(k:Kind)=>kinds.find(x=>x.id===k)?.name??'';

export type Status='want'|'eating'|'done';
export const statuses:{id:Status;name:string}[]=[{id:'want',name:'想吃'},{id:'eating',name:'在吃'},{id:'done',name:'吃完'}];

type Base={id:string;who:string[];site:string;url:string;note:string;sample?:boolean;created:number;updated:number};
// cover：存在本机和仓库里的图（自己放的，或缓存下来的缩略图）；img：帖子封面的地址
export type Item=Base&{kind:Kind;title:string;by:string;taste:number;status:Status;cover?:string;img?:string;ratio?:number;video?:boolean};
// news：自动去看时发现的作品，at 是发现的时间（0 表示第一次记下的旧作）；checked：上次自动去看的时间
export type News={id:string;title:string;url:string;img?:string;at:number};
type Watched={visited:number;news?:News[];checked?:number};
export type Series=Base&Watched&{title:string;by:string;seen:number;total:number;state:'on'|'end'|'pit'};
export type Chef=Base&Watched&{name:string};
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
// 同一个浏览器里开着的别的标签页：这边一存，那边跟着读一遍，免得拿旧的盖掉新的
const bc=typeof BroadcastChannel==='function'?new BroadcastChannel('ran-site'):null;
const commit=(next:State)=>{state=next;emit();void setKey('state',next).then(()=>bc?.postMessage(1));clearTimeout(pushTimer);pushTimer=window.setTimeout(()=>{void syncNow();},2500);};
async function reread(){
  const saved=await getKey<State>('state');
  if(!saved||!Array.isArray(saved.items))return;
  const merged=merge(state,clean(saved));
  if(canon(merged)!==canon(state)){state=merged;emit();}
}

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
  if(bc)bc.onmessage=()=>{void reread();};
  addEventListener('hashchange',inbox);inbox();
  (window as unknown as {ran:unknown}).ran={key:inboxKey,known,take:(p:Pack)=>(last=take(p)),watch,last:()=>last,settle};
  setTimeout(()=>{void cacheCovers();},1500);
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
// 同一位厨子在不同时候可能记成了不同的编号，按主页认人
export const chefKey=(url:string)=>{
  let m=url.match(/douyin\.com\/user\/([\w-]{10,})/);if(m)return 'c-dy-'+m[1];
  m=url.match(/xiaohongshu\.com\/user\/profile\/([0-9a-f]{24})/i);if(m)return 'c-xhs-'+m[1];
  return '';
};
export function remove(type:'items'|'series'|'chefs',id:string){
  // 删掉的东西留一个记号，别的设备同步时才知道它是被删了，而不是还没收到；自动更新也凭这个记号不再把它加回来
  const now=Date.now(),dead={...state.dead,[id]:now};
  if(type==='chefs'){
    const c=state.chefs.find(x=>x.id===id);
    if(c){dead['chef:'+c.name]=now;const k=chefKey(c.url);if(k)dead[k]=now;}
  }
  commit({...state,[type]:(state[type] as Base[]).filter(x=>x.id!==id),dead} as State);
}
// 删错了，放回去
export function restore(type:'items'|'series'|'chefs',rec:Item|Series|Chef){
  if((state[type] as Base[]).some(x=>x.id===rec.id))return;
  const dead={...state.dead};
  if(type==='chefs'){delete dead['chef:'+(rec as Chef).name];const k=chefKey(rec.url);if(k&&k!==rec.id)delete dead[k];}
  commit({...state,[type]:[{...rec,updated:Date.now()},...(state[type] as Base[])],dead} as State);
}
export function step(id:string,by:number){
  commit({...state,series:state.series.map(x=>x.id===id?{...x,seen:Math.max(0,x.seen+by),visited:Date.now(),updated:Date.now()}:x)});
}
export const days=(n:number)=>{const out:string[]=[];for(let i=n-1;i>=0;i--){const d=new Date(Date.now()-i*864e5);out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);}return out;};
export function visited(type:'series'|'chefs',id:string,when=Date.now()){
  // 要连 updated 一起改：同步时两边谁新听谁的，不改的话这一下会被仓库里的旧记录盖回去
  const now=Date.now();
  commit({...state,[type]:(state[type] as (Series|Chef)[]).map(x=>x.id===id?{...x,visited:when,updated:now}:x)} as State);
}
export const hasNew=(x:Series|Chef)=>(x.news??[]).some(n=>n.at>x.visited);
export function setStatus(id:string,status:Status){
  commit({...state,items:state.items.map(x=>x.id===id?{...x,status,updated:Date.now()}:x)});
}
export function clearSamples(){
  commit({...state,items:state.items.filter(x=>!x.sample),series:state.series.filter(x=>!x.sample),chefs:state.chefs.filter(x=>!x.sample)});
}
export const hasSamples=(s:State)=>s.items.some(x=>x.sample)||s.series.some(x=>x.sample)||s.chefs.some(x=>x.sample);

// 图片：缩到 900px 以内存进本机，连上仓库后也会传上去
export async function putCover(file:File):Promise<{id:string;ratio:number}>{
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise<HTMLImageElement>((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url;});
    const k=Math.min(1,900/Math.max(img.width,img.height));
    const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);
    const id=uid()+'.jpg';await setKey('asset:'+id,c.toDataURL('image/jpeg',.86));
    await setKey('dirty',[...((await getKey<string[]>('dirty'))??[]),id]);
    return {id,ratio:c.height/c.width};
  }finally{URL.revokeObjectURL(url);}
}
// 从仓库取图一次只走四个，免得一屏几十张同时去要
let lane=0;const waitLane:(()=>void)[]=[];
const queued=async<T,>(fn:()=>Promise<T>):Promise<T>=>{
  if(lane>=4)await new Promise<void>(ok=>waitLane.push(ok));
  lane++;try{return await fn();}finally{lane--;waitLane.shift()?.();}
};
export async function getCover(id:string):Promise<string|undefined>{
  const here=await getKey<string>('asset:'+id);
  if(here||!remote)return here;
  return queued(async()=>{
    try{
      const r=await api('assets/'+encodeURIComponent(id));
      if(!r.ok)return undefined;
      const j=await r.json();
      const data='data:image/jpeg;base64,'+String(j.content??'').replace(/\s/g,'');
      if(data.length<40)return undefined;
      await setKey('asset:'+id,data);return data;
    }catch{return undefined;}
  });
}

/* ───────── 封面 ───────── */

// 小红书的封面换成不带时效的地址；别家的原样留着
export function normImg(src:unknown):string{
  if(typeof src!=='string'||!/^https:\/\//.test(src))return '';
  const m=src.match(/xhscdn\.com\/(?:\d{12}\/[0-9a-f]{32}\/)?((?:[\w-]+\/)*[0-9a-z]{30,})(?:!|$|\?)/i);
  if(m)return 'https://ci.xiaohongshu.com/'+m[1]+'?imageView2/2/w/480/format/jpg';
  return src;
}
// 抖音的封面地址带着过期时间，大约两周
const expiry=(u:string)=>{const m=u.match(/[?&]x-expires=(\d{9,})/);return m?+m[1]*1000:0;};
export const imgAlive=(u:string)=>{const e=expiry(u);return !e||e>Date.now()+60000;};
// 由真人出演的角色，帖子封面多半是演员本人的照片，不自动取；想要封面可以自己放一张图
const NOCOVER=['pp','newt'];
const coverOk=(ids:string[])=>!ids.some(id=>NOCOVER.includes(id));
const clampRatio=(r:unknown)=>typeof r==='number'&&r>0?Math.round(Math.min(2,Math.max(.4,r))*1000)/1000:undefined;

// 会过期的封面：趁还没过期缩成一张小图存下来，以后就不怕它失效，手机上也看得到
let caching:Promise<number>|null=null;
const gaveUp=new Set<string>();
export function cacheCovers():Promise<number>{
  return caching??=(async()=>{
    let made=0;
    const todo=state.items.filter(i=>!i.cover&&i.img&&expiry(i.img)&&imgAlive(i.img)&&!gaveUp.has(i.id)&&coverOk(i.who));
    const done:Record<string,{cover:string;ratio:number}>={};
    const flush=async()=>{
      const ids=Object.keys(done);if(!ids.length)return;
      const got={...done};for(const k of ids)delete done[k];
      await setKey('dirty',[...new Set([...((await getKey<string[]>('dirty'))??[]),...ids.map(k=>got[k].cover)])]);
      const now=Date.now();
      commit({...state,items:state.items.map(x=>got[x.id]&&!x.cover?{...x,...got[x.id],updated:now}:x)});
    };
    let at=0;
    const worker=async()=>{
      while(at<todo.length){
        const i=todo[at++];
        try{
          const r=await fetch(i.img!,{referrerPolicy:'no-referrer'});
          if(!r.ok)throw new Error(String(r.status));
          const bmp=await createImageBitmap(await r.blob());
          const k=Math.min(1,360/bmp.width);
          const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
          c.getContext('2d')!.drawImage(bmp,0,0,c.width,c.height);bmp.close?.();
          const id='t-'+i.id+'.jpg';
          await setKey('asset:'+id,c.toDataURL('image/jpeg',.8));
          done[i.id]={cover:id,ratio:clampRatio(c.height/c.width)??1.25};made++;
          if(Object.keys(done).length>=12)await flush();
        }catch{gaveUp.add(i.id);}
      }
    };
    await Promise.all([worker(),worker(),worker()]);
    await flush();
    return made;
  })().finally(()=>{caching=null;});
}

/* ───────── 收件口：自动更新把东西交到这里，由网站自己查重、认删、归档 ───────── */

type RawItem={id?:string;who?:string[];kind?:string;title?:string;by?:string;site?:string;url?:string;img?:string;ratio?:number;video?:boolean;text?:string};
type RawChef={id?:string;name?:string;who?:string[];site?:string;url?:string;note?:string};
type RawWork={id?:string;title?:string;url?:string;img?:string};
export type Pack={items?:RawItem[];chefs?:RawChef[];covers?:RawItem[];news?:Record<string,{works?:RawWork[];total?:number}>};
type Taken={items:number;chefs:number;covers:number;checked:number;fresh:string[];skipped:number;error?:string};
let last:Taken|null=null;
const WATCH='ran-routine-watch';
const str=(v:unknown,max:number)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
const link=(v:unknown)=>typeof v==='string'&&/^https:\/\//.test(v)?v.slice(0,600):'';
const inboxKey=()=>{
  try{
    let k=localStorage.getItem('ran-inbox-key');
    if(!k){k=uid()+uid();localStorage.setItem('ran-inbox-key',k);}
    return k;
  }catch{return '';}
};
// 这些编号里，哪些已经有了，或者是她删掉的
function known(ids:string[]):string[]{
  const have=new Set([...state.items,...state.series,...state.chefs].map(x=>x.id));
  return (Array.isArray(ids)?ids:[]).filter(id=>have.has(id)||state.dead[id]!==undefined);
}
const watch=()=>[
  ...state.chefs.map(x=>({id:x.id,type:'chef',name:x.name,by:'',site:x.site,url:x.url})),
  ...state.series.map(x=>({id:x.id,type:'series',name:x.title,by:x.by,site:x.site,url:x.url})),
];
export function take(p:Pack):Taken{
  const res:Taken={items:0,chefs:0,covers:0,checked:0,fresh:[],skipped:0};
  if(!p||typeof p!=='object')return {...res,error:'bad'};
  const now=Date.now();
  let {items,chefs,series}=state;
  const have=new Set([...items,...series,...chefs].map(x=>x.id));

  const add:Item[]=[];
  (Array.isArray(p.items)?p.items:[]).forEach((r,n)=>{
    const id=str(r?.id,60),title=str(r?.title,80);
    if(!id||!title)return;
    if(have.has(id)||state.dead[id]!==undefined){res.skipped++;return;}
    let ids=(Array.isArray(r.who)?r.who:[]).filter(x=>typeof x==='string'&&whoIs(x));
    if(!ids.length)ids=guessWho([title,r.by,r.text].join(' '));
    if(!ids.length){res.skipped++;return;}
    const url=link(r.url),img=coverOk(ids)?normImg(r.img):'';
    have.add(id);
    add.push({id,who:[...new Set(ids)],kind:kinds.some(k=>k.id===r.kind)?r.kind as Kind:'misc',title,by:str(r.by,40),site:str(r.site,12)||siteOf(url),url,note:'',taste:0,status:'done',
      ...(img?{img,ratio:clampRatio(r.ratio)}:{}),...(r.video?{video:true}:{}),created:now-n,updated:now});
  });
  res.items=add.length;
  if(add.length)items=[...add,...items];

  // 已经收着的条目：补上封面
  const cov=new Map<string,RawItem>();
  for(const r of [...(Array.isArray(p.covers)?p.covers:[]),...(Array.isArray(p.items)?p.items:[])])if(r&&typeof r.id==='string')cov.set(r.id,r);
  items=items.map(x=>{
    const r=cov.get(x.id);
    if(!r||x.updated===now||!coverOk(x.who))return x;
    const img=normImg(r.img);
    const stale=!x.img||(!x.cover&&!imgAlive(x.img));
    const next={...x};
    if(img&&stale&&img!==x.img){next.img=img;const k=clampRatio(r.ratio);if(k&&!x.cover)next.ratio=k;}
    if(r.video&&!x.video)next.video=true;
    if(next.img===x.img&&next.video===x.video)return x;
    res.covers++;return {...next,updated:now};
  });

  const addChefs:Chef[]=[];
  for(const r of Array.isArray(p.chefs)?p.chefs:[]){
    const name=str(r?.name,40);if(!name)continue;
    const url=link(r.url),id=chefKey(url)||str(r.id,60)||'c-'+uid();
    const all=[...chefs,...addChefs];
    if(have.has(id)||state.dead[id]!==undefined||state.dead['chef:'+name]!==undefined||all.some(c=>c.name===name||(url&&chefKey(c.url)===chefKey(url)&&chefKey(url)))){res.skipped++;continue;}
    const ids=(Array.isArray(r.who)?r.who:[]).filter(x=>typeof x==='string'&&whoIs(x));
    have.add(id);
    addChefs.push({id,name,who:ids,site:str(r.site,12)||siteOf(url),url,note:str(r.note,80),visited:0,created:now,updated:now});
  }
  res.chefs=addChefs.length;
  if(addChefs.length)chefs=[...addChefs,...chefs];

  // 自动去看的结果：和上次看到的比，多出来的就是更新
  if(p.news&&typeof p.news==='object'){
    let base:Record<string,string[]>={};
    try{base=JSON.parse(localStorage.getItem(WATCH)||'{}')||{};}catch{/* 记录坏了就重新记 */}
    const apply=<T extends Series|Chef>(x:T):T=>{
      const r=p.news![x.id];if(!r)return x;
      const ok=coverOk(x.who);
      const works=(Array.isArray(r.works)?r.works:[]).map(w=>({id:str(w?.id,60),title:str(w?.title,60),url:link(w?.url),img:ok?normImg(w?.img):''})).filter(w=>w.id);
      res.checked++;
      const prev=base[x.id];
      const old=x.news??[];
      let news=old;
      if(prev){
        const fresh=works.filter(w=>!prev.includes(w.id)&&!old.some(n=>n.id===w.id));
        if(fresh.length){
          news=[...fresh.map(w=>({id:w.id,title:w.title||'新作',url:w.url,...(w.img?{img:w.img}:{}),at:now})),...old].slice(0,6);
          res.fresh.push(('name' in x?x.name:x.title)+'：'+fresh.map(w=>w.title||'新作').join('、'));
        }
      }
      if(!news.length&&works.length)news=works.slice(0,3).map(w=>({id:w.id,title:w.title||'作品',url:w.url,...(w.img?{img:w.img}:{}),at:0}));
      if(works.length)base[x.id]=[...new Set([...works.map(w=>w.id),...(prev??[])])].slice(0,80);
      const next={...x,news,checked:now,updated:now} as T;
      if('total' in next&&typeof r.total==='number'&&r.total>(next as Series).total)(next as Series).total=Math.floor(r.total);
      return next;
    };
    chefs=chefs.map(apply);series=series.map(apply);
    const live=new Set([...chefs,...series].map(x=>x.id));
    for(const k of Object.keys(base))if(!live.has(k))delete base[k];
    try{localStorage.setItem(WATCH,JSON.stringify(base));}catch{/* 存不了就下次再记 */}
  }

  if(res.items||res.chefs||res.covers||res.checked)commit({...state,items,chefs,series});
  try{sessionStorage.setItem('ran-last',JSON.stringify(res));}catch{/* 不要紧 */}
  setTimeout(()=>{void cacheCovers();},300);
  return res;
}
// 别的标签页把东西编进地址的 # 后面交过来：#inbox=<本机口令>.<内容>
function inbox(){
  const m=/^#inbox=([a-z0-9]{8,40})\.([\w-]+)$/.exec(location.hash);
  if(!m)return;
  history.replaceState(null,'',location.pathname+location.search+'#/');
  if(m[1]!==inboxKey()){last={items:0,chefs:0,covers:0,checked:0,fresh:[],skipped:0,error:'key'};return;}
  try{
    const bin=atob(m[2].replace(/-/g,'+').replace(/_/g,'/'));
    last=take(JSON.parse(new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)))));
  }catch{last={items:0,chefs:0,covers:0,checked:0,fresh:[],skipped:0,error:'bad'};}
}
// 等封面存完、同步完
async function settle(){
  const made=await cacheCovers();
  await syncNow();
  const left=((await getKey<string[]>('dirty'))??[]).length;
  if(left)await syncNow();
  return {cached:made,waiting:state.items.filter(i=>!i.cover&&i.img&&expiry(i.img)&&imgAlive(i.img)&&coverOk(i.who)&&!gaveUp.has(i.id)).length,
    unsent:((await getKey<string[]>('dirty'))??[]).length,sync:sync.state,covered:state.items.filter(i=>i.cover||i.img).length,items:state.items.length};
}

/* ───────── 一句提示 ───────── */

export type Toast={text:string;undo?:()=>void;n:number};
let toast:Toast|null=null,toastTimer=0;
export function say(text:string,undo?:()=>void){
  toast={text,undo,n:Date.now()};emit();
  clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>{toast=null;emit();},undo?6000:2600);
}
export const hush=()=>{clearTimeout(toastTimer);toast=null;emit();};
export function useToast():Toast|null{return useSyncExternalStore(f=>{subs.add(f);return()=>{subs.delete(f);};},()=>toast);}

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
        for(const id of ((await getKey<string[]>('dirty'))??[]).slice(0,25)){
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
  })().finally(()=>{
    running=null;
    if(again){again=false;void syncNow();}
    else if(sync.state==='idle')void getKey<string[]>('dirty').then(d=>{if(d?.length&&remote)setTimeout(()=>{void syncNow(true);},800);});
  });
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
// 能用 App 打开的链接换成 App 的地址（小红书、抖音、B站）
export function appLink(url:string):string{
  let m=url.match(/xiaohongshu\.com\/(?:explore|discovery\/item)\/([0-9a-f]{24})/i);
  if(m)return 'xhsdiscover://item/'+m[1];
  m=url.match(/xiaohongshu\.com\/user\/profile\/([0-9a-f]{24})/i);
  if(m)return 'xhsdiscover://user/'+m[1];
  m=url.match(/douyin\.com\/(?:video|note)\/(\d+)/i);
  if(m)return 'snssdk1128://aweme/detail/'+m[1];
  m=url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/);
  if(m)return 'bilibili://video/'+m[1];
  return '';
}
export const preferApp=()=>{try{return localStorage.getItem('ran-app')!=='0';}catch{return true;}};
export const setPreferApp=(on:boolean)=>{try{localStorage.setItem('ran-app',on?'1':'0');}catch{/* 存不了就算了 */}};
const phone=()=>/iphone|ipad|ipod|android/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/macintosh/i.test(navigator.userAgent));
// 先试着叫 App；一秒多之后页面还在眼前，说明 App 没接住，再开网页
export function openOut(url:string){
  const app=preferApp()?appLink(url):'';
  if(!app){if(!window.open(url,'_blank','noopener'))location.href=url;return;}
  const t0=Date.now();
  let left=false;
  const mark=()=>{left=true;};
  addEventListener('blur',mark);addEventListener('pagehide',mark);document.addEventListener('visibilitychange',mark);
  location.href=app;
  setTimeout(()=>{
    removeEventListener('blur',mark);removeEventListener('pagehide',mark);document.removeEventListener('visibilitychange',mark);
    if(left||document.hidden||!document.hasFocus()||Date.now()-t0>2800)return;
    if(phone())location.href=url;
    else if(!window.open(url,'_blank','noopener'))location.href=url;
  },1400);
}
export function ago(t:number):string{
  if(!t)return '还没去看过';
  const d=Math.floor((Date.now()-t)/864e5);
  if(d<=0)return '今天看过';
  if(d===1)return '昨天看过';
  if(d<30)return `${d} 天前看过`;
  return `${Math.floor(d/30)} 个月没去了`;
}
