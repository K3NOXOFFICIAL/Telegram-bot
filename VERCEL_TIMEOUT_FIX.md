# Vercel Gateway Timeout - Fix

## 🐛 Problem

**Symptom:** 504 Gateway Timeout beim `/api/sync` Endpoint nach ~5 Minuten

**Ursache:** 
- Vercel Serverless Functions haben ein 5-Minuten Timeout (300s)
- Große Syncs dauern länger (z.B. 20.000 Dateien = ~1.1 Stunden)
- Die alte Implementierung verwendete `setTimeout()` für Fortsetzungen
- **`setTimeout()` funktioniert NICHT in Vercel Serverless** - die Function terminiert bevor der Timer ausgelöst wird!

## ✅ Lösung

### Fire-and-Forget Pattern

**Alt (FUNKTIONIERT NICHT):**
```typescript
// ❌ setTimeout wird nie ausgeführt - Function beendet sich vorher!
setTimeout(async () => {
  await fetch('/api/sync', { method: 'POST' });
}, 2000);

return res.json({ needsContinuation: true });
```

**Neu (FUNKTIONIERT):**
```typescript
// ✅ Request wird SOFORT gesendet, BEVOR Response zurückgegeben wird
fetch('/api/continue-sync', { 
  method: 'POST',
  headers: { 'x-auth-token': authToken }
}).catch(error => console.error(error)); // Fire-and-forget!

// Response wird direkt zurückgegeben (wartet nicht auf Continuation)
return res.status(202).json({ needsContinuation: true });
```

### Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ Client macht POST /api/sync                                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ /api/sync startet Verarbeitung                             │
│ • Verarbeitet 15 Ordner parallel                            │
│ • Nach 4.2 Minuten: Zeit-Check                              │
│ • Wenn nötig: Speichert Progress in Redis                   │
└─────────────────────────────────────────────────────────────┘
                          │
                ┌─────────┴─────────┐
                │ Needs Continue?   │
                └─────────┬─────────┘
                          │ YES
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ SOFORT: fetch('/api/continue-sync')  (Fire-and-forget!)    │
│ ────────────────────────────────────────────────────────────│
│ return 202 { needsContinuation: true }                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ /api/continue-sync startet (neuer Serverless Invocation)   │
│ • Lädt Progress aus Redis                                   │
│ • Setzt fort bei gespeichertem Index                        │
│ • Verarbeitet nächsten Chunk (4.2 Min)                      │
│ • Triggert wieder /api/continue-sync falls nötig            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Wiederholt bis fertig │
              └───────────────────────┘
```

## 📝 Implementierung

### 1. Neuer Endpoint: `/api/continue-sync.ts`

```typescript
export default async function handler(req, res) {
  const config = loadConfig();
  const stats = await syncOneDriveToTelegramParallel(config);
  
  if (stats.needsContinuation) {
    // Triggere SOFORT nächsten Chunk
    fetch(`https://${req.headers.host}/api/continue-sync`, {
      method: 'POST',
      headers: { 'x-auth-token': authToken }
    }).catch(error => console.error(error));
    
    return res.status(202).json({ 
      needsContinuation: true,
      stats 
    });
  }
  
  return res.status(200).json({ 
    success: true,
    stats 
  });
}
```

### 2. Angepasster `/api/sync.ts`

```typescript
const stats = await syncOneDriveToTelegramParallel(config);

if (stats.needsContinuation) {
  // Triggere /api/continue-sync SOFORT (nicht /api/sync!)
  fetch(`https://${req.headers.host}/api/continue-sync`, {
    method: 'POST',
    headers: { 'x-auth-token': authToken }
  }).catch(error => console.error(error));
  
  return res.status(202).json({
    needsContinuation: true,
    progress: {
      currentFolder: stats.foldersScanned,
      totalFolders: stats.totalFolders,
      percentComplete: Math.round((stats.foldersScanned / stats.totalFolders) * 100)
    }
  });
}
```

### 3. Timing-Optimierung in `lib/sync.ts`

```typescript
const MAX_EXECUTION_TIME = 4.2 * 60 * 1000; // 4.2 Minuten

// Gibt Zeit für:
// - Cleanup (Release Lock, Save Stats)
// - Triggern des neuen Requests
// - Response senden
// = Puffer von ~50 Sekunden vor 5-Min-Limit
```

## 🔍 Warum funktioniert das?

### Kritische Unterschiede

| Aspekt | setTimeout (Alt) | fetch Fire-and-forget (Neu) |
|--------|------------------|------------------------------|
| **Ausführung** | Nach Response | VOR Response |
| **Timing** | 2s Verzögerung | Sofort |
| **Vercel Kompatibilität** | ❌ Wird nie ausgeführt | ✅ Wird ausgeführt |
| **Function Lifecycle** | Timeout nach Response | Request während Function läuft |

### Serverless Function Lifecycle

```
Vercel Serverless Function Lifecycle:
├── Function startet
├── Code wird ausgeführt
├── Response wird gesendet  ← ENDE DER FUNCTION!
└── Alles nach Response wird NICHT ausgeführt (inkl. setTimeout)

Mit fetch Fire-and-forget:
├── Function startet
├── Code wird ausgeführt
├── fetch() wird aufgerufen (nicht-blockierend)  ← WICHTIG: VOR Response!
├── Response wird gesendet
└── Vercel garantiert dass fetch() ausgeführt wird
```

## 📊 Performance

### Mit dem Fix

**20.000 Dateien:**
```
Chunk 1: 4.2 Min  →  fetch('/api/continue-sync')  →  Response 202
Chunk 2: 4.2 Min  →  fetch('/api/continue-sync')  →  Response 202
Chunk 3: 4.2 Min  →  fetch('/api/continue-sync')  →  Response 202
...
Chunk 16: 4.2 Min →  Fertig!  →  Response 200

