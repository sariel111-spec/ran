import {useEffect,useRef,useState} from 'react';
import {ClipboardPaste,ExternalLink,X} from 'lucide-react';
import {guessWho,label,people} from './people';
import {preferApp,setPreferApp,openOut,appLink,connect,disconnect,getRemote,linkCode,readLinkCode,syncNow,useSync,soundOn,setSound,tock,clearSamples,exportJson,getCover,hasSamples,imgAlive,importJson,kinds,normImg,putCover,say,restore,readShare,remove,saveChef,saveItem,saveSeries,siteOf,statuses,
  type Chef,type Item,type Kind,type Series,type State,type Status} from './store';

export type Draft={type:'item'|'series'|'chef';item?:Item;series?:Series;chef?:Chef;who?:string;kind?:Kind};

function Sheet({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){
  useEffect(()=>{
    const on=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};
    addEventListener('keydown',on);document.body.classList.add('locked');
    return()=>{removeEventListener('keydown',on);document.body.classList.remove('locked');};
  },[close]);
  return <div className="veil" onPointerDown={e=>{if(e.target===e.currentTarget)close();}}>
    <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2><button className="icon" onClick={close} aria-label="关上"><X size={19}/></button></header>
      {children}
    </section>
  </div>;
}

const typeName={item:'一篇',series:'一个系列',chef:'一位厨子'} as const;

