import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const port=Number(process.env.PORT||5173);
const host=process.env.FILM_LAB_HOST||'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.jpg':'image/jpeg','.png':'image/png','.json':'application/json','.map':'application/json','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  let filename;
  try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));}catch{res.writeHead(400);res.end('Invalid URL');return;}
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  try{const info=await stat(filename);if(!info.isFile())throw new Error('Not a file');res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'});if(req.method==='HEAD'){res.end();return;}const stream=createReadStream(filename);stream.on('error',()=>res.destroy());stream.pipe(res);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,host,()=>console.log(`Film Lab: http://${host}:${port}`));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
