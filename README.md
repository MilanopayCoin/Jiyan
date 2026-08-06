# Zincir: Drone

Mobil-first AR risk-ödül yükseliş oyunu (push-your-luck arcade).

Kameranı aç → drone yükselsin → çarpan artsın → **İNDİR** ile kilitle veya sinyal kaybında her şeyi kaybet.

## Çalıştırma

```bash
npm install
npm run dev
```

Arka kamera izni ister (`facingMode: environment`). İzin yoksa gökyüzü fallback kullanılır.

## Netlify

`netlify.toml` ayarları:
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- Site `main` branch'inden yayınlanmalı

Canlı: https://chaindrone.netlify.app

## Stack

- React + TypeScript + Vite
- Three.js (geometrik drone + pervane animasyonu)
- Tailwind CSS v4
- Framer Motion
- LocalStorage (seri, rozet, görev, geçmiş)

## Oyun döngüsü

1. **KALKIŞ** — drone katman 1'e yükselir
2. Her katmanda **YÜKSEL** veya **İNDİR**
3. Düşme olasılığı katmanla artar; LED yeşil → sarı → kırmızı
4. Düşüşte near-miss mesajı; inişte kazanç kilitlenir

## Ayrı oyun: Messi vs Ronaldo Top Sektirme

VR modları Zincir’den kaldırıldı; top sektirme ayrı uygulamada:

```bash
cd messi-ronaldo
npm install
npm run dev
```