export function AddSheet({draft,close}:{draft:Draft;close:()=>void}){
  const old=draft.item??draft.series??draft.chef;
  const [type,setType]=useState(draft.type);
  const [paste,setPaste]=useState('');
  const [url,setUrl]=useState(old?.url??'');
  const [title,setTitle]=useState(draft.item?.title??draft.series?.title??draft.chef?.name??'');
  const [by,setBy]=useState(draft.item?.by??draft.series?.by??'');
  const [whose,setWhose]=useState<string[]>(old?.who??(draft.who?[draft.who]:[]));
  const [kind,setKind]=useState<Kind>(draft.item?.kind??draft.kind??'fic');
  const [status,setStat]=useState<Status>(draft.item?.status??'want');
  const [taste,setTaste]=useState(draft.item?.taste??0);
  const [note,setNote]=useState(old?.note??'');
  const [seen,setSeen]=useState(String(draft.series?.seen??''));
  const [total,setTotal]=useState(String(draft.series?.total||''));
  const [st,setSt]=useState<Series['state']>(draft.series?.state??'on');
  const [cover,setCover]=useState(draft.item?.cover);
  const [img,setImg]=useState(draft.item?.img??'');
  const [ratio,setRatio]=useState(draft.item?.ratio);
  const [shot,setShot]=useState('');
  useEffect(()=>{let on=true;setShot('');if(cover)void getCover(cover).then(v=>{if(on&&v)setShot(v);});return()=>{on=false;};},[cover]);
  const linked=normImg(img.trim());
  const preview=shot||(linked&&imgAlive(linked)?linked:'');
  const [sure,setSure]=useState(false);
  const [err,setErr]=useState('');
  const file=useRef<HTMLInputElement>(null);

  const take=(text:string)=>{
    setPaste(text);
    const r=readShare(text);
    if(r.url)setUrl(r.url);
    if(r.title&&type!=='chef')setTitle(t=>t||r.title);
    if(r.by)(type==='chef'?setTitle:setBy)(v=>v||r.by);
    if(type==='item'){
      if(r.site==='AO3')setKind('ao3');
      else if(/漫剧|AI\s?漫/i.test(text))setKind('comic');
      else if(/剧情|主线|实况/.test(text))setKind('plot');
    }
    // 标题里认得出是谁，就先替你分好牌（赵光义、晋中原、赵二都归同一块）
    const g=guessWho(text);
    if(g.length)setWhose(w=>w.length?w:g);
  };
  const fromClipboard=async()=>{
    try{take(await navigator.clipboard.readText());}
    catch{setErr('浏览器没让读剪贴板，长按上面的框手动粘贴就行。');}
  };
  const toggle=(id:string)=>setWhose(w=>w.includes(id)?w.filter(x=>x!==id):[...w,id]);

  const save=()=>{
    const name=title.trim();
    if(!name){setErr(type==='chef'?'给这位厨子写个名字。':'写个标题，之后才找得到它。');return;}
    const common={id:old?.id,who:whose,url:url.trim(),site:siteOf(url.trim()),note:note.trim()};
    if(type==='item')saveItem({...common,title:name,by:by.trim(),kind,status,taste,cover,img:linked||undefined,ratio});
    else if(type==='series')saveSeries({...common,title:name,by:by.trim(),seen:Math.max(0,parseInt(seen)||0),total:Math.max(0,parseInt(total)||0),state:st});
    else saveChef({...common,name});
    close();
  };
  const del=()=>{
    if(!sure){setSure(true);return;}
    const list=type==='item'?'items':type==='series'?'series':'chefs';
    remove(list,old!.id);say(`删掉了「${title.trim()||'这一条'}」`,()=>restore(list,old!));close();
  };

  return <Sheet title={old?`改一改这${type==='chef'?'位厨子':type==='series'?'个系列':'篇'}`:'收一口'} close={close}>
    <div className="form">
      {!old&&<div className="seg" role="group" aria-label="收的是什么">
        {(['item','series','chef'] as const).map(t=><button key={t} aria-pressed={type===t} onClick={()=>setType(t)}>{typeName[t]}</button>)}
      </div>}

      {!old&&<label className="field paste">
        <span>在 App 里点分享、复制链接，把复制到的那一整段贴进来，标题和厨子会自己拆好</span>
        <textarea value={paste} onChange={e=>take(e.target.value)} rows={2} placeholder="粘贴在这里" autoFocus/>
        <button type="button" className="link" onClick={fromClipboard}><ClipboardPaste size={15} aria-hidden="true"/>读剪贴板</button>
      </label>}

      <label className="field"><span>{type==='chef'?'厨子的名字':'标题'}</span>
        <input value={title} onChange={e=>{setTitle(e.target.value);setErr('');}}/></label>
      {type!=='chef'&&<label className="field"><span>厨子</span><input value={by} onChange={e=>setBy(e.target.value)} placeholder="谁做的饭"/></label>}
      <label className="field"><span>{type==='chef'?'主页链接':'链接'}</span>
        <span className="with-go"><input value={url} onChange={e=>setUrl(e.target.value)} inputMode="url" placeholder="https://"/>
          {url&&<a className="go" href={url} target="_blank" rel="noreferrer" aria-label="打开这个链接"><ExternalLink size={16}/></a>}</span>
        {url&&<small>{siteOf(url)}</small>}</label>

      <fieldset className="field"><legend>是谁的</legend>
        <div className="mini">{people.map(p=><button type="button" key={p.id} aria-pressed={whose.includes(p.id)} onClick={()=>toggle(p.id)} style={{'--deep':p.deep} as React.CSSProperties}><i/>{label(p)}</button>)}</div>
      </fieldset>

      {type==='item'&&<>
        <fieldset className="field"><legend>种类</legend>
          <div className="chips">{kinds.map(k=><button type="button" key={k.id} aria-pressed={kind===k.id} onClick={()=>setKind(k.id)}>{k.name}</button>)}</div>
        </fieldset>
        <fieldset className="field"><legend>吃到哪了</legend>
          <div className="seg">{statuses.map(x=><button type="button" key={x.id} aria-pressed={status===x.id} onClick={()=>setStat(x.id)}>{x.name}</button>)}</div>
        </fieldset>
        <fieldset className="field"><legend>好吃度</legend>
          <div className="rate">{[1,2,3,4,5].map(n=><button type="button" key={n} className={n<=taste?'on':''} onClick={()=>setTaste(taste===n?0:n)} aria-label={`${n} 分`} aria-pressed={n<=taste}/>)}</div>
        </fieldset>
      </>}

      {type==='series'&&<div className="pair">
        <label className="field"><span>看到第几话</span><input value={seen} onChange={e=>setSeen(e.target.value)} inputMode="numeric" placeholder="0"/></label>
        <label className="field"><span>一共几话（不知道就空着）</span><input value={total} onChange={e=>setTotal(e.target.value)} inputMode="numeric"/></label>
        <fieldset className="field wide"><legend>现在</legend>
          <div className="chips">{([['on','连载中'],['end','完结'],['pit','坑了']] as const).map(([id,n])=><button type="button" key={id} aria-pressed={st===id} onClick={()=>setSt(id)}>{n}</button>)}</div>
        </fieldset>
      </div>}

      <label className="field"><span>备注</span><textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder={type==='item'?'哪里好吃':''}/></label>

      {type==='item'&&<div className="field cover-field">
        <span>封面</span>
        <div className="cover-row">
          {preview?<img src={preview} alt="现在的封面" referrerPolicy="no-referrer"/>:<i aria-hidden="true">还没有图</i>}
          <div>
            <input ref={file} type="file" accept="image/*" hidden onChange={async e=>{const f=e.target.files?.[0];if(!f)return;const c=await putCover(f);setCover(c.id);setRatio(c.ratio);}}/>
            <button type="button" className="link" onClick={()=>file.current?.click()}>{cover?'换一张自己存的图':'放一张自己存的图'}</button>
            {(cover||img)&&<button type="button" className="link" onClick={()=>{setCover(undefined);setImg('');setRatio(undefined);}}>不要封面</button>}
          </div>
        </div>
        <input value={img} onChange={e=>{setImg(e.target.value);if(!cover)setRatio(undefined);}} inputMode="url" placeholder="或者贴一个图片链接" aria-label="封面图片链接"/>
      </div>}

      {err&&<p className="err" role="alert">{err}</p>}
      <footer>
        {old&&<button className="danger" onClick={del}>{sure?'再点一次就删掉':'删掉'}</button>}
        {old&&url&&<a className="pill" href={url} target="_blank" rel="noreferrer" onClick={e=>{if(preferApp()&&appLink(url)){e.preventDefault();openOut(url);}}}><ExternalLink size={15} aria-hidden="true"/>{type==='chef'?'去主页':type==='series'?'去看':'去吃'}</a>}
        <button className="primary" onClick={save}>{old?'改好了':'收下'}</button>
      </footer>
    </div>
  </Sheet>;
}

