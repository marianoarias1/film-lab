import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings,applyPixels} from '../dist/engine.js';
import {laboratoryDefaults} from '../dist/laboratory-engine.js';
import {sharedGrainValue,setSharedGrain,hasLegacyGrain} from '../dist/shared-grain.js';
import {settingsAtIntensity} from '../dist/album.js';
const input=new Uint8ClampedArray(16*12*4).fill(128);
const render=s=>applyPixels(input.slice(),16,12,s);
test('reading shared grain preserves legacy settings and rendered pixels',()=>{
 const lab=laboratoryDefaults();lab.film.enabled=true;lab.film.grain=28;
 const s=normalizeSettings({grain:12,laboratory:lab}),saved=structuredClone(s),before=render(s);
 assert(hasLegacyGrain(s));assert(sharedGrainValue(s)>12);assert.deepEqual(s,saved);assert.deepEqual(render(s),before);
 setSharedGrain(s,0);assert.equal(s.grain,0);assert.equal(s.laboratory.film.grain,0);assert(!hasLegacyGrain(s));assert.equal(s.laboratory.film.fade,saved.laboratory.film.fade);
 // An undo snapshot retains the original rendering exactly.
 assert.deepEqual(render(saved),before);
});
test('one canonical grain survives serialization and is independent of Film activation',()=>{
 const s=normalizeSettings({grain:0,laboratory:laboratoryDefaults()});setSharedGrain(s,55);
 assert.equal(sharedGrainValue(s),55);assert.equal(s.laboratory.film.grain,0);
 const disabled=render(s);s.laboratory.film.enabled=true;s.laboratory.film.fade=0;s.laboratory.film.dust=0;s.laboratory.film.leak=0;
 assert.deepEqual(render(s),disabled);assert.equal(sharedGrainValue(normalizeSettings(JSON.parse(JSON.stringify(s)))),55);
 assert.equal(settingsAtIntensity(s,50).grain,27.5);setSharedGrain(s,0);assert.deepEqual(render(s),render(normalizeSettings({grain:0})));
});
