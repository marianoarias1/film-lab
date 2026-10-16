import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dustLightDefaults,normalizeDustLight,applyDustLight} from '../dist/dust-light.js';
import {normalizeSettings,applyPixels,parseRecipe} from '../dist/engine.js';
import {laboratoryDefaults,normalizeLaboratory,applyLaboratory,presets} from '../dist/laboratory-engine.js';
import {createPhoto,copyTreatment,pasteTreatment,settingsAtIntensity} from '../dist/album.js';
const input=(w,h)=>Uint8ClampedArray.from({length:w*h*4},(_,i)=>i%4===3?179:80+(i%151));
const effect=()=>({...dustLightDefaults(),enabled:true});
test('disabled and zero intensity preserve every original byte; old edits default to disabled',()=>{
 const pixels=input(50,40);for(const s of [undefined,dustLightDefaults(),{...effect(),intensity:0}])assert.deepEqual(applyDustLight(pixels.slice(),50,40,s),pixels);
 assert.equal(normalizeLaboratory({film:{enabled:true}}).dustLight.enabled,false);
});
test('distribution is deterministic and independent; temperature and intensity are effective',()=>{
 const pixels=input(240,160),s=effect(),render=s=>applyDustLight(pixels.slice(),240,160,s),a=render(s);
 assert.deepEqual(a,render(s));assert.notDeepEqual(a,pixels);assert.notDeepEqual(a,render({...s,seed:s.seed+17033}));assert.notDeepEqual(a,render({...s,temperature:0}));assert.notDeepEqual(a,render({...s,intensity:10}));
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],pixels[i]);
 const legacy={...laboratoryDefaults(),film:{...laboratoryDefaults().film,enabled:true}};const before=applyLaboratory(pixels.slice(),240,160,legacy);legacy.dustLight={...s,enabled:false};assert.deepEqual(before,applyLaboratory(pixels.slice(),240,160,legacy));
});
test('photo export bands equal full frame even with particles crossing band boundaries',()=>{
 const w=601,h=409,pixels=input(w,h),settings=normalizeSettings({grain:12,laboratory:{dustLight:{...effect(),size:100,diffusion:100}}});
 const full=applyPixels(pixels,w,h,settings,{fullWidth:w,fullHeight:h}),bands=new Uint8ClampedArray(pixels.length);
 for(let y=0;y<h;y+=83){const rows=Math.min(83,h-y);bands.set(applyPixels(pixels.slice(y*w*4,(y+rows)*w*4),w,rows,settings,{fullWidth:w,fullHeight:h,offsetY:y}),y*w*4);}assert.deepEqual(bands,full);
});
test('settings are bounded and survive recipe/JSON/copy; videos keep unsupported effects out',()=>{
 const invalid=normalizeDustLight({enabled:1,intensity:999,amount:-2,size:NaN,seed:Infinity,temperature:'bad',extra:true});assert.equal(invalid.enabled,false);assert.equal(invalid.intensity,100);assert.equal(invalid.amount,0);assert.equal(invalid.size,40);assert(!('extra'in invalid));
 const settings=normalizeSettings({grain:16,laboratory:{dustLight:effect()}});const source=createPhoto(new File(['a'],'a.jpg',{type:'image/jpeg'}),{id:'source',name:'Source',settings});source.settings=settings;
 const copied=copyTreatment(source),target=createPhoto(new File(['b'],'b.jpg',{type:'image/jpeg'}),{id:'target',name:'Target',settings:{}});pasteTreatment(target,copied);assert.deepEqual(target.settings.laboratory.dustLight,effect());assert.deepEqual(JSON.parse(JSON.stringify(target.settings)),settings);assert.deepEqual(settingsAtIntensity(settings,20).laboratory.dustLight,effect());
 const imported=parseRecipe({name:'Luz',settings});assert.deepEqual(imported.settings.laboratory.dustLight,effect());
 const video=createPhoto(new File(['v'],'v.mp4',{type:'video/mp4'}),{id:'video',name:'Video',settings:{}});pasteTreatment(video,copied);assert.equal(video.settings.laboratory,null);
 assert.equal(presets.stardust.dustLight.enabled,true);
});
