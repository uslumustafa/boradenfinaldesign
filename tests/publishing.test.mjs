import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import nunjucks from 'nunjucks';
import {loadData,ROOT,sitemapXML} from '../scripts/build.mjs';
import {buildModel} from '../scripts/model.mjs';
import {buildRoutes} from '../scripts/routes.mjs';
import {makeFilters} from '../scripts/filters.mjs';

test('shared head identifies the canonical page and unchanged approved logo at its real dimensions',()=>{
  const data=loadData(),model=buildModel(data);
  const env=new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(ROOT,'src/templates')),{autoescape:true});
  for(const [name,fn] of Object.entries(makeFilters()))env.addFilter(name,fn);
  for(const [name,value] of Object.entries({data,site:data.site,model,groups:model.groups,services:model.services,contact:model.contact,share_image:{...data.site.shareImage,url:new URL(data.site.shareImage.path,data.site.url).href}}))env.addGlobal(name,value);
  const canonical=data.site.url+'/iletisim/';
  const html=env.render('layouts/base.njk',{page:{canonical,url:'/iletisim/',crumbs:[],titleFull:'İletişim',description:'Fixture'}});
  assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
  assert.ok(html.includes(`<meta property="og:image" content="${data.site.url}${data.site.shareImage.path}">`));
  assert.match(html,/<meta property="og:image:alt" content="Boraden">/);
  assert.match(html,/<meta property="og:image:width" content="211">/);
  assert.match(html,/<meta property="og:image:height" content="48">/);
});

test('sitemap serializes only public pages and omits lastmod without trusted revision data',()=>{
  const routes=[{url:'/'},{url:'/bilgi-merkezi/'},{url:'/taslak/',noindex:true},{url:'/arama#sozluk',searchOnly:true}];
  const xml=sitemapXML(routes,'https://www.boraden.com.tr');
  assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]),['https://www.boraden.com.tr/','https://www.boraden.com.tr/bilgi-merkezi/']);
  assert.doesNotMatch(xml,/<lastmod>/);
  const data=loadData();
  const actual=sitemapXML(buildRoutes(data,buildModel(data)),data.site.url);
  assert.doesNotMatch(actual,/<lastmod>/);
});
