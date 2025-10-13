# OneDrive zu Telegram Bot - Schnellstart

## ✅ Installation erfolgreich abgeschlossen!

### Nächste Schritte:

#### 1. Umgebungsvariablen konfigurieren

Bearbeiten Sie die Datei `.env` und tragen Sie Ihre Credentials ein:

```powershell
notepad .env
```

Sie benötigen:
- **Telegram Bot Token**: Von @BotFather erhalten
- **Telegram Chat ID**: ID der Gruppe mit aktivierten Topics
- **Microsoft Client ID, Secret & Tenant ID**: Von Azure Portal

#### 2. Lokalen Dev-Server starten

```powershell
npm run dev
```

Der Server läuft dann auf `http://localhost:3000`

#### 3. Endpoints testen

**Status abfragen:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/status" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Synchronisierung starten:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/sync" -Method POST | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

#### 4. Auf Vercel deployen

```powershell
# Login (einmalig)
vercel login

# Projekt deployen
vercel

# Umgebungsvariablen setzen
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_CHAT_ID
vercel env add MICROSOFT_CLIENT_ID
vercel env add MICROSOFT_CLIENT_SECRET
vercel env add MICROSOFT_TENANT_ID
vercel env add ONEDRIVE_FOLDER_PATH

# Production Deployment
vercel --prod
```

### 📚 Weitere Informationen

Siehe `README.md` für detaillierte Dokumentation:
```powershell
notepad README.md
```

### 🎯 Projektstruktur

```
telegram-onedrive-bot/
├── api/              # Vercel Serverless Functions
│   ├── sync.ts      # Hauptsynchronisierung
│   ├── status.ts    # Status-Endpoint  
│   └── webhook.ts   # Telegram Webhook
├── lib/              # Bibliotheken
│   ├── bot.ts       # Telegram Bot
│   ├── onedrive.ts  # OneDrive Client
│   ├── sync.ts      # Sync-Logik
│   ├── store.ts     # Datenspeicherung
│   └── ...
└── ...
```

### ⚡ Wichtige Hinweise

- **Telegram-Gruppe**: Muss Forum-Topics aktiviert haben
- **Bot-Rechte**: Bot muss Admin in der Gruppe sein
- **Azure-Permissions**: `Files.Read.All` muss gewährt sein
- **Vercel Crons**: Benötigen einen Pro Account

### 🐛 Bei Problemen

```powershell
# Logs anzeigen (nach Vercel Deployment)
vercel logs

# TypeScript kompilieren
npm run build
```

Viel Erfolg! 🚀