Total: ~67 Minuten (1.1 Stunden)
Kein Timeout! Jeder Chunk unter 5 Min!
```

### Ohne den Fix

```
Request startet
... nach 5 Minuten ...
❌ 504 Gateway Timeout
setTimeout() wird nie ausgeführt
Sync bricht ab
```

## 🎯 Vorteile

✅ **Kein Gateway Timeout** - Jeder Chunk unter 5 Minuten
✅ **Automatische Fortsetzung** - Fire-and-forget Pattern
✅ **Separater Endpoint** - Cleaner Code, besseres Monitoring
✅ **Progress Tracking** - Jeder Chunk gibt Fortschritt zurück
✅ **Fehlerresistent** - Fehler in einem Chunk stoppen nicht den Rest
✅ **Vercel-Kompatibel** - Nutzt Serverless-freundliche Patterns

## 🔧 Konfiguration

**vercel.json:**
```json
{
  "functions": {
    "api/sync.ts": { "maxDuration": 300 },
    "api/continue-sync.ts": { "maxDuration": 300 }
  }
}
```

**Umgebungsvariablen:**
```env
SYNC_AUTH_TOKEN=your_secret_token  # Optional für Sicherheit
```

## 📈 Monitoring

**Status prüfen während Sync:**
```powershell
Invoke-WebRequest -Uri "https://your-app.vercel.app/api/status" | ConvertFrom-Json
```

**Response bei laufendem Chunk:**
```json
{
  "currentSync": {
    "isRunning": true,
    "filesPosted": 2500,
    "filesFound": 15000,
    "foldersScanned": 25,
    "totalFolders": 42,
    "duration": 252000,
    "progress": {
      "currentFolder": 25,
      "totalFolders": 42,
      "percentComplete": 59.5
    }
  }
}
```

## 🚨 Troubleshooting

### "Lock ist hängen geblieben"

```powershell
# Manuelles Release
Invoke-WebRequest -Uri "https://your-app.vercel.app/api/force-unlock" -Method POST
```

### "Continuation startet nicht"

**Prüfe Logs:**
```powershell
vercel logs --follow
```

**Suche nach:**
- `"✅ Auto-Continue Request gesendet"` - Request wurde getriggert
- `"🔄 Continue-Sync aufgerufen"` - Continuation wurde empfangen

**Wenn Continuation fehlt:**
- Prüfe `SYNC_AUTH_TOKEN` Konfiguration
- Prüfe dass `/api/continue-sync.ts` deployed ist
- Manueller Retry: `POST /api/continue-sync`

### "Immer noch Timeout"

**Mögliche Ursachen:**
1. **Zu viele Dateien pro Chunk** - Reduziere `CONCURRENT` von 15 auf 10
2. **Langsame OneDrive API** - Erhöhe `MAX_EXECUTION_TIME` Puffer nicht weiter (!)
3. **Netzwerk-Probleme** - Retry-Logik sollte das abfangen

**Reduziere CONCURRENT:**
```typescript
// In lib/sync.ts
const CONCURRENT = 10; // Statt 15
```

## 📚 Technische Details

### Warum 4.2 Minuten?

```
Vercel Limit:        300s (5 Minuten)
Chunk Duration:      252s (4.2 Minuten)
Puffer:               48s (0.8 Minuten)

Puffer wird genutzt für:
- Lock Release:       ~0.5s
- Stats Save:         ~0.5s
- Progress Save:      ~0.5s
- fetch() Trigger:    ~0.5s
- Response Send:      ~0.5s
- Network Overhead:   ~1s
- Sicherheit:         ~45s
= 48s Gesamt
```

### Fire-and-Forget Implementation

**Wichtig:** Wir warten NICHT auf die Response von fetch():
```typescript
// ✅ Richtig: Fire-and-forget
fetch('/api/continue-sync', { method: 'POST' })
  .catch(error => console.error(error));
// Kein .then() und kein await!

// ❌ Falsch: Würde auf Response warten
await fetch('/api/continue-sync', { method: 'POST' });
```

### Error Handling

**Wenn fetch() fehlschlägt:**
- Error wird geloggt (`.catch()`)
- Response wird trotzdem gesendet
- Client kann manuell `/api/continue-sync` aufrufen
- Progress ist in Redis gespeichert

**Wenn Chunk fehlschlägt:**
- Lock wird freigegeben (garantiert)
- Stats werden gespeichert
- Nächster Sync startet von vorne
- Bereits gepostete Dateien werden übersprungen (Redis Check)

## 🎉 Zusammenfassung

**Der Fix:**
1. Separater `/api/continue-sync` Endpoint
2. Fire-and-forget fetch() BEFORE Response
3. 4.2 Min Chunks (unter 5 Min Limit)
4. Automatische Verkettung von Chunks

**Resultat:**
- ✅ Kein Gateway Timeout mehr
- ✅ Beliebig lange Syncs möglich
- ✅ Automatische Fortsetzung
- ✅ Vollständiges Progress Tracking

---

**Status:** ✅ FIXED - Gateway Timeout behoben
**Datum:** 15. Oktober 2025
**Getestet:** Vercel Serverless Production Environment
