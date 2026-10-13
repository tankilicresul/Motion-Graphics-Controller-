# 🎬 ATLAS Motion Graphics Controller & Studio

> **Yapay Zeka Destekli, Gerçek Zamanlı Parametrik Motion Grafik Stüdyosu**  
> Sıfırdan render beklemeden renk, hız, font, yay fiziği ve metinleri anlık değiştirin; Claude Pro / MCP köprüsü ile tek tıkla profesyonel animasyonlar üretin ve 1080p MP4 olarak indirin.

---

## ✨ Özellikler

* **⚡ Sıfır Render Bekleme Süresi:** Parametrik sahne motoru sayesinde renk, yay sertliği, metin veya hız değiştiğinde tüm videoyu baştan render etmez, anında tuvalde günceller.
* **📐 Çoklu En-Boy Oranı Desteği:**
  * `16:9` Yatay (1920×1080) — YouTube, TV ve Sinematik vitrinler.
  * `9:16` Dikey Reels / TikTok / Shorts (1080×1920) — Akıllı responsive sığdırma ve güvenli kenar boşluğu.
  * `1:1` Kare (1080×1080) — Instagram gönderi formatı.
* **📹 Gerçek Video Üstü Motion (Overlay & Sync):**
  * Kendi insan veya ürün videonuzu yükleyin; motion grafikler şeffaf katman olarak üzerine binsin.
  * **Video Başlangıç Ofseti:** Videonun istediğiniz saniyesinden başlamasını sağlayın.
  * **Zaman Çizgisini Eşitle:** Proje süresini videonuzun uzunluğuna tek tıkla sabitleyin.
* **⏱️ Sahne Zaman Çizelgesi & Kırpıcı (Scene Trimmer):**
  * Sahne başlangıç ve bitiş saniyelerini sayısal olarak milisaniyesine kadar ayarlayın.
* **🔊 AI Destekli SFX (Ses Efekti Motoru):**
  * WebAudio tabanlı sentezleyici: *Impact, Whoosh, Riser, Pop, Glitch, Shimmer*.
  * Sahnelerin ritmine göre yapay zeka otomatik ses atar.
  * 1080p MP4 render alırken ses kanalı videoya gömülü (muxed) olarak dışa aktarılır.
* **🤖 Claude Pro & MCP Entegrasyonu:**
  * Claude Pro sohbette ürettiğiniz tasarımları tek tıkla panodan içeri aktarma (Zero-Paste Bridge).
  * Claude MCP Server desteği (`atlas-mcp.js`) ile AI sohbetten doğrudan sahneye canlı yama atabilir.
* **🖥️ 4 Panelli Modern Arayüz:**
  * Canlı yay eğrisi (Spring Curve) grafiği.
  * Boyutlandırılabilir bölmeler ve modern beyaz/turuncu/mavi/yeşil renk paleti.

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimler
* [Node.js](https://nodejs.org/) (v18 veya üzeri)

### 2. Kurulum
```bash
git clone https://github.com/tankilicresul/Motion-Graphics-Controller-.git
cd Motion-Graphics-Controller-
npm install
```

### 3. Başlatma
```bash
node server.js
```
Tarayıcınızda açın:
👉 **http://localhost:3456**

---

## 🛠️ Mimari & Dosya Yapısı

```
motion-studio/
├── public/
│   └── index.html         # Stüdyo UI, WebAudio SFX motoru ve HTML5 Canvas sahne çalışma zamanı
├── server.js              # Express/HTTP sunucusu, FFmpeg MP4 render motoru ve AI API köprüsü
├── atlas-mcp.js           # Model Context Protocol (MCP) Claude entegrasyon aracı
├── exports/               # Render edilen MP4 ve WAV dosyaları
├── package.json
└── README.md
```

---

## 📄 Lisans
MIT License — Dilediğiniz gibi geliştirebilir ve kullanabilirsiniz.