export function SettingsSheet({s,close}:{s:State;close:()=>void}){
  const sync=useSync();
  const remote=getRemote();
  const [msg,setMsg]=useState('');
  const [sound,setSnd]=useState(soundOn);
  const [app,setApp]=useState(preferApp);
  const [owner,setOwner]=useState('sariel111-spec');
  const [repo,setRepo]=useState('ran-data');
  const [key,setKey]=useState('');
  const [busy,setBusy]=useState(false);
  const file=useRef<HTMLInputElement>(null);
  const out=()=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([exportJson()],{type:'application/json'}));
    a.download=`染-备份-${new Date().toISOString().slice(0,10)}.json`;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);setMsg('备份文件已经下载。');
  };
  const join=async(r:{owner:string;repo:string;token:string})=>{
    setBusy(true);setMsg('');
    try{await connect(r);setKey('');setMsg('连上了。以后这台设备会自己同步。');}
    catch(e){setMsg(e instanceof Error?e.message:'连接失败');}
    finally{setBusy(false);}
  };
  const link=()=>{
    const code=readLinkCode(key);
    if(code)return join(code);
    if(!owner.trim()||!repo.trim()||!key.trim()){setMsg('三项都要填。');return;}
    return join({owner:owner.trim(),repo:repo.trim(),token:key.trim()});
  };
  const pasteCode=async()=>{
    let text='';
    try{text=await navigator.clipboard.readText();}catch{setMsg('读不到剪贴板。把连接码粘贴到「令牌或连接码」那一格，再点「连接」也可以。');return;}
    const code=readLinkCode(text);
    if(!code){setMsg('剪贴板里没有连接码。先在已经连好的那台设备上点「复制连接码」。');return;}
    return join(code);
  };
  const copyCode=async()=>{
    try{await navigator.clipboard.writeText(linkCode());setMsg('连接码已复制。到另一台设备的「染」里点「粘贴连接码」。');}
    catch{setMsg('复制失败，换个浏览器再试。');}
  };
  const when=sync.at?new Date(sync.at).toLocaleTimeString('zh-CN',{hour12:false}):'';
  return <Sheet title="设置" close={close}>
    <div className="form">
      <section className="sync">
        <h3>同步</h3>
        <p className="device-line">这台设备：{remote?`已连接 ${remote.owner}/${remote.repo}`:'还没连接，东西只存在这台设备上'}
          {remote&&<> · {sync.state==='error'?sync.message:sync.state==='syncing'?'正在同步':when?`上次同步 ${when}`:'还没同步过'}</>}
          <br/>藏了 {s.items.length} 件 · 在追 {s.series.length} 个系列 · 厨子 {s.chefs.length} 位 · 版本 {BUILD}</p>
        {remote?<div className="stack">
          <button className="pill" onClick={()=>void syncNow()}>现在同步一次</button>
          <button className="pill" onClick={copyCode}>复制连接码</button>
          <button className="link" onClick={()=>void disconnect()}>断开</button>
        </div>:<>
          <div className="stack"><button className="pill" onClick={pasteCode} disabled={busy}>粘贴连接码</button></div>
          <p className="plain small">第一台设备：填下面三项。之后的设备只要「粘贴连接码」。</p>
          <div className="pair">
            <label className="field"><span>GitHub 用户名</span><input name="ran-owner" value={owner} onChange={e=>setOwner(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}/></label>
            <label className="field"><span>私有仓库名</span><input name="ran-repo" value={repo} onChange={e=>setRepo(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}/></label>
          </div>
          <label className="field"><span>令牌或连接码</span>
            <input type="text" name="ran-key" className="masked" value={key} onChange={e=>setKey(e.target.value)} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-1p-ignore data-lpignore="true" placeholder="只给 ran-data 这一个仓库的令牌"/></label>
          <div className="stack"><button className="primary" onClick={link} disabled={busy}>{busy?'正在连接':'连接'}</button></div>
        </>}
      </section>
      <section className="sync">
        <h3>备份</h3>
        <div className="stack">
          <button className="pill" onClick={out}>导出备份</button>
          <button className="pill" onClick={()=>file.current?.click()}>导入备份</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async e=>{
            const f=e.target.files?.[0];if(!f)return;
            try{importJson(await f.text());setMsg('导入好了。');}catch(x){setMsg(x instanceof Error?x.message:'这个文件读不了。');}
          }}/>
          {hasSamples(s)&&<button className="pill" onClick={()=>{clearSamples();setMsg('示例已经清掉。');}}>清掉示例</button>}
        </div>
      </section>
      <label className="switch"><input type="checkbox" checked={app} onChange={e=>{setPreferApp(e.target.checked);setApp(e.target.checked);}}/><span>跳转时先打开 App（小红书、抖音、B站），没装再开网页</span></label>
      <label className="switch"><input type="checkbox" checked={sound} onChange={e=>{setSound(e.target.checked);setSnd(e.target.checked);if(e.target.checked)tock();}}/><span>翻牌时有一声木头响</span></label>
      {msg&&<p className="plain" role="status">{msg}</p>}
    </div>
  </Sheet>;
}
const BUILD=((document.querySelector('script[type=module][src*="assets/"]') as HTMLScriptElement|null)?.src.split('/').pop()??'预览').replace(/^index-|\.js$/g,'').slice(0,8);
