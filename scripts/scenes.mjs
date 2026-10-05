// Sayfa → formasyon (parçacık şekli) eşlemesi.
//
// Her sayfa iki yerde parçacık şekli gösterir: koyu kahramanda 3B «dünya» (scene) ve beyaz sayfadaki «Şekil» kutularında mürekkeple (fig).
// Şekil kutusu yazının arkasına değil, kendi yerine çizilir (yan sütunda menünün altında, dizinlerde önizleme sütununda, bölüm yanında).
// Şekiller sitenin kendi içeriğinden türer — hizmetin adı, kapsamı ve sözcükleri (mutabakat, KDV zinciri, mühür…), sektörün muhasebe konusu,
// sayfanın işlevi (takvim, arşiv, sözlük…). İlgisiz endüstri simgesi kullanılmaz; yeni eşleme eklerken «bu şekil bu sayfanın metninde geçen
// bir şeyi mi anlatıyor?» diye bakılır. Ayrıntı ve şekil listesi: docs/FORMASYONLAR.md
//
// Kimlikler src/assets/js/world/formations.js › FORMATIONS'tandır. Sıra numarası kalıcıdır ama eşleme kimlikle yazılır; bilinmeyen kimlik
// derlemeyi durdurur (sessizce boş sayfa üretmez). Wagtail karşılığı: Page.scene / Page.fig (formasyon seçici; kimliğe göre).
import { SCENE, FIGURES } from '../src/assets/js/world/formations.js';

/** Kimlik (ya da geçerli sıra numarası) → sıra numarası. null/undefined → null. */
export function sceneOf(id) {
  if (id === null || id === undefined) return null;
  if (typeof id === 'number') {
    if (!Number.isInteger(id) || id < 0 || id >= FIGURES.length) throw new RangeError(`Geçersiz sahne numarası: ${id}`);
    return id;
  }
  if (!Object.prototype.hasOwnProperty.call(SCENE, id)) throw new RangeError(`Bilinmeyen formasyon kimliği: «${id}» (formations.js › FORMATIONS)`);
  return SCENE[id];
}

/** Şeklin ekranda gösterilen kısa açıklaması. */
export const figureOf = (id) => FIGURES[sceneOf(id)] || '';

/** Kimlik listesi → doğrulanmış, boşlukla ayrılmış dize (data-fig özniteliği). Boş/yoksa null. */
export function figOf(list) {
  if (list === null || list === undefined) return null;
  const arr = (Array.isArray(list) ? list : String(list).split(/[\s,]+/)).filter((x) => x !== '' && x !== null && x !== undefined);
  if (!arr.length) return null;
  return arr
    .map((x) => {
      sceneOf(x); // geçersiz kimlik/numara → hata
      return x;
    })
    .join(' ');
}

// ——— Hizmet alanları (ana sayfadaki alan şekilleri; kimlikleri kalıcı) ————————————————————————————
export const AREA_SHAPE = {
  vergi: 'defter', // üst üste defter yaprakları — kayıt ve beyan düzeni
  denetim: 'ornekleme', // örnekleme kafesi — kanıt ve seçilen örnekler
  danismanlik: 'agac', // yapı ağacı — karar ve organizasyon yapısı
  insan: 'halka', // on iki aylık bordro halkası
  sistem: 'katman', // veri katmanları
  akademi: 'sutunlar', // sütunlar — bilgi ve öğrenme
};

