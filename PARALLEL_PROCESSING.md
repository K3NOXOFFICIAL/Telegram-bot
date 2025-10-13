# Parallele Verarbeitung - Dokumentation

## 🚀 Wie funktioniert die parallele Verarbeitung?

### Batch-basierte Parallelität

Der Bot verarbeitet Ordner in **Batches von 3 Ordnern gleichzeitig**:

```
Ordner: A, B, C, D, E, F

Batch 1: [A, B, C] → Parallel verarbeiten → Warten bis alle fertig
Batch 2: [D, E, F] → Parallel verarbeiten → Warten bis alle fertig
```

### Code-Ablauf

```typescript
// In syncOneDriveToTelegramParallel()
const CONCURRENT = 3; // Anzahl Ordner pro Batch

for (let i = 0; i < folders.length; i += CONCURRENT) {
  const batch = folders.slice(i, i + CONCURRENT);
  
  // Alle Ordner im Batch GLEICHZEITIG starten
  const batchResults = await Promise.all(
    batch.map(folder => processFolderParallel(folder, ...))
  );
  
  // Warten bis alle Ordner im Batch fertig sind
  // Dann nächster Batch
}
```

## 📊 Verarbeitungslogik

### Pro Ordner (parallel)

Jeder Ordner wird **gleichzeitig** verarbeitet:

```
[10:30:15] [Ordner A] Start
[10:30:15] [Ordner B] Start  
[10:30:16] [Ordner C] Start  <-- Alle 3 fast gleichzeitig!

[Ordner A] Datei1.jpg uploaden → 2s warten
[Ordner B] Datei1.mp4 uploaden → 2s warten
[Ordner C] Datei1.png uploaden → 2s warten

[Ordner A] Datei2.jpg uploaden → 2s warten
[Ordner B] Datei2.mp4 uploaden → 2s warten
[Ordner C] Datei2.png uploaden → 2s warten

[10:30:45] [Ordner A] Fertig (10 Dateien in 30s)
[10:30:47] [Ordner B] Fertig (8 Dateien in 32s)
[10:30:50] [Ordner C] Fertig (12 Dateien in 35s)
```

### Pro Ordner (sequenziell innerhalb)

**Innerhalb** eines Ordners werden Dateien **nacheinander** hochgeladen:

```
Ordner A:
  Datei1.jpg → Upload → 2s Pause → Datei2.jpg → Upload → 2s Pause → ...
```

Dies ist wichtig für:
- ✅ Rate-Limiting (Telegram API Limits)
- ✅ Chronologische Reihenfolge (älteste Dateien zuerst)
- ✅ Server-Ressourcen schonen

## ⚙️ Konfiguration

### CONCURRENT Wert anpassen

In `lib/sync.ts` Zeile ~450:

```typescript
const CONCURRENT = 3; // Anzahl paralleler Ordner
```

**Empfehlungen:**

| CONCURRENT | Szenario | Vor-/Nachteile |
|------------|----------|----------------|
| 1 | Wenige Ordner, viele Dateien | ❌ Langsam, ✅ Sicher |
| 2 | Standard, ausgewogen | ✅ Sicher, ⚠️ Mittel |
| **3** | **Empfohlen** | ✅ Schnell, ✅ Stabil |
| 4-5 | Viele Ordner, wenige Dateien | ⚠️ Schnell, ❌ Risk |
| 6+ | Nicht empfohlen | ❌ API Limits, ❌ Instabil |

### Rate-Limit-Delay anpassen

In `.env`:

```env
RATE_LIMIT_DELAY=2000  # 2 Sekunden zwischen Uploads
```

**Empfehlungen:**

- **1000ms (1s):** Schnell, aber riskant bei vielen parallelen Ordnern
- **2000ms (2s):** Empfohlen - guter Kompromiss
- **3000ms (3s):** Sicher bei vielen Dateien

## 📈 Performance-Vergleich

### Szenario: 6 Ordner, je 10 Dateien (60 Dateien total)

#### Sequenziell (CONCURRENT = 1)
```
Ordner 1: 10 Dateien × 2s = 20s
Ordner 2: 10 Dateien × 2s = 20s
Ordner 3: 10 Dateien × 2s = 20s
Ordner 4: 10 Dateien × 2s = 20s
Ordner 5: 10 Dateien × 2s = 20s
Ordner 6: 10 Dateien × 2s = 20s
────────────────────────────────
Total: 120 Sekunden (2 Minuten)
```

#### Parallel 2 (CONCURRENT = 2)
```
Batch 1: [Ordner 1, 2] parallel → 20s
Batch 2: [Ordner 3, 4] parallel → 20s
Batch 3: [Ordner 5, 6] parallel → 20s
────────────────────────────────
Total: 60 Sekunden (1 Minute)
```

