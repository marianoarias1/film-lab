import {applyPixels} from './engine.js';
self.onmessage=({data:m})=>{try{const out=applyPixels(new Uint8ClampedArray(m.pixels),m.width,m.height,m.settings,m.geometry);self.postMessage({id:m.id,pixels:out.buffer},[out.buffer]);}catch(e){self.postMessage({id:m.id,error:e.message});}};
