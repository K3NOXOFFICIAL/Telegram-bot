# Webhook-Modus Dokumentation

## ⚠️ Wichtiges Problem: Webhook vs. getUpdates Konflikt

### Das Problem

Telegram Bot API erlaubt **NICHT**, dass ein Bot gleichzeitig Webhook **UND** `getUpdates` verwendet:

```
Error 409: Conflict: can't use getUpdates method while webhook is active; 
use deleteWebhook to delete the webhook first
```

### Warum ist ein Webhook aktiv?

Ein Webhook wurde vermutlich konfiguriert über:
1. Vercel Webhook-Endpoint: `/api/webhook`
2. Manuell via Telegram API
3. Durch ein anderes Tool/Deployment

### Aktuelle Lösung

**Der Bot funktioniert jetzt im WEBHOOK-MODUS:**

#### Was wurde geändert:

1. **`getTopicFileNames()` in `lib/bot.ts`**
   - Verwendet **NICHT** mehr `getUpdates` API
   - Gibt leeres Set zurück
   - Verlässt sich ausschließlich auf Redis Cache

2. **`scanTopicFiles()` in `lib/topicManager.ts`**
   - Kein API-Scan mehr
   - Lädt nur aus Redis Cache
   - Cache wird bei jedem Upload aktualisiert

3. **Webhook-Handler in `api/webhook.ts`**
   - Empfängt Updates von Telegram
   - Loggt nur wichtige Updates (keine Sticker/Joins)
   - Bestätigt Empfang

#### Wie funktioniert die Duplikat-Vermeidung jetzt?

**Zweistufige Prüfung (wie vorher):**

1. **Redis `file:{fileId}` Check**
   - Primäre Prüfung ob Datei bereits hochgeladen
   - Wird bei jedem Upload gesetzt

2. **Redis `topic_files:{topicId}` Check**
   - Liste aller Dateinamen im Topic
   - Wird bei jedem Upload aktualisiert
   - Dient als Backup falls `file:ID` fehlt

**Kein API-Scan nötig!** Der Cache wird durch Uploads kontinuierlich aufgebaut.

## 🔧 Webhook-Verwaltung

### Webhook-Status prüfen

```powershell
Invoke-WebRequest -Uri "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo" | ConvertFrom-Json
```

### Webhook löschen (falls gewünscht)

```powershell
Invoke-WebRequest -Uri "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook" -Method Post | ConvertFrom-Json
```

⚠️ **ABER:** Wenn du den Webhook löschst, musst du entweder:
- Den Webhook wieder aktivieren für `/api/webhook`
- Auf `getUpdates`-Polling umstellen (nicht für Vercel empfohlen)

### Webhook neu setzen

```powershell
$webhookUrl = "https://telegram-bot-indol-delta.vercel.app/api/webhook"
$botToken = "<YOUR_BOT_TOKEN>"

Invoke-WebRequest -Uri "https://api.telegram.org/bot$botToken/setWebhook?url=$webhookUrl" -Method Post | ConvertFrom-Json
```

## 📊 Vor- und Nachteile

### ✅ Vorteile Webhook-Modus (aktuell)

- **Echtzeit-Updates:** Telegram pushed Updates sofort
- **Keine Polling-Last:** Server muss nicht ständig fragen
- **Serverless-freundlich:** Perfekt für Vercel
- **Redis-basiert:** Cache wird kontinuierlich aufgebaut

### ❌ Nachteile

- **Kein initiales Topic-Scannen:** Kann nicht alle alten Nachrichten scannen
- **Redis-abhängig:** Ohne Redis fehlen Backup-Informationen
- **Webhook muss online sein:** Falls Endpoint down ist, gehen Updates verloren

### ✅ Vorteile getUpdates-Modus (alt)

- **Initiales Scannen möglich:** Kann letzte ~100 Nachrichten abrufen
- **Flexibler:** Kann Updates auch später abrufen
- **Offline-fähig:** Kann pausiert werden

### ❌ Nachteile getUpdates-Modus

