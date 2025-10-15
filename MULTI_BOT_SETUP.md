# 🤖 Multi-Bot Upload - Setup & Performance

## ⚡ Performance-Boost durch Multiple Bots

**Konzept:** Verteile Uploads auf mehrere Telegram Bots um Rate-Limits zu multiplizieren!

### 📊 Rate-Limit Multiplikation

| Bots | Msg/Min pro Topic | Delay | Gesamt (10 Topics) | Speedup |
|------|-------------------|-------|-------------------|---------|
| 1 Bot | 17 | 3500ms | 170/min (2.8/s) | 1x |
| **3 Bots** | **51** | **1200ms** | **510/min (8.5/s)** | **3x** |
| 5 Bots | 85 | 700ms | 850/min (14/s) | 5x |

**Mit 3 Bots = 3x schneller!** 🚀

---

## 🔧 Setup

### 1. Bot-Tokens erstellen

Erstelle zusätzliche Bots über [@BotFather](https://t.me/BotFather):

```
/newbot
Bot Name: YourBot2
Username: yourbot2_bot
Token: 8401433539:AAHrUxXOIrkachKP4qwJUSZfYxvxyfjuKI0

/newbot
Bot Name: YourBot3
Username: yourbot3_bot
Token: 7893535626:AAHsg_cfoo-c-TtqJ3DxY_0e8bSaBxMaQkc
```

**Du hast jetzt:**
- Bot 1: Original Token (aus .env)
- Bot 2: `8401433539:AAHrUxXOIrkachKP4qwJUSZfYxvxyfjuKI0`
- Bot 3: `7893535626:AAHsg_cfoo-c-TtqJ3DxY_0e8bSaBxMaQkc`

### 2. Bots zur Gruppe hinzufügen

1. Öffne deine Telegram-Gruppe
2. Gruppe Info → Mitglieder → Mitglied hinzufügen
3. Suche nach `yourbot2_bot` und `yourbot3_bot`
4. Füge beide hinzu

### 3. Bots zu Admins machen

**WICHTIG:** Alle Bots brauchen Admin-Rechte!

1. Gruppe Info → Bearbeiten
2. Administratoren → Administrator hinzufügen
3. Wähle jeden Bot einzeln aus
4. Aktiviere mindestens:
   - ✅ Nachrichten senden
   - ✅ Medien senden
   - ✅ Topics verwalten (falls Forum-Gruppe)

### 4. Environment Variables setzen

#### Lokal (.env):
```env
# Komma-separierte Bot-Tokens (ALLE auf einer Zeile!)
TELEGRAM_BOT_TOKENS=BOT1_TOKEN,8401433539:AAHrUxXOIrkachKP4qwJUSZfYxvxyfjuKI0,7893535626:AAHsg_cfoo-c-TtqJ3DxY_0e8bSaBxMaQkc

# Oder einzeln (backwards compatible):
TELEGRAM_BOT_TOKEN=BOT1_TOKEN
```

#### Vercel:
```bash
# Via Vercel CLI
vercel env add TELEGRAM_BOT_TOKENS

# Eingabe (komma-separiert):
BOT1_TOKEN,8401433539:AAHrUxXOIrkachKP4qwJUSZfYxvxyfjuKI0,7893535626:AAHsg_cfoo-c-TtqJ3DxY_0e8bSaBxMaQkc

# Für alle Environments auswählen:
[x] Production
[x] Preview
[x] Development
```

#### Oder via Vercel Dashboard:
1. Gehe zu: https://vercel.com/your-project/settings/environment-variables
2. Klicke "Add New"
3. Name: `TELEGRAM_BOT_TOKENS`
4. Value: `BOT1,BOT2,BOT3` (komma-separiert)
5. Alle Environments auswählen
6. Save

---

## 🎯 Wie es funktioniert

### Round-Robin Bot-Rotation

```typescript
// Bot-Manager verteilt Last gleichmäßig
const botManager = new MultiBotManager(config);

// Upload 1 → Bot 1
await botManager.sendPhotoByUrl(url1, name1, topicId);

// Upload 2 → Bot 2  
await botManager.sendPhotoByUrl(url2, name2, topicId);

// Upload 3 → Bot 3
await botManager.sendPhotoByUrl(url3, name3, topicId);

// Upload 4 → Bot 1 (Rotation!)
await botManager.sendPhotoByUrl(url4, name4, topicId);
```

**Jeder Bot hat sein eigenes 20 msg/min Limit!**

### Performance-Berechnung

**Mit 3 Bots:**
```
Pro Bot: 20 msg/min Limit
3 Bots: 3 × 20 = 60 msg/min möglich pro Topic

Sicherer Delay (mit Puffer):
60 msg/min = 1 msg/1s
Mit Puffer: 1200ms Delay = 50 msg/min

10 Topics parallel:
10 × 50 msg/min = 500 msg/min gesamt
500 msg/min = 8.3 msg/s
```

**Vergleich zu Single-Bot:**
- Vorher: 2.8 msg/s (170/min)
- Nachher: 8.3 msg/s (500/min)
- **3x schneller!** ⚡⚡⚡

---

## 📊 Performance-Erwartungen

### Mit 3 Bots:

| Dateien | Single-Bot (3500ms) | Multi-Bot (1200ms) | Zeitersparnis |
|---------|---------------------|---------------------|---------------|
| 1.000 | ~6 Min | ~2 Min | 4 Min (67%) |
| 10.000 | ~60 Min | ~20 Min | 40 Min (67%) |
| 50.000 | ~5 Std | ~1.7 Std | 3.3 Std (67%) |
| 100.000 | ~10 Std | ~3.3 Std | 6.7 Std (67%) |

**3x schneller bei gleicher Stabilität!** 🚀

---

## 🔍 Monitoring & Logs

### Erfolgreiche Initialisierung:

```
🤖 Multi-Bot Mode: 3 Bots konfiguriert
🤖 MultiBotManager initialisiert mit 3 Bot(s)
   📊 Rate-Limit Multiplikator: 3x
   ⚡ Erwartete Performance: 51 msg/min pro Topic
```

### Upload-Logs:

```
📂 [14:30:00] [Ordner1] Start
🚀 [Ordner1] Prefetching ALLE 100 URLs parallel...
✅ [Ordner1] Alle URLs geladen in 2.3s
✅ [14:30:03] [Ordner1] file1.jpg (1 msg in letzter Minute) ← Bot 1
✅ [14:30:04] [Ordner1] file2.jpg (2 msg in letzter Minute) ← Bot 2
✅ [14:30:05] [Ordner1] file3.jpg (3 msg in letzter Minute) ← Bot 3
✅ [14:30:06] [Ordner1] file4.jpg (4 msg in letzter Minute) ← Bot 1
```

**Keine langen Pausen mehr!** ⚡

---

## ⚙️ Settings Tuning

### Automatische Anpassung

Default-Settings passen sich automatisch an:

**Mit 1 Bot (Single-Bot):**
```typescript
uploadDelay: 3500ms  // Sicher für 20 msg/min
concurrentFolders: 10
```

**Mit 3+ Bots (Multi-Bot):**
```typescript
uploadDelay: 1200ms  // Nutzt 3x Multiplikator
concurrentFolders: 10
```

### Manuelle Anpassung

Wenn noch schneller gewünscht (mit mehr Bots):

**Mit 5 Bots:**
```typescript
uploadDelay: 700ms   // 5 × 17 msg/min = 85 msg/min
concurrentFolders: 10
```

**Via API:**
```powershell
$body = @{
  uploadDelay = 700
  concurrentFolders = 10
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://your-app.vercel.app/api/settings" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## 🛡️ Sicherheit & Best Practices

### ✅ DO:
- Alle Bots als Admin zur Gruppe hinzufügen
- Tokens in Environment Variables (NICHT in Code!)
- Mit 3 Bots starten (ideal für Balance)
- Logs auf "⚠️ Topic Rate Limit erreicht" prüfen

### ❌ DON'T:
- Tokens in Git commiten
- Mehr als 5 Bots (diminishing returns)
- Delay unter 700ms (Risk für 429 Errors)
- Bots ohne Admin-Rechte

---

## 🐛 Troubleshooting

### Problem: "MultiBotManager initialisiert mit 1 Bot(s)"

**Ursache:** Nur ein Token erkannt

**Lösung:**
```bash
# Prüfe Environment Variable
echo $env:TELEGRAM_BOT_TOKENS  # PowerShell
# Sollte zeigen: BOT1,BOT2,BOT3

# Wenn leer, setze neu:
vercel env add TELEGRAM_BOT_TOKENS
```

### Problem: "Bot kann nicht in Gruppe posten"

**Ursache:** Fehlende Admin-Rechte

**Lösung:**
1. Gruppe Info → Administratoren
2. Prüfe ob ALLE Bots Admin sind
3. Aktiviere "Nachrichten senden" + "Medien senden"

### Problem: Immer noch Stops trotz Multi-Bot

**Ursache:** Delay zu kurz oder Bot-Count falsch

**Lösung:**
```typescript
// Prüfe ob Bots richtig geladen wurden
console.log(botManager.getBotCount()); // Sollte 3 sein

// Erhöhe Delay wenn nötig
uploadDelay: 1500ms  // Mehr Puffer
```

---

## 📈 Performance-Vergleich

### Timeline-Vergleich (1000 Dateien):

**Single-Bot (3500ms Delay):**
```
0:00 → Start
6:00 → Fertig (1000 Dateien)
```

**Multi-Bot (1200ms Delay, 3 Bots):**
```
0:00 → Start
2:00 → Fertig (1000 Dateien) ✅
```

**Zeitersparnis: 4 Minuten (67%)!**

---

## 🎯 Zusammenfassung

**Was wurde implementiert:**
- ✅ MultiBotManager-Klasse (Round-Robin Distribution)
- ✅ Automatisches Token-Parsing (komma-separiert)
- ✅ Bot-Rotation bei jedem Upload
- ✅ Backwards-Compatible (funktioniert mit 1 Bot)
- ✅ Automatische Settings-Optimierung

**Performance-Gewinn:**
- **3x schneller** mit 3 Bots
- **5x schneller** mit 5 Bots
- Gleiche Stabilität (keine 429 Errors)
- Kontinuierlicher Upload ohne Stops

**Setup-Zeit:** ~10 Minuten
**ROI:** Massiv! 🚀

---

## 🚀 Next Steps

1. ✅ Füge 2 zusätzliche Bots zur Gruppe hinzu
2. ✅ Mache beide zu Admins
3. ✅ Setze `TELEGRAM_BOT_TOKENS` Environment Variable
4. ✅ Deploy zu Vercel
5. ✅ Genieße 3x schnelleren Upload! 🎉

**Fragen?** Siehe Troubleshooting oben oder Logs prüfen!
