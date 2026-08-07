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
- LocalStorage (seri, rozet, görev, geçmiş, arkadaş kodları)
- PWA (service worker + ana ekrana ekle + yerel bildirimler)
- Neon Postgres + Netlify Functions (`/api/sync`) — arkadaş / günlük skor sync
- Günlük challenge (paylaşılan seed RNG) · cihaz eğimi (DeviceOrientation)
- Ek araçlar: Uçurtma, UFO (blöf LED + faz kalkanı), Kağıt Uçak
- Kör Uçuş modu (katman 3+ görüş kaybı)
- Phantom cüzdan bağlantısı (Profil → bağla / mesaj imzala)
- WalletConnect (QR / mobil) — `VITE_WALLETCONNECT_PROJECT_ID`
- Multi-asset play wallet (USDT/USDC/SOL/ETH/BTC) · demo yükle/çek
- On-chain SOL deposit (Phantom → treasury) — `VITE_SOLANA_TREASURY`
- Çekim kuyruğu (%2 ücret, iptal = iade)
- Auto cash-out · günlük check-in · davet ödülleri

### Phantom

Extension (`injected`) App ID olmadan çalışır. Google/Apple için Portal’dan App ID alıp Netlify / `.env`’e `VITE_PHANTOM_APP_ID` ekleyin; redirect URL’i allowlist’e alın (`https://chaindrone.netlify.app/`).

On-chain SOL yükleme için Netlify env:

```
VITE_SOLANA_CLUSTER=devnet
VITE_SOLANA_TREASURY=<treasury-public-key>
```

Docs: https://docs.phantom.com/sdks/react-sdk/sign-and-send-transaction

Claimable Postgres (süreli). Kalıcı yapmak için claim edin ve `DATABASE_URL`’i Netlify env’e taşıyın:

https://neon.new/claim/019fd967-b410-769a-9dc7-562b5815504e

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

