# 📦 Projekt erfolgreich erstellt!

## ✨ Was wurde erstellt?

Ein vollständiges, produktionsreifes TypeScript-Projekt für automatische OneDrive zu Telegram Synchronisation.

## 📁 Projektstruktur

```
telegram-onedrive-bot/
│
├── 📄 Konfigurationsdateien
│   ├── package.json          # Node.js Dependencies und Scripts
│   ├── tsconfig.json          # TypeScript Konfiguration
│   ├── vercel.json            # Vercel Deployment & Cron-Jobs
│   ├── .env                   # Umgebungsvariablen (lokal)
│   ├── .env.example           # Beispiel-Konfiguration
│   └── .gitignore             # Git Ignore Rules
│
├── 🚀 API Endpoints (Vercel Serverless Functions)
│   ├── api/sync.ts            # Hauptsynchronisierung (manuell + Cron)
│   ├── api/status.ts          # Status & Health Check
│   └── api/webhook.ts         # Telegram Webhook (optional)
│
├── 📚 Bibliotheken
│   ├── lib/types.ts           # TypeScript Typdefinitionen
│   ├── lib/config.ts          # Konfigurationsverwaltung
│   ├── lib/bot.ts             # Telegram Bot API Client
│   ├── lib/onedrive.ts        # Microsoft Graph API Client
│   ├── lib/store.ts           # Persistente Datenspeicherung
│   ├── lib/sync.ts            # Synchronisierungslogik
│   └── lib/topicManager.ts    # Telegram Topics Verwaltung
│
├── 📖 Dokumentation
│   ├── README.md              # Hauptdokumentation
│   ├── QUICKSTART.md          # Schnellstart-Anleitung
│   ├── TELEGRAM_SETUP.md      # Telegram Bot Setup
│   └── AZURE_SETUP.md         # Azure App Registration
│
└── 🧪 Testing
    └── test-local.ts          # Lokales Test-Skript

```

## 🎯 Hauptfunktionen

✅ **OneDrive Überwachung**
- Scannt automatisch einen konfigurierten OneDrive-Ordner
- Erkennt neue Unterordner

✅ **Automatische Topic-Erstellung**
- Erstellt Telegram Topics basierend auf Ordnernamen
- Nutzt existierende Topics wieder

✅ **Medien-Upload**
- Postet Bilder und Videos automatisch
- Unterstützt: JPG, PNG, GIF, MP4, MOV, etc.

✅ **Duplikat-Vermeidung**
- Speichert gepostete Dateien persistent
- Verwendet Vercel KV oder In-Memory Store

✅ **Rate Limiting**
- Konfigurierbare Verzögerung zwischen Posts
- Verhindert Telegram API Limits

✅ **Vercel-kompatibel**
- Serverless Functions
- Automatische Cron-Jobs
- Environment Variables

## 🚀 Schnellstart

### 1. Dependencies installieren

```powershell
cd s:\Coding\Telegram-bot
npm install
```

✅ **Bereits erledigt!**

### 2. Umgebungsvariablen konfigurieren

```powershell
notepad .env
```

Siehe:
- [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md) für Bot Token & Chat ID
- [AZURE_SETUP.md](./AZURE_SETUP.md) für Microsoft Credentials

### 3. Lokal testen

```powershell
# Status prüfen
npm run dev
# In anderem Terminal:
Invoke-WebRequest -Uri "http://localhost:3000/api/status" | ConvertFrom-Json

# Synchronisierung testen
npm run test-local
```

### 4. Auf Vercel deployen

```powershell
# Login
vercel login

# Deploy
vercel

# Production
vercel --prod
```

## 📊 Verfügbare Scripts

```powershell
# Entwicklungs-Server starten
npm run dev

# TypeScript kompilieren
npm run build

# Lokaler Sync-Test
npm run test-local
# oder
npm run sync

# Production Deployment
npm run deploy
```

## 🌐 API Endpoints

Nach dem Deployment:

