# Telegram Bot API Limits - Upload-Optimierung

## 📊 Telegram Bot API Limits

### Relevante Limits für Uploads

| Limit | Wert | Auswirkung |
|-------|------|------------|
| **Message sending frequency (group chats)** | **20 messages/minute** | Pro Topic/Chat |
| **Message broadcasting frequency** | **30 messages/second** | Über alle Chats hinweg |
| **API requests frequency** | ~30 requests/second | API-Calls insgesamt |
| File upload limit | 50 MB | Ohne local Bot API server |

### Interpretation für Multi-Topic-Upload

**Kritisches Limit:** 20 messages/minute pro Chat

```
20 messages/minute = 1 message alle 3 Sekunden pro Topic
```

**Optimales Limit:** 30 messages/second gesamt

```
30 messages/second = bis zu 30 parallele Topics theoretisch möglich
Praktisch: 6-10 Topics parallel (mit Sicherheitspuffer)
```

## ⚡ Aktuelle Optimierung

### Konfiguration

```typescript
// In lib/sync.ts
const CONCURRENT = 6;           // 6 Ordner/Topics gleichzeitig
await bot.delay(3000);          // 3 Sekunden zwischen Uploads
```

### Berechnung

**Pro Topic:**
```
3s zwischen Uploads = 20 msg/minute ✅ (Limit: 20/min)
```

**6 Topics parallel:**
```
6 Topics × 20 msg/min = 120 msg/min insgesamt
= 2 msg/sec durchschnittlich ✅ (Limit: 30/sec)
```

**Sicherheitspuffer:**
```
2 msg/sec ≪ 30 msg/sec (nur 6.7% der Kapazität!)
= Sehr sicherer Bereich, keine Rate Limits
```

## 🚀 Performance-Zahlen

### Upload-Geschwindigkeit

**Einzelner Ordner (sequenziell):**
```
1 Datei alle 3s = 20 Dateien/minute = 1.200 Dateien/Stunde
```

**6 Ordner parallel:**
```
6 × 20 Dateien/minute = 120 Dateien/minute
= 7.200 Dateien/Stunde 🚀
```

### Zeit für große Projekte

**Beispiel 1: 1.000 Dateien**
```
Sequenziell: 1.000 / 20 = 50 Minuten
Parallel (6): 1.000 / 120 = 8.3 Minuten ⚡
```

**Beispiel 2: 10.000 Dateien**
```
Sequenziell: 10.000 / 20 = 500 Minuten = 8.3 Stunden
Parallel (6): 10.000 / 120 = 83 Minuten = 1.4 Stunden ⚡
```

**Beispiel 3: 20.000 Dateien (5-6h Daten)**
```
Sequenziell: 20.000 / 20 = 1.000 Minuten = 16.7 Stunden
Parallel (6): 20.000 / 120 = 167 Minuten = 2.8 Stunden ⚡
```

**Mit Chunked Processing:**
```
2.8 Stunden / 4 Min pro Chunk = ~42 Chunks
42 × 4 Min = 168 Minuten = 2.8 Stunden total ✅
```

## 🎯 Warum genau diese Werte?

### CONCURRENT = 6

**Zu wenig (z.B. 3):**
```
3 Topics × 20 msg/min = 60 msg/min = 1 msg/sec
→ Nutzt nur 3.3% der 30 msg/sec Kapazität ❌
```

**Optimal (6):**
```
6 Topics × 20 msg/min = 120 msg/min = 2 msg/sec
→ Nutzt 6.7% der Kapazität, sehr sicher ✅
```

**Zu viel (z.B. 15):**
```
15 Topics × 20 msg/min = 300 msg/min = 5 msg/sec
→ Näher am Limit, weniger Puffer ⚠️
```

**Viel zu viel (z.B. 30):**
```
30 Topics × 20 msg/min = 600 msg/min = 10 msg/sec
→ Immer noch unter 30/sec, aber viele Requests ⚠️
```

### bot.delay(3000)

**Zu kurz (1s):**
```
1s = 60 msg/min pro Topic ❌ (Limit: 20/min)
→ Garantiertes Rate Limit!
```

**Knapp (2.5s):**
```
2.5s = 24 msg/min pro Topic ⚠️ (Limit: 20/min)
→ Zu nah am Limit, riskant bei Bursts
```

**Optimal (3s):**
```
3s = 20 msg/min pro Topic ✅ (Limit: 20/min)
→ Genau am Limit, maximale Geschwindigkeit
```

**Zu langsam (5s):**
```
5s = 12 msg/min pro Topic ❌
→ Nur 60% der möglichen Geschwindigkeit
```

## 📈 Weitere Optimierungsmöglichkeiten

### Option 1: Mehr Parallelität (riskanter)

```typescript
const CONCURRENT = 10;
await bot.delay(3000);
```

