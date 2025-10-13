# Vercel Function Timeout - Lösungen

## ⚠️ Problem: "Function Max Duration exceeded"

### Ursache
Vercel Serverless Functions haben ein maximales Timeout:
- **Hobby Plan:** 10 Sekunden
- **Pro Plan:** 60 Sekunden (default)
- **Pro Plan (konfiguriert):** bis 300 Sekunden (5 Minuten)

Bei vielen Dateien kann die Synchronisierung länger dauern.

## ✅ Lösung 1: maxDuration erhöhen (implementiert)

### vercel.json aktualisiert:

```json
{
  "functions": {
    "api/sync.ts": {
      "maxDuration": 300
    },
    "api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

**Bedeutung:**
- `/api/sync` → 300 Sekunden (5 Minuten)
- Alle anderen APIs → 60 Sekunden
- Erfordert **Vercel Pro Plan**!

### Deployment erforderlich

Nach Änderung der `vercel.json`:

```powershell
# Deploye die Änderungen
vercel --prod

# ODER via Git
git add vercel.json
git commit -m "Increase function timeout to 300s"
git push
```

## ✅ Lösung 2: Verarbeitung optimieren

### Aktuelle Konfiguration

```typescript
// In lib/sync.ts
const CONCURRENT = 3;           // 3 Ordner parallel
const RATE_LIMIT_DELAY = 2000; // 2s zwischen Uploads
```

### Zeitberechnung

**Beispiel:** 6 Ordner, je 20 Dateien (120 Dateien total)

```
Pro Ordner: 20 Dateien × 2s = 40 Sekunden
Parallel (3): 2 Batches × ~40s = ~80 Sekunden
Plus Overhead: ~100 Sekunden total
```

**Kritisch wird es ab:**
- 150+ Dateien total
- Große Video-Dateien (Upload dauert länger)
- Langsame OneDrive-Verbindung

### Optimierungen bei Timeout-Problemen

#### Option A: Mehr Parallelität (riskanter)

```typescript
const CONCURRENT = 5; // Mehr Ordner gleichzeitig
const RATE_LIMIT_DELAY = 1500; // Kürzere Pausen
```

⚠️ **Risiko:** Telegram API Rate Limits

#### Option B: Weniger Dateien pro Sync

Implementiere einen "Resume"-Mechanismus:

```typescript
// Maximal 50 Dateien pro Sync
const MAX_FILES_PER_SYNC = 50;
let filesProcessed = 0;

for (const file of mediaFiles) {
  if (filesProcessed >= MAX_FILES_PER_SYNC) {
    console.log(`⏸️ Limit erreicht - stoppe für diesen Sync`);
    break;
  }
  // ... upload logic
  filesProcessed++;
}
```

#### Option C: Streaming Response (fortgeschritten)

Sende Zwischenstatus zurück, damit Vercel weiß dass die Function noch läuft:

```typescript
// In api/sync.ts
res.setHeader('Content-Type', 'text/event-stream');
res.write('data: {"status": "starting"}\n\n');

// Während Sync
res.write(`data: {"progress": ${percent}}\n\n`);

