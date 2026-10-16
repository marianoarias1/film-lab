import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewQueue} from '../dist/preview-queue.js';
import {rawPixels,rawDimensions} from '../dist/raw-preview.js';

const tick = () => new Promise(resolve=>setImmediate(resolve));
test('rapid previews retain one running job and only the newest pending edit', async()=>{
  const queue=createPreviewQueue(), started=[];
  let release;
  const first=queue.request(async()=>{started.push(0);await new Promise(r=>release=r);return 0;});
  const pending=[];
  for(let i=1;i<=20;i++) pending.push(queue.request(async()=>{started.push(i);return i;}));
  release();
  assert.equal(await first,0);
  assert.deepEqual(await Promise.all(pending),[...Array(19).fill(null),20]);
  assert.deepEqual(started,[0,20]);
});
test('media changes clear queued work; a failed render does not stall the queue',async()=>{
  const queue=createPreviewQueue();let release;
  const first=queue.request(()=>new Promise(r=>release=r));
  const stale=queue.request(()=>assert.fail('old file must never render'));
  queue.clear();assert.equal(await stale,null);release();await first;
  await assert.rejects(queue.request(()=>{throw Error('bad pixels');}),/bad pixels/);
  assert.equal(await queue.request(()=>42),42);
  await tick();
});
test('full-resolution RAW conversion preserves every RGB byte and alpha',()=>{
  const image={width:2,height:2,colors:3,data:new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12])};
  const result=rawPixels(image);
  assert.deepEqual(new Uint8ClampedArray(result.pixels),new Uint8ClampedArray([1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255]));
  assert.deepEqual(rawDimensions(image,{width:6000,height:4000},false),{width:2,height:2});
});
test('RAW preview bounds working memory and preserves original oriented dimensions',()=>{
  const image={width:4,height:2,colors:3,data:new Uint8Array(24).fill(80)};
  const result=rawPixels(image,2);
  assert.equal(result.width,2);assert.equal(result.height,1);assert.equal(result.pixels.byteLength,8);
  assert.deepEqual([...new Uint8ClampedArray(result.pixels)],[80,80,80,255,80,80,80,255]);
  assert.deepEqual(rawDimensions(image,{width:8,height:4},true),{width:8,height:4});
  assert.deepEqual(rawDimensions({width:2,height:4},{width:8,height:4},true),{width:4,height:8});
});
