// Publication dates follow editorial verification in model, related cards, templates and schema.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import nunjucks from 'nunjucks';
import {loadData,ROOT} from '../scripts/build.mjs';
import {buildModel} from '../scripts/model.mjs';
import {buildRoutes} from '../scripts/routes.mjs';
import {makeFilters} from '../scripts/filters.mjs';

const data=loadData(), model=buildModel(data), routes=buildRoutes(data,model);
const env=new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(ROOT,'src/templates')),{autoescape:true});
for(const [name,fn] of Object.entries(makeFilters()))env.addFilter(name,fn);
for(const [name,value] of Object.entries({data,model,site:data.site,groups:model.groups,services:model.services,contact:model.contact,share_image:{...data.site.shareImage,url:new URL(data.site.shareImage.path,data.site.url).href}}))env.addGlobal(name,value);
const render=r=>env.render(r.template,{page:{...r,titleFull:r.title,canonical:data.site.url+r.url},...r.ctx});

test('unverified dates stay in source but are absent from the public model and article JSON-LD',()=>{
  const pending=model.latest.filter(p=>p.publicationDateVerified===false);
  assert.equal(pending.length,3);
  for(const pub of pending){
    assert.equal(pub.date,null);
    assert.equal(pub.dateStatus,'Tarih teyit bekliyor');
    assert.ok(data.content.publications.blog.find(p=>p.id===pub.id).date,'original editorial date preserved');
    const route=routes.find(r=>r.url===pub.url);
    assert.equal(Object.hasOwn(route.ctx.ld['@graph'][0],'datePublished'),false);
    const sidebar=render(route).match(/<dl class="art__dl">([\s\S]*?)<\/dl>/)[1];
    assert.match(sidebar,/Tarih teyit bekliyor/);
    assert.doesNotMatch(sidebar,/<time|1970/);
  }
  const known=model.latest.find(p=>p.publicationDateVerified!==false&&p.date);
  assert.equal(routes.find(r=>r.url===known.url).ctx.ld['@graph'][0].datePublished,known.date);
  assert.equal(model.latest.slice(-3).every(p=>p.publicationDateVerified===false),true,'unknown chronology comes after dated publications');
});

test('lists, hub preview and related cards render a pending state without time assertions',()=>{
  const list=render(routes.find(r=>r.url==='/bilgi-merkezi/blog/'));
  assert.match(list,/Tarih teyit bekliyor/);
  assert.match(list,/Öne çıkan yazı/);
  const blogItems=list.match(/<ol class="pub-list">([\s\S]*?)<\/ol>/)[1];
  assert.doesNotMatch(blogItems,/<time/);
  const hub=render(routes.find(r=>r.url==='/bilgi-merkezi/'));
  assert.equal((hub.match(/data-date="Tarih teyit bekliyor"/g)||[]).length,3);
  const related=env.renderString('{% import "partials/blocks.njk" as b %}{{ b.related(rel) }}',{rel:{posts:model.publications.blog}});
  // Render the actual shared macro to ensure service cards also consume normalized dates.
  assert.ok(model.services.some(s=>s.related.posts.some(p=>p.dateStatus==='Tarih teyit bekliyor')));
  for(const r of routes.filter(r=>!r.searchOnly))assert.doesNotMatch(render(r),/<time[^>]*datetime="(?:null|undefined|)"/,'no empty datetime: '+r.url);
  assert.match(related,/Tarih teyit bekliyor/);
});

test('date formatters never turn null or empty dates into the Unix epoch',()=>{
  const filters=makeFilters();
  for(const name of ['date_tr','date_short','date_long','day_of','month_short','year_of']){
    assert.equal(filters[name](null),'');
    assert.equal(filters[name](''),'');
  }
});
