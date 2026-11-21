// 每个人一件线描的小物。都是自己画的普通物件，不画人，也不画任何官方图样。
const P=Math.PI;
const pt=(cx:number,cy:number,r:number,deg:number)=>{
  const a=deg*P/180;
  return [+(cx+r*Math.cos(a)).toFixed(2),+(cy+r*Math.sin(a)).toFixed(2)] as const;
};

function Fan(){
  // 折扇：扇骨、扇面、一朵小荷苞、穗子
  const c=[60,96] as const;
  const ribs=Array.from({length:7},(_,i)=>204+i*22);
  const [x0,y0]=pt(c[0],c[1],66,204),[x1,y1]=pt(c[0],c[1],66,336);
  const [u0,v0]=pt(c[0],c[1],26,204),[u1,v1]=pt(c[0],c[1],26,336);
  return <>
    <path d={`M${x0} ${y0} A66 66 0 0 1 ${x1} ${y1} L${u1} ${v1} A26 26 0 0 0 ${u0} ${v0} Z`}/>
    {ribs.map(d=>{const [a,b]=pt(c[0],c[1],66,d);return <path key={d} d={`M${c[0]} ${c[1]} L${a} ${b}`}/>;})}
    <circle cx={c[0]} cy={c[1]} r="2.2"/>
    <path d="M60 98 C58 104 63 107 60 113 M60 113 L57 119 M60 113 L60 120 M60 113 L63 119"/>
    <path d="M60 46 C54 52 54 60 60 64 C66 60 66 52 60 46 Z M54 58 C50 60 50 64 56 65 M66 58 C70 60 70 64 64 65" className="thin"/>
  </>;
}

function Pendant(){
  // 玉环佩：绳、环、结、流苏
  return <>
    <path d="M60 6 L60 26"/>
    <circle cx="60" cy="46" r="20"/>
    <circle cx="60" cy="46" r="8"/>
    <path d="M60 66 L60 72 M60 72 L66 79 L60 86 L54 79 Z"/>
    <path d="M60 86 L60 92 M52 92 L68 92 M54 92 L53 114 M57 92 L56.5 116 M60 92 L60 117 M63 92 L63.5 116 M66 92 L67 114"/>
    <path d="M47 38 A16 16 0 0 1 60 30" className="thin"/>
  </>;
}

function Ginkgo(){
  // 银杏叶 + 一根针
  const veins=[-62,-44,-26,-10,10,26,44,62];
  return <>
    <path d="M60 84 C40 76 16 64 10 40 C24 28 44 24 57 31 L60 46 L63 31 C76 24 96 28 110 40 C104 64 80 76 60 84 Z"/>
    {veins.map(d=>{const [a,b]=pt(60,84,Math.abs(d)>50?40:46,-90+d);return <path key={d} className="thin" d={`M60 84 L${a} ${b}`}/>;})}
    <path d="M60 84 C61 96 58 106 52 114"/>
    <path d="M88 86 L106 112 M86 83 a2.4 2.4 0 1 0 .1 0" className="thin"/>
  </>;
}

function Flute(){
  // 一管笛、穗子、一朵桃花
  const petals=[0,72,144,216,288].map(d=>pt(84,36,9,d-90));
  return <>
    <g transform="rotate(-24 60 70)">
      <rect x="8" y="64" width="104" height="11" rx="5.5"/>
      {[30,44,56,68,80,92].map(x=><circle key={x} cx={x} cy="69.5" r="1.9" className="thin"/>)}
      <path d="M100 64 L100 75" className="thin"/>
      <path d="M18 75 C16 84 22 88 19 96 M19 96 L16 106 M19 96 L19 107 M19 96 L22 106"/>
    </g>
    {petals.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6.2" className="thin"/>)}
    <circle cx="84" cy="36" r="2.2"/>
  </>;
}

function Sun(){
  // 太阳、一颗星、一片四叶草
  const rays=Array.from({length:12},(_,i)=>i*30);
  return <>
    <circle cx="56" cy="58" r="20"/>
    {rays.map((d,i)=>{const [a,b]=pt(56,58,27,d),[c,e]=pt(56,58,i%2?35:41,d);return <path key={d} d={`M${a} ${b} L${c} ${e}`}/>;})}
    <path d="M98 22 L100.6 29.4 L108 32 L100.6 34.6 L98 42 L95.4 34.6 L88 32 L95.4 29.4 Z" className="thin"/>
    <g className="thin" transform="translate(96 98)">
      <path d="M0 0 C-9 -9 -3 -14 0 -6 C3 -14 9 -9 0 0 Z M0 0 C9 -9 14 -3 6 0 C14 3 9 9 0 0 Z M0 0 C9 9 3 14 0 6 C-3 14 -9 9 0 0 Z M0 0 C-9 9 -14 3 -6 0 C-14 -3 -9 -9 0 0 Z"/>
      <path d="M0 6 C1 12 4 15 8 17"/>
    </g>
  </>;
}

function Case(){
  // 旧皮箱，盖缝里探出一枝小绿芽
  return <>
    <rect x="16" y="46" width="88" height="56" rx="7"/>
    <path d="M16 62 L104 62"/>
    <path d="M46 46 L46 38 Q46 30 54 30 L66 30 Q74 30 74 38 L74 46"/>
    <path d="M34 46 L34 102 M86 46 L86 102" className="thin"/>
    <rect x="29" y="56" width="10" height="12" rx="2" className="thin"/>
    <rect x="81" y="56" width="10" height="12" rx="2" className="thin"/>
    <path d="M16 54 L24 46 M104 54 L96 46 M16 94 L24 102 M104 94 L96 102" className="thin"/>
    <path d="M62 62 C62 54 64 50 68 46 M68 46 C74 40 82 42 82 42 C82 50 74 52 68 46 M65 52 C59 48 54 50 54 50 C55 56 61 57 65 52" className="thin"/>
  </>;
}

function Web(){
  // 一张网，角上挂着一小滴
  const c=[60,60] as const, spokes=Array.from({length:8},(_,i)=>i*45+22.5), rings=[16,30,45];
  return <>
    {spokes.map(d=>{const [a,b]=pt(c[0],c[1],56,d);return <path key={d} d={`M${c[0]} ${c[1]} L${a} ${b}`} className="thin"/>;})}
    {rings.map(r=><path key={r} d={spokes.map((d,i)=>{
      const [a,b]=pt(c[0],c[1],r,d),[m,n]=pt(c[0],c[1],r*.8,d+22.5),[e,f]=pt(c[0],c[1],r,d+45);
      return `${i?'':`M${a} ${b} `}Q${m} ${n} ${e} ${f}`;
    }).join(' ')}/>)}
    <path d="M60 60 L60 96" className="thin"/>
    <path d="M60 96 C56 101 56 106 60 106 C64 106 64 101 60 96 Z"/>
  </>;
}

const art:Record<string,()=>React.ReactNode>={czx:Fan,zgy:Pendant,cs:Ginkgo,ywz:Flute,zql:Sun,newt:Case,pp:Web};

export function Motif({id,className=''}:{id:string;className?:string}){
  const A=art[id];
  return <svg viewBox="0 0 120 120" className={`motif ${className}`} aria-hidden="true" focusable="false">{A?<A/>:null}</svg>;
}
