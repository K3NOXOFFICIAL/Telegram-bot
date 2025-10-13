# Lock-Problem Lösung

## Problem: "Synchronisierung läuft bereits - überspringe"

### Ursache
Der Sync-Lock in Redis ist noch aktiv, obwohl keine Synchronisierung läuft. Dies kann passieren durch:
- Serverless Function Timeout
- Fehler während der Synchronisierung
- Deployment während laufendem Sync
- Manueller Abbruch

### Schnelle Lösung

#### Option 1: Lock manuell freigeben (empfohlen)
```powershell
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/release-lock?token=release-lock-now" -Method Get
```

#### Option 2: Warten (5 Minuten)
Der Lock läuft automatisch nach 5 Minuten ab.

#### Option 3: Redis komplett leeren (Vorsicht!)
```powershell
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/clear-redis?token=clear-redis-now" -Method Get
```
⚠️ **Achtung:** Löscht ALLE Daten inkl. topic_files Cache!

### Lock-Status prüfen

```powershell
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/status" | ConvertFrom-Json
```

In der Response:
```json
{
  "syncLock": {
    "locked": true,
    "ageSeconds": 142,
    "ageMinutes": 2,
    "timestamp": "2025-10-13T21:28:15.000Z"
  }
}
```

### Änderungen am Lock-System

#### Vorher (❌ Problem)
- Lock-Timeout: **30 Minuten** (viel zu lang!)
- Keine Prüfung auf abgelaufene Locks
- Kein Lock-Status-Endpoint

#### Nachher (✅ Gelöst)
- Lock-Timeout: **5 Minuten** (realistisch)
- Automatische Erkennung abgelaufener Locks
- Lock-Status im `/api/status` Endpoint
- Neuer `/api/release-lock` Endpoint

### Workflow bei hängendem Lock

1. **Status prüfen:**
   ```powershell
   Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/status" | ConvertFrom-Json | Select-Object -ExpandProperty syncLock
   ```

2. **Wenn Lock älter als 5 Minuten:**
   - Nächster Sync gibt Lock automatisch frei
   - ODER manuell freigeben:
   ```powershell
   Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/release-lock?token=release-lock-now" -Method Get
   ```

3. **Sync erneut starten:**
   ```powershell
   Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync" -Method Post
   ```

### Neue Endpoints

#### `/api/release-lock`
Gibt den Sync-Lock manuell frei.

**Query Parameters:**
- `token` - Auth-Token (Standard: `release-lock-now`)

**Response:**
```json
{
  "success": true,
  "message": "Sync-Lock wurde freigegeben",
  "timestamp": "2025-10-13T21:30:00.000Z"
}
```

#### `/api/status` (erweitert)
Zeigt jetzt auch Lock-Status:

**Neue Felder:**
```json
{
  "syncLock": {
    "locked": true/false,
    "ageSeconds": 120,
    "ageMinutes": 2,
    "timestamp": "2025-10-13T21:28:00.000Z"
  }
}
```

### Lock-Logik im Code

```typescript
// In lib/store.ts
export async function acquireSyncLock(): Promise<boolean> {
  // 1. Prüfe ob Lock existiert
  const existingLock = await kvStore.get('sync_lock');
  
  // 2. Wenn ja, prüfe Alter
  if (existingLock) {
    const lockAge = Date.now() - parseInt(existingLock);
    
    // 3. Wenn älter als 5 Minuten, lösche und erstelle neu
    if (lockAge > 300000) {
      await kvStore.del('sync_lock');
    } else {
      return false; // Lock ist noch aktiv
    }
  }
  
  // 4. Setze neuen Lock mit 5 Minuten TTL
  await kvStore.set('sync_lock', Date.now().toString(), {
    nx: true,
    px: 300000 // 5 Minuten
  });
  
  return true;
}
```

### Testing

1. **Lock-Timeout testen:**
   ```powershell
   # Starte Sync
   Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync" -Method Post
   
   # Sofort nochmal versuchen
   Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync" -Method Post
   # Erwartet: "Synchronisierung läuft bereits"
   
   # Nach 5 Minuten wieder versuchen
   # Erwartet: Lock wird automatisch freigegeben und Sync startet
   ```

2. **Manuelles Release testen:**
   ```powershell
   # Lock freigeben
   Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/release-lock?token=release-lock-now" -Method Get
   
   # Sync sollte jetzt funktionieren
   Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync" -Method Post
   ```

### Vercel Logs prüfen

```powershell
vercel logs
```

Suche nach:
- `🔒 Sync-Lock erhalten` - Lock erfolgreich gesetzt
- `⏸️ Sync läuft bereits` - Lock blockiert
- `⏰ Lock ist abgelaufen` - Alter Lock erkannt und gelöscht
- `🔓 Sync-Lock freigegeben` - Lock manuell oder automatisch freigegeben

---

**Status:** ✅ Lock-System verbessert  
**Datum:** 13. Oktober 2025, 21:35 Uhr
