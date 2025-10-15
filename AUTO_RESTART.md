# 🔄 Auto-Restart & Health Monitoring

Dieses System überwacht automatisch alle Services und startet sie bei Problemen neu.

## 🏗️ Architektur

### 1. **Health Monitor** (`/api/health-monitor`)
- Läuft alle 5 Minuten automatisch (Vercel Cron Job)
- Prüft System-Status und erkennt Probleme
- Führt automatische Recovery-Aktionen durch

### 2. **Auto-Recovery in allen Endpoints**
- `api/sync.ts` - Gibt Lock bei Fehler automatisch frei
- `api/continue-sync.ts` - Gibt Lock bei Fehler automatisch frei
- Beide triggern automatisch Health Monitor für Neustart

### 3. **Watchdog Script** (für lokale Entwicklung)
- Überwacht lokale Entwicklungsumgebung
- Automatischer Neustart bei Problemen
- Status-Monitoring und Logging

---

## 🚀 Features

### Automatische Problemerkennung

#### 1. **Hängende Locks**
```
Problem: Sync Lock älter als 10 Minuten
Aktion: Lock wird freigegeben, neuer Sync gestartet
```

#### 2. **Stillstand**
```
Problem: Sync läuft länger als 30 Minuten ohne Abschluss
Aktion: Force Restart des Sync
```

#### 3. **Lock ohne Progress**
```
Problem: Lock existiert aber kein Fortschritt seit 5 Minuten
Aktion: Lock freigeben, Sync neu starten
```

#### 4. **Fehler in Sync**
```
Problem: Exception/Error in sync.ts oder continue-sync.ts
Aktion: Lock automatisch freigeben für Recovery
```

---

## 📊 Verwendung

### Production (Vercel)

**Automatisch aktiv nach Deployment:**
```bash
vercel --prod
```

Der Health Monitor läuft automatisch alle 5 Minuten via Cron Job.

**Manueller Health Check:**
```powershell
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/health-monitor"
```

**Response Beispiel:**
```json
{
  "success": true,
  "health": {
    "healthy": true,
    "issues": [],
    "actions": [],
    "timestamp": "2025-10-15T12:00:00.000Z"
  },
  "message": "Alle Services sind gesund"
}
```

**Bei Problemen:**
```json
{
  "success": false,
  "health": {
    "healthy": false,
    "issues": [
      "Sync Lock ist 12 Minuten alt (max: 10)"
    ],
    "actions": [
      "Alter Sync Lock wurde automatisch gelöst",
      "Neuer Sync wurde getriggert"
    ],
    "timestamp": "2025-10-15T12:00:00.000Z"
  },
  "message": "Probleme erkannt und Auto-Recovery durchgeführt"
}
```

---

### Lokale Entwicklung

**1. Watchdog starten:**
```powershell
npm run watchdog
```

**Output:**
```
🐕 Watchdog gestartet
📍 Überwache: http://localhost:3000
⏱️  Check-Interval: 30s

🔍 [12:00:00] Prüfe Health Status...
✅ System ist gesund!

📊 WATCHDOG STATUS
==================================================
Status: ✅ Gesund
Letzter Check: 12:00:00
Aufeinanderfolgende Fehler: 0/3
Uptime: 5m 30s
==================================================
```

**2. Bei Problemen:**
```
❌ Health Check fehlgeschlagen (1/3): connect ECONNREFUSED
⚠️  System nicht gesund (2/3)
   Probleme:
   - Sync Lock ist 12 Minuten alt (max: 10)
   Auto-Recovery Aktionen:
   - Alter Sync Lock wurde automatisch gelöst
   - Neuer Sync wurde getriggert

🚨 Maximale Fehler erreicht - versuche Recovery...
🔓 Gebe Lock frei...
✅ Lock freigegeben
🔄 Starte Sync neu...
✅ Sync gestartet
```

**3. Watchdog stoppen:**
```
Strg + C
```

---

## ⚙️ Konfiguration

### Timeouts anpassen

**In `api/health-monitor.ts`:**
```typescript
const MAX_LOCK_AGE_MINUTES = 10;      // Lock-Timeout
const MAX_PROGRESS_STALL_MINUTES = 15; // Stillstand-Timeout
```

