// Сервер для онлайн-игры: раздаёт игру по ссылке и передаёт данные между игроками.
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000;
let html=null,gz=null;
try{const f=fs.existsSync(path.join(__dirname,'index.html'))?'index.html':fs.readdirSync(__dirname).find(n=>/\.html?$/i.test(n));html=fs.readFileSync(path.join(__dirname,f));gz=zlib.gzipSync(html,{level:6});console.log('Игра: '+f)}catch(e){console.log('HTML-файл игры не найден рядом с server.js')}
const srv=http.createServer((q,r)=>{
  if(q.url==='/health'){r.end('ok');return}
  if(!html){r.writeHead(500);r.end('index.html not found');return}
  const h={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'};
  if(/gzip/.test(q.headers['accept-encoding']||'')){h['Content-Encoding']='gzip';r.writeHead(200,h);r.end(gz)}
  else{r.writeHead(200,h);r.end(html)}
});
const wss=new WebSocketServer({server:srv,path:'/ws',maxPayload:4096});
let nid=1;const C=new Map();
const send=(w,o)=>{if(w.readyState===1)w.send(JSON.stringify(o))};
wss.on('connection',ws=>{
  const id=nid++;ws.id=id;ws.nm='Игрок '+id;C.set(id,ws);
  send(ws,{t:'w',i:id,l:[...C.values()].filter(c=>c!==ws).map(c=>({i:c.id,n:c.nm}))});
  ws.on('message',m=>{
    let o;try{o=JSON.parse(m)}catch(_){return}
    if(o.t==='j'){ws.nm=String(o.n||ws.nm).slice(0,16)}
    else if(o.t==='h'){const to=C.get(+o.to);if(to)send(to,{t:'h',i:id,d:Math.max(0,Math.min(80,+o.d||0))});return}
    else if(o.t!=='s'&&o.t!=='f')return;
    o.i=id;if(o.t==='j')o.n=ws.nm;
    const s=JSON.stringify(o);for(const c of C.values())if(c!==ws&&c.readyState===1)c.send(s);
  });
  ws.on('close',()=>{C.delete(id);const s=JSON.stringify({t:'l',i:id});for(const c of C.values())if(c.readyState===1)c.send(s)});
  ws.on('error',()=>{});
});
setInterval(()=>{for(const c of C.values())if(c.readyState===1)c.ping()},25000);
srv.listen(PORT,()=>console.log('Сервер запущен, порт '+PORT));