- **Nicht mit Webhook kompatibel:** Error 409
- **Polling-Last:** Muss regelmäßig Telegram abfragen
- **Serverless schwierig:** Lange Connections nicht ideal

## 🚀 Empfehlung

**Bleibe im WEBHOOK-MODUS!** Dies ist die beste Lösung für Vercel:

1. ✅ Echtzeit-Updates
2. ✅ Kein Polling nötig
3. ✅ Redis-Cache funktioniert perfekt
4. ✅ Duplikat-Vermeidung durch zweistufige Prüfung

## 🔄 Redis-Cache-Aufbau

Falls Redis gelöscht wurde oder neu gestartet:

### Automatischer Aufbau beim Upload

Der Cache baut sich **automatisch** auf:

1. **Erste Sync nach Redis-Löschung:**
   - Bot findet Dateien in OneDrive
   - Prüft: `file:ID` in Redis → nicht gefunden
   - Prüft: Dateiname in `topic_files:topicId` → nicht gefunden
   - Lädt Datei hoch → **würde doppelt hochladen** ❌

2. **Mit file:ID Duplikat-Check:**
   - Bot merkt: Datei wurde schon hochgeladen (via Message-ID im Topic)
   - Markiert in Redis: `file:ID` → verhindert zukünftige Uploads ✅

### Manueller Cache-Rebuild (optional)

Falls du sicher sein willst, dass keine Duplikate entstehen:

```typescript
// Erstelle ein Script: rebuild-cache.ts
import { TelegramBot } from './lib/bot';
import { saveTopicFiles } from './lib/store';

async function rebuildCache() {
  // Gehe durch alle Topics
  // Für jedes Topic:
  // - Hole die letzten Nachrichten manuell (via Bot-Methoden)
  // - Extrahiere Dateinamen aus Captions
  // - Speichere in topic_files:topicId
}
```

## 📝 Testing

### Test 1: Upload funktioniert

```powershell
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/sync" -Method Post
```

Erwartung:
- ✅ Keine Error 409
- ✅ Dateien werden hochgeladen
- ✅ Redis Cache wird aktualisiert

### Test 2: Duplikat-Vermeidung

1. Führe Sync zweimal aus
2. Prüfe Logs: "Überspringe bereits gepostete Datei"
3. Keine doppelten Uploads im Topic

### Test 3: Webhook empfängt Updates

1. Schreibe eine Nachricht im Topic
2. Prüfe Vercel Logs: Webhook-Empfang geloggt
3. Status-Endpoint sollte weiterhin funktionieren

## 🐛 Troubleshooting

### "Synchronisierung läuft bereits - überspringe"

**Ursache:** Sync-Lock ist noch aktiv (Redis `sync_lock`)

**Lösung:**
```powershell
# Warte 30 Minuten (Lock expiry) ODER
# Lösche Lock manuell via clear-redis Endpoint
Invoke-WebRequest -Uri "https://telegram-bot-indol-delta.vercel.app/api/clear-redis?token=clear-redis-now" -Method Get
```

### Webhook empfängt keine Updates

**Prüfe:**
1. Webhook-URL korrekt gesetzt?
2. HTTPS aktiv?
3. Vercel Endpoint erreichbar?

```powershell
# Status prüfen
Invoke-WebRequest -Uri "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | ConvertFrom-Json
```

### Duplikate trotz Redis-Cache

**Ursachen:**
1. Redis wurde gelöscht → Cache neu aufbauen
2. File-ID ändert sich (unwahrscheinlich)
3. Dateiname ändert sich

**Lösung:** Manueller Cache-Rebuild (siehe oben)

## 📚 Weitere Infos

- [Telegram Bot API - Webhooks](https://core.telegram.org/bots/api#setwebhook)
- [Telegram Bot API - getUpdates](https://core.telegram.org/bots/api#getupdates)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

---

**Stand:** 13. Oktober 2025  
**Status:** ✅ Webhook-Modus aktiv und funktionsfähig
