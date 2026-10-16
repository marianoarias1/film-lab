const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
export function normalizeRegion(input){
 if(!input||typeof input!=='object')return null;
 const mode=input.mode==='edges'?'edges':'all';
 const erased=Array.isArray(input.erased)?input.erased.slice(0,512).filter(p=>p&&[p.x,p.y,p.radius].every(Number.isFinite)).map(p=>({x:clamp(p.x),y:clamp(p.y),radius:clamp(p.radius,.015,.4)})):[];
 return mode==='all'&&!erased.length?null:{mode,erased};
}
export function regionWeight(region,x,y,width,height){
 if(!region)return 1;
 const min=Math.min(width,height),sx=width/min,sy=height/min;
 let weight=1;
 if(region.mode==='edges'){const edge=Math.min(x*width,(1-x)*width,y*height,(1-y)*height)/min,t=clamp(edge/.3);weight=1-t*t*(3-2*t);}
 for(const p of region.erased){const distance=Math.hypot((x-p.x)*sx,(y-p.y)*sy)/p.radius;if(distance>=1)continue;const t=clamp((distance-.55)/.45);weight*=t*t*(3-2*t);if(weight<.001)return 0;}
 return weight;
}
export function regionSampler(input,width,height){
 const region=normalizeRegion(input);if(!region)return null;
 if(!region.erased.length)return (x,y)=>regionWeight(region,x,y,width,height);
 const cols=32,rows=Math.max(8,Math.min(64,Math.ceil(32*height/width))),min=Math.min(width,height);
 const cells=Array.from({length:cols*rows},()=>({mode:region.mode,erased:[]}));
 for(const p of region.erased){const dx=p.radius*min/width,dy=p.radius*min/height,left=Math.max(0,Math.floor((p.x-dx)*cols)),right=Math.min(cols-1,Math.floor((p.x+dx)*cols)),top=Math.max(0,Math.floor((p.y-dy)*rows)),bottom=Math.min(rows-1,Math.floor((p.y+dy)*rows));for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)cells[y*cols+x].erased.push(p);}
 return (x,y)=>regionWeight(cells[Math.min(rows-1,Math.max(0,Math.floor(y*rows)))*cols+Math.min(cols-1,Math.max(0,Math.floor(x*cols)))],x,y,width,height);
}
