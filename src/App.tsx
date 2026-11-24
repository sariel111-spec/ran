import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Check,Dices,ExternalLink,Minus,MoreHorizontal,Play,Plus,Search,Settings2,Shuffle,X} from 'lucide-react';
import {cn,label,people,who,type Person} from './people';
import {Motif} from './motif';
import {ago,appLink,days,flip,openOut,preferApp,flippedToday,getCover,hasNew,hush,imgAlive,kindName,kinds,remove,restore,say,setStatus,statuses,step,tock,today,useStore,useToast,visited,
  type Chef,type Item,type Kind,type News,type Series,type State,type Status} from './store';
import {AddSheet,SettingsSheet,type Draft} from './sheets';

type Route={name:'home'}|{name:'room';id:string}|{name:'all'}|{name:'follow'};
const parse=():Route=>{
  const h=location.hash.replace(/^#\/?/,'');
  if(h.startsWith('p/')&&who(h.slice(2)))return {name:'room',id:h.slice(2)};
  if(h==='all')return {name:'all'};
  if(h==='follow')return {name:'follow'};
  return {name:'home'};
};
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz=(ms:number)=>{try{navigator.vibrate?.(ms);}catch{/* 不支持就算了 */}};

type Dye={x:number;y:number;color:string;scale:number;out?:boolean};
type Enter=(p:Person,at:{x:number;y:number})=>void;
let introDone=false;

export function App(){
  const s=useStore();
  const [route,setRoute]=useState<Route>(parse);
  const [dye,setDye]=useState<Dye|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [settings,setSettings]=useState(false);

  useEffect(()=>{
    const on=()=>{setRoute(parse());window.scrollTo(0,0);};
    addEventListener('hashchange',on);return()=>removeEventListener('hashchange',on);
  },[]);

  // 染：颜色从牌子洇开，盖满之后换页，再慢慢褪成他的底色
  const enter=useCallback<Enter>((p,at)=>{
    if(calm()){location.hash='#/p/'+p.id;return;}
    const far=Math.max(...[[0,0],[innerWidth,0],[0,innerHeight],[innerWidth,innerHeight]].map(([a,b])=>Math.hypot(a-at.x,b-at.y)));
    setDye({...at,color:p.deep,scale:(far*2/40)/.6});
    setTimeout(()=>{location.hash='#/p/'+p.id;setDye(d=>d&&{...d,out:true});},860);
    setTimeout(()=>setDye(null),1500);
  },[]);

  const add=useCallback((d:Draft={type:'item'})=>setDraft(d),[]);
  const room=route.name==='room'?who(route.id):undefined;
  const toast=useToast();
  const news=s.chefs.filter(hasNew).length+s.series.filter(hasNew).length;

  return <div className={`app on-${route.name}`} style={room?{'--tint':room.tint,'--deep':room.deep,'--mark':room.mark} as React.CSSProperties:undefined}>
    {route.name==='home'&&<Home s={s} enter={enter} add={add} settings={()=>setSettings(true)}/>}
    {room&&<Room key={room.id} s={s} p={room} add={add} enter={enter}/>}
    {route.name==='all'&&<Vault s={s} add={add}/>}
    {route.name==='follow'&&<Follow s={s} add={add}/>}
    {route.name!=='room'&&<nav className="dock" aria-label="主导航">
      <a href="#/" aria-current={route.name==='home'?'page':undefined}>翻牌</a>
      <a href="#/all" aria-current={route.name==='all'?'page':undefined}>藏阁</a>
      <a href="#/follow" className={news?'dot':undefined} aria-current={route.name==='follow'?'page':undefined} aria-label={news?`追更，有 ${news} 处更新`:undefined}>追更</a>
    </nav>}
    {toast&&<div key={toast.n} className={`toast${route.name==='room'?' low':''}`} role="status">
      <span>{toast.text}</span>
      {toast.undo&&<button onClick={()=>{toast.undo!();hush();}}>撤销</button>}
    </div>}
    {dye&&<div className={`dye${dye.out?' out':''}`} style={{'--x':dye.x+'px','--y':dye.y+'px','--c':dye.color,'--s':dye.scale} as React.CSSProperties} aria-hidden="true"><i/><i/><i/><i/></div>}
    {draft&&<AddSheet draft={draft} close={()=>setDraft(null)}/>}
    {settings&&<SettingsSheet s={s} close={()=>setSettings(false)}/>}
  </div>;
}

/* ───────── 托盘 ───────── */

function Home({s,enter,add,settings}:{s:State;enter:Enter;add:(d?:Draft)=>void;settings:()=>void}){
  const turned=flippedToday(s);
  const [lift,setLift]=useState<string|null>(null);
  const [peek,setPeek]=useState<string|null>(null);
  const [intro]=useState(()=>!introDone);
  const busy=useRef(false);
  const refs=useRef<Record<string,HTMLButtonElement|null>>({});
  useEffect(()=>{introDone=true;},[]);

  const pick=(p:Person)=>{
    if(busy.current)return;
    busy.current=true;
    const el=refs.current[p.id]!;
    const was=turned.includes(p.id);
    setLift(p.id);buzz(8);
    const go=()=>{
      const r=el.getBoundingClientRect();
      enter(p,{x:r.left+r.width/2,y:r.top+r.height/2});
      setTimeout(()=>{busy.current=false;},1500);
    };
    if(calm()){flip(p.id);go();return;}
    setTimeout(()=>{flip(p.id);if(!was)tock();},was?0:170);
    setTimeout(go,was?280:780);
  };
  const fate=()=>{
    if(busy.current)return;
    const last=people[Math.floor(Math.random()*people.length)];
    if(calm()){pick(last);return;}
    let t=0,at=Math.floor(Math.random()*people.length);
    const hops=people.length*2+people.indexOf(last)-at;
    for(let i=0;i<=hops;i++){
      const p=people[(at+i)%people.length];
      t+=46+Math.pow(i/hops,3)*190;
      setTimeout(()=>{setPeek(p.id);buzz(3);},t);
    }
    setTimeout(()=>{setPeek(null);pick(last);},t+300);
  };

  const names=turned.map(id=>who(id)?.name).filter(Boolean);
  const now=new Date();
  const waiting=useMemo(()=>{
    const all=[
      ...s.series.filter(x=>x.state==='on'||hasNew(x)).map(x=>({type:'series' as const,x})),
      ...s.chefs.map(x=>({type:'chefs' as const,x})),
    ].sort((a,b)=>+hasNew(b.x)-+hasNew(a.x)||a.x.visited-b.x.visited);
    return all.slice(0,Math.min(5,Math.max(3,all.filter(w=>hasNew(w.x)).length)));
  },[s.series,s.chefs]);
  const fresh=useMemo(()=>[...s.items].sort((a,b)=>b.created-a.created).slice(0,8),[s.items]);

  return <main className="home enter">
    <header className="top">
      <h1 className="title"><span>染</span></h1>
      <div className="tools">
        <a className="icon" href="#/all" aria-label="搜索收藏"><Search size={19}/></a>
        <button className="icon" onClick={()=>add()} aria-label="收一口新的"><Plus size={20}/></button>
        <button className="icon" onClick={settings} aria-label="设置"><Settings2 size={19}/></button>
      </div>
    </header>

    <section className="stage" aria-label="绿头牌托盘">
      <div className="ask" aria-live="polite">
        {names.length?<><span>今夜是</span>{names.map(n=><b key={n} className="hung">{n}</b>)}</>
          :<p><span>今夜</span><b>翻谁的牌子</b></p>}
        <time dateTime={today()}>{cn(now.getMonth()+1)}月{cn(now.getDate())}日</time>
      </div>
      <div className="lattice" aria-hidden="true"/>
      <div className={`tray${intro?' intro':''}`}>
        <div className="tray-bed">
          {people.map((p,i)=><Plaque key={p.id} p={p} index={i} turned={turned.includes(p.id)} lift={lift===p.id} peek={peek===p.id}
            count={s.items.filter(x=>x.who.includes(p.id)).length}
            set={el=>{refs.current[p.id]=el;}} onPick={()=>pick(p)}/>)}
        </div>
      </div>
      <button className="fate" onClick={fate}><Shuffle size={15} aria-hidden="true"/>听天由命</button>
    </section>

    <Diary s={s}/>

    <section className="block">
      <div className="block-head"><h2>等你去看</h2><a href="#/follow">全部追更</a></div>
      {waiting.length?<ul className="rows">{waiting.map(w=><WaitRow key={w.x.id} type={w.type} x={w.x}
        onEdit={()=>add(w.type==='series'?{type:'series',series:w.x as Series}:{type:'chef',chef:w.x as Chef})}/>)}</ul>
        :<Empty text="还没有在追的系列和厨子。" act="添一个" on={()=>add({type:'series'})}/>}
    </section>

    <section className="block">
      <div className="block-head"><h2>新收的</h2><a href="#/all">去藏阁</a></div>
      {fresh.length?<Feed items={fresh} fixed showWho onEdit={i=>add({type:'item',item:i})}/>
        :<Empty text="藏阁还是空的。看到好吃的，复制链接回来收一口。" act="收一口" on={()=>add()}/>}
    </section>
  </main>;
}

function Plaque({p,index=0,turned,lift,peek,count,set,onPick,mini,here}:{p:Person;index?:number;turned:boolean;lift?:boolean;peek?:boolean;count?:number;set?:(el:HTMLButtonElement|null)=>void;onPick:(el:HTMLButtonElement)=>void;mini?:boolean;here?:boolean}){
  const move=(e:React.PointerEvent<HTMLButtonElement>)=>{
    if(e.pointerType!=='mouse'||mini)return;
    const r=e.currentTarget.getBoundingClientRect();
    const k=(e.clientX-r.left)/r.width-.5;
    e.currentTarget.style.setProperty('--lean',(k*16).toFixed(1)+'deg');
    e.currentTarget.style.setProperty('--glare',((k+.5)*100).toFixed(0)+'%');
  };
  return <button ref={set} className={`plaque${turned?' turned':''}${lift?' lift':''}${peek?' peek':''}${here?' here':''}`}
    style={{'--tilt':(mini?0:p.tilt)+'deg','--deep':p.deep,'--mark':p.mark,'--i':index} as React.CSSProperties}
    onClick={e=>onPick(e.currentTarget)} onPointerMove={move} disabled={here}
    onPointerLeave={e=>{e.currentTarget.style.removeProperty('--lean');}}
    aria-label={here?`现在就在${label(p)}这里`:`${turned?'去':'翻'}${label(p)}的牌子${count?`，藏了 ${count} 件`:''}`}>
    <span className="pl-body">
      <span className="pl-face pl-front">
        <i className="pl-head"/>
        <span className={`pl-name${p.also?' two':''}`}><b><V t={p.name}/></b>{p.also&&<><i className="pl-dot"/><small><V t={p.also}/></small></>}</span>
        {!mini&&!!count&&<i className="pl-count">{cn(count)}</i>}
      </span>
      <span className="pl-face pl-back"><Motif id={p.id}/><em><V t={mini?p.name:p.alias}/></em></span>
    </span>
  </button>;
}

// 起居注：近七日翻了谁
function Diary({s}:{s:State}){
  const week=days(7);
  const any=week.some(d=>s.flips[d]?.length);
  const names=['日','一','二','三','四','五','六'];
  return <section className="diary" aria-label="起居注，近七日翻过的牌子">
    <h2>起居注</h2>
    <ol>{week.map((d,i)=>{
      const ids=s.flips[d]??[];
      const day=new Date(d+'T12:00:00');
      return <li key={d} className={i===6?'now':''}>
        <span className="diary-day">{i===6?'今':names[day.getDay()]}</span>
        <span className="diary-slips">{ids.length?ids.map(id=>{const p=who(id);return p?<a key={id} href={`#/p/${id}`} style={{background:p.deep}} title={label(p)} aria-label={`${d} 翻了${label(p)}`}/>:null;}):<i/>}</span>
      </li>;
    })}</ol>
    {!any&&<p>翻过的牌子会记在这里。</p>}
  </section>;
}

/* ───────── 他的地方 ───────── */

function Room({s,p,add,enter}:{s:State;p:Person;add:(d?:Draft)=>void;enter:Enter}){
  const [kind,setKind]=useState<Kind|'all'>('all');
  const [stat,setStat]=useState<Status|'all'>('all');
  const [picked,setPicked]=useState('');
  const turned=flippedToday(s);
  const mine=useMemo(()=>s.items.filter(i=>i.who.includes(p.id)).sort((a,b)=>b.created-a.created),[s.items,p.id]);
  const byKind=kind==='all'?mine:mine.filter(i=>i.kind===kind);
  const shown=stat==='all'?byKind:byKind.filter(i=>i.status===stat);
  const series=s.series.filter(x=>x.who.includes(p.id));
  const chefs=s.chefs.filter(x=>x.who.includes(p.id));

  const draw=()=>{
    const pool=mine.filter(i=>i.status==='want').length?mine.filter(i=>i.status==='want'):mine.filter(i=>i.status!=='done').length?mine.filter(i=>i.status!=='done'):mine;
    if(!pool.length)return;
    const rest=pool.length>1?pool.filter(i=>i.id!==picked):pool;
    const it=rest[Math.floor(Math.random()*rest.length)];
    setKind('all');setStat('all');setPicked(it.id);buzz(8);
  };
  useEffect(()=>{
    if(!picked)return;
    const el=document.getElementById('card-'+picked);
    el?.scrollIntoView({block:'center',behavior:calm()?'auto':'smooth'});
    const t=setTimeout(()=>setPicked(''),2600);return()=>clearTimeout(t);
  },[picked]);

  const hop=(q:Person,el:HTMLButtonElement)=>{
    const r=el.getBoundingClientRect();
    if(!turned.includes(q.id)){flip(q.id);tock();}
    buzz(8);
    setTimeout(()=>enter(q,{x:r.left+r.width/2,y:r.top+r.height/2}),calm()?0:turned.includes(q.id)?120:520);
  };

  return <main className="room">
    <header className="room-top">
      <a className="back" href="#/"><ArrowLeft size={18} aria-hidden="true"/>托盘</a>
      <button className="pill" onClick={()=>add({type:'item',who:p.id})}><Plus size={16} aria-hidden="true"/>收一口</button>
    </header>

    <section className="hero">
      <Motif id={p.id} className="hero-art"/>
      <div className="hero-name">
        <h1>{p.name}</h1>
        {p.also&&<p className="hero-also">{p.also}</p>}
        <p className="hero-from">{p.from}<i/>{p.alias}</p>
        <span className="hero-seal" aria-hidden="true">{p.seal}</span>
      </div>
      <p className="hero-line">{p.line}</p>
      <dl className="tally">
        <div><dt>藏了</dt><dd>{mine.length}</dd></div>
        <div><dt>在追</dt><dd>{series.length}</dd></div>
        <div><dt>厨子</dt><dd>{chefs.length}</dd></div>
      </dl>
    </section>

    <Tabs value={kind} set={setKind} count={k=>k==='all'?mine.length:mine.filter(i=>i.kind===k).length}/>
    {mine.length>0&&<div className="sub">
      <StatusFilter value={stat} set={setStat} count={x=>x==='all'?byKind.length:byKind.filter(i=>i.status===x).length}/>
      <button className="link" onClick={draw}><Dices size={15} aria-hidden="true"/>抽一篇</button>
    </div>}

    {shown.length?<Feed items={shown} picked={picked} onEdit={i=>add({type:'item',item:i})}/>
      :<Empty text={mine.length===0?`${p.name}这里还空着。看到好吃的，复制链接回来收一口。`:'这样筛下来一件都没有。'} act="收一口" on={()=>add({type:'item',who:p.id,kind:kind==='all'?undefined:kind})}/>}

    {(series.length>0||chefs.length>0)&&<section className="block">
      <div className="block-head"><h2>为他追的</h2><a href="#/follow">全部追更</a></div>
      <ul className="watches">
        {series.map(x=><Watch key={x.id} type="series" x={x} onEdit={()=>add({type:'series',series:x})}/>)}
        {chefs.map(x=><Watch key={x.id} type="chefs" x={x} onEdit={()=>add({type:'chef',chef:x})}/>)}
      </ul>
    </section>}

    <section className="swap" aria-label="换一块牌子">
      <h2>换一块牌子</h2>
      <div className="tray small"><div className="tray-bed">
        {people.map((q,i)=><Plaque key={q.id} p={q} index={i} mini here={q.id===p.id} turned={turned.includes(q.id)} onPick={el=>hop(q,el)}/>)}
      </div></div>
    </section>
  </main>;
}

function Tabs({value,set,count}:{value:Kind|'all';set:(k:Kind|'all')=>void;count:(k:Kind|'all')=>number}){
  return <div className="tabs" role="tablist" aria-label="按种类看">
    {[{id:'all' as const,name:'全部'},...kinds].map(k=><button key={k.id} role="tab" aria-selected={value===k.id} onClick={()=>set(k.id)}>
      {k.name}<sup>{count(k.id)||''}</sup>
    </button>)}
  </div>;
}
function StatusFilter({value,set,count}:{value:Status|'all';set:(k:Status|'all')=>void;count:(k:Status|'all')=>number}){
  return <div className="stat" role="group" aria-label="按吃到哪了看">
    {[{id:'all' as const,name:'都看'},...statuses].map(x=><button key={x.id} aria-pressed={value===x.id} onClick={()=>set(x.id)}>{x.name}<small>{count(x.id)}</small></button>)}
  </div>;
}

/* ───────── 一格一格的封面 ───────── */

const memo=new Map<string,string>();
// 先用存在本机的图；没有就直接连帖子的封面；都没有再去仓库里取
function useCover(i:{cover?:string;img?:string}){
  const live=i.img&&imgAlive(i.img)?i.img:'';
  const [src,setSrc]=useState(()=>(i.cover&&memo.get(i.cover))||'');
  const [bad,setBad]=useState('');
  useEffect(()=>{
    if(!i.cover){setSrc('');return;}
    const m=memo.get(i.cover);
    if(m){setSrc(m);return;}
    let on=true;
    void getCover(i.cover).then(v=>{if(!v)return;memo.set(i.cover!,v);if(on)setSrc(v);});
    return()=>{on=false;};
  },[i.cover]);
  return {src:src||(bad===live?'':live),fail:()=>{if(src)setSrc('');else setBad(live);}};
}
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const pictured=(i:Item)=>!!i.cover||(!!i.img&&imgAlive(i.img));
// 封面的高宽比：有图跟着图走，没图的题签按标题长短错开
const shape=(i:Item,pic:boolean)=>pic?clamp(i.ratio??1.3,.62,1.4):[...i.title].length>26?1.3:[...i.title].length>12?1.12:.92;

function Card({i,showWho,picked,onEdit}:{i:Item;showWho?:boolean;picked?:boolean;onEdit:()=>void}){
  const ps=i.who.map(who).filter(Boolean) as Person[];
  const p=ps[0];
  const pic=useCover(i);
  const [seenRatio,setSeenRatio]=useState(0);
  const [pop,setPop]=useState(false);
  const next=()=>{
    const order=statuses.map(x=>x.id);
    setStatus(i.id,order[(order.indexOf(i.status)+1)%order.length]);
    setPop(true);buzz(6);setTimeout(()=>setPop(false),320);
  };
  const ratio=pic.src?clamp(i.ratio??(seenRatio||1.3),.62,1.4):shape(i,false);
  const face=<>
    {pic.src?<img src={pic.src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={pic.fail}
        onLoad={e=>{if(!i.ratio)setSeenRatio(e.currentTarget.naturalHeight/Math.max(1,e.currentTarget.naturalWidth));}}/>
      :<span className="art"><b>{i.title}</b>{p&&<Motif id={p.id}/>}<em>{kindName(i.kind)}</em></span>}
    {i.video&&<i className="card-play" aria-hidden="true"><Play size={10} fill="currentColor" strokeWidth={0}/></i>}
    {showWho&&ps.length>0&&<span className="card-tags" aria-hidden="true">{ps.map(q=><b key={q.id} style={{'--deep':q.deep} as React.CSSProperties}>{q.seal}</b>)}</span>}
  </>;
  const st=statuses.find(x=>x.id===i.status)?.name;
  const frame={aspectRatio:String(1/ratio)} as React.CSSProperties;
  return <li id={'card-'+i.id} className={`card is-${i.status}${picked?' picked':''}${showWho&&ps.length?' tagged':''}${i.video?' video':''}`} style={p?{'--deep':p.deep,'--mark':p.mark} as React.CSSProperties:undefined}>
    {i.url?<Out className="card-face" style={frame} url={i.url} label={`去看「${i.title}」`}>{face}</Out>
      :<button className="card-face" style={frame} onClick={onEdit} aria-label={`「${i.title}」还没有链接，点开补上`}>{face}</button>}
    <div className="card-body">
      <button className="card-title" onClick={onEdit} aria-label={`改一改「${i.title}」`}>
        {pic.src&&<b>{i.title}</b>}
        {i.note&&<span className="note">{i.note}</span>}
        {i.taste>0&&<span className="taste" aria-label={`好吃度 ${i.taste}，满分 5`}>{[1,2,3,4,5].map(n=><i key={n} className={n<=i.taste?'on':''}/>)}</span>}
        <span className="card-by">
          {showWho&&ps.length===0&&<em>还没分牌</em>}
          {i.by||kindName(i.kind)}{i.site&&<> · {i.site}</>}{i.sample&&<> · 示例</>}
        </span>
      </button>
      <button className={`stamp${pop?' pop':''}`} onClick={next} aria-label={`现在是${st}，点一下换`}>{st}</button>
    </div>
  </li>;
}

// 瀑布流：每一件放进当下最矮的那一列，顺序还是从新到旧
function Feed({items,showWho,picked,fixed,onEdit}:{items:Item[];showWho?:boolean;picked?:string;fixed?:boolean;onEdit:(i:Item)=>void}){
  const box=useRef<HTMLDivElement>(null),more=useRef<HTMLDivElement>(null);
  const [w,setW]=useState(0);
  const [limit,setLimit]=useState(24);
  useEffect(()=>{
    const el=box.current;if(!el)return;
    setW(el.clientWidth);
    const ro=new ResizeObserver(e=>setW(Math.round(e[0].contentRect.width)));
    ro.observe(el);return()=>ro.disconnect();
  },[]);
  const at=picked?items.findIndex(i=>i.id===picked):-1;
  const n=fixed?items.length:Math.max(limit,at+1);
  useEffect(()=>{
    const el=more.current;if(!el||fixed||n>=items.length)return;
    const io=new IntersectionObserver(e=>{if(e.some(x=>x.isIntersecting))setLimit(l=>Math.max(l,n)+24);},{rootMargin:'900px'});
    io.observe(el);return()=>io.disconnect();
  },[fixed,n,items.length]);
  const cols=!w||w<520?2:w<840?3:4;
  const lanes=useMemo(()=>{
    const cw=((w||360)-(cols-1)*10)/cols;
    const out=Array.from({length:cols},()=>({h:0,list:[] as Item[]}));
    for(const i of items.slice(0,fixed?(cols===3?6:8):n)){
      const pic=pictured(i);
      const lane=out.reduce((a,b)=>b.h<a.h-1?b:a);
      lane.list.push(i);
      lane.h+=cw*shape(i,pic)+(pic?([...i.title].length*14.5>cw-20?80:60):44)+(i.note?22:0)+10;
    }
    return out;
  },[items,n,cols,w,fixed]);
  return <>
    <div className="feed" ref={box}>
      {lanes.map((l,k)=><ul key={k}>{l.list.map(i=><Card key={i.id} i={i} showWho={showWho} picked={picked===i.id} onEdit={()=>onEdit(i)}/>)}</ul>)}
    </div>
    {!fixed&&n<items.length&&<div ref={more} className="feed-more" aria-hidden="true">往下还有 {items.length-n} 件</div>}
  </>;
}

/* ───────── 追更 ───────── */

// 往外跳：装了 App 就进 App，没有就开网页
export function Out({url,label,after,className='go',style,children}:{url:string;label?:string;after?:()=>void;className?:string;style?:React.CSSProperties;children:React.ReactNode}){
  return <a className={className} style={style} href={url} target="_blank" rel="noreferrer" aria-label={label}
    onClick={e=>{after?.();if(preferApp()&&appLink(url)){e.preventDefault();openOut(url);}}}>{children}</a>;
}
const V=({t}:{t:string})=><>{[...t].map((c,i)=><span key={i}>{c}</span>)}</>;

function Dots({ids}:{ids:string[]}){
  return <span className="dots">{ids.map(id=>{const p=who(id);return p?<i key={id} style={{background:p.deep}} title={label(p)}/>:null;})}</span>;
}
const stateName={on:'连载中',end:'完结',pit:'坑了'} as const;
const fresh=(t:number)=>t>0&&Date.now()-t<864e5&&new Date(t).getDate()===new Date().getDate();

const nameOf=(x:Series|Chef)=>'name' in x?x.name:x.title;
const day=(t:number)=>{const d=new Date(t);return `${d.getMonth()+1}月${d.getDate()}日`;};

function Thumb({n}:{n:News}){
  const [ok,setOk]=useState(!!n.img&&imgAlive(n.img));
  return ok?<img src={n.img} alt="" referrerPolicy="no-referrer" loading="lazy" onError={()=>setOk(false)}/>:<i className="news-dot"/>;
}

// 追更里的一位厨子或一个系列
function Watch({type,x,onEdit,manage}:{type:'series'|'chefs';x:Series|Chef;onEdit:()=>void;manage?:boolean}){
  const name=nameOf(x);
  const today=fresh(x.visited);
  const news=x.news??[];
  const unread=news.filter(n=>n.at>x.visited);
  const sr=type==='series'?x as Series:null;
  const mark=()=>{
    if(today)return;
    const was=x.visited;
    visited(type,x.id);buzz(6);
    say(`记下了：今天去看过「${name}」`,()=>visited(type,x.id,was));
  };
  const went=()=>{if(!fresh(x.visited))visited(type,x.id);};
  const del=()=>{remove(type,x.id);buzz(8);say(`删掉了「${name}」`,()=>restore(type,x));};
  return <li className={`watch${unread.length?' has-new':''}`}>
    <div className="watch-head">
      <button className="watch-name" onClick={onEdit} aria-label={`改一改「${name}」`}><Dots ids={x.who}/><b>{name}</b></button>
      {unread.length>0&&<span className="new-seal">有更新</span>}
      {manage?<button className="del" onClick={del}>删掉</button>
        :<button className="icon sm" onClick={onEdit} aria-label={`改一改或删掉「${name}」`}><MoreHorizontal size={18}/></button>}
    </div>
    <p className="meta">
      <span>{sr?(sr.by||'系列'):'厨子'}</span>{x.site&&<span>{x.site}</span>}{sr&&<span>{stateName[sr.state]}</span>}
      <span>{ago(x.visited)}</span>
      {x.sample&&<span className="sample">示例</span>}
    </p>
    {x.note&&<span className="note">{x.note}</span>}
    {unread.length>0&&<ul className="news">{unread.slice(0,3).map(n=><li key={n.id}>
      {n.url?<Out className="news-item" url={n.url} after={went}><Thumb n={n}/><span>{n.title}</span></Out>
        :<span className="news-item"><Thumb n={n}/><span>{n.title}</span></span>}
    </li>)}{unread.length>3&&<li className="latest">还有 {unread.length-3} 篇</li>}</ul>}
    {!unread.length&&news[0]&&<p className="latest">最近一篇：{news[0].title}</p>}
    {!manage&&<div className="watch-acts">
      {sr&&<div className="stepper" aria-label="看到第几话">
        <button onClick={()=>step(x.id,-1)} aria-label="少记一话"><Minus size={14}/></button>
        <output key={sr.seen}>{sr.seen}{sr.total?<small>/{sr.total}</small>:null}</output>
        <button onClick={()=>{step(x.id,1);buzz(6);}} aria-label="多记一话"><Plus size={14}/></button>
      </div>}
      <button className={`act${today?' done':''}`} onClick={mark} aria-pressed={today}><Check size={15} aria-hidden="true"/>{today?'今天看过':'看过了'}</button>
      {x.url?<Out className="act out" url={x.url} after={went}><ExternalLink size={14} aria-hidden="true"/>{sr?'去看':'去主页'}</Out>
        :<button className="act" onClick={onEdit}>补上链接</button>}
    </div>}
  </li>;
}

// 首页那几行：只说谁在等
function WaitRow({type,x,onEdit}:{type:'series'|'chefs';x:Series|Chef;onEdit:()=>void}){
  const name=nameOf(x);
  const unread=(x.news??[]).filter(n=>n.at>x.visited);
  return <li className="row">
    <div className="row-text">
      <button className="row-title" onClick={onEdit}><Dots ids={x.who}/><b>{name}</b>{unread.length>0&&<span className="new-seal">有更新</span>}</button>
      <span className="meta">
        <span>{type==='series'?`第 ${(x as Series).seen} 话`:'厨子'}</span>{x.site&&<span>{x.site}</span>}
        <span>{unread.length?unread[0].title:ago(x.visited)}</span>
      </span>
    </div>
    <div className="row-side">
      {x.url&&<Out url={x.url} label={`去看「${name}」`} after={()=>{if(!fresh(x.visited))visited(type,x.id);}}><ExternalLink size={16}/></Out>}
    </div>
  </li>;
}

function Follow({s,add}:{s:State;add:(d?:Draft)=>void}){
  const [manage,setManage]=useState(false);
  // 顺序只在进页面时排一次：有更新的在前，其余按多久没去；点了「看过了」不会让它当场跳走
  const rank=useRef<Record<string,number>>({});
  const order=<T extends Series|Chef>(list:T[])=>{
    const sorted=[...list].sort((a,b)=>+hasNew(b)-+hasNew(a)||('state' in a&&'state' in b?(a.state==='on'?0:1)-(b.state==='on'?0:1):0)||a.visited-b.visited);
    sorted.forEach((x,i)=>{rank.current[x.id]??=i;});
    return [...list].sort((a,b)=>rank.current[a.id]-rank.current[b.id]);
  };
  const series=order(s.series),chefs=order(s.chefs);
  const news=s.series.filter(hasNew).length+s.chefs.filter(hasNew).length;
  const checked=Math.max(0,...s.series.map(x=>x.checked??0),...s.chefs.map(x=>x.checked??0));
  const none=!s.series.length&&!s.chefs.length;
  return <main className="page enter">
    <header className="page-top">
      <div className="page-head"><h1>追更</h1>{!none&&<button className={`pill${manage?' on':''}`} onClick={()=>setManage(v=>!v)} aria-pressed={manage}>{manage?'整理好了':'整理'}</button>}</div>
      <p>{manage?'点「删掉」就不再追了，删错了可以马上撤销。删掉的不会被自动加回来。'
        :<>{news?<>有 <b>{news}</b> 处更新，排在最前。</>:checked?'这会儿没有新的。':''}{checked?`每隔一天晚上自动去各家看一遍，上次是${day(checked)}。`:'每隔一天晚上会自动去各家看一遍，谁更新了会标在这里。'}去看过的点「看过了」。</>}</p>
    </header>
    <section className="block">
      <div className="block-head"><h2>系列与合集</h2><button className="link" onClick={()=>add({type:'series'})}>添一个系列</button></div>
      {series.length?<ul className="watches">{series.map(x=><Watch key={x.id} type="series" x={x} manage={manage} onEdit={()=>add({type:'series',series:x})}/>)}</ul>
        :<Empty text="还没有在追的系列。" act="添一个系列" on={()=>add({type:'series'})}/>}
    </section>
    <section className="block">
      <div className="block-head"><h2>厨子</h2><button className="link" onClick={()=>add({type:'chef'})}>添一位厨子</button></div>
      {chefs.length?<ul className="watches">{chefs.map(x=><Watch key={x.id} type="chefs" x={x} manage={manage} onEdit={()=>add({type:'chef',chef:x})}/>)}</ul>
        :<Empty text="还没有关注的厨子。" act="添一位厨子" on={()=>add({type:'chef'})}/>}
    </section>
  </main>;
}

/* ───────── 藏阁 ───────── */

function Vault({s,add}:{s:State;add:(d?:Draft)=>void}){
  const [q,setQ]=useState('');
  const [kind,setKind]=useState<Kind|'all'>('all');
  const [stat,setStat]=useState<Status|'all'>('all');
  const [person,setPerson]=useState('');
  const [byTaste,setByTaste]=useState(false);
  const base=useMemo(()=>{
    const words=q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    // 搜「晋中原」「赵二」也找得到赵光义名下的东西
    const hit=(i:Item,w:string)=>[i.title,i.by,i.note,i.site,kindName(i.kind),...i.who.map(id=>{const p=who(id);return p?`${p.name} ${p.also??''} ${p.alias}`:'';})].join(' ').toLowerCase().includes(w)
      ||i.who.some(id=>who(id)?.keys.test(w));
    return s.items.filter(i=>(!person||(person==='none'?i.who.length===0:i.who.includes(person)))&&words.every(w=>hit(i,w)))
      .sort((a,b)=>byTaste?b.taste-a.taste||b.created-a.created:b.created-a.created);
  },[s.items,q,person,byTaste]);
  const byKind=kind==='all'?base:base.filter(i=>i.kind===kind);
  const shown=stat==='all'?byKind:byKind.filter(i=>i.status===stat);
  const loose=s.items.filter(i=>i.who.length===0).length;
  return <main className="page enter">
    <header className="page-top">
      <h1>藏阁</h1>
      <label className="search"><Search size={17} aria-hidden="true"/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜标题、厨子、备注、名字" aria-label="搜索收藏"/>
        {q&&<button onClick={()=>setQ('')} aria-label="清空搜索"><X size={16}/></button>}
      </label>
    </header>
    <div className="whose" role="group" aria-label="按人看">
      <button className="plain-chip" aria-pressed={person===''} onClick={()=>setPerson('')}>全部</button>
      {people.map(p=><button key={p.id} aria-pressed={person===p.id} onClick={()=>setPerson(person===p.id?'':p.id)} style={{'--deep':p.deep} as React.CSSProperties}><i/>{p.name}</button>)}
      {loose>0&&<button className="plain-chip" aria-pressed={person==='none'} onClick={()=>setPerson(person==='none'?'':'none')}>还没分牌</button>}
    </div>
    <Tabs value={kind} set={setKind} count={k=>k==='all'?base.length:base.filter(i=>i.kind===k).length}/>
    <div className="sub">
      <StatusFilter value={stat} set={setStat} count={x=>x==='all'?byKind.length:byKind.filter(i=>i.status===x).length}/>
      <button className="link" onClick={()=>setByTaste(v=>!v)} aria-pressed={byTaste}>{byTaste?'最好吃的在前':'新收的在前'}</button>
    </div>
    {shown.length?<Feed items={shown} showWho onEdit={i=>add({type:'item',item:i})}/>
      :<Empty text={s.items.length?'这样筛下来一件都没有。':'藏阁还是空的。看到好吃的，复制链接回来收一口。'} act="收一口" on={()=>add()}/>}
  </main>;
}

function Empty({text,act,on}:{text:string;act:string;on:()=>void}){
  return <div className="empty"><p>{text}</p><button className="pill" onClick={on}><Plus size={16} aria-hidden="true"/>{act}</button></div>;
}