// ——— 47 hizmet: şekil, hizmetin kendi kapsamından (content.json › services: başlık, kapsam, çıktı) ———————————
export const SERVICE_SHAPE = {
  // Vergi ve Mali Müşavirlik
  'mali-musavirlik-ve-muhasebe': 'defter', // kayıt düzeni, dönem kontrolü, beyan hazırlığı
  'diger-dolayli-vergiler': 'kdv-zinciri', // işlemin vergi boyutu zincir boyunca yüklenir
  'bireysel-danismanlik-hizmetleri': 'dilimler', // gelir vergisi: kademeli tarife
  'ar-ge-hizmetleri': 'akis', // faaliyet ayrımı → kapsam kontrolü → dokümantasyon
  'tam-tasdik-islemleri': 'muhur', // tasdik raporu
  'kdv-iade-islemleri': 'kdv-zinciri', // yüklenilen ve hesaplanan KDV
  'kurumlar-vergisi-denetim-ve-tasdik': 'bilanco', // finansal sonuçtan vergi matrahına köprü
  'transfer-fiyatlandirma': 'pay', // ilişkili taraflar: ortaklık ve kontrol bağı
  'cari-hesap-mutabakatlarinin-yapilmasi': 'mutabakat', // alacak/borç kayıtlarının eşleşmesi
  'otv-hizmetleri': 'dilimler', // ürün ve matrah kademelerine göre oran
  // Denetim ve Raporlama
  'bagimsiz-denetim': 'terazi', // bağımsızlık ve denge
  'kurumsal-raporlama': 'rasyo', // finansal sonuçların arkasındaki göstergeler
  'ufrs-tfrs-raporlama': 'bilanco', // tablo ve dipnot
  'finansal-tablo-denetimi': 'ornekleme', // kanıt odaklı inceleme
  'mali-tablolarin-denetimi': 'mutabakat', // kayıtların tablolara doğru yansıması
  'usulsuzluk-ve-hile-denetimi': 'hile', // baskı, fırsat, gerekçelendirme
  'ic-denetim-ve-ic-kontrol': 'savunma', // üç savunma hattı
  'suistimal-inceleme-ve-onleme': 'akis', // önleyici kontrol noktaları
  // Kurumsal Danışmanlık
  'sirket-degerlemesi': 'nakit', // geleceğe ilişkin nakit akışı varsayımları
  'sirket-kurulus-danismanligi': 'pay', // şirket yapısı: sermaye ve ortaklık
  'ticaret-sicil-islemleri': 'muhur', // tescil, onaylı belge
  raporlama: 'kup', // ihtiyaç haritası, veri düzeni: boyutlara göre veri
  'yonetim-danismanligi': 'agac', // planlama, organizasyon, kontrol
  'mali-danismanlik': 'bilanco', // işletmenin mali yapısı
  // İnsan Kaynakları ve Bordro
  'insan-kaynaklari-ve-bordro': 'halka', // on iki aylık bordro döngüsü
  'sgk-dosya-acilisi': 'akis', // ilk adım: kayıt ve bildirim hazırlığı
  'ev-hizmetlisi-sgk-dosya-acilisi': 'takvim', // çalışma düzenine göre aylara yayılan gün
  bordrolama: 'abakus', // kalem kalem, kontrollü hesaplama
  'istihdam-tesvik': 'ornekleme', // koşulu sağlayan çalışan/dönem seçimi
  'sgk-protokolu': 'mutabakat', // ödeme ve mahsup eşleşmesi
  'asgari-iscilik-ve-ilisiksizlik-belgesi': 'hakedis', // proje ve taahhüt işleri
  'borclanma-islemleri': 'sure', // sigortalılık geçmişindeki dönemler
  'emeklilik-danismanligi': 'sure', // sigorta başlangıcı ve hizmet süreleri
  'insan-kiymetleri-surec-yonetimi': 'agac', // açık sorumluluklar
  'yabanci-uyruklu-ikamet-izini': 'basvuru', // başvuru ve takip adımları
  'calisma-izni-alma-ve-iptali': 'basvuru', // başvuru, uzatma, sona erme
  'yurtdisina-isci-gonderimi': 'sube', // merkezden çok noktaya görevlendirme
  'isveren-denetimi-ve-raporlamasi': 'kup', // belge × yükümlülük × risk
  'sgk-dosya-kapanisi': 'mutabakat', // kayıtlar ve son bildirimlerin birlikte kontrolü
  // Sistemler ve İş Zekâsı
  'muhasebe-sistemleri': 'katman', // kayıt düzenini taşıyan altyapı katmanları
  'veri-analiz-sistemleri': 'kup', // veri haritası ve analiz düzeni
  'cozum-prosedurleri': 'akis', // iş akışı, sorumluluk, uygulama
  // Boraden Akademi
  'muhasebe-ve-vergi': 'defter', // kayıt ve belge düzeni
  ufrs: 'bilanco', // finansal tablo seti ve dipnot
  'finansal-analiz': 'rasyo', // oran ve eğilim analizi
  'ic-denetim': 'savunma', // risk, saha çalışması, bulgu raporlama
  'insan-kiymetleri-egitimi': 'halka', // özlük, ücret ve bordro düzeni
};

// ——— 10 sektör + müşteri segmenti (sectors.json): şekil, sektörün kendi muhasebe/denetim konusundan ———————————
export const SECTOR_SHAPE = {
  'finansal-hizmetler': 'kayip', // beklenen kredi zararı ve kuyruk riski
  'uretim-ve-sanayi': 'maliyet', // hammadde, işçilik, genel üretim gideri
  'enerji-ve-dogal-kaynaklar': 'varlik', // aktifleştirme, amortisman, değer düşüklüğü
  'perakende-tuketici-ve-gida': 'sube', // çok noktalı satışın merkez kayda bağlanması
  'teknoloji-medya-ve-telekom': 'edim', // sözleşmenin zamana yayılan gelir dilimleri
  'saglik-ve-ilac': 'alacak', // hasta, özel sigorta ve kurum alacakları
  'insaat-gayrimenkul-ve-altyapi': 'hakedis', // yıllara yaygın iş, hakediş
  'turizm-ulastirma-ve-lojistik': 'sezon', // sezonluk gelir, sabit gider
  'aile-sirketleri-ve-kobiler': 'uc-halka', // aile, mülkiyet, işletme
  'kamu-ve-sivil-toplum': 'savunma', // yönetim, risk ve uyum, iç denetim
};

