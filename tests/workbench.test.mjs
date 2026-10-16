import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeFraming,framingGeometry,ratioFraming,frameCanvas} from '../dist/framing.js';
import {normalizeSettings,applyPixels} from '../dist/engine.js';import {settingsAtIntensity,createPhoto,copyTreatment,pasteTreatment,snapshot} from '../dist/album.js';
import {normalizeRegion,regionWeight,regionSampler} from '../dist/effect-region.js';import {laboratoryDefaults,normalizeLaboratory,applyLaboratory,presets} from '../dist/laboratory-engine.js';
import {safeRecipe,stateChanges} from '../dist/cloud-model.js';

test('framing clamps data, rotates dimensions and preserves fixed output ratios',()=>{
 assert.equal(normalizeFraming({turns:4,angle:0}),null);const bounded=normalizeFraming({turns:-1,angle:900,x:2,y:-1,width:2,height:.001});assert.deepEqual(bounded,{turns:3,angle:20,x:0,y:0,width:1,height:.05});
 assert.equal(framingGeometry(6000,4000,{turns:1}).outputWidth,4000);assert.equal(framingGeometry(6000,4000,{turns:1}).outputHeight,6000);
 for(const turns of [0,1,2,3])for(const ratio of [1,.8,9/16,16/9]){const s=ratioFraming(6000,4000,ratio,{turns}),g=framingGeometry(6000,4000,s);assert(Math.abs(g.outputWidth/g.outputHeight-ratio)<.001);assert(s.x+s.width<=1.000001);assert(s.y+s.height<=1.000001);}
 // Inverse corner coordinates stay covered while straightening, without black corners.
 const g=framingGeometry(6000,4000,{angle:20}),c=Math.cos(20*Math.PI/180),n=Math.sin(20*Math.PI/180);assert((6000*c+4000*n)/g.cover<=6000+.001);assert((4000*c+6000*n)/g.cover<=4000+.001);
});
test('framing is independent of filter intensity, snapshots persist it and paste preserves target framing',()=>{
 const crop={turns:1,angle:2,x:.1,y:.1,width:.7,height:.8},s=normalizeSettings({framing:crop,contrast:20});assert.deepEqual(settingsAtIntensity(s,0).framing,crop);assert.deepEqual(snapshot(s,100,{}).settings.framing,crop);
 const recipe={id:'r',name:'R',settings:s},a=createPhoto(new File(['a'],'a.jpg',{type:'image/jpeg'}),recipe),b=createPhoto(new File(['b'],'b.jpg',{type:'image/jpeg'}),{...recipe,settings:{framing:{turns:2}}}),own=structuredClone(b.settings.framing);pasteTreatment(b,copyTreatment(a));assert.deepEqual(b.settings.framing,own);
 const v=createPhoto(new File(['v'],'v.mp4',{type:'video/mp4'}),recipe);assert.equal(v.settings.framing,null);
 assert.deepEqual(stateChanges({settings:{}},{settings:{framing:null}}),[]);
});
test('soft regions respect aspect ratio and spatial index matches direct evaluation',()=>{
 assert.equal(normalizeRegion({mode:'all',erased:[]}),null);const region=normalizeRegion({mode:'edges',erased:[{x:.08,y:.2,radius:.12},{x:.8,y:.8,radius:.2}]});assert.equal(regionWeight(region,.5,.5,6000,4000),0);assert.equal(regionWeight(region,0,.5,6000,4000),1);const sampler=regionSampler(region,6000,4000);
 for(let y=0;y<=1;y+=.03)for(let x=0;x<=1;x+=.03)assert.equal(sampler(x,y),regionWeight(region,x,y,6000,4000));
 const center={mode:'all',erased:[{x:.5,y:.5,radius:.1}]};assert.equal(regionWeight(center,.5,.5,6000,4000),0);assert(regionWeight(center,.56,.5,6000,4000)>0);assert.equal(regionWeight(center,.7,.5,6000,4000),1);
});
test('each lab component can exclude a zone, while other components and base edits stay independent',()=>{
 const w=120,h=80,input=new Uint8ClampedArray(w*h*4).fill(100),region={mode:'all',erased:[{x:.5,y:.5,radius:.3}]},center=(40*w+60)*4;
 for(const group of ['film','grade','dustLight']){const lab=laboratoryDefaults();lab.film.grain=0;lab[group].enabled=true;lab[group].region=region;const output=applyLaboratory(input.slice(),w,h,lab);assert.deepEqual(output.slice(center,center+4),input.slice(center,center+4));assert.notDeepEqual(output,input);}
 const settings=normalizeSettings({exposure:1,laboratory:{grade:{enabled:true,shadowAmount:50,region}}});const base=applyPixels(input,w,h,{exposure:1});const result=applyPixels(input,w,h,settings);assert.deepEqual(result.slice(center,center+4),base.slice(center,center+4));
});
test('masked lab export bands match full image and normalized settings retain brush strokes',()=>{
 const w=220,h=179,input=Uint8ClampedArray.from({length:w*h*4},(_,i)=>i%4===3?255:i%225),region={mode:'edges',erased:[{x:.05,y:.2,radius:.13},{x:.6,y:.8,radius:.2}]};const lab=normalizeLaboratory({film:{...presets.expired.film,region},grade:{...presets.cinema.grade,region},dustLight:{...presets.stardust.dustLight,region}});const full=applyLaboratory(input.slice(),w,h,lab),bands=new Uint8ClampedArray(input.length);
 for(let y=0;y<h;y+=31){const rows=Math.min(31,h-y);bands.set(applyLaboratory(input.slice(y*w*4,(y+rows)*w*4),w,rows,lab,{fullWidth:w,fullHeight:h,offsetY:y}),y*w*4);}assert.deepEqual(bands,full);assert.deepEqual(JSON.parse(JSON.stringify(normalizeSettings({laboratory:lab}))).laboratory,lab);
});
