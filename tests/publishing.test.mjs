import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import nunjucks from 'nunjucks';
import {loadData,ROOT,sitemapXML,templateGlobals} from '../scripts/build.mjs';
import {buildModel} from '../scripts/model.mjs';
import {buildRoutes} from '../scripts/routes.mjs';
import {makeFilters} from '../scripts/filters.mjs';

test('shared head identifies the canonical page and unchanged approved logo at its real dimensions',()=>{
  const data=loadData(),model=buildModel(data);
  const env=new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(ROOT,'src/templates')),{autoescape:true});
  for(const [name,fn] of Object.entries(makeFilters()))env.addFilter(name,fn);
  for(const [name,value] of Object.entries(templateGlobals(data,model)))env.addGlobal(name,value);
  const canonical=data.site.url+'/iletisim/';
  const html=env.render('layouts/base.njk',{page:{canonical,url:'/iletisim/',crumbs:[],titleFull:'İletişim',description:'Fixture'}});
  assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
  assert.ok(html.includes(`<meta property="og:image" content="${data.site.url}${data.site.shareImage.path}">`));
  assert.match(html,/<meta property="og:image:alt" content="Boraden">/);
  assert.match(html,/<meta property="og:image:width" content="211">/);
  assert.match(html,/<meta property="og:image:height" content="48">/);
  assert.match(html,/<meta property="og:type" content="website">/);
  assert.match(html,/<meta name="twitter:card" content="summary">/,'211 px genişlikteki logo için geniş kart değil');
  assert.doesNotMatch(html,/article:published_time/);
  const art=env.render('layouts/base.njk',{page:{canonical,url:'/x/',crumbs:[],titleFull:'Yazı',description:'Fixture',ogType:'article',published:'2026-09-06'}});
  assert.match(art,/<meta property="og:type" content="article">/);
  assert.match(art,/<meta property="article:published_time" content="2026-09-06">/);
});

test('sitemap serializes only public pages; lastmod only from a content date, never the build day',()=>{
  const routes=[{url:'/'},{url:'/bilgi-merkezi/'},{url:'/taslak/',noindex:true,lastmod:'2026-01-01'},{url:'/arama#sozluk',searchOnly:true},{url:'/not/',lastmod:'2026-09-06'},{url:'/bozuk/',lastmod:'Eylül 2026'}];
  const xml=sitemapXML(routes,'https://www.boraden.com.tr');
  assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]),['https://www.boraden.com.tr/','https://www.boraden.com.tr/bilgi-merkezi/','https://www.boraden.com.tr/not/','https://www.boraden.com.tr/bozuk/']);
  assert.deepEqual([...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(m=>m[1]),['2026-09-06'],'yalnızca geçerli içerik tarihi; tarihsiz ya da biçimsiz değer yazılmaz');
  const data=loadData();
  const all=buildRoutes(data,buildModel(data));
  const actual=sitemapXML(all,data.site.url);
  const today=new Date().toISOString().slice(0,10);
  const dated=new Map(all.filter(r=>r.lastmod&&!r.noindex&&!r.searchOnly).map(r=>[data.site.url.replace(/\/$/,'')+r.url,r.lastmod]));
  const got=[...actual.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
  assert.equal(got.length,dated.size);
  for(const [,loc,lm] of got){
    assert.equal(lm,dated.get(loc),`${loc}: lastmod rotadaki içerik tarihiyle aynı olmalı`);
    assert.match(lm,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(lm<=today,`${loc}: gelecek tarihli lastmod`);
  }
  assert.doesNotMatch(actual,new RegExp(`<loc>${data.site.url}/</loc><lastmod>`),'ana sayfanın içerik tarihi yok');
});
