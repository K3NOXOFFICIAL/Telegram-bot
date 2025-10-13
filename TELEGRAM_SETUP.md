# 🤖 Telegram Bot Setup - Schritt-für-Schritt Anleitung

Diese Anleitung hilft Ihnen, einen Telegram Bot zu erstellen und mit Forum-Topics zu konfigurieren.

## Schritt 1: Bot erstellen

1. **BotFather öffnen:**
   - Öffnen Sie Telegram
   - Suchen Sie nach `@BotFather`
   - Starten Sie den Chat

2. **Neuen Bot erstellen:**
   ```
   /newbot
   ```

3. **Bot-Namen eingeben:**
   - BotFather fragt nach einem Namen für Ihren Bot
   - Beispiel: `OneDrive Media Bot`

4. **Bot-Username eingeben:**
   - Muss auf `bot` enden
   - Muss einzigartig sein
   - Beispiel: `onedrive_media_sync_bot`

5. **Bot Token kopieren:**
   - BotFather sendet Ihnen einen Token
   - Format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
   - ⚠️ **Wichtig:** Halten Sie diesen Token geheim!
   - Dies ist Ihre `TELEGRAM_BOT_TOKEN`

## Schritt 2: Telegram-Gruppe erstellen

1. **Neue Gruppe erstellen:**
   - In Telegram: Klicken Sie auf "Neue Gruppe"
   - Name: z.B. `OneDrive Medien`
   - Fügen Sie mindestens 1 weiteres Mitglied hinzu (kann später entfernt werden)

2. **In Supergruppe umwandeln:**
   - Öffnen Sie die Gruppeneinstellungen (⋮)
   - Gehen Sie zu "Gruppe bearbeiten" oder "Edit"
   - Tippen Sie auf "Gruppentyp"
   - Wählen Sie "Öffentlich" aus (kann später wieder auf Privat gesetzt werden)
   - Die Gruppe ist jetzt eine Supergruppe

3. **Forum-Topics aktivieren:**
   - Öffnen Sie die Gruppeneinstellungen
   - Tippen Sie auf "Topics" oder "Themen"
   - Aktivieren Sie "Topics"
   - ✅ Die Gruppe unterstützt jetzt Forum-Topics!

## Schritt 3: Bot zur Gruppe hinzufügen

1. **Bot hinzufügen:**
   - Öffnen Sie Ihre Gruppe
   - Tippen Sie auf den Gruppennamen (oben)
   - Wählen Sie "Mitglied hinzufügen"
   - Suchen Sie nach dem Username Ihres Bots (z.B. `@onedrive_media_sync_bot`)
   - Fügen Sie ihn hinzu

2. **Bot zum Admin machen:**
   - Gruppeneinstellungen öffnen
   - Gehen Sie zu "Administratoren"
   - Tippen Sie auf "Administrator hinzufügen"
   - Wählen Sie Ihren Bot aus
   - **Wichtige Berechtigungen aktivieren:**
     - ✅ Nachrichten löschen
     - ✅ Nachrichten posten
     - ✅ Medien senden
     - ✅ Topics verwalten (sehr wichtig!)
   - Speichern Sie die Änderungen

## Schritt 4: Chat-ID ermitteln

### Methode 1: Mit @getidsbot (Einfachste Methode)

1. Suchen Sie in Telegram nach `@getidsbot`
2. Starten Sie den Bot mit `/start`
3. Leiten Sie eine beliebige Nachricht aus Ihrer Gruppe an @getidsbot weiter
4. Der Bot zeigt Ihnen die Chat-ID an
5. Format: `-1001234567890` (negativ und sehr lang)

### Methode 2: Mit JSON Info Bot

1. Suchen Sie nach `@JsonDumpBot`
2. Fügen Sie den Bot temporär zu Ihrer Gruppe hinzu
3. Senden Sie eine Nachricht in die Gruppe (z.B. `/start`)
4. Der Bot antwortet mit JSON-Daten
5. Suchen Sie nach `"chat": { "id": -1001234567890 }`
6. Entfernen Sie den Bot wieder aus der Gruppe

### Methode 3: Über die Telegram Bot API

1. Fügen Sie Ihren Bot zur Gruppe hinzu
2. Senden Sie eine Nachricht in die Gruppe (z.B. `/start@your_bot_username`)
3. Öffnen Sie in Ihrem Browser:
   ```
   https://api.telegram.org/bot<IHR_BOT_TOKEN>/getUpdates
   ```
