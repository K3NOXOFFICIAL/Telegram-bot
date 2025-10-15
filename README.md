# 📸 OneDrive zu Telegram Topics Bot

Ein TypeScript-basierter Bot, der automatisch neue Medien (Bilder und Videos) aus OneDrive-Ordnern in passende Telegram-Topics postet. Vollständig auf Vercel deploybar.

## 🎯 Funktionen

- ✅ Überwacht einen SharePoint/OneDrive-Ordner auf neue Unterordner
- ✅ **Rekursive Suche**: Findet Dateien auch in Unterordnern (z.B. `images/`, `videos/`)
- ✅ Erstellt automatisch Telegram Topics basierend auf Ordnernamen
- ✅ Postet alle Bilder und Videos in die passenden Topics
- ✅ **Doppelte Duplikat-Prüfung**: Verhindert Uploads durch Redis File-ID Check + Topic-Scan
- ✅ **Intelligente Topic-Verwaltung**: Merged existierende Dateien beim Scannen statt zu überschreiben
- ✅ **Konsistenz-Sicherung**: Speichert Daten sowohl in Redis als auch im Fallback-Store
- ✅ Rate-Limiting mit automatischem Retry bei Telegram API Limits
- ✅ **Parallele Verarbeitung**: Verarbeitet mehrere Ordner gleichzeitig (bis zu 6 parallel)
- ✅ **Optimierte Upload-Geschwindigkeit**: Bis zu 7.200 Dateien/Stunde mit Telegram Limits
- ✅ **Chunked Processing**: Automatische Fortsetzung bei langen Syncs (5-6 Stunden)
- ✅ **Robustes Error Handling**: Fehler stoppen nicht den gesamten Upload-Prozess
- ✅ **Automatisches Retry**: Bis zu 5 Versuche bei Fehlern mit intelligenter Fehlerbehandlung
- ✅ **Automatische Fehler-Recovery**: Lock-Management mit automatischer Freigabe bei Fehlern
- ✅ Automatische Synchronisierung alle 5 Minuten (Cron-Job)
- ✅ Vercel-kompatibel mit Serverless Functions
- ✅ Sichere Speicherung von Credentials in Umgebungsvariablen

## 📋 Voraussetzungen

### 1. Telegram Bot erstellen

**📖 Siehe ausführliche Anleitung:** [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md)

