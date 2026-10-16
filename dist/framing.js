const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function normalizeFraming(input){
 if(!input||typeof input!=='object')return null;
 const number=(v,f)=>Number.isFinite(v)?v:f;
 const turns=((Math.round(number(input.turns,0))%4)+4)%4;
 const angle=clamp(number(input.angle,0),-20,20);
 const width=clamp(number(input.width,1),.05,1),height=clamp(number(input.height,1),.05,1);
 const x=clamp(number(input.x,0),0,1-width),y=clamp(number(input.y,0),0,1-height);
 return turns||angle||x||y||width!==1||height!==1?{turns,angle,x,y,width,height}:null;
}
export function framingGeometry(width,height,input){
 const s=normalizeFraming(input)||{turns:0,angle:0,x:0,y:0,width:1,height:1};
 const w=s.turns%2?height:width,h=s.turns%2?width:height;
 const radians=s.angle*Math.PI/180,c=Math.abs(Math.cos(radians)),n=Math.abs(Math.sin(radians));
 return {...s,orientedWidth:w,orientedHeight:h,outputWidth:Math.max(1,Math.round(w*s.width)),outputHeight:Math.max(1,Math.round(h*s.height)),radians:s.turns*Math.PI/2+radians,cover:Math.max(c+h/w*n,c+w/h*n)};
}
export function ratioFraming(width,height,ratio,initial={}){
 const s=normalizeFraming(initial)||{turns:0,angle:0,x:0,y:0,width:1,height:1};
 if(!ratio)return {...s};
 const g=framingGeometry(width,height,s),relative=ratio*g.orientedHeight/g.orientedWidth;
 const w=Math.min(1,relative),h=w/relative;
 return {...s,x:clamp(s.x+s.width/2-w/2,0,1-w),y:clamp(s.y+s.height/2-h/2,0,1-h),width:w,height:h};
}
export function frameCanvas(source,input){
 const s=normalizeFraming(input);if(!s)return source;
 const g=framingGeometry(source.width,source.height,s),out=document.createElement('canvas');out.width=g.outputWidth;out.height=g.outputHeight;
 const ctx=out.getContext('2d');ctx.save();ctx.translate(-g.x*g.orientedWidth,-g.y*g.orientedHeight);ctx.translate(g.orientedWidth/2,g.orientedHeight/2);ctx.rotate(g.radians);ctx.scale(g.cover,g.cover);ctx.drawImage(source,-source.width/2,-source.height/2);ctx.restore();return out;
}
let cachedSource=null,cachedKey='',cachedData=null;
export function framedImageData(source,input){
 const s=normalizeFraming(input);if(!source||!s)return source;
 const key=JSON.stringify(s);if(cachedSource===source&&cachedKey===key)return cachedData;
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').putImageData(source,0,0);
 const framed=frameCanvas(canvas,s),data=framed.getContext('2d',{willReadFrequently:true}).getImageData(0,0,framed.width,framed.height);
 canvas.width=canvas.height=framed.width=framed.height=0;cachedSource=source;cachedKey=key;cachedData=data;return data;
}
export function clearFramingCache(){cachedSource=cachedData=null;cachedKey='';}