// Am Ende
res.write('data: {"status": "complete"}\n\n');
res.end();
```

## 🎯 Empfohlene Konfiguration

### Für kleine bis mittlere Projekte (<100 Dateien)

```json
// vercel.json
{
  "functions": {
    "api/sync.ts": { "maxDuration": 300 }
  }
}
```

```typescript
// lib/sync.ts
const CONCURRENT = 3;
const RATE_LIMIT_DELAY = 2000;
```

**Kapazität:** ~200 Dateien in 5 Minuten

### Für große Projekte (>100 Dateien)

**Option 1: Pro Plan + längeres Timeout**
```json
{
  "functions": {
    "api/sync.ts": { "maxDuration": 300 }
  }
}
```

**Option 2: Enterprise Plan + maximales Timeout**
```json
{
  "functions": {
    "api/sync.ts": { "maxDuration": 900 }
  }
}
```

**Option 3: Chunked Processing**
- Teile Sync in mehrere kleinere Chunks
- Jeder Chunk läuft separat
- Nutze Cron Jobs für automatische Fortsetzung

## 📊 Monitoring

### Prüfe Function-Dauer

Im Status-Endpoint siehst du die letzte Sync-Dauer:

```powershell
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/status" | ConvertFrom-Json | Select-Object -ExpandProperty currentSync
```

Response:
```json
{
  "duration": 245000,  // Millisekunden = 245s
  "filesPosted": 85,
  "isRunning": false
}
```

### Vercel Logs prüfen

```powershell
vercel logs --follow
```

Suche nach:
- `Duration: XXXXms` - Wie lange dauerte die Function?
- `Timeout` - Wurde Timeout erreicht?

## 🚨 Troubleshooting

### "504 Gateway Timeout"

**Ursache:** Function läuft länger als maxDuration

**Lösungen:**
1. ✅ Erhöhe maxDuration in vercel.json
2. ✅ Reduziere Dateien pro Sync
3. ✅ Erhöhe CONCURRENT
4. ✅ Reduziere RATE_LIMIT_DELAY

### "Function invocation timed out"

**Ursache:** Vercel Plan erlaubt nicht die gewünschte Duration

**Lösungen:**
1. Upgrade zu Pro Plan (60s → 300s)
2. Implementiere Chunked Processing
3. Nutze Background Jobs (externe Service)

### Sync dauert sehr lange

**Analysiere:**
```
Total Zeit = (Dateien / CONCURRENT) × RATE_LIMIT_DELAY + Overhead

Beispiel:
120 Dateien / 3 parallel = 40 Dateien pro Stream
40 × 2s = 80s + ~20s Overhead = 100s
```

**Optimiere:**
- Mehr parallel → schneller, aber mehr Risk
- Weniger Delay → schneller, aber Rate Limits
- Chunked Sync → sicherer, aber komplexer

## ⚙️ Vercel Plans Vergleich

| Feature | Hobby | Pro | Enterprise |
|---------|-------|-----|------------|
| Max Duration (default) | 10s | 60s | 60s |
| Max Duration (max) | 10s | 300s | 900s |
| Preis | Kostenlos | $20/mo | Custom |
| Empfohlung | ❌ Zu kurz | ✅ Perfekt | ⚠️ Overkill |

**Empfehlung:** Pro Plan mit 300s maxDuration

## 🔄 Alternative Architekturen

### Option 1: Webhook + Queue (empfohlen bei >500 Dateien)

1. Webhook empfängt Sync-Request
2. Fügt Job zu Queue hinzu (z.B. BullMQ, Redis Queue)
3. Worker verarbeitet Queue außerhalb von Vercel
4. Status via API abrufbar

**Vorteile:**
- ✅ Keine Timeouts
- ✅ Retry bei Fehlern
- ✅ Skalierbar

**Nachteile:**
- ❌ Komplexer Setup
- ❌ Zusätzliche Infrastruktur

### Option 2: Cron + State Management

1. Cron läuft alle 5 Minuten
2. Speichert Fortschritt in Redis
3. Fortsetzt wo aufgehört wurde

**Vorteile:**
- ✅ Automatische Fortsetzung
- ✅ Funktioniert mit Timeouts

**Nachteile:**
- ❌ Langsamer (5 Min Intervalle)
- ❌ Komplexere State-Logik

### Option 3: Edge Functions (experimentell)

Vercel Edge Functions haben andere Limits:
- Schneller Start
- Kürzere max Duration (30s)
- Nicht geeignet für lange Syncs

## 📋 Deployment Checklist

Nach vercel.json Änderung:

- [ ] `vercel.json` aktualisiert
- [ ] Changes committed
- [ ] Deployed: `vercel --prod`
- [ ] Vercel Dashboard: Max Duration geprüft
- [ ] Test-Sync durchgeführt
- [ ] Logs geprüft auf Timeouts
- [ ] Bei Bedarf CONCURRENT angepasst

## 📚 Weitere Ressourcen

- [Vercel Function Duration Limits](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)
- [Vercel Pro Plan](https://vercel.com/pricing)
- [Streaming Responses](https://vercel.com/docs/functions/streaming)

---

**Status:** ✅ vercel.json aktualisiert (maxDuration: 300s)  
**Action Required:** Deployment erforderlich!  
**Datum:** 13. Oktober 2025
