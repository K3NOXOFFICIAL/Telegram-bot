# Chunked Processing System - Automatische Fortsetzung

## 🎯 Problem & Lösung

### Problem
- Vercel Functions haben max. 5 Minuten Timeout
- Große Syncs (5-6 Stunden Daten) passen nicht in eine Function
- Manuelle Fortsetzung ist unpraktisch

### Lösung: Auto-Continuation System ✅
Der Bot teilt lange Syncs automatisch in 4-Minuten-Chunks auf und startet sich selbst neu.

## 🔄 Wie es funktioniert

### Ablauf

```
┌─────────────────────────────────────────────────────────────┐
│ Chunk 1 (4 Min)                                             │
│ ├─ Ordner 1, 2, 3 verarbeiten                              │
│ ├─ Zeit läuft ab (4 Min erreicht)                          │
│ ├─ Fortschritt speichern: "Bei Ordner 4 weitermachen"      │
│ └─ Auto-Trigger: Neuen Sync-Request starten                │
└──────────────────────┬──────────────────────────────────────┘
                       │ 2s Pause
┌──────────────────────▼──────────────────────────────────────┐
│ Chunk 2 (4 Min)                                             │
│ ├─ Fortschritt laden: "Starte bei Ordner 4"                │
│ ├─ Ordner 4, 5, 6 verarbeiten                              │
│ ├─ Zeit läuft ab (4 Min erreicht)                          │
│ ├─ Fortschritt speichern: "Bei Ordner 7 weitermachen"      │
│ └─ Auto-Trigger: Neuen Sync-Request starten                │
└──────────────────────┬──────────────────────────────────────┘
                       │ 2s Pause
┌──────────────────────▼──────────────────────────────────────┐
│ Chunk 3 (4 Min)                                             │
│ ├─ Fortschritt laden: "Starte bei Ordner 7"                │
│ ├─ Ordner 7, 8, 9 verarbeiten                              │
│ ├─ Alle Ordner fertig!                                     │
│ ├─ Fortschritt löschen                                     │
│ └─ Status: "Synchronisierung vollständig abgeschlossen"    │
└─────────────────────────────────────────────────────────────┘
```

### Code-Flow

1. **Sync startet:**
   ```typescript
   // Lädt Fortschritt aus Redis
   const progress = await getSyncProgress();
   // → null = Neue Session
   // → {currentFolderIndex: 4} = Fortsetzung
   ```

2. **Verarbeitung:**
   ```typescript
   for (let i = startIndex; i < folders.length; i += CONCURRENT) {
     // Prüfe Zeit
     if (elapsed > 4 Minuten) {
       // Speichere Fortschritt
       await saveSyncProgress({ currentFolderIndex: i });
       needsContinuation = true;
       break;
     }
     // Verarbeite Batch...
   }
   ```

3. **Auto-Trigger:**
   ```typescript
   if (needsContinuation) {
     // Starte neuen Sync nach 2s
     setTimeout(() => fetch('/api/sync', { method: 'POST' }), 2000);
     return { needsContinuation: true };
   }
   ```

4. **Nächster Chunk:**
   - Lädt Fortschritt: "Starte bei Ordner 4"
   - Macht weiter wo aufgehört
   - Wiederholt bis fertig

## 📊 Redis-Datenstruktur

### sync_progress
```json
{
  "currentFolderIndex": 4,
  "totalFolders": 12
}
```

### sync_stats
```json
{
  "foldersScanned": 4,
  "filesFound": 120,
  "filesPosted": 120,
  "errors": 0,
  "duration": 240000,
  "lastUpdate": 1697234567890,
  "isRunning": false,
  "needsContinuation": true
}
```

## 🎮 Verwendung

### Manuell starten

```powershell
# Starte Sync (läuft automatisch bis Ende)
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync" -Method Post
```

Das war's! Der Bot macht den Rest automatisch:
- ✅ Läuft 4 Minuten
- ✅ Speichert Fortschritt
- ✅ Startet sich selbst neu
- ✅ Wiederholt bis alles fertig

### Status während laufendem Sync

```powershell
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync/status" | ConvertFrom-Json
```

Response:
```json
{
  "syncProgress": {
    "currentFolder": 5,
    "totalFolders": 12,
    "percentComplete": 42
  },
  "currentSync": {
    "filesPosted": 120,
    "needsContinuation": true
  }
}
```

## ⏱️ Zeitmessung

### Beispiel-Berechnung

**Szenario:** 12 Ordner, je 50 Dateien (600 Dateien total)

**Pro Ordner:**
```
50 Dateien × 2s = 100 Sekunden
```

**Pro Chunk (3 Ordner parallel):**
```
~100 Sekunden pro Chunk
= ~1.7 Minuten
```

**Chunks benötigt:**
```
12 Ordner / 3 parallel = 4 Chunks
4 × 1.7 Min = ~7 Minuten
```

**Automatische Fortsetzungen:**
```
7 Min / 4 Min pro Chunk = 2 Fortsetzungen
= 3 Function-Calls total
```

### Großes Projekt: 5-6 Stunden Daten

**Annahme:**
- 100 Ordner
- Durchschnittlich 200 Dateien pro Ordner
- 20.000 Dateien total

**Berechnung:**
```
20.000 Dateien / 3 parallel = 6.666 Dateien pro Stream
6.666 × 2s = ~13.332 Sekunden
= ~222 Minuten
= ~3.7 Stunden
```

