# Quick Fix: Vercel Timeout Problem

## 🚀 Sofortige Lösung

### Schritt 1: Deployment mit neuer Konfiguration

Die `vercel.json` wurde bereits aktualisiert. Jetzt deployen:

```powershell
# Im Projekt-Ordner
cd S:\Coding\Telegram-bot

# Deployment starten
vercel --prod
```

### Schritt 2: Vercel Dashboard Prüfung

1. Gehe zu [Vercel Dashboard](https://vercel.com/dashboard)
2. Wähle dein Projekt: `telegram-bot-indol-delta`
3. Gehe zu **Settings** → **Functions**
4. Prüfe: **Max Duration** sollte **300 seconds** sein

### Schritt 3: Testen

```powershell
# Sync starten
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync" -Method Post

# Status prüfen (während es läuft)
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/status" | ConvertFrom-Json
```

## ⚠️ Wichtig: Pro Plan erforderlich

**Die maxDuration von 300s funktioniert nur mit Vercel Pro Plan!**

### Ohne Pro Plan?

**Option A: Upgrade zu Pro ($20/Monat)**
- Beste Lösung
- 300s max Duration
- Andere Pro Features

**Option B: Optimiere für 60s (Free/Hobby Plan)**

1. **Reduziere Batch-Größe:**
```typescript
// In lib/sync.ts Zeile ~450
const CONCURRENT = 5; // Mehr parallel = schneller
```

2. **Schnelleres Rate-Limit:**
```env
# In .env
RATE_LIMIT_DELAY=1000  # 1 Sekunde statt 2
```

3. **Limitiere Dateien pro Sync:**
```typescript
// In processFolderParallel, nach Zeile 277
const MAX_FILES_PER_FOLDER = 20;
const mediaFilesToProcess = mediaFiles.slice(0, MAX_FILES_PER_FOLDER);
```

## 📊 Zeitmessung

### Berechne benötigte Zeit

```
Zeit = (Total Dateien / CONCURRENT) × RATE_LIMIT_DELAY + Overhead

Beispiele:

60 Dateien, CONCURRENT=3, DELAY=2000ms:
= (60 / 3) × 2s + 20s
= 20 × 2s + 20s
= 60 Sekunden ✅ OK ohne Pro

120 Dateien, CONCURRENT=3, DELAY=2000ms:
= (120 / 3) × 2s + 20s
= 40 × 2s + 20s
= 100 Sekunden ⚠️ Braucht Pro

180 Dateien, CONCURRENT=3, DELAY=2000ms:
= (180 / 3) × 2s + 20s
= 60 × 2s + 20s
= 140 Sekunden ⚠️ Braucht Pro

300 Dateien, CONCURRENT=3, DELAY=2000ms:
= (300 / 3) × 2s + 20s
= 100 × 2s + 20s
= 220 Sekunden ⚠️ Braucht Pro + 300s Config
```

### Optimiert für 60s (ohne Pro)

```
60s Budget:

CONCURRENT=5, DELAY=1500ms:
Max Dateien = (60s - 20s) / 1.5s × 5
= 40s / 1.5s × 5
≈ 130 Dateien in 60 Sekunden
```

## 🎯 Empfohlene Konfigurationen

### Mit Pro Plan (300s) - Empfohlen ✅

```typescript
// lib/sync.ts
const CONCURRENT = 3;
const RATE_LIMIT_DELAY = 2000;

// Kapazität: ~200 Dateien
```

### Ohne Pro Plan (60s) - Kompromiss ⚠️

```typescript
// lib/sync.ts
const CONCURRENT = 5;
const RATE_LIMIT_DELAY = 1000;

// Kapazität: ~100 Dateien
// Risiko: Höhere Chance auf Rate Limits
```

### Enterprise Plan (900s) - Maximum 💎

```typescript
// lib/sync.ts
const CONCURRENT = 3;
const RATE_LIMIT_DELAY = 2000;

// vercel.json
"maxDuration": 900

// Kapazität: ~600 Dateien
```

## 🔧 Nach Deployment

### Prüfe Logs

```powershell
vercel logs --follow
```

Achte auf:
- ✅ `Duration: XXXXms` - Sollte < 300000ms sein
- ❌ `Function invocation timed out` - Immer noch zu lange!
- ✅ `✨ Synchronisierung abgeschlossen` - Erfolgreich

### Bei weiterhin Timeouts

1. **Prüfe ob Pro Plan aktiv ist:**
   - Vercel Dashboard → Billing
   - Subscription Status

2. **Prüfe vercel.json Deployment:**
   ```powershell
   vercel inspect <deployment-url>
   ```

3. **Erhöhe CONCURRENT weiter:**
   ```typescript
   const CONCURRENT = 6; // Mehr Risiko, aber schneller
   ```

4. **Reduziere Dateien pro Run:**
   Implementiere Chunking (siehe VERCEL_TIMEOUT.md)

## 📱 Support

### Vercel Support kontaktieren

Falls maxDuration nicht wirkt:

1. Gehe zu [Vercel Support](https://vercel.com/support)
2. Ticket erstellen: "maxDuration not applied"
3. Erwähne: Project, Deployment URL, vercel.json

### Community

- [Vercel Discord](https://vercel.com/discord)
- [Vercel Discussions](https://github.com/vercel/vercel/discussions)

---

**Next Steps:**
1. ✅ `vercel --prod` ausführen
2. ✅ Dashboard prüfen (300s?)
3. ✅ Sync testen
4. ✅ Logs prüfen

**Datum:** 13. Oktober 2025
