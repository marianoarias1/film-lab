const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const prototypeDefaults=()=>({film:{enabled:true,fade:25,grain:20,dust:15,leak:20,leakX:.08,leakY:.4,leakTemperature:100},grade:{enabled:true,shadows:'#427e93',shadowAmount:16,mids:'#d7ae8a',midAmount:5,highlights:'#efbb79',highlightAmount:15},seed:71432});
export const presets={
 expired:{name:'Película caducada',description:'Negros suaves, textura fina y luz ámbar.',film:{enabled:true,fade:38,grain:28,dust:25,leak:34,leakX:.05,leakY:.35,leakTemperature:100},grade:{enabled:true,shadows:'#6f8b6c',shadowAmount:12,mids:'#c89372',midAmount:8,highlights:'#f0c38b',highlightAmount:15}},
 disposable:{name:'Desechable cálida',description:'Color cálido, textura y desgaste sutil.',film:{enabled:true,fade:12,grain:23,dust:9,leak:12,leakX:.96,leakY:.65,leakTemperature:100},grade:{enabled:true,shadows:'#576e66',shadowAmount:8,mids:'#e6ac7c',midAmount:8,highlights:'#f3cf94',highlightAmount:17}},
 cinema:{name:'Cine cálido / frío',description:'Sombras azuladas y luces doradas.',film:{enabled:true,fade:7,grain:10,dust:0,leak:0,leakX:.1,leakY:.5,leakTemperature:100},grade:{enabled:true,shadows:'#327e9b',shadowAmount:32,mids:'#d8a88b',midAmount:5,highlights:'#efb264',highlightAmount:27}},
 silver:{name:'Editorial frío',description:'Sombras frías y luces neutras, sin desgaste.',film:{enabled:false,fade:0,grain:0,dust:0,leak:0,leakX:.1,leakY:.5,leakTemperature:100},grade:{enabled:true,shadows:'#6982b0',shadowAmount:21,mids:'#9bafbe',midAmount:7,highlights:'#f0e9db',highlightAmount:7}}
};
export function laboratoryDefaults(){const s=prototypeDefaults();s.film.enabled=false;s.grade.enabled=false;return s;}
export function normalizeLaboratory(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const out=laboratoryDefaults();
 const number=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
 for(const group of ['film','grade']){const from=input[group];if(!from||typeof from!=='object')continue;out[group].enabled=from.enabled===true;for(const key of Object.keys(out[group])){if(key==='enabled')continue;if(typeof out[group][key]==='number')out[group][key]=number(from[key],out[group][key],0,key==='leakX'||key==='leakY'?1:100);else if(/^#[0-9a-f]{6}$/i.test(from[key]))out[group][key]=from[key].toLowerCase();}}
 out.seed=number(input.seed,out.seed,0,4294967295)>>>0;
 return out;
}
function hash(x,y,seed){let n=Math.imul(x+seed,374761393)^Math.imul(y+seed,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function color(hex){return /^#[0-9a-f]{6}$/i.test(hex)?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255):[.5,.5,.5];}
function tintVector(hex,amount){const c=color(hex),l=.2126*c[0]+.7152*c[1]+.0722*c[2];return c.map(v=>(v-l)*clamp(amount/100)*.65);}
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
export function applyLaboratory(pixels,width,height,settings,geometry={}){
 if(!settings)return pixels;
 const s=normalizeLaboratory(settings),f=s.film,g=s.grade,film=f.enabled,grade=g.enabled;
 if(!film&&!grade)return pixels;
 const fullWidth=geometry.fullWidth||width,fullHeight=geometry.fullHeight||height,offsetY=geometry.offsetY||0;
 const faded=film?clamp(f.fade/100):0,grain=film?clamp(f.grain/100)*24:0,leak=film?clamp(f.leak/100):0;
 const shadows=tintVector(g.shadows,g.shadowAmount),mids=tintVector(g.mids,g.midAmount),highlights=tintVector(g.highlights,g.highlightAmount);
 const aspect=fullHeight/fullWidth,leakRadius=.45,ref=1800,temperature=f.leakTemperature/100,leakRed=.08+.92*temperature,leakGreen=.55-.10*temperature,leakBlue=1-.92*temperature;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,nx=(x+.5)/fullWidth,ny=(y+offsetY+.5)/fullHeight;
  let r=pixels[i]/255,b=pixels[i+2]/255,v=pixels[i+1]/255;
  if(faded){const l=.2126*r+.7152*v+.0722*b,sat=1-faded*.35;r=(l+(r-l)*sat)*(1-faded*.22)+faded*.1;v=(l+(v-l)*sat)*(1-faded*.22)+faded*.1;b=(l+(b-l)*sat)*(1-faded*.22)+faded*.1;}
  if(grade){const l=.2126*r+.7152*v+.0722*b,sw=1-smooth(l/.6),hw=smooth((l-.4)/.6),mw=Math.max(0,1-sw-hw);const c=[r,v,b];for(let k=0;k<3;k++)c[k]=clamp(c[k]+(shadows[k]*sw+mids[k]*mw+highlights[k]*hw)*4*c[k]*(1-c[k]));[r,v,b]=c;}
  if(leak){const dx=nx-f.leakX,dy=(ny-f.leakY)*aspect,d=Math.sqrt(dx*dx+dy*dy),a=(1-smooth(d/leakRadius))*leak*.78;r=1-(1-r)*(1-a*leakRed);v=1-(1-v)*(1-a*leakGreen);b=1-(1-b)*(1-a*leakBlue);}
  if(grain){const noise=(hash(Math.floor(nx*ref),Math.floor(ny*ref*aspect),s.seed)-.5)*grain/255;r+=noise;v+=noise;b+=noise;}
  pixels[i]=Math.round(clamp(r)*255);pixels[i+1]=Math.round(clamp(v)*255);pixels[i+2]=Math.round(clamp(b)*255);
 }
 if(film&&f.dust>0){const count=Math.round(clamp(f.dust/100)*160),min=Math.min(fullWidth,fullHeight);for(let j=0;j<count;j++){
  const cx=hash(j,3,s.seed)*fullWidth,cy=hash(j,8,s.seed)*fullHeight-offsetY,rad=(.0005+hash(j,12,s.seed)*.0015)*min,strength=.2+hash(j,20,s.seed)*.6;
  for(let y=Math.max(0,Math.floor(cy-rad-1));y<Math.min(height,Math.ceil(cy+rad+1));y++)for(let x=Math.max(0,Math.floor(cx-rad-1));x<Math.min(width,Math.ceil(cx+rad+1));x++){const d=Math.hypot(x+.5-cx,y+.5-cy),coverage=clamp(rad+.5-d)*strength;if(!coverage)continue;const i=(y*width+x)*4,target=hash(j,30,s.seed)>.3?240:40;for(let k=0;k<3;k++)pixels[i+k]=Math.round(pixels[i+k]*(1-coverage)+target*coverage);}
 }}return pixels;
}
