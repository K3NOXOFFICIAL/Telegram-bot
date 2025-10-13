# Vercel Deployments bereinigen

## Problem
Es laufen mehrere Vercel Deployments gleichzeitig und alle versuchen, die gleichen Bilder hochzuladen.

## Lösung 1: Alte Deployments löschen (empfohlen)

### In Vercel Dashboard:
1. Gehe zu https://vercel.com/dashboard
2. Wähle dein Projekt "Telegram-bot"
3. Klicke auf **Deployments** Tab
4. Für jedes alte Deployment (außer dem neuesten):
   - Klicke auf die drei Punkte ⋯
   - Wähle **Delete**
   - Bestätige die Löschung

### Oder per PowerShell (Vercel CLI):
```powershell
# Liste alle Deployments
vercel ls

# Lösche ein spezifisches Deployment
vercel rm <deployment-url>
```

## Lösung 2: Sync-Lock (bereits implementiert!)

Der Code verwendet jetzt einen Redis-Lock-Mechanismus:
- ✅ Nur **eine Instanz** kann gleichzeitig synchronisieren
- ✅ Lock läuft nach 30 Minuten automatisch ab (für den Fall eines Crashes)
- ✅ Andere Deployments überspringen den Sync mit der Nachricht: "Synchronisierung läuft bereits"

### Wie es funktioniert:
```
Deployment 1: Startet Sync → Erhält Lock ✅
Deployment 2: Startet Sync → Lock bereits vergeben ❌ → Überspringt
Deployment 3: Startet Sync → Lock bereits vergeben ❌ → Überspringt
...
Deployment 1: Sync fertig → Gibt Lock frei 🔓
```

## Lösung 3: Duplikat-Prävention

Der Bot speichert jede hochgeladene Datei in Redis:
- ✅ Vor jedem Upload prüft er: "Wurde diese Datei schon gepostet?"
- ✅ Wenn ja → Überspringen
- ✅ Wenn nein → Upload + Speichern in Redis

### Datei-Tracking:
```typescript
// Vor Upload:
if (await isFilePosted(file.id)) {
  continue; // Überspringen
}

// Nach Upload:
await markFileAsPosted(file.id, file.name, folder.name, message.message_id);
```

## Empfehlung

**Machen Sie beides:**
1. ✅ Lösche alte Vercel Deployments (nur das neueste behalten)
2. ✅ Der Sync-Lock und Duplikat-Check sind bereits aktiv

So verhindern Sie:
- ❌ Mehrfach-Uploads
- ❌ Race Conditions
- ❌ Doppelte API-Calls
- ❌ Telegram Rate Limiting
