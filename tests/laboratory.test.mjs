import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyPixels,normalizeSettings,parseRecipe} from '../dist/engine.js';
import {applyLaboratory,laboratoryDefaults,normalizeLaboratory,presets} from '../dist/laboratory-engine.js';
import {createPhoto,copyTreatment,pasteTreatment,settingsAtIntensity} from '../dist/album.js';
import {treatmentOf,stateChanges} from '../dist/cloud-model.js';

function fixture(width,height){const pixels=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;pixels[i]=(x*3+y)%256;pixels[i+1]=(x+y*2)%256;pixels[i+2]=(x*2+y*3)%256;pixels[i+3]=177;}return pixels;}
function laboratory(id){const p=presets[id];return {...laboratoryDefaults(),film:structuredClone(p.film),grade:structuredClone(p.grade)};}

test('older settings remain neutral; disabled components preserve the exact pixels',()=>{
 assert.equal(normalizeSettings({temperature:7}).laboratory,null);
 const pixels=fixture(80,60);assert.deepEqual(applyLaboratory(pixels.slice(),80,60,null),pixels);
 assert.deepEqual(applyLaboratory(pixels.slice(),80,60,laboratoryDefaults()),pixels);
 const before={settings:{temperature:7},intensity:100},after={settings:{temperature:7,laboratory:null},intensity:100};assert.deepEqual(stateChanges(before,after),[]);
});

test('all presets render deterministically, preserve alpha and produce different results',()=>{
 const input=fixture(80,60),original=input.slice(),outputs=[];
 for(const id of Object.keys(presets)){const s=laboratory(id),a=applyLaboratory(input.slice(),80,60,s);assert.deepEqual(a,applyLaboratory(input.slice(),80,60,s));assert.notDeepEqual(a,input);for(let i=3;i<a.length;i+=4)assert.equal(a[i],177);outputs.push(a);}
 for(let i=1;i<outputs.length;i++)assert.notDeepEqual(outputs[i],outputs[i-1]);assert.deepEqual(input,original);
});

test('export bands including neighborhood overlap match full-frame processing exactly',()=>{
 const width=257,height=405,input=fixture(width,height);
 for(const id of Object.keys(presets)){
  const settings=normalizeSettings({sharpness:22,temperature:8,grain:10,laboratory:laboratory(id)}),full=applyPixels(input,width,height,settings,{fullWidth:width,fullHeight:height,referenceWidth:width}),bands=new Uint8ClampedArray(input.length);
  for(let y=0;y<height;y+=192){const top=Math.max(0,y-1),end=Math.min(height,y+193),result=applyPixels(input.slice(top*width*4,end*width*4),width,end-top,settings,{fullWidth:width,fullHeight:height,offsetY:top,referenceWidth:width});bands.set(result.subarray((y-top)*width*4,(y-top+Math.min(192,height-y))*width*4),y*width*4);}
  assert.deepEqual(bands,full,id);
 }
});

test('normalization bounds imported parameters and does not retain unknown values',()=>{
 const s=normalizeLaboratory({film:{enabled:true,grain:999,dust:NaN,leakX:-5},grade:{enabled:true,shadows:'<script>',highlightAmount:Infinity},seed:-20,extra:'ignored'});
 assert.equal(s.film.grain,100);assert.equal(s.film.leakX,0);assert.equal(s.grade.shadows,'#427e93');assert.equal(s.seed,0);assert(!('extra'in s));assert.equal(normalizeLaboratory(null),null);
});

test('recipe intensity changes base settings while keeping laboratory independent',()=>{
 const settings=normalizeSettings({exposure:2,laboratory:laboratory('cinema')});
 for(const intensity of [0,30,100]){const result=settingsAtIntensity(settings,intensity);assert.deepEqual(result.laboratory,settings.laboratory);assert.equal(result.exposure,2*intensity/100);assert.notEqual(result.laboratory,settings.laboratory);}
});

test('copy, saved recipes and cloud snapshot serialization preserve independent effects',()=>{
 const recipe={id:'test',name:'Original',settings:normalizeSettings()},first=createPhoto(new File(['a'],'a.jpg',{type:'image/jpeg'}),recipe),second=createPhoto(new File(['b'],'b.jpg',{type:'image/jpeg'}),recipe);
 first.settings.laboratory=laboratory('expired');const clipboard=copyTreatment(first);pasteTreatment(second,clipboard);second.settings.laboratory.film.grain=91;
 assert.notEqual(first.settings.laboratory.film.grain,91);assert.notEqual(clipboard.settings.laboratory.film.grain,91);assert.equal(second.undo.length,1);
 const snapshot=JSON.parse(JSON.stringify(treatmentOf(first)));assert.deepEqual(normalizeSettings(snapshot.settings),first.settings);
 const imported=parseRecipe({name:'Mi laboratorio',settings:snapshot.settings});assert.deepEqual(imported.settings.laboratory,first.settings.laboratory);
 const changes=stateChanges({settings:{laboratory:null}},snapshot);assert.equal(changes.find(c=>c.label==='Laboratorio').after.includes('Película:'),true);
});

test('videos cannot receive unsupported laboratory components through recipes or paste',()=>{
 const recipe={id:'test',name:'Original',settings:normalizeSettings({laboratory:laboratory('expired')})},video=createPhoto(new File(['v'],'v.mp4',{type:'video/mp4'}),recipe);
 assert.equal(video.kind,'video');assert.equal(video.settings.laboratory,null);pasteTreatment(video,{settings:recipe.settings,intensity:100,recipe});assert.equal(video.settings.laboratory,null);
});

test('preview fits portrait, landscape and video aspect ratios without cropping; zoom is explicit',async()=>{
 const {fittedPreview}=await import('../dist/preview-layout.js');
 for(const [w,h]of [[399,501],[6000,4000],[1080,1920],[3840,2160]]){
  const fit=fittedPreview(w,h,760,510);assert(fit.width<=760);assert(fit.height<=510);assert(Math.abs(fit.width/fit.height-w/h)<1e-10);
  const zoom=fittedPreview(w,h,760,510,1.75);assert.equal(zoom.width,fit.width*1.75);assert.equal(zoom.height,fit.height*1.75);
 }
 assert.equal(fittedPreview(0,100,760,510),null);assert.equal(fittedPreview(100,100,0,0),null);
});