4. Ersetzen Sie `<IHR_BOT_TOKEN>` mit Ihrem echten Token
5. Suchen Sie in der JSON-Antwort nach `"chat":{"id":-1001234567890...}`

## Schritt 5: Werte in .env eintragen

Öffnen Sie die `.env` Datei:

```powershell
notepad s:\Coding\Telegram-bot\.env
```

Tragen Sie die Werte ein:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
```

**Wichtig:**
- Bot Token ohne Leerzeichen
- Chat ID ist negativ und sehr lang (ca. 13-14 Zeichen)
- Keine Anführungszeichen verwenden

## Schritt 6: Testen

### Lokaler Test:

```powershell
cd s:\Coding\Telegram-bot
npm run dev
```

In einem anderen Terminal:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/status" | ConvertFrom-Json
```

### Test-Nachricht senden:

Erstellen Sie eine Test-Datei `test-message.ts`:

```typescript
import 'dotenv/config';
import { TelegramBot } from './lib/bot';
import { loadConfig } from './lib/config';

const config = loadConfig();
const bot = new TelegramBot(config);

bot.sendMessage('🎉 Bot erfolgreich konfiguriert!').then(msg => {
  if (msg) {
    console.log('✅ Nachricht gesendet!');
  } else {
    console.error('❌ Fehler beim Senden');
  }
});
```

Ausführen:

```powershell
npx tsx test-message.ts
```

## Schritt 7: Topics testen

Der Bot erstellt automatisch Topics basierend auf OneDrive-Ordnernamen. Zum manuellen Test:

```powershell
npm run test-local
```

Der Bot wird:
1. OneDrive-Unterordner scannen
2. Für jeden Ordner ein Topic erstellen
3. Medien in die entsprechenden Topics posten

## Troubleshooting

### Fehler: "Unauthorized"

**Problem:** Bot Token ist ungültig.

**Lösung:**
- Überprüfen Sie den Token in `.env`
- Kopieren Sie ihn erneut von @BotFather
- Achten Sie auf Leerzeichen am Anfang/Ende

### Fehler: "Chat not found"

**Problem:** Chat ID ist falsch oder Bot ist nicht in der Gruppe.

**Lösung:**
1. Überprüfen Sie die Chat ID (muss negativ sein)
2. Stellen Sie sicher, dass der Bot in der Gruppe ist
3. Ermitteln Sie die ID erneut (siehe Schritt 4)

### Fehler: "Not enough rights to manage topics"

**Problem:** Bot hat keine Admin-Rechte oder Topics-Permission.

**Lösung:**
1. Machen Sie den Bot zum Admin
2. Aktivieren Sie "Topics verwalten" in den Admin-Rechten
3. Entfernen Sie den Bot und fügen Sie ihn erneut hinzu

### Bot erstellt keine Topics

**Problem:** Forum-Topics sind nicht aktiviert.

**Lösung:**
1. Gruppeneinstellungen öffnen
2. "Topics" aktivieren
3. Falls nicht verfügbar: Gruppe muss eine Supergruppe sein

### Bot postet nicht

**Problem:** Fehlende Berechtigungen.

**Lösung:**
1. Überprüfen Sie Admin-Rechte des Bots
2. Aktivieren Sie "Nachrichten posten" und "Medien senden"
3. Prüfen Sie die Logs: `vercel logs` (nach Deployment)

## Bot-Befehle (Optional)

Sie können zusätzliche Befehle für Ihren Bot bei @BotFather setzen:

```
/setcommands
```

Dann:

```
sync - Manuelle Synchronisierung starten
status - Bot-Status anzeigen
help - Hilfe anzeigen
```

## Datenschutz & Sicherheit

🔒 **Wichtig:**
- Bot Token niemals öffentlich teilen
- `.env` Datei nicht in Git committen
- Verwenden Sie Vercel Environment Variables im Production
- Bot kann alle Nachrichten in der Gruppe lesen (Privacy Mode)

### Privacy Mode anpassen (Optional):

Bei @BotFather:
```
/setprivacy
```

- `Enabled`: Bot sieht nur Befehle und Erwähnungen
- `Disabled`: Bot sieht alle Nachrichten (Standard)

## Nützliche Links

- [Telegram Bot API Dokumentation](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots/features#botfather)
- [Forum Topics](https://telegram.org/blog/topics-in-groups-collectible-usernames)

---

Bei weiteren Fragen: Siehe `README.md` im Projekt-Ordner.
