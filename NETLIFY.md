# Netlify deploy checklist (chaindrone.netlify.app)

Paylaştığın log’da şu satırlar vardı — bunlar **yanlış** ayar demek:

- `No config file was defined`
- `Detected 0 framework(s)`
- `Starting to deploy site from '/'`
- Build komutu **hiç çalışmamış**

Doğru log’da şunlar görünmeli:

- `Config file: /opt/build/repo/netlify.toml`
- `npm ci` / `npm run build`
- `publish: dist` (veya `Deploying to Netlify from dist`)

## Netlify UI’da kontrol et

1. **Site configuration → Build & deploy → Continuous Deployment**
   - Repository: `MilanopayCoin/Jiyan`
   - Production branch: `main`
2. **Build settings**
   - **Base directory:** *(boş bırak)*
   - **Build command:** `npm run build` (veya boş — `netlify.toml` kullanır)
   - **Publish directory:** `dist`
3. **Trigger deploy → Clear cache and deploy site**

`netlify.toml` `main` branch kökünde mevcut.
