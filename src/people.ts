export type Person={
  id:string;
  name:string;       // 牌子上写的名字
  alias:string;      // 另一个称呼
  also?:string;      // 同一个人的另一个名字，和正名刻在同一块牌子上
  seal:string;       // 他的小印
  keys:RegExp;       // 标题里出现这些字，就算他的
  from:string;       // 出处
  line:string;       // 进到他那页时的一句
  tint:string;       // 染过之后的底色
  deep:string;       // 染料本色
  mark:string;       // 一点点缀色
  tilt:number;       // 牌子在盘里歪多少度
};

export const people:Person[]=[
  {id:'czx',name:'陈子奚',alias:'玉山君',seal:'奚',keys:/陈子奚|子奚|奚主|玉山君/,from:'燕云十六声',line:'沧浪之水清兮',tint:'#DDEBE6',deep:'#1D5C57',mark:'#8C2F2B',tilt:-.5},
  {id:'zgy',name:'赵光义',alias:'开封府尹',also:'晋中原',seal:'义',keys:/赵光义|晋中原|晋中缘|赵二|义主|晋主|府尹/,from:'燕云十六声',line:'千秋在我，功过任说',tint:'#F2E3DD',deep:'#8A2620',mark:'#3B2C4D',tilt:.5},
  {id:'cs',name:'陈慎',alias:'小师兄',seal:'慎',keys:/陈慎|慎主|小师兄/,from:'燕云十六声',line:'观音九针，与天借命',tint:'#F1EED6',deep:'#7A5D0E',mark:'#4F8572',tilt:-.3},
  {id:'ywz',name:'叶问舟',alias:'师兄',seal:'舟',keys:/叶问舟|问舟|舟主|李慕苏/,from:'逆水寒',line:'舟上一笛，桃花满襟',tint:'#DEE9F2',deep:'#2A5A82',mark:'#C9797B',tilt:.9},
  {id:'zql',name:'周棋洛',alias:'洛洛',seal:'洛',keys:/周棋洛|棋洛|洛洛|kiro|helios/i,from:'恋与制作人',line:'今天也是太阳',tint:'#FAEFC8',deep:'#8E5400',mark:'#E9A100',tilt:-.6},
  {id:'newt',name:'纽特',alias:'斯卡曼德',seal:'纽',keys:/纽特|斯卡曼德|newt|scamander/i,from:'神奇动物在哪里',line:'箱子里另有一个世界',tint:'#DCE6EA',deep:'#21495D',mark:'#B98820',tilt:.3},
  {id:'pp',name:'加菲虫',alias:'彼得·帕克',seal:'虫',keys:/加菲虫|加菲|超凡蜘蛛侠|蜘蛛侠|彼得|peter|garfield/i,from:'超凡蜘蛛侠',line:'放学后，屋顶见',tint:'#E2E6F1',deep:'#1F3A75',mark:'#B4242B',tilt:-.8},
];

export const who=(id:string)=>people.find(p=>p.id===id);

// 赵光义和晋中原是同一个人：只有一块牌子，收藏和追更都记在同一处。
export const guessWho=(text:string)=>people.filter(p=>p.keys.test(text)).map(p=>p.id);
export const label=(p:Person)=>p.also?`${p.name}·${p.also}`:p.name;
const digits='〇一二三四五六七八九';
export const cn=(n:number):string=>n<10?digits[n]:n<20?'十'+(n%10?digits[n%10]:''):n<100?digits[Math.floor(n/10)]+'十'+(n%10?digits[n%10]:''):String(n);