// ——— Hesaplayıcılar (calculators-*.json): şekil, hesabın kendi mantığından ——————————————————————————————
export const CALC_SHAPE = {
  'maas-hesaplama': 'abakus', // brüt → net: kalem kalem kesinti
  'isveren-maliyeti-hesaplama': 'nakit', // brüt ücret + işveren payları = toplam maliyet
  'asgari-ucret-hesaplama': 'halka', // yıllık parametre, aylık ücret
  'gelir-vergisi-hesaplama': 'dilimler', // kademeli tarife
  'kidem-tazminati-hesaplama': 'sure', // hizmet süresi
  'ihbar-tazminati-hesaplama': 'sure', // ihbar süresi
  'kdv-hesaplama': 'kdv-zinciri',
  'kurumlar-vergisi-hesaplama': 'bilanco', // mali kârdan matraha
  'gecici-vergi-hesaplama': 'takvim', // üç aylık dönemler
  'serbest-meslek-makbuzu-hesaplama': 'abakus', // brüt, stopaj, KDV, net
  'gecikme-zammi-hesaplama': 'sure', // gecikilen süre
};
export const CALC_GROUP_SHAPE = { bordro: 'halka', vergi: 'dilimler', tazminat: 'sure' };

// ——— Sık sorulan sorular (faq.json › grup kimliği): her başlığın şekli, başlığın konusundan ————————————————————
export const FAQ_SHAPE = {
  'calisma-bicimi': 'akis', // çalışma adımları
  'ucret-ve-kapsam': 'dilimler', // kapsama göre kademelenen ücret
  'gizlilik-ve-bagimsizlik': 'gizlilik', // veri koruma, bağımsızlık
  'hesaplayicilar-ve-bilgi-merkezi': 'abakus', // hesaplayıcılar
  iletisim: 'yonlendirme', // mesajın ilgili alana ulaşması
};

// ——— Hakkımızda bölümleri (aboutpage.json › sections[].id) —————————————————————————————————————————
export const ABOUT_SHAPE = {
  'kapsam-anlayisi': 'petek', // altı alan, kırk yedi başlık
  'bagimsizlik-ve-tarafsizlik': 'yazit', // taşa kazınmış ilke
  'gizlilik-ve-veri-guvenligi': 'gizlilik',
  'bilgi-paylasimi-ve-egitim': 'kitap',
  'calisma-bicimi': 'ag', // uzmanlıkların birlikte çalışması
};

// ——— Sayfa türleri: kahraman sahnesi (scene) + şekil kutularının varsayılan dizisi (fig) ———————————————————————
// Bölüm işaretleri ([data-fig-at]) ve üzerine gelme şekilleri ([data-fig-hover]) şablonlarda; burada yalnızca sayfanın açılış şekli yer alır.
const one = (id, ...rest) => ({ scene: id, fig: [id, ...rest] });
export const PAGE = {
  services: one('petek'), // 6 alan × 47 başlık — alan bölümlerinde her alanın şekline döner
  sectors: one('matris'), // sektör × hizmet alanı dağılımı — sektör satırlarında her sektörün şekline döner
  about: one('yazit'), // Orhun Abideleri tarzında dikili taş/yazıt; bölümlerde alan ve ekip şekilleri
  team: one('ag'), // kişiler ve çalıştıkları alanlar
  person: one('ag'),
  careers: one('basvuru'), // başvuru yolu
  contact: one('yonlendirme'), // mesajın konuya göre ilgili alana ulaşması
  hub: one('yayin'), // sirküler, duyuru, blog, haber
  circulars: one('arsiv'), // yıllara göre sirküler dosyaları
  pubs: one('yayin'),
  article: one('yayin'),
  reports: one('kup'), // sektör istatistikleri: boyutlara göre dilimlenen veri
  notes: one('kitap'), // okuma notları
  note: one('kitap'),
  glossary: one('sozluk'), // birbirine bağlı terimler
  faq: one('soru'), // başlıklara göre sorular ve yanıtlar
  legal: one('gizlilik'), // kişisel verinin korunması
  search: one('arama'),
  sitemap: one('petek'),
  calculators: one('abakus'),
  calendar: one('takvim'),
};

/** Hizmetin şekli (tanımsızsa derleme hatası: yeni hizmet eklenince eşleme de eklenmeli). */
export function shapeOfService(id, groupId) {
  const s = SERVICE_SHAPE[id];
  if (!s) throw new Error(`scenes.mjs › SERVICE_SHAPE: «${id}» hizmeti için şekil tanımlı değil (alan: ${groupId || '?'})`);
  sceneOf(s);
  return s;
}
export function shapeOfSector(slug) {
  const s = SECTOR_SHAPE[slug];
  if (!s) throw new Error(`scenes.mjs › SECTOR_SHAPE: «${slug}» sektörü için şekil tanımlı değil`);
  sceneOf(s);
  return s;
}
export function shapeOfCalc(slug, group) {
  const s = CALC_SHAPE[slug] || CALC_GROUP_SHAPE[group];
  if (!s) throw new Error(`scenes.mjs › CALC_SHAPE: «${slug}» hesaplayıcısı için şekil tanımlı değil`);
  sceneOf(s);
  return s;
}
export function shapeOfArea(id) {
  const s = AREA_SHAPE[id];
  if (!s) throw new Error(`scenes.mjs › AREA_SHAPE: «${id}» alanı için şekil tanımlı değil`);
  sceneOf(s);
  return s;
}