### GET /api/status
Zeigt Bot-Status, Konfiguration und Statistiken

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/status"
```

### POST /api/sync
Startet manuelle Synchronisierung

```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/sync" -Method POST
```

### POST /api/webhook
Telegram Webhook Endpoint (optional)

## ⚙️ Konfiguration

### Umgebungsvariablen (.env)

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Microsoft Graph
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=your_tenant_id

# OneDrive
ONEDRIVE_FOLDER_PATH=/Fotos

# Optionen
RATE_LIMIT_DELAY=2000
```

### Vercel Cron-Jobs (vercel.json)

Standardmäßig: Alle 5 Minuten

```json
"crons": [
  {
    "path": "/api/sync",
    "schedule": "*/5 * * * *"
  }
]
```

Anpassbar:
- `*/5 * * * *` - Alle 5 Minuten
- `0 * * * *` - Jede Stunde
- `0 9 * * *` - Täglich um 9 Uhr

**Hinweis:** Cron-Jobs benötigen Vercel Pro!

## 🔐 Sicherheit

✅ Alle Credentials in Umgebungsvariablen
✅ `.env` ist in `.gitignore`
✅ Keine Passwörter im Code
✅ Optional: Auth Token für `/api/sync`

## 🗄️ Datenspeicherung

**Standard:** In-Memory Store (für Entwicklung)
**Production:** Vercel KV (automatisch erkannt)

Optional: Eigene Datenbank (PostgreSQL, MongoDB, Redis)

## 📦 Dependencies

### Production:
- `axios` - HTTP Client
- `@microsoft/microsoft-graph-client` - OneDrive API
- `@vercel/kv` - Persistente Speicherung
- `form-data` - Multipart Uploads
- `dotenv` - Environment Variables

### Development:
- `typescript` - TypeScript Compiler
- `@vercel/node` - Vercel Types
- `tsx` - TypeScript Executor
- `@types/node` - Node.js Types

## 🐛 Troubleshooting

### TypeScript Fehler

```powershell
npm run build
```

Sollte ohne Fehler durchlaufen.

### Lokale Tests schlagen fehl

1. Prüfen Sie `.env` Datei
2. Validieren Sie Bot Token & Chat ID
3. Testen Sie Azure Credentials

```powershell
npm run test-local
```

### Vercel Deployment Probleme

```powershell
# Logs anzeigen
vercel logs

# Environment Variables prüfen
vercel env ls
```

## 📚 Dokumentation

- **[README.md](./README.md)** - Hauptdokumentation
- **[QUICKSTART.md](./QUICKSTART.md)** - Schnellstart
- **[TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md)** - Bot Setup
- **[AZURE_SETUP.md](./AZURE_SETUP.md)** - Azure Setup

## 🎓 Nächste Schritte

1. ✅ **Telegram Bot erstellen** → [TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md)
2. ✅ **Azure App registrieren** → [AZURE_SETUP.md](./AZURE_SETUP.md)
3. ✅ **.env konfigurieren**
4. ✅ **Lokal testen** → `npm run test-local`
5. ✅ **Auf Vercel deployen** → `vercel`

## 💡 Tipps

### Große Mediensammlungen
- Erhöhen Sie `RATE_LIMIT_DELAY` (z.B. 3000ms)
- Nutzen Sie Vercel Pro für längere Function-Timeouts

### Mehrere OneDrive-Ordner
- Duplizieren Sie das Projekt
- Oder erweitern Sie die Logik für mehrere Pfade

### Benachrichtigungen
- Passen Sie `lib/sync.ts` an
- Senden Sie Zusammenfassung nach jedem Sync

### Monitoring
- Nutzen Sie `/api/status` für Health Checks
- Integrieren Sie Monitoring-Tools (z.B. Uptime Robot)

## 🤝 Support

Bei Fragen:
1. Prüfen Sie die Dokumentation
2. Testen Sie lokal mit `npm run dev`
3. Überprüfen Sie Logs mit `vercel logs`

## 📄 Lizenz

MIT License - Frei verwendbar für private und kommerzielle Projekte

---

**Viel Erfolg mit Ihrem OneDrive zu Telegram Bot! 🚀**