### Cron-Intervall anpassen

**In `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/health-monitor",
      "schedule": "*/5 * * * *"  // Alle 5 Minuten
    }
  ]
}
```

**Cron-Syntax:**
- `*/5 * * * *` - Alle 5 Minuten
- `*/10 * * * *` - Alle 10 Minuten
- `0 * * * *` - Jede volle Stunde
- `0 0 * * *` - Täglich um Mitternacht

### Watchdog-Intervall anpassen

**In `scripts/watchdog.ts`:**
```typescript
const CHECK_INTERVAL = 30000; // 30 Sekunden
const MAX_RETRIES = 3;        // Max Fehler vor Recovery
```

---

## 🔍 Monitoring & Debugging

### Status prüfen
```powershell
# Production
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/status" | ConvertFrom-Json

# Local
Invoke-WebRequest -Uri "http://localhost:3000/api/status" | ConvertFrom-Json
```

### Health Monitor manuell triggern
```powershell
# Production
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/health-monitor" | ConvertFrom-Json

# Local
Invoke-WebRequest -Uri "http://localhost:3000/api/health-monitor" | ConvertFrom-Json
```

### Logs ansehen
```powershell
# Vercel Logs
vercel logs

# Nur Fehler
vercel logs --follow | Select-String "ERROR|❌"
```

---

## 🛠️ Troubleshooting

### Problem: Health Monitor läuft nicht

**Ursache:** Cron Job nicht aktiv (nur mit Vercel Pro Account)

**Lösung:**
1. Manuell triggern via API
2. Externen Cron-Service nutzen (z.B. cron-job.org)
3. Watchdog lokal laufen lassen

### Problem: Zu viele Auto-Restarts

**Ursache:** Timeouts zu niedrig eingestellt

**Lösung:**
```typescript
// In api/health-monitor.ts
const MAX_LOCK_AGE_MINUTES = 15;  // Erhöhen
```

### Problem: Lock wird nicht freigegeben

**Ursache:** Fehler im Health Monitor

**Lösung:**
```powershell
# Manuell Lock freigeben
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/force-unlock" -Method POST
```

### Problem: Sync startet nach Fehler nicht neu

**Ursache:** Health Monitor noch nicht gelaufen

**Lösung:**
```powershell
# Manuell Health Monitor triggern
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/health-monitor"
```

---

## 📈 Best Practices

### 1. **Monitoring einrichten**
```powershell
# UptimeRobot oder ähnliche Services nutzen
# Endpoint: /api/health-monitor
# Intervall: 5 Minuten
```

### 2. **Alerts konfigurieren**
- Webhook zu Discord/Slack bei Health Check Failures
- Email-Benachrichtigung bei mehrfachen Restarts

### 3. **Logs regelmäßig prüfen**
```powershell
# Täglich Logs checken
vercel logs --since 24h | Select-String "Auto-Recovery|Force Restart"
```

### 4. **Watchdog in Entwicklung nutzen**
```powershell
# Immer im Hintergrund laufen lassen
npm run watchdog
```

---

## 🔐 Sicherheit

### Auth-Token für Sync
```env
SYNC_AUTH_TOKEN=your-secret-token
```

Alle Sync-Endpunkte prüfen diesen Token automatisch.

### Rate Limiting
Health Monitor hat 60s Timeout - verhindert zu häufige Checks.

---

## 📊 Status-Codes

| Code | Bedeutung | Aktion |
|------|-----------|--------|
| 200 | Alles OK | Keine |
| 202 | Sync läuft weiter | Auto-continuation |
| 401 | Nicht autorisiert | Token prüfen |
| 500 | Fehler | Auto-recovery aktiv |
| 503 | Unhealthy | Recovery läuft |

---

## 🎯 Zusammenfassung

✅ **Automatische Überwachung** alle 5 Minuten  
✅ **Auto-Recovery** bei allen bekannten Problemen  
✅ **Lock-Management** mit automatischer Freigabe  
✅ **Watchdog** für lokale Entwicklung  
✅ **Status-Monitoring** jederzeit verfügbar  

Das System ist **vollautomatisch** und benötigt keine manuelle Intervention! 🚀
