# 🔐 Azure App Registration - Schritt-für-Schritt Anleitung

Diese Anleitung hilft Ihnen, eine Azure App für den OneDrive-Zugriff zu erstellen.

## Voraussetzungen

- Ein Microsoft 365 Account mit OneDrive-Zugriff
- Administratorrechte für Azure AD (oder Zugriff auf das Azure Portal)

## Schritt 1: Azure Portal öffnen

1. Gehen Sie zu [https://portal.azure.com](https://portal.azure.com)
2. Melden Sie sich mit Ihrem Microsoft-Account an

## Schritt 2: App Registration erstellen

1. **Navigation:**
   - Im linken Menü: Klicken Sie auf "Azure Active Directory" (oder "Microsoft Entra ID")
   - Dann: "App registrations" (App-Registrierungen)
   - Klicken Sie: "New registration" (Neue Registrierung)

2. **App-Details eingeben:**
   - **Name**: `OneDrive Telegram Bot` (oder ein Name Ihrer Wahl)
   - **Supported account types**: Wählen Sie eine der folgenden Optionen:
     - `Accounts in this organizational directory only` - Nur Ihr Verzeichnis
     - `Accounts in any organizational directory` - Mehrere Organisationen
     - `Accounts in any organizational directory and personal Microsoft accounts` - Auch persönliche Accounts
   - **Redirect URI**: Kann leer bleiben (wir nutzen App-only Auth)
   - Klicken Sie: "Register"

## Schritt 3: Application ID & Tenant ID notieren

Nach der Erstellung sehen Sie die Übersichtsseite:

1. **Kopieren Sie diese Werte:**
   - `Application (client) ID` → Dies ist Ihre `MICROSOFT_CLIENT_ID`
   - `Directory (tenant) ID` → Dies ist Ihre `MICROSOFT_TENANT_ID`

## Schritt 4: Client Secret erstellen

1. **Navigation:**
   - Im linken Menü der App: "Certificates & secrets"
   - Tab: "Client secrets"
   - Klicken Sie: "New client secret"

2. **Secret erstellen:**
   - **Description**: `Bot Secret` (oder ein Name Ihrer Wahl)
   - **Expires**: Wählen Sie eine Gültigkeitsdauer (z.B. 24 Monate)
   - Klicken Sie: "Add"

3. **Secret kopieren:**
   - ⚠️ **WICHTIG**: Kopieren Sie sofort den **Value** (nicht die Secret ID!)
   - Dieser Wert wird nur EINMAL angezeigt!
   - Dies ist Ihre `MICROSOFT_CLIENT_SECRET`

## Schritt 5: API Permissions hinzufügen

1. **Navigation:**
   - Im linken Menü: "API permissions"
   - Klicken Sie: "Add a permission"

2. **Microsoft Graph wählen:**
   - Klicken Sie: "Microsoft Graph"
   - Wählen Sie: "Application permissions" (nicht Delegated!)

3. **Permissions auswählen:**
   - Suchen Sie nach: `Files`
   - Aktivieren Sie:
     - `Files.Read.All` - **Mindestens diese Permission**
     - `Files.ReadWrite.All` - Wenn Sie auch Schreibzugriff benötigen

4. **Admin Consent gewähren:**
   - Klicken Sie: "Grant admin consent for [Ihr Verzeichnis]"
   - Bestätigen Sie mit "Yes"
   - Status sollte jetzt grün sein ✅

## Schritt 6: Werte in .env eintragen

Öffnen Sie die `.env` Datei in Ihrem Projekt:

```powershell
notepad s:\Coding\Telegram-bot\.env
```

Tragen Sie die kopierten Werte ein:

```env
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MICROSOFT_CLIENT_SECRET=your_secret_value_here~xxx-xxx
MICROSOFT_TENANT_ID=87654321-4321-4321-4321-987654321def
```

## Schritt 7: OneDrive-Pfad ermitteln

Der Bot überwacht einen bestimmten Ordner in OneDrive. Beispiele:

```env
# Root-Ordner "Fotos"
ONEDRIVE_FOLDER_PATH=/Fotos

# Verschachtelter Ordner
ONEDRIVE_FOLDER_PATH=/Dokumente/Bilder

# Root-Verzeichnis (nicht empfohlen)
ONEDRIVE_FOLDER_PATH=/
```

**Wichtig:** 
- Pfad startet immer mit `/`
- Keine Leerzeichen am Anfang/Ende
- Groß-/Kleinschreibung beachten

## Schritt 8: Testen

Testen Sie die Konfiguration lokal:

```powershell
cd s:\Coding\Telegram-bot
npm run test-local
```

Oder prüfen Sie nur die Konfiguration:

```powershell
npm run dev
# In einem anderen Terminal:
Invoke-WebRequest -Uri "http://localhost:3000/api/status" | ConvertFrom-Json
```

## Troubleshooting

### Fehler: "Insufficient privileges"

**Problem:** Die App hat nicht die nötigen Berechtigungen.

**Lösung:**
1. Gehen Sie zu "API permissions"
2. Prüfen Sie, ob "Grant admin consent" geklickt wurde
3. Status muss grün sein
4. Eventuell erneut "Grant admin consent" klicken

### Fehler: "Invalid client secret"

**Problem:** Das Client Secret ist falsch oder abgelaufen.

**Lösung:**
1. Erstellen Sie ein neues Client Secret (Schritt 4)
2. Aktualisieren Sie die `.env` Datei
3. Altes Secret können Sie danach löschen

### Fehler: "Unauthorized"

**Problem:** Client ID oder Tenant ID ist falsch.

**Lösung:**
1. Überprüfen Sie die Werte im Azure Portal
2. Kopieren Sie sie erneut
3. Achten Sie auf Leerzeichen am Anfang/Ende

### Fehler: "Folder not found"

**Problem:** Der OneDrive-Pfad existiert nicht.

**Lösung:**
1. Prüfen Sie den Ordnernamen in OneDrive
2. Achten Sie auf Groß-/Kleinschreibung
3. Pfad muss mit `/` beginnen
4. Erstellen Sie den Ordner in OneDrive, falls nicht vorhanden

## Sicherheitshinweise

🔒 **Wichtig:**
- Teilen Sie niemals Ihr Client Secret
- Committen Sie niemals die `.env` Datei in Git
- Rotieren Sie das Secret regelmäßig (alle 6-12 Monate)
- Verwenden Sie im Production-Umgebung Vercel Environment Variables

## Weiterführende Links

- [Azure Portal](https://portal.azure.com)
- [Microsoft Graph API Docs](https://learn.microsoft.com/en-us/graph/api/overview)
- [App Registration Tutorial](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

Bei weiteren Fragen: Siehe `README.md` im Projekt-Ordner.