#### Parallel 3 (CONCURRENT = 3) ✅
```
Batch 1: [Ordner 1, 2, 3] parallel → 20s
Batch 2: [Ordner 4, 5, 6] parallel → 20s
────────────────────────────────
Total: 40 Sekunden (40s) ⚡
```

**3x schneller als sequenziell!**

## 🔍 Logs verstehen

### Normale parallele Verarbeitung

```
📦 Batch 1/2: Starte 3 Ordner PARALLEL
   📂 Urlaub | Hochzeit | Geburtstag

📂 [21:30:15] [Urlaub] Start
📂 [21:30:15] [Hochzeit] Start
📂 [21:30:16] [Geburtstag] Start

   [Urlaub] 15 Medien gefunden
   [Hochzeit] 8 Medien gefunden
   [Geburtstag] 12 Medien gefunden

   ✅ [Urlaub] Bild1.jpg
   ✅ [Hochzeit] Video1.mp4
   ✅ [Geburtstag] Bild1.png
   
   ... (parallel uploads) ...
   
✅ [21:30:45] [Urlaub] Fertig (15 gepostet in 30.2s)
✅ [21:30:47] [Hochzeit] Fertig (8 gepostet in 32.1s)
✅ [21:30:50] [Geburtstag] Fertig (12 gepostet in 35.4s)

✅ Batch 1 abgeschlossen in 35.4s
   📊 Batch: 35 Dateien gepostet
   📊 Gesamt: 35 von 35 Dateien (0 Fehler)
```

**Wichtige Indikatoren:**
- ✅ Alle Ordner starten fast gleichzeitig (gleiche Sekunde)
- ✅ Logs von verschiedenen Ordnern sind vermischt
- ✅ Batch-Zeit ≈ längster Ordner (nicht Summe!)

### Problem: Nur sequenziell

```
📂 [21:30:15] [Urlaub] Start
   [Urlaub] 15 Medien gefunden
   ✅ [Urlaub] Bild1.jpg
   ... (alle Uploads von Urlaub) ...
✅ [21:30:45] [Urlaub] Fertig (30s)

📂 [21:30:46] [Hochzeit] Start  ❌ Erst NACH Urlaub!
   [Hochzeit] 8 Medien gefunden
   ...
```

**Problem-Indikatoren:**
- ❌ Ordner starten nacheinander (nicht gleichzeitig)
- ❌ Keine vermischten Logs
- ❌ Batch-Zeit = Summe aller Ordner

## 🐛 Troubleshooting

### "Nur ein Ordner läuft"

**Mögliche Ursachen:**

1. **CONCURRENT = 1**
   - Lösung: In `lib/sync.ts` auf 3 erhöhen

2. **Promise.all fehlt**
   - Prüfe: Code verwendet `Promise.all()` korrekt?

3. **await in map-Funktion**
   - Problem: `await` vor `processFolderParallel`
   - Lösung: Kein `await` in der map-Callback

### "Rate Limit Errors"

**Wenn zu viele parallele Uploads:**

1. Reduziere CONCURRENT (z.B. 3 → 2)
2. Erhöhe RATE_LIMIT_DELAY (2000 → 3000)
3. Prüfe Telegram Bot API Limits

### Vercel Timeout

**Serverless Functions haben Limits:**

- **Hobby Plan:** 10 Sekunden
- **Pro Plan:** 60 Sekunden
- **Enterprise:** 900 Sekunden

**Lösungen:**

1. Weniger parallele Ordner
2. Upgrade zu Pro Plan
3. Background Jobs verwenden

## 🎯 Best Practices

### DO ✅

- ✅ CONCURRENT = 3 für optimale Performance
- ✅ Rate-Limit einhalten (2s zwischen Uploads)
- ✅ Logs mit Zeitstempel prüfen
- ✅ Bei vielen Dateien: CONCURRENT niedriger setzen

### DON'T ❌

- ❌ CONCURRENT > 5 (API Limits!)
- ❌ RATE_LIMIT_DELAY < 1000 (zu aggressiv)
- ❌ await in map-Callback (blockiert Parallelität)
- ❌ Zu viele Batches ohne Pausen

## 📚 Code-Referenz

### Parallel ausführen (richtig ✅)

```typescript
const batchResults = await Promise.all(
  batch.map(folder => processFolderParallel(folder, ...))
);
```

### Sequenziell ausführen (falsch für diesen Use-Case ❌)

```typescript
const batchResults = [];
for (const folder of batch) {
  const result = await processFolderParallel(folder, ...);
  batchResults.push(result);
}
```

---

**Status:** ✅ Parallele Verarbeitung aktiv (3 Ordner gleichzeitig)  
**Performance:** ~3x schneller als sequenziell  
**Datum:** 13. Oktober 2025
