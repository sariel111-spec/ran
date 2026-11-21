import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Check,Dices,ExternalLink,Minus,Plus,Search,Settings2,Shuffle,X} from 'lucide-react';
import {cn,label,people,who,type Person} from './people';
import {Motif} from './motif';
import {ago,days,flip,flippedToday,getCover,kindName,kinds,setStatus,statuses,step,tock,today,useStore,visited,
  type Chef,type Item,type Kind,type Series,type State,type Status} from './store';
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

  return <div className={`app on-${route.name}`} style={room?{'--tint':room.tint,'--deep':room.deep,'--mark':room.mark} as React.CSSProperties:undefined}>
    {route.name==='home'&&<Home s={s} enter={enter} add={add} settings={()=>setSettings(true)}/>}
    {room&&<Room key={room.id} s={s} p={room} add={add} enter={enter}/>}
    {route.name==='all'&&<Vault s={s} add={add}/>}
    {route.name==='follow'&&<Follow s={s} add={add}/>}
    {route.name!=='room'&&<nav className="dock" aria-label="主导航">
      <a href="#/" aria-current={route.name==='home'?'page':undefined}>翻牌</a>
      <a href="#/all" aria-current={route.name==='all'?'page':undefined}>藏阁</a>
      <a href="#/follow" aria-current={route.name==='follow'?'page':undefined}>追更</a>
    </nav>}
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
  const waiting=useMemo(()=>[
    ...s.series.filter(x=>x.state==='on').map(x=>({type:'series' as const,x})),
    ...s.chefs.map(x=>({type:'chefs' as const,x})),
  ].sort((a,b)=>a.x.visited-b.x.visited).slice(0,3),[s.series,s.chefs]);
  const fresh=useMemo(()=>[...s.items].sort((a,b)=>b.created-a.created).slice(0,4),[s.items]);

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
      {waiting.length?<ul className="rows">{waiting.map(w=>w.type==='series'
        ?<SeriesRow key={w.x.id} x={w.x as Series} compact/>
        :<ChefRow key={w.x.id} x={w.x as Chef} compact/>)}</ul>
        :<Empty text="还没有在追的系列和厨子。" act="添一个" on={()=>add({type:'series'})}/>}
    </section>

    <section className="block">
      <div className="block-head"><h2>新收的</h2><a href="#/all">去藏阁</a></div>
      {fresh.length?<ul className="slips">{fresh.map(i=><Slip key={i.id} i={i} showWho onOpen={()=>add({type:'item',item:i})}/>)}</ul>
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
        <span className={`pl-name${p.also?' two':''}`}><b>{p.name}</b>{p.also&&<><i className="pl-dot"/><small>{p.also}</small></>}</span>
        {!mini&&!!count&&<i className="pl-count">{cn(count)}</i>}
      </span>
      <span className="pl-face pl-back"><Motif id={p.id}/><em>{mini?p.name:p.alias}</em></span>
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
    const el=document.getElementById('slip-'+picked);
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

    {shown.length?<ul className="slips">{shown.map(i=><Slip key={i.id} i={i} picked={picked===i.id} onOpen={()=>add({type:'item',item:i})}/>)}</ul>
      :<Empty text={mine.length===0?`${p.name}这里还空着。看到好吃的，复制链接回来收一口。`:'这样筛下来一件都没有。'} act="收一口" on={()=>add({type:'item',who:p.id,kind:kind==='all'?undefined:kind})}/>}

    {(series.length>0||chefs.length>0)&&<section className="block">
      <div className="block-head"><h2>为他追的</h2><a href="#/follow">全部追更</a></div>
      <ul className="rows">
        {series.map(x=><SeriesRow key={x.id} x={x} onEdit={()=>add({type:'series',series:x})}/>)}
        {chefs.map(x=><ChefRow key={x.id} x={x} onEdit={()=>add({type:'chef',chef:x})}/>)}
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

/* ───────── 一张笺 ───────── */

function Cover({id}:{id:string}){
  const [src,setSrc]=useState('');
  useEffect(()=>{let on=true;void getCover(id).then(v=>{if(on&&v)setSrc(v);});return()=>{on=false;};},[id]);
  return src?<img className="slip-cover" src={src} alt=""/>:null;
}

function Slip({i,showWho,picked,onOpen}:{i:Item;showWho?:boolean;picked?:boolean;onOpen:()=>void}){
  const ps=i.who.map(who).filter(Boolean) as Person[];
  const [pop,setPop]=useState(false);
  const next=()=>{
    const order=statuses.map(x=>x.id);
    setStatus(i.id,order[(order.indexOf(i.status)+1)%order.length]);
    setPop(true);buzz(6);setTimeout(()=>setPop(false),320);
  };
  return <li id={'slip-'+i.id} className={`slip is-${i.status}${picked?' picked':''}`} style={ps[0]?{'--deep':ps[0].deep,'--mark':ps[0].mark} as React.CSSProperties:undefined}>
    <button className="slip-main" onClick={onOpen}>
      {i.cover&&<Cover id={i.cover}/>}
      <span className="slip-text">
        <b>{i.title}</b>
        <span className="meta">
          {showWho&&ps.length>0&&<em>{ps.map(p=>p.name).join('、')}</em>}
          {showWho&&ps.length===0&&<em className="loose">还没分牌</em>}
          <span>{kindName(i.kind)}</span>
          {i.by&&<span>{i.by}</span>}
          {i.site&&<span>{i.site}</span>}
          {i.sample&&<span className="sample">示例</span>}
        </span>
        {i.note&&<span className="note">{i.note}</span>}
        {i.taste>0&&<span className="taste" aria-label={`好吃度 ${i.taste}，满分 5`}>{[1,2,3,4,5].map(n=><i key={n} className={n<=i.taste?'on':''}/>)}</span>}
      </span>
    </button>
    <div className="slip-side">
      <button className={`stamp${pop?' pop':''}`} onClick={next} aria-label={`现在是${statuses.find(x=>x.id===i.status)?.name}，点一下换`}>{statuses.find(x=>x.id===i.status)?.name}</button>
      {i.url&&<a className="go" href={i.url} target="_blank" rel="noreferrer" aria-label={`打开「${i.title}」`}><ExternalLink size={16}/></a>}
    </div>
  </li>;
}

/* ───────── 追更 ───────── */

function Dots({ids}:{ids:string[]}){
  return <span className="dots">{ids.map(id=>{const p=who(id);return p?<i key={id} style={{background:p.deep}} title={label(p)}/>:null;})}</span>;
}
const stateName={on:'连载中',end:'完结',pit:'坑了'} as const;
const fresh=(t:number)=>t>0&&Date.now()-t<864e5&&new Date(t).getDate()===new Date().getDate();

function Seen({on,done}:{on:()=>void;done:boolean}){
  return <button className={`seen-btn${done?' done':''}`} onClick={on} disabled={done} aria-label={done?'今天看过了':'记成今天看过'}><Check size={15}/></button>;
}

function SeriesRow({x,compact,onEdit}:{x:Series;compact?:boolean;onEdit?:()=>void}){
  const stale=x.state==='on'&&Date.now()-x.visited>7*864e5;
  return <li className={`row${stale?' stale':''}`}>
    <div className="row-text">
      <button className="row-title" onClick={onEdit} disabled={!onEdit}><Dots ids={x.who}/><b>{x.title}</b></button>
      <span className="meta">
        <span>{x.by||'系列'}</span>{x.site&&<span>{x.site}</span>}<span>{stateName[x.state]}</span>
        <span className={stale?'warm':''}>{ago(x.visited)}</span>
        {x.sample&&<span className="sample">示例</span>}
      </span>
      {!compact&&x.note&&<span className="note">{x.note}</span>}
    </div>
    <div className="row-side">
      {!compact&&<div className="stepper" aria-label="看到第几话">
        <button onClick={()=>step(x.id,-1)} aria-label="少记一话"><Minus size={14}/></button>
        <output key={x.seen}>{x.seen}{x.total?<small>/{x.total}</small>:null}</output>
        <button onClick={()=>{step(x.id,1);buzz(6);}} aria-label="多记一话"><Plus size={14}/></button>
      </div>}
      {compact&&<span className="seen">第 {x.seen} 话</span>}
      {x.url&&<a className="go" href={x.url} target="_blank" rel="noreferrer" onClick={()=>visited('series',x.id)} aria-label={`去看「${x.title}」`}><ExternalLink size={16}/></a>}
    </div>
  </li>;
}
function ChefRow({x,compact,onEdit}:{x:Chef;compact?:boolean;onEdit?:()=>void}){
  const stale=Date.now()-x.visited>10*864e5;
  return <li className={`row${stale?' stale':''}`}>
    <div className="row-text">
      <button className="row-title" onClick={onEdit} disabled={!onEdit}><Dots ids={x.who}/><b>{x.name}</b></button>
      <span className="meta">
        <span>厨子</span>{x.site&&<span>{x.site}</span>}
        <span className={stale?'warm':''}>{ago(x.visited)}</span>
        {x.sample&&<span className="sample">示例</span>}
      </span>
      {!compact&&x.note&&<span className="note">{x.note}</span>}
    </div>
    <div className="row-side">
      {!compact&&<Seen on={()=>{visited('chefs',x.id);buzz(6);}} done={fresh(x.visited)}/>}
      {x.url?<a className="go" href={x.url} target="_blank" rel="noreferrer" onClick={()=>visited('chefs',x.id)} aria-label={`去${x.name}的主页`}><ExternalLink size={16}/></a>
        :!compact&&<button className="link" onClick={onEdit}>补上主页</button>}
    </div>
  </li>;
}

function Follow({s,add}:{s:State;add:(d?:Draft)=>void}){
  const series=[...s.series].sort((a,b)=>(a.state==='on'?0:1)-(b.state==='on'?0:1)||a.visited-b.visited);
  const chefs=[...s.chefs].sort((a,b)=>a.visited-b.visited);
  const due=s.series.filter(x=>x.state==='on'&&Date.now()-x.visited>7*864e5).length+s.chefs.filter(x=>Date.now()-x.visited>10*864e5).length;
  return <main className="page enter">
    <header className="page-top">
      <h1>追更</h1>
      <p>{due?<>有 <b>{due}</b> 处很久没去了，排在最前。</>:'都去看过了。'}点箭头去看，回来就记成「今天看过」；在 App 里看过的，点对勾记一下。</p>
    </header>
    <section className="block">
      <div className="block-head"><h2>系列与合集</h2><button className="link" onClick={()=>add({type:'series'})}>添一个系列</button></div>
      {series.length?<ul className="rows">{series.map(x=><SeriesRow key={x.id} x={x} onEdit={()=>add({type:'series',series:x})}/>)}</ul>
        :<Empty text="还没有在追的系列。" act="添一个系列" on={()=>add({type:'series'})}/>}
    </section>
    <section className="block">
      <div className="block-head"><h2>厨子</h2><button className="link" onClick={()=>add({type:'chef'})}>添一位厨子</button></div>
      {chefs.length?<ul className="rows">{chefs.map(x=><ChefRow key={x.id} x={x} onEdit={()=>add({type:'chef',chef:x})}/>)}</ul>
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
    {shown.length?<ul className="slips">{shown.map(i=><Slip key={i.id} i={i} showWho onOpen={()=>add({type:'item',item:i})}/>)}</ul>
      :<Empty text={s.items.length?'这样筛下来一件都没有。':'藏阁还是空的。看到好吃的，复制链接回来收一口。'} act="收一口" on={()=>add()}/>}
  </main>;
}

function Empty({text,act,on}:{text:string;act:string;on:()=>void}){
  return <div className="empty"><p>{text}</p><button className="pill" onClick={on}><Plus size={16} aria-hidden="true"/>{act}</button></div>;
}
