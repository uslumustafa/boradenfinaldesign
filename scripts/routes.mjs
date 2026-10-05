// Sayfa tablosu: her giriş bir URL, bir şablon ve bağlam üretir.
// Wagtail karşılığı: her giriş bir Page modeli / URL deseni olur.
// Alan modülleri scripts/routes/*.mjs içindedir; her biri ortak bağlamı alır:
//   { add, data, model, site, home }
//   add({ url, template, title, titleFull?, description?, scene, fig?, kind, crumbs, bodyClass?, noindex?, searchable?, ctx })
//   scene: kahraman 3B sahnesi — formasyon kimliği ('petek') ya da sıra numarası; fig: beyaz sayfadaki «Şekil» kutularının varsayılan şekil dizisi (kimlik listesi)
//   (sayfa kaydırıldıkça sırayla dönüşür; bölüm işaretleri şablondadır). Şekil adları ve eşleme: scripts/scenes.mjs
//   add({ url, title, description, kind, searchOnly: true })  → yalnızca arama dizinine girer, sayfa üretilmez
import { slugify } from './filters.mjs';
import { sceneOf, figOf } from './scenes.mjs';
import { registerCore } from './routes/core.mjs';
import { registerTools } from './routes/tools.mjs';
import { registerSectors } from './routes/sectors.mjs';
import { registerInsights } from './routes/insights.mjs';
import { registerCompany } from './routes/company.mjs';
import { registerTeam } from './routes/team.mjs';
import { registerSupport } from './routes/support.mjs';
import { registerReading } from './routes/reading.mjs';

export function buildRoutes(data, model, { lenient = false, onError = (m) => console.error(m) } = {}) {
  const R = [];
  // scene/fig kimlikleri burada doğrulanır ve sıra numarasına/dizgeye çevrilir (bilinmeyen kimlik = derleme hatası)
  const add = (r) => {
    const n = { searchable: true, scene: null, fig: null, crumbs: [], ...r };
    n.scene = sceneOf(n.scene);
    n.fig = figOf(n.fig);
    R.push(n);
  };
  const ctx = { add, data, model, site: data.site, home: { label: 'Ana sayfa', url: '/' } };
  // lenient (geliştirme): bir alan modülündeki hata diğerlerini düşürmez
  const safe = (name, fn) => {
    try {
      fn(ctx);
    } catch (e) {
      if (!lenient) throw e;
      onError(`[rotalar] ${name} HATA: ${e && e.message ? e.message : e}`);
    }
  };
  safe('core', registerCore);
  safe('tools', registerTools);
  safe('sectors', registerSectors);
  safe('insights', registerInsights);
  safe('company', registerCompany);
  safe('team', registerTeam);
  safe('support', registerSupport);
  safe('reading', registerReading);

  // aynı adres iki kez tanımlanmasın
  const seen = new Set();
  const out = [];
  for (const r of R) {
    const key = (r.searchOnly ? 'search:' : '') + r.url;
    if (seen.has(key)) {
      if (!lenient) throw new Error(`Yinelenen rota: ${r.url}`);
      onError(`[rotalar] Yinelenen rota atlandı: ${r.url}`);
      continue;
    }
    seen.add(key);
    out.push(r);
  }
  return out;
}

export { slugify };
