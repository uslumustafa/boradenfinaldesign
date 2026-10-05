// Local public-root confinement uses synthetic fixtures only, including symlink/index paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {serve} from '../scripts/serve.mjs';

test('preview serves normal routes/Range but denies traversal and symlinks outside its actual root',async t=>{
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'boraden-serve-'));
  const root=path.join(fixture,'public'),sibling=path.join(fixture,'public-sibling');
  fs.mkdirSync(path.join(root,'guide'),{recursive:true});fs.mkdirSync(sibling);
  fs.mkdirSync(path.join(root,'index-link'));
  fs.writeFileSync(path.join(root,'guide/index.html'),'guide');
  fs.writeFileSync(path.join(root,'404.html'),'missing');
  fs.writeFileSync(path.join(root,'file.pdf'),'0123456789');
  fs.writeFileSync(path.join(sibling,'canary.txt'),'synthetic outside canary');
  fs.symlinkSync(path.join(sibling,'canary.txt'),path.join(root,'outside.txt'));
  fs.symlinkSync(path.join(sibling,'canary.txt'),path.join(root,'guide/outside.html'));
  fs.symlinkSync(path.join(sibling,'canary.txt'),path.join(root,'index-link/index.html'));
  const server=serve({root,port:0,quiet:true});await once(server,'listening');
  t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture,{recursive:true,force:true});});
  const request=(url,headers={})=>new Promise((resolve,reject)=>{
    http.get({host:'127.0.0.1',port:server.address().port,path:url,headers},res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));}).on('error',reject);
  });
  for(const url of ['/%2e%2e%2fpublic-sibling/canary.txt','/%2e%2e%2fpublic-sibling%2fcanary.txt','/outside.txt','/guide/outside.html','/index-link/']){
    const r=await request(url);assert.equal(r.status,403,url);assert.equal(r.body,'403');
  }
  assert.equal((await request('/guide/')).body,'guide');
  assert.equal((await request('/guide?x=1')).headers.location,'/guide/?x=1');
  assert.equal((await request('/unknown/')).status,404);
  const range=await request('/file.pdf',{Range:'bytes=2-5'});
  assert.equal(range.status,206);assert.equal(range.body,'2345');assert.equal(range.headers['content-range'],'bytes 2-5/10');
  fs.unlinkSync(path.join(root,'404.html'));
  fs.symlinkSync(path.join(sibling,'canary.txt'),path.join(root,'404.html'));
  const fallback=await request('/unknown/');
  assert.equal(fallback.status,403);assert.equal(fallback.body,'403');
});
