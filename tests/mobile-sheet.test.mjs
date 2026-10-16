import {test} from 'node:test';import assert from 'node:assert/strict';
import {sheetSizes,closestSheetSnap,photoStageHeight} from '../dist/mobile-sheet.js';
test('sheet sizes leave image space at mobile heights and reserve header/footer',()=>{
 for(const height of [390,568,667,740,844,932]){const sizes=sheetSizes(height),available=Math.max(120,height-58-114);assert(sizes.collapsed<=sizes.compact);assert(sizes.compact<=sizes.expanded);assert(sizes.expanded<=available-96||available<160);assert(sizes.collapsed>0);}
 const normal=sheetSizes(844);assert(normal.compact>=320);assert(normal.expanded>normal.compact);assert.equal(sheetSizes(844,150).compact<normal.compact,true);
});
test('dragging chooses the nearest stable snap; compact remains reversible',()=>{const sizes=sheetSizes(844);assert.equal(closestSheetSnap(0,sizes),'collapsed');assert.equal(closestSheetSnap(sizes.compact+1,sizes),'compact');assert.equal(closestSheetSnap(999,sizes),'expanded');assert.equal(closestSheetSnap(sizes.compact,sizes),'compact');});

test('photo fills the lowered panel space, shrinks to compact and never shrinks above it',()=>{
 for(const height of [390,568,667,844,932]){
  const footer=60,sizes=sheetSizes(height,footer),full=photoStageHeight(height,footer,sizes,sizes.collapsed),compact=photoStageHeight(height,footer,sizes,sizes.compact);
  assert(full>=compact);assert.equal(compact,Math.min(height-58-footer,Math.max(96,height-58-footer-sizes.compact+92)));
  assert.equal(photoStageHeight(height,footer,sizes,sizes.expanded),compact);
  assert.equal(photoStageHeight(height,footer,sizes,sizes.expanded+100),compact);
  let previous=full;for(let y=sizes.collapsed;y<=sizes.expanded;y++){const current=photoStageHeight(height,footer,sizes,y);assert(current<=previous+1e-8);assert(current>=compact);previous=current;}
 }
 const sizes=sheetSizes(844,60);assert(photoStageHeight(844,60,sizes,sizes.collapsed)>photoStageHeight(844,60,sizes,sizes.compact));
});
