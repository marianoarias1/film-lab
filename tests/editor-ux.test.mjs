import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recipeDescription,catalogDescriptions} from '../dist/recipe-description.js';
import {viewportState,mountMobileViewport} from '../dist/mobile-viewport.js';

test('old cached catalog recipes receive specific descriptions without changing settings',()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
  const before=structuredClone(catalog);
  for(const recipe of catalog.recipes){
    assert.equal(recipeDescription({...recipe,description:'Look original editable de Film Lab; ajustá sus valores a la luz de tu foto.'}),catalogDescriptions[recipe.id]);
    assert(recipe.description.length<116);assert(!/look original|ajustá sus valores/i.test(recipe.description));
  }
  assert.equal(new Set(Object.values(catalogDescriptions)).size,catalog.recipes.length);
  assert.deepEqual(catalog,before);
});

test('descriptions keep meaningful custom text and a single final period',()=>{
  assert.equal(recipeDescription({description:'Rojos presentes y negros firmes. Texto adicional.'}),'Rojos presentes y negros firmes.');
  assert.equal(recipeDescription({id:'custom',settings:{temperature:20,contrast:24,grain:20}}),'Tonos cálidos, contraste marcado, textura de grano.');
});

test('mobile viewport recovers full height after keyboard dismissal and rotation',()=>{
  assert.deepEqual(viewportState({layoutHeight:844,visualHeight:400,textFocused:true}),{height:400,keyboard:true});
  assert.deepEqual(viewportState({layoutHeight:844,visualHeight:400,textFocused:false}),{height:400,keyboard:false});
  assert.deepEqual(viewportState({layoutHeight:844,visualHeight:844}),{height:844,keyboard:false});
  assert.deepEqual(viewportState({layoutHeight:390,visualHeight:390}),{height:390,keyboard:false});
});

test('viewport falls back without VisualViewport and preserves deliberate pinch zoom',()=>{
  assert.deepEqual(viewportState({layoutHeight:780}),{height:780,keyboard:false});
  assert.equal(viewportState({layoutHeight:844,visualHeight:420,scale:2}),null);
  assert.equal(viewportState({layoutHeight:0}),null);
});

test('Photos scroll is cleared before tools layout changes and restored on return', t=>{
  const priorWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),priorDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  t.mock.method(globalThis,'setTimeout',()=>0);
  const classes=()=>{const values=new Set();return {toggle(key,on){on?values.add(key):values.delete(key);},remove(key){values.delete(key);},contains:key=>values.has(key)};};
  const properties=new Map(),root={scrollTop:0,classList:classes(),style:{getPropertyValue:key=>properties.get(key)||'',setProperty:(key,value)=>properties.set(key,value),removeProperty:key=>properties.delete(key)}};
  const body={scrollTop:0,dataset:{mobilePanel:'photo'},classList:classes()},resets=[];
  let pageY=310;
  const win={innerWidth:390,innerHeight:844,get scrollY(){return pageY;},scrollTo(x,y){resets.push({panel:body.dataset.mobilePanel,y});pageY=y;root.scrollTop=y;},addEventListener(){}};
  const doc={documentElement:root,body,scrollingElement:root,activeElement:{matches:()=>false},getElementById:()=>null,addEventListener(){}};
  Object.defineProperty(globalThis,'window',{value:win,configurable:true});Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
  try {
    const viewport=mountMobileViewport();viewport.beforePanelChange('recipes');
    assert.deepEqual(resets[0],{panel:'photo',y:0});assert.equal(pageY,0);assert(root.classList.contains('mobile-editor-locked'));
    body.dataset.mobilePanel='recipes';viewport.panelChanged();
    viewport.beforePanelChange('adjustments');body.dataset.mobilePanel='adjustments';viewport.panelChanged();assert.equal(pageY,0);
    viewport.beforePanelChange('photo');body.dataset.mobilePanel='photo';viewport.panelChanged();assert.equal(pageY,310);assert(!root.classList.contains('mobile-editor-locked'));
    win.innerWidth=1200;body.dataset.mobilePanel='recipes';viewport.panelChanged();assert(!root.classList.contains('mobile-editor-locked'));
  } finally {
    if(priorWindow)Object.defineProperty(globalThis,'window',priorWindow);else delete globalThis.window;
    if(priorDocument)Object.defineProperty(globalThis,'document',priorDocument);else delete globalThis.document;
  }
});
