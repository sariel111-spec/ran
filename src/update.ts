// 加到主屏幕的网页是从内存里恢复的，不会重新加载，可能好几天都停在旧版本上。
// 每次回到前台，比一下正在跑的版本和 index.html 现在指向的版本。
// 样式和脚本各有一个带版本号的文件名，两个都要比：只改了样式时脚本的名字不会变
const names=(text:string)=>[...new Set(text.match(/assets\/index-[\w-]+\.(?:js|css)/g)??[])].sort().join('|');
const mine=names(document.documentElement.outerHTML);
let last=0;
async function check(){
  if(!mine||Date.now()-last<30000)return;
  last=Date.now();
  try{
    const html=await (await fetch('./index.html?t='+Date.now(),{cache:'no-store'})).text();
    const next=names(html);
    if(!next||next===mine)return;
    // 开着抽屉时不刷新；同一个版本也只刷新一次
    if(document.querySelector('.sheet')||sessionStorage.getItem('ran-build')===next){last=0;return;}
    sessionStorage.setItem('ran-build',next);
    location.replace(location.pathname+'?v='+Date.now().toString(36)+location.hash);
  }catch{/* 没网就下次再看 */}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void check();});
addEventListener('pageshow',()=>{void check();});
setTimeout(()=>{void check();},4000);