**Performance:**
```
10 × 20 msg/min = 200 msg/min = 3.3 msg/sec
→ Immer noch weit unter 30 msg/sec Limit
→ 2x schneller als aktuell (6)
```

**Risiken:**
- Mehr API-Requests
- Höhere Server-Last
- Weniger Fehlertoleranz bei Netzwerkproblemen

### Option 2: Kürzere Pausen (sehr riskant!)

```typescript
const CONCURRENT = 6;
await bot.delay(2500);  // 2.5s statt 3s
```

**Performance:**
```
6 Topics × 24 msg/min = 144 msg/min
→ 20% schneller
```

**Risiken:**
- ⚠️ Sehr nah am 20 msg/min Limit!
- Bei kurzen Bursts (retry, etc.) → Rate Limit
- Nicht empfohlen!

### Option 3: Dynamisches Rate-Limiting

Implementiere intelligentes Rate-Limiting:

```typescript
// Verfolge letzte Upload-Zeiten pro Topic
const topicTimestamps = new Map<number, number[]>();

function getDynamicDelay(topicId: number): number {
  const now = Date.now();
  const recent = topicTimestamps.get(topicId) || [];
  
  // Behalte nur letzte 60s
  const recentInMinute = recent.filter(t => now - t < 60000);
  
  if (recentInMinute.length >= 19) {
    // Nah am Limit (20/min) → langsamer
    return 4000; // 4s
  } else if (recentInMinute.length <= 10) {
    // Weit unter Limit → schneller
    return 2500; // 2.5s
  }
  
  return 3000; // Standard
}
```

**Vorteile:**
- Adaptiv: Schnell wenn möglich, sicher wenn nötig
- Optimal bei ungleich verteilten Dateien

**Nachteile:**
- Komplexer Code
- Schwer zu testen

## 🎮 Empfohlene Konfigurationen

### Standard (aktuell) ✅

```typescript
const CONCURRENT = 6;
await bot.delay(3000);
```

**Für:**
- Stabile, sichere Uploads
- Große Mengen (5-6h Daten)
- Produktions-Umgebung

**Performance:** 7.200 Dateien/Stunde

### Aggressiv (für kleinere Mengen)

```typescript
const CONCURRENT = 10;
await bot.delay(3000);
```

**Für:**
- Kleinere Mengen (<5.000 Dateien)
- Schnellere Fertigstellung gewünscht
- Risiko akzeptabel

**Performance:** 12.000 Dateien/Stunde

### Konservativ (für kritische Umgebungen)

```typescript
const CONCURRENT = 4;
await bot.delay(3500);
```

**Für:**
- Maximale Stabilität
- Kritische Produktions-Umgebung
- Rate Limits auf keinen Fall riskieren

**Performance:** 4.114 Dateien/Stunde

## 🔍 Monitoring & Anpassung

### Rate Limit Errors prüfen

```powershell
vercel logs | Select-String "429|Rate limit"
```

**Wenn Rate Limits auftreten:**
1. Reduziere CONCURRENT (z.B. 6 → 4)
2. Erhöhe delay (z.B. 3000 → 3500)
3. Prüfe ob andere Bots aktiv sind

### Performance messen

```powershell
# Status während Sync
$status = Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/status" | ConvertFrom-Json
$stats = $status.currentSync

# Berechne Uploads pro Minute
$uploadRate = ($stats.filesPosted / $stats.duration) * 60000
Write-Host "Upload Rate: $uploadRate Dateien/Minute"
```

**Ziel-Werte:**
- 100-120 Dateien/Minute = Optimal ✅
- 60-100 Dateien/Minute = Gut, könnte schneller
- >120 Dateien/Minute = Zu schnell, Rate Limits möglich

## 📚 Telegram Bot API Dokumentation

- [Rate Limits](https://core.telegram.org/bots/faq#broadcasting-to-users)
- [Avoiding Flood Waits](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this)
- [Best Practices](https://core.telegram.org/bots/api#making-requests)

## 🎯 Zusammenfassung

### Aktuelle Konfiguration

✅ **CONCURRENT = 6** - Nutzt 6.7% der 30 msg/sec Kapazität
✅ **delay = 3000ms** - Genau am 20 msg/min Limit pro Chat
✅ **Performance: 7.200 Dateien/Stunde** - 6x schneller als sequenziell
✅ **Sicher:** Großer Puffer zum globalen Limit

### Für deine 20.000 Dateien

```
Mit aktueller Config: ~2.8 Stunden
Mit Chunked Processing: ~42 Chunks à 4 Min
Total: ~2.8 Stunden (statt 16.7h sequenziell!)
```

**6x Speedup durch Parallelisierung!** 🚀

---

**Status:** ✅ Optimiert für maximale Geschwindigkeit innerhalb Telegram Limits  
**CONCURRENT:** 6 parallele Topics  
**Delay:** 3 Sekunden (20 msg/min pro Chat)  
**Datum:** 13. Oktober 2025
