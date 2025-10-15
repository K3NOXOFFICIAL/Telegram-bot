/**
 * Vercel Serverless Function: Health Monitor & Auto-Restart
 * Endpoint: /api/health-monitor
 * Überwacht den System-Status und startet Services bei Bedarf automatisch neu
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  getSyncLockStatus, 
  releaseSyncLock, 
  getSyncProgress,
  loadSyncStats 
} from '../lib/store';

const MAX_LOCK_AGE_MINUTES = 10; // Lock älter als 10 Minuten = Problem
const MAX_PROGRESS_STALL_MINUTES = 15; // Kein Fortschritt seit 15 Minuten = Problem

interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
  actions: string[];
  timestamp: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Setze CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🏥 Health Monitor gestartet');

    const result: HealthCheckResult = {
      healthy: true,
      issues: [],
      actions: [],
      timestamp: new Date().toISOString()
    };

    // 1. Prüfe Sync Lock
    const lockStatus = await getSyncLockStatus();
    const syncProgress = await getSyncProgress();
    const syncStats = await loadSyncStats();
    
    if (lockStatus.locked) {
      const lockAgeMinutes = lockStatus.age! / 60000;
      
      if (lockAgeMinutes > MAX_LOCK_AGE_MINUTES) {
        result.healthy = false;
        result.issues.push(`Sync Lock ist ${Math.round(lockAgeMinutes)} Minuten alt (max: ${MAX_LOCK_AGE_MINUTES})`);
        
        // Auto-Recovery: Löse alten Lock und prüfe ob Continuation nötig
        console.log(`⚠️  Alter Sync Lock erkannt (${Math.round(lockAgeMinutes)} min) - löse auf...`);
        await releaseSyncLock();
        result.actions.push('Alter Sync Lock wurde automatisch gelöst');
        
        // Prüfe ob unvollständiger Sync existiert
        if (syncProgress && syncProgress.currentFolderIndex !== undefined) {
          console.log(`📍 Unvollständiger Sync erkannt - triggere Continuation ab Ordner ${syncProgress.currentFolderIndex + 1}`);
          await triggerContinueSync(req);
          result.actions.push(`Sync-Fortsetzung getriggert ab Ordner ${syncProgress.currentFolderIndex + 1}`);
        } else {
          // Kein Progress gespeichert - starte neuen Sync
          await triggerSync(req);
          result.actions.push('Neuer Sync wurde getriggert');
        }
      }
    }

    // 2. Prüfe Sync Progress (existiert nur während aktivem Sync)
    // Progress wird nur während aktivem Sync gespeichert
    // Wenn kein Progress existiert aber Lock da ist = Problem
    if (lockStatus.locked && !syncProgress) {
      const lockAgeMinutes = lockStatus.age! / 60000;
      
      if (lockAgeMinutes > 5) { // Lock aber kein Progress seit 5 Minuten = Problem
        result.healthy = false;
        result.issues.push(`Sync Lock existiert aber kein Progress seit ${Math.round(lockAgeMinutes)} Minuten`);
        
        // Auto-Recovery: Starte Sync neu
        console.log(`⚠️  Lock ohne Progress erkannt (${Math.round(lockAgeMinutes)} min) - starte neu...`);
        await releaseSyncLock();
        await triggerSync(req);
        result.actions.push('Sync wurde wegen fehlendem Progress neu gestartet');
      }
    }

    // 3. Prüfe ob laufender Sync existiert aber nicht fortschreitet
    
    // Check if sync is marked as running
    if (syncStats && (syncStats as any).isRunning) {
      const lastUpdate = (syncStats as any).lastUpdate;
      
      if (lastUpdate) {
        const stallMinutes = (Date.now() - lastUpdate) / 60000;
        
        // Wenn Sync als laufend markiert aber seit 15 Minuten kein Update
        if (stallMinutes > MAX_PROGRESS_STALL_MINUTES) {
          result.healthy = false;
          result.issues.push(`Sync läuft aber kein Update seit ${Math.round(stallMinutes)} Minuten`);
          
          // Auto-Recovery: Prüfe ob Continuation möglich
          console.log(`⚠️  Hängender Sync erkannt (kein Update seit ${Math.round(stallMinutes)} min) - Force Restart...`);
          await releaseSyncLock();
          
          // Prüfe ob es gespeicherten Progress gibt
          if (syncProgress && syncProgress.currentFolderIndex !== undefined) {
            console.log(`📍 Setze hängenden Sync fort ab Ordner ${syncProgress.currentFolderIndex + 1}`);
            await triggerContinueSync(req);
            result.actions.push(`Hängender Sync wurde fortgesetzt ab Ordner ${syncProgress.currentFolderIndex + 1}`);
          } else {
            await triggerSync(req);
            result.actions.push('Hängender Sync wurde neu gestartet');
          }
        }
      }
    }
    
    // 4. Prüfe ob unvollständiger Sync ohne Lock existiert (z.B. nach Crash)
    if (!lockStatus.locked && syncProgress && syncProgress.currentFolderIndex !== undefined) {
      console.log(`⚠️  Unvollständiger Sync ohne Lock erkannt - setze fort ab Ordner ${syncProgress.currentFolderIndex + 1}`);
      result.issues.push(`Unvollständiger Sync gefunden (Ordner ${syncProgress.currentFolderIndex + 1}/${syncProgress.totalFolders || '?'})`);
      await triggerContinueSync(req);
      result.actions.push(`Unvollständiger Sync wird fortgesetzt ab Ordner ${syncProgress.currentFolderIndex + 1}`);
    }

    // 4. Auto-Start: DEAKTIVIERT - Nur bei kritischen Problemen neu starten
    // Der reguläre Cron-Job sollte den Sync alle 5 Minuten starten
    // Health Monitor ist nur für Recovery zuständig
    /*
    if (!lockStatus.locked && !syncProgress) {
      const lastSync = (syncStats as any)?.lastUpdate;
      if (lastSync) {
        const lastSyncMinutes = (Date.now() - lastSync) / 60000;
        
        if (lastSyncMinutes > 120) {
          console.log(`ℹ️  Letzter Sync vor ${Math.round(lastSyncMinutes)} Minuten - Starte Routine-Sync`);
          await triggerSync(req);
          result.actions.push('Routine-Sync wurde gestartet');
        }
      }
    }
    */
    
    // Log Health Status
    console.log(`🏥 Health Check abgeschlossen:`);
    console.log(`   - Healthy: ${result.healthy}`);
    console.log(`   - Issues: ${result.issues.length}`);
    console.log(`   - Actions: ${result.actions.length}`);
    if (result.issues.length > 0) {
      console.log(`   - Probleme:`, result.issues);
    }
    if (result.actions.length > 0) {
      console.log(`   - Aktionen:`, result.actions);
    }

    // Response - WICHTIG: Immer 200 zurückgeben wenn Monitor erfolgreich lief
    // Auch wenn Probleme erkannt wurden - der Monitor hat erfolgreich gearbeitet!
    // 503 würde Vercel Cron als Fehler werten und weitere Ausführungen blockieren
    
    return res.status(200).json({
      success: true, // Monitor lief erfolgreich
      health: result,
      systemHealthy: result.healthy, // Separates Flag für System-Gesundheit
      message: result.healthy 
        ? 'Alle Services sind gesund' 
        : 'Probleme erkannt und Auto-Recovery durchgeführt',
    });

  } catch (error: any) {
    console.error('❌ Fehler im Health Monitor:', error);

    return res.status(500).json({
      success: false,
      error: 'Health Monitor fehlgeschlagen',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Hilfsfunktion: Triggert einen neuen Sync
 */
async function triggerSync(req: VercelRequest): Promise<void> {
  try {
    const baseUrl = `https://${req.headers.host}`;
    const syncUrl = `${baseUrl}/api/sync`;
    const authToken = process.env.SYNC_AUTH_TOKEN;
    
    console.log('▶️  Health Monitor: Triggere Sync an', syncUrl);
    
    // Verwende node-fetch oder nativen fetch (je nach Node Version)
    // Fire-and-forget request mit Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s Timeout
    
    try {
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'x-auth-token': authToken || '',
          'Content-Type': 'application/json',
          'User-Agent': 'Health-Monitor/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Sync Request erfolgreich gesendet (HTTP', response.status, ')');
      } else {
        console.log('⚠️  Sync Request gesendet aber unerwarteter Status:', response.status);
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Timeout oder Abort ist OK - Request wurde gesendet
      if (fetchError.name === 'AbortError') {
        console.log('✅ Sync Request gesendet (Timeout nach 3s - normal)');
      } else {
        console.log('⚠️  Sync Request möglicherweise gesendet, Fehler:', fetchError.message);
      }
    }
  } catch (error: any) {
    console.error('❌ Fehler beim Sync-Trigger:', error.message);
    // Nicht weiterwerfen - Health Monitor soll trotzdem erfolgreich sein
  }
}

/**
 * Hilfsfunktion: Triggert Continuation eines unterbrochenen Syncs
 */
async function triggerContinueSync(req: VercelRequest): Promise<void> {
  try {
    const baseUrl = `https://${req.headers.host}`;
    const continueUrl = `${baseUrl}/api/continue-sync`;
    const authToken = process.env.SYNC_AUTH_TOKEN;
    
    console.log('▶️  Health Monitor: Triggere Continue-Sync an', continueUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s Timeout
    
    try {
      const response = await fetch(continueUrl, {
        method: 'POST',
        headers: {
          'x-auth-token': authToken || '',
          'Content-Type': 'application/json',
          'User-Agent': 'Health-Monitor/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Continue-Sync Request erfolgreich gesendet (HTTP', response.status, ')');
      } else {
        console.log('⚠️  Continue-Sync Request gesendet aber unerwarteter Status:', response.status);
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Timeout oder Abort ist OK - Request wurde gesendet
      if (fetchError.name === 'AbortError') {
        console.log('✅ Continue-Sync Request gesendet (Timeout nach 3s - normal)');
      } else {
        console.log('⚠️  Continue-Sync Request möglicherweise gesendet, Fehler:', fetchError.message);
      }
    }
  } catch (error: any) {
    console.error('❌ Fehler beim Continue-Sync-Trigger:', error.message);
    // Nicht weiterwerfen - Health Monitor soll trotzdem erfolgreich sein
  }
}