**Chunks:**
```
222 Min / 4 Min pro Chunk = 56 Chunks
= 56 Function-Calls
= ~$0.11 Kosten (bei $2/million requests)
```

## 🔍 Logs verstehen

### Chunk 1 startet

```
🔄 Starte PARALLELE Synchronisierung...
📁 12 Ordner gefunden

📦 Batch 1/4: Starte 3 Ordner PARALLEL
   📂 Ordner1 | Ordner2 | Ordner3
   
... (Verarbeitung) ...

⏰ Zeit-Limit erreicht (240s) - stoppe und speichere Fortschritt
💾 Fortschritt gespeichert: 3/12

⏸️ Synchronisierung pausiert - wird automatisch fortgesetzt
📊 Zwischenstand:
   - Ordner: 3/12
   - Dateien gepostet: 150
   
🔄 Triggere automatische Fortsetzung...
▶️  Auto-Continue: Starte nächsten Chunk...
```

### Chunk 2 fortsetzt

```
🔄 Starte PARALLELE Synchronisierung...
📂 Fortschritt geladen: Ordner 3/12
📍 Setze fort bei Ordner 4
📁 12 Ordner gefunden

📦 Batch 2/4: Starte 3 Ordner PARALLEL
   📂 Ordner4 | Ordner5 | Ordner6
   
... (Verarbeitung) ...
```

### Letzter Chunk abgeschlossen

```
✨ Synchronisierung abgeschlossen
📊 Finale Statistiken:
   - Ordner: 12
   - Dateien gefunden: 600
   - Dateien gepostet: 600
   - Fehler: 0
   
🗑️  Sync-Fortschritt gelöscht
```

## 🐛 Troubleshooting

### Sync hängt / keine Fortsetzung

**Prüfe Status:**
```powershell
$status = Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/status" | ConvertFrom-Json
$status.syncProgress
```

**Wenn Fortschritt existiert aber nichts passiert:**
```powershell
# Starte manuell neu
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync" -Method Post
```

### Fortschritt zurücksetzen

```powershell
# Über Redis-Clear (löscht ALLES!)
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/clear-redis?token=clear-redis-now" -Method Get
```

⚠️ **Achtung:** Löscht auch topic_files Cache!

### Zu viele Chunks

**Wenn jeder Chunk nur 1-2 Ordner schafft:**

**Option A: Erhöhe Parallelität**
```typescript
const CONCURRENT = 5; // Mehr Ordner pro Chunk
```

**Option B: Reduziere Delay**
```env
RATE_LIMIT_DELAY=1500
```

**Option C: Erhöhe Time-Limit**
```typescript
const MAX_EXECUTION_TIME = 4.5 * 60 * 1000; // 4.5 Minuten
```
⚠️ Näher am 5-Min-Limit = riskanter

## 📈 Performance-Optimierung

### Für schnellere Chunks

1. **Mehr Parallelität:**
   ```typescript
   const CONCURRENT = 4; // oder 5
   ```

2. **Kürzere Pausen:**
   ```env
   RATE_LIMIT_DELAY=1500
   ```

3. **Längere Chunks (riskant):**
   ```typescript
   const MAX_EXECUTION_TIME = 4.5 * 60 * 1000;
   ```

### Für mehr Stabilität

1. **Weniger Parallelität:**
   ```typescript
   const CONCURRENT = 2;
   ```

2. **Längere Pausen:**
   ```env
   RATE_LIMIT_DELAY=3000
   ```

3. **Kürzere Chunks (sicherer):**
   ```typescript
   const MAX_EXECUTION_TIME = 3.5 * 60 * 1000;
   ```

## 🎯 Best Practices

### DO ✅
- ✅ Lass den Bot automatisch laufen
- ✅ Prüfe Status während langem Sync
- ✅ Nutze vernünftige CONCURRENT Werte (3-4)
- ✅ Behalte 1 Minute Sicherheitspuffer (4 statt 5 Min)

### DON'T ❌
- ❌ Starte nicht mehrere Syncs gleichzeitig
- ❌ Erhöhe nicht MAX_EXECUTION_TIME über 4.5 Min
- ❌ Lösche nicht Redis während laufendem Sync
- ❌ Setze nicht CONCURRENT > 6

## 📊 Monitoring

### Vercel Logs live verfolgen

```powershell
vercel logs --follow
```

### Fortschritt prüfen

```powershell
# Status-Check alle 30s
while ($true) {
  $status = Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/status" | ConvertFrom-Json
  if ($status.syncProgress) {
    Write-Host "Fortschritt: $($status.syncProgress.percentComplete)% ($($status.syncProgress.currentFolder)/$($status.syncProgress.totalFolders))"
  } else {
    Write-Host "Kein aktiver Sync"
  }
  Start-Sleep -Seconds 30
}
```

## 💰 Kosten

### Vercel Function Calls

**Pro Chunk:**
- 1 Function Call à ~240s
- ~$0.002 pro Call (Pro Plan)

**Großes Projekt (50 Chunks):**
- 50 × $0.002 = $0.10
- Vernachlässigbar!

**Pro Plan Kosten:**
- $20/Monat
- Inkludiert: 1 Million Function Calls
- Chunked Processing kostet praktisch nichts extra

---

**Status:** ✅ Auto-Continuation System aktiv  
**Max Chunk Duration:** 4 Minuten  
**Auto-Trigger Delay:** 2 Sekunden  
**Datum:** 13. Oktober 2025