**Kurzversion:**
1. Öffne [@BotFather](https://t.me/botfather) in Telegram
2. Sende `/newbot` und folge den Anweisungen
3. Speichere den Bot Token
4. Erstelle eine Telegram-Gruppe mit Forum-Topics aktiviert
5. Füge deinen Bot zur Gruppe hinzu und mache ihn zum Admin
6. Hole die Chat-ID (z.B. mit [@getidsbot](https://t.me/getidsbot))

### 2. Microsoft Azure App registrieren

**📖 Siehe ausführliche Anleitung:** [AZURE_SETUP.md](./AZURE_SETUP.md)

**Kurzversion:**
1. Gehe zu [Azure Portal](https://portal.azure.com)
2. Erstelle eine neue App Registration
3. Notiere Client ID, Tenant ID und erstelle ein Client Secret
4. Füge `Files.Read.All` Permission hinzu
5. Klicke "Grant admin consent"

### 3. Vercel Account

1. Erstelle einen Account auf [vercel.com](https://vercel.com)
2. Installiere die Vercel CLI: `npm i -g vercel`

## 🚀 Installation

### 1. Projekt klonen und Dependencies installieren

```powershell
cd s:\Coding\Telegram-bot
npm install
```

### 2. Umgebungsvariablen konfigurieren

Kopiere `.env.example` zu `.env`:

```powershell
Copy-Item .env.example .env
```

Bearbeite `.env` und fülle alle Werte aus:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

MICROSOFT_CLIENT_ID=your_client_id_here
MICROSOFT_CLIENT_SECRET=your_client_secret_here
MICROSOFT_TENANT_ID=your_tenant_id_here

ONEDRIVE_FOLDER_PATH=/path/to/your/folder
RATE_LIMIT_DELAY=2000
```

## 💻 Lokale Entwicklung

```powershell
# Vercel Dev-Server starten
npm run dev
```

Öffne: `http://localhost:3000`

### Endpoints testen

```powershell
# Status abfragen
Invoke-WebRequest -Uri "http://localhost:3000/api/status" | Select-Object -ExpandProperty Content

# Synchronisierung starten
Invoke-WebRequest -Uri "http://localhost:3000/api/sync" -Method POST | Select-Object -ExpandProperty Content
```

## 🌐 Vercel Deployment

### 1. Mit Vercel verbinden

```powershell
vercel login
vercel
```

Folge den Anweisungen und wähle:
- Set up and deploy: `Yes`
- Which scope: Dein Account
- Link to existing project: `No`
- Project name: `telegram-onedrive-bot`
- Directory: `./`

### 2. Redis Storage einrichten

**WICHTIG:** Ohne Redis werden Topic-Mappings nicht persistent gespeichert und Topics werden bei jedem Neustart doppelt erstellt!

**Option A: Redis Cloud (empfohlen)**
1. Erstelle kostenlosen Account auf [redis.io](https://redis.io/cloud)
2. Erstelle eine neue Redis-Datenbank
3. Kopiere die Connection-URL (Format: `redis://default:password@host:port`)
4. Füge als Environment Variable hinzu: `REDIS_URL`

**Option B: Vercel KV (Alternative)**
1. Gehe zu: https://vercel.com/dashboard
2. Wähle dein Projekt → **Storage** Tab
3. Klicke auf **Create Database**
4. Wähle **KV (Redis)**
5. Gib einen Namen ein (z.B. "telegram-bot-storage")
6. Wähle die gleiche Region wie dein Deployment
7. Klicke auf **Create**
8. Vercel fügt automatisch diese Environment Variables hinzu:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

Der Bot priorisiert automatisch: `REDIS_URL` → Vercel KV → In-Memory (nicht persistent!)

### 3. Umgebungsvariablen setzen

**Benötigte Environment Variables:**

```powershell
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_CHAT_ID
vercel env add MICROSOFT_CLIENT_ID
vercel env add MICROSOFT_CLIENT_SECRET
vercel env add MICROSOFT_TENANT_ID
vercel env add SHAREPOINT_SITE_ID
vercel env add SHAREPOINT_DRIVE_ID
vercel env add ONEDRIVE_FOLDER_PATH
vercel env add RATE_LIMIT_DELAY
vercel env add REDIS_URL
```

Oder im Vercel Dashboard unter "Settings" → "Environment Variables"

**Wichtig:** Fügen Sie `REDIS_URL` hinzu für persistente Speicherung!

### 4. Deployen

```powershell
npm run deploy
```

Deine App ist jetzt live unter: `https://your-project.vercel.app`

## 📊 API Endpoints

### GET /api/status

Zeigt den aktuellen Bot-Status inkl. Upload-Geschwindigkeit und Runtime-Settings:

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/status" | ConvertFrom-Json
```

Response:
```json
{
  "healthy": true,
  "timestamp": "2025-10-15T12:00:00.000Z",
  "config": {
    "valid": true,
    "errors": []
  },
  "runtimeSettings": {
    "uploadDelay": 1000,
    "concurrentFolders": 15,
    "updatedAt": "2025-10-15T12:00:00.000Z",
    "note": "Änderbar via POST /api/settings"
  },
  "uploadSpeed": {
    "current": "12.50 files/sec",
    "average": "10.25 files/sec",
    "totalUploaded": 5000,
    "runningSince": "2025-10-15T11:00:00.000Z",
    "elapsedSeconds": 3600
  },
  "state": {
    "totalPostedFiles": 150,
    "totalTopicMappings": 5,
    "lastSync": "2025-10-13T11:55:00.000Z"
  },
  "topics": [
    {
      "folderName": "Urlaub 2025",
      "topicName": "Urlaub 2025",
      "topicId": 12345
    }
  ]
}
```

### POST /api/sync

Startet eine manuelle Synchronisierung:

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/sync" -Method POST | ConvertFrom-Json
```

Response:
```json
{
  "success": true,
  "stats": {
    "foldersScanned": 3,
    "filesFound": 45,
    "filesPosted": 12,
    "errors": 0,
    "duration": 15230
  },
  "timestamp": "2025-10-13T12:05:00.000Z"
}
```

### POST /api/force-unlock

Gibt einen hängenden Sync-Lock manuell frei (nützlich bei Fehlern):

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/force-unlock" -Method POST | ConvertFrom-Json
```

Response:
```json
{
  "success": true,
  "message": "Lock erfolgreich freigegeben",
  "previousLockStatus": {
    "locked": true,
    "age": 125000,
    "timestamp": 1697198400000
  },
  "currentLockStatus": {
    "locked": false
  }
}
```

### GET /api/settings

Zeigt aktuelle Runtime-Einstellungen:

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/settings" | ConvertFrom-Json
```

Response:
```json
{
  "success": true,
  "settings": {
    "uploadDelay": 1000,
    "concurrentFolders": 15,
    "updatedAt": 1728993600000
  }
}
```

### POST /api/settings

Ändert Upload-Einstellungen während des laufenden Betriebs:

```powershell
# Ändere Upload-Delay (100-10000ms)
$body = @{
  uploadDelay = 500
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://your-project.vercel.app/api/settings" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body | ConvertFrom-Json

# Ändere Anzahl paralleler Ordner (1-30)
$body = @{
  concurrentFolders = 20
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://your-project.vercel.app/api/settings" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body | ConvertFrom-Json

# Ändere beides gleichzeitig
$body = @{
  uploadDelay = 800
  concurrentFolders = 12
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://your-project.vercel.app/api/settings" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body | ConvertFrom-Json
```

Response:
```json
{
  "success": true,
  "settings": {
    "uploadDelay": 800,
    "concurrentFolders": 12,
    "updatedAt": 1728993700000
  },
  "message": "Einstellungen erfolgreich aktualisiert",
  "note": "Änderungen werden beim nächsten Sync-Chunk wirksam"
}
```

**Wichtig:** Einstellungsänderungen werden beim nächsten Batch/Chunk wirksam, nicht sofort für laufende Uploads.

## ⏱️ Automatische Synchronisierung

Die `vercel.json` ist bereits konfiguriert für automatische Synchronisierung alle 5 Minuten:

```json
{
  "crons": [
    {
      "path": "/api/sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Cron-Syntax:**
- `*/5 * * * *` - Alle 5 Minuten
- `0 */1 * * *` - Jede Stunde
- `0 9 * * *` - Täglich um 9:00 Uhr

Hinweis: Cron-Jobs benötigen einen Vercel Pro Account!

## 🔒 Sicherheit

- Alle sensiblen Daten werden in Umgebungsvariablen gespeichert
- Niemals Credentials im Code oder in Git committen
- Optional: Authentifizierung für `/api/sync` mit `SYNC_AUTH_TOKEN`

```env
SYNC_AUTH_TOKEN=your_secret_token
```

Dann beim Aufruf:

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/sync?token=your_secret_token" -Method POST
```

## 🌐 Webhook-Modus (WICHTIG!)

**Der Bot läuft im WEBHOOK-MODUS!**

Dies bedeutet:
- ✅ Telegram sendet Updates in Echtzeit an `/api/webhook`
- ✅ Kein Polling nötig (perfekt für Vercel Serverless)
- ⚠️ `getUpdates` API funktioniert NICHT (Error 409)
- ✅ Redis-Cache ist die primäre Quelle für Duplikat-Vermeidung

**Siehe:** [WEBHOOK_MODE.md](./WEBHOOK_MODE.md) für Details

## 🔄 Duplikat-Vermeidung

Der Bot verwendet ein mehrschichtiges System, um doppelte Uploads zu verhindern:

### 1. Redis File-ID Check (Primär)
Jede hochgeladene Datei wird mit ihrer OneDrive-ID in Redis gespeichert (`file:{fileId}`). Bei jedem Sync wird zuerst geprüft, ob die File-ID bereits existiert.

### 2. Topic-Files Cache (Sekundär)
Zusätzlich wird eine Liste aller Dateinamen pro Topic gespeichert (`topic_files:{topicId}`). Dies dient als Backup-Prüfung, falls Redis gelöscht wurde.

### 3. Topic-Scan bei jedem Sync
Bei jedem Sync werden die letzten ~100 Nachrichten aus jedem Topic gescannt und mit dem Cache abgeglichen. Neue Dateien werden automatisch zum Cache hinzugefügt.

### 4. Keine Topic-Duplikate
Vor der Erstellung eines neuen Topics wird geprüft, ob bereits ein Mapping für diesen Ordner existiert. Topic-IDs werden validiert um Konflikte zu vermeiden.

### 5. Store-Konsistenz
Alle wichtigen Daten werden sowohl in Redis als auch im Fallback-Store (bot_state) gespeichert. Bei Fehlern wird ein Rollback durchgeführt.

**Wichtig:** Diese Mechanismen funktionieren am besten mit aktiviertem Redis! Ohne Redis können nach einem Deployment-Neustart Duplikate entstehen (werden aber beim nächsten Sync erkannt und übersprungen).

## �🗄️ Datenspeicherung

Der Bot nutzt standardmäßig einen In-Memory Store. Für Production wird empfohlen:

### Option 1: Vercel KV (empfohlen)

1. Aktiviere Vercel KV in deinem Projekt-Dashboard
2. Die Umgebungsvariablen werden automatisch gesetzt
3. Der Bot erkennt automatisch Vercel KV und nutzt es

### Option 2: Externe Datenbank

Du kannst den Store in `lib/store.ts` anpassen, um eine externe Datenbank zu nutzen:
- PostgreSQL (z.B. Vercel Postgres)
- MongoDB
- Redis

## 📝 Projektstruktur

```
telegram-onedrive-bot/
├── api/
│   ├── sync.ts          # Hauptsynchronisierung
│   ├── status.ts        # Status-Endpoint
│   └── webhook.ts       # Telegram Webhook (optional)
├── lib/
│   ├── bot.ts           # Telegram Bot API
│   ├── config.ts        # Konfigurationsverwaltung
│   ├── onedrive.ts      # OneDrive/Graph API
│   ├── store.ts         # Datenspeicherung
│   ├── sync.ts          # Synchronisierungslogik
│   ├── topicManager.ts  # Topic-Verwaltung
│   └── types.ts         # TypeScript-Typen
├── package.json
├── tsconfig.json
├── vercel.json
├── .env.example
└── README.md
```

## 🐛 Troubleshooting

### Bot postet nicht in Topics

1. Stelle sicher, dass die Telegram-Gruppe Forum-Topics aktiviert hat
2. Der Bot muss Admin-Rechte haben
3. Prüfe die Logs: `vercel logs`

### Microsoft Graph API Fehler

1. Überprüfe, ob alle Permissions gewährt wurden
2. "Grant admin consent" im Azure Portal klicken
3. Client Secret könnte abgelaufen sein (max. 24 Monate)

### Rate Limiting & Performance

**Telegram Bot API Limits:**
- **20 messages/minute pro Topic** (kritisches Limit)
- **30 messages/second gesamt** (über alle Topics hinweg)

**Aktuelle Optimierung (ABSOLUTE MAXIMUM!):**
- ✅ **15 parallele Topics** - Maximale Parallelisierung! 🚀
- ✅ **1 Sekunde Delay** - Schnellst möglich (Processing-Overhead verhindert 429)
- ✅ **Performance: 18.000 Dateien/Stunde** - 15x schneller als sequenziell! 🚀🚀🚀
- ✅ **Intelligentes Retry** - Automatische Behandlung von seltenen 429 Errors
- ✅ **Optimierte OneDrive API** - Keine unnötigen Verzögerungen

**Effektive Rate:**
```
15 Topics parallel mit 1s Delay + Processing-Overhead
= Praktisch unter Telegram Limits durch Verarbeitungszeit
= Automatische 429-Behandlung für maximale Sicherheit
```

**Beispiel-Performance:**
```
1.000 Dateien → ~3.3 Minuten ⚡⚡⚡
10.000 Dateien → ~33 Minuten ⚡⚡⚡
20.000 Dateien → ~1.1 Stunden ⚡⚡⚡
```

**📖 Siehe:** [TELEGRAM_LIMITS_OPTIMIZATION.md](./TELEGRAM_LIMITS_OPTIMIZATION.md) für Details

### Vercel Timeout / Function Max Duration

**Problem:** "Function invocation timed out" oder "504 Gateway Timeout"

**Ursache:** Synchronisierung dauert länger als erlaubte Function-Dauer (300s / 5 Min)

**✅ Lösung: Automatisches Chunked Processing (FIXED!)**

Der Bot nutzt **automatisches Chunked Processing mit garantierter Fortsetzung**:
- Verarbeitet in **3.8-Minuten-Chunks** (deutlich unter 5-Min-Limit!)
- **Wartet auf Request-Initiierung** bevor Response gesendet wird (Fix für Vercel!)
- Nutzt separaten `/api/continue-sync` Endpoint für Fortsetzungen
- Kann beliebig lange Syncs (5-6 Stunden) durchführen
- **Fehler in einem Ordner stoppen nicht die anderen** (Promise.allSettled)
- **Automatisches Retry bei Fehlern** (bis zu 5 Versuche)
- **Lock wird garantiert freigegeben** (auch bei Fehlern)

**Wichtig: Garantierte Request-Initiierung**
```typescript
// Request wird gesendet UND wir warten auf Initiierung
const fetchPromise = fetch('/api/continue-sync', {
  signal: AbortSignal.timeout(2000)
});

// Warte max 500ms dass Request gestartet ist
await Promise.race([fetchPromise, new Promise(r => setTimeout(r, 500))]);

// Jetzt Response senden - Request läuft bereits!
return res.status(202).json({ needsContinuation: true });
```

**Konfiguration in vercel.json:**
```json
{
  "functions": {
    "api/sync.ts": { "maxDuration": 300 },  // 5 Minuten
    "api/continue-sync.ts": { "maxDuration": 300 },  // 5 Minuten
    "api/status.ts": { "maxDuration": 60 }   // 1 Minute
  }
}
```

**Status während langer Syncs:**
```powershell
# Zeigt aktuellen Fortschritt
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/status" | ConvertFrom-Json

# Beispiel-Output mit Progress:
# "progress": {
#   "currentFolder": 15,
#   "totalFolders": 42,
#   "percentComplete": 35.7
# }
```

**Bei Problemen:**

1. **Lock hängt?** Manuelles Release:
   ```powershell
   Invoke-WebRequest -Uri "https://your-project.vercel.app/api/force-unlock" -Method POST
   ```

2. **Fehler wiederholen sich?** Der Bot macht automatisch bis zu 5 Retry-Versuche mit:
   - Intelligenter Wartezeit bei Rate Limits (basierend auf Telegram-Antwort)
   - 5 Sekunden Pause bei Timeouts
   - 10 Sekunden Pause bei Netzwerkfehlern
   - Automatisches Überspringen bei permanenten Fehlern

3. **Optimierung anpassen:**
   ```typescript
   // In lib/sync.ts
   const CONCURRENT = 15;       // Mehr parallel = schneller (empfohlen: 10-15)
   const MAX_EXECUTION_TIME = 3.8 * 60 * 1000;  // 3.8 Min pro Chunk (sicherer Puffer!)
   const maxRetries = 5;        // Anzahl Retry-Versuche bei Fehlern
   ```

**Erfordert Vercel Pro Plan!**

**📖 Siehe:**
- [VERCEL_TIMEOUT.md](./VERCEL_TIMEOUT.md) - Timeout Details
- [CHUNKED_PROCESSING.md](./CHUNKED_PROCESSING.md) - Wie Chunking funktioniert
- [LOCK_PROBLEM.md](./LOCK_PROBLEM.md) - Lock-Probleme beheben

## 📚 Weitere Ressourcen

- [Telegram Bot API Dokumentation](https://core.telegram.org/bots/api)
- [Microsoft Graph API Dokumentation](https://learn.microsoft.com/en-us/graph/api/overview)
- [Vercel Dokumentation](https://vercel.com/docs)

## 📄 Lizenz

MIT License

## 🤝 Unterstützung

Bei Problemen oder Fragen:
1. Prüfe die Logs: `vercel logs`
2. Teste lokal: `npm run dev`
3. Überprüfe die Umgebungsvariablen

---

Erstellt mit ❤️ für automatische OneDrive zu Telegram Synchronisierung
