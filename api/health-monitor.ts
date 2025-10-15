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
    if (lockStatus.locked) {
      const lockAgeMinutes = lockStatus.age! / 60000;
      
      if (lockAgeMinutes > MAX_LOCK_AGE_MINUTES) {
        result.healthy = false;
        result.issues.push(`Sync Lock ist ${Math.round(lockAgeMinutes)} Minuten alt (max: ${MAX_LOCK_AGE_MINUTES})`);
        
        // Auto-Recovery: Löse alten Lock
        console.log(`⚠️  Alter Sync Lock erkannt (${Math.round(lockAgeMinutes)} min) - löse auf...`);
        await releaseSyncLock();
        result.actions.push('Alter Sync Lock wurde automatisch gelöst');
        
        // Triggere neuen Sync
        await triggerSync(req);
        result.actions.push('Neuer Sync wurde getriggert');
      }
    }

    // 2. Prüfe Sync Progress (existiert nur während aktivem Sync)
    const syncProgress = await getSyncProgress();
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
    const syncStats = await loadSyncStats();
    if (syncStats && syncStats.startTime) {
      const syncAgeMinutes = (Date.now() - new Date(syncStats.startTime).getTime()) / 60000;
      
      // Wenn Sync älter als 30 Minuten aber noch nicht abgeschlossen
      if (syncAgeMinutes > 30 && !syncStats.endTime) {
        result.healthy = false;
        result.issues.push(`Sync läuft seit ${Math.round(syncAgeMinutes)} Minuten ohne Abschluss`);
        
        // Auto-Recovery: Force restart
        console.log(`⚠️  Hängender Sync erkannt (${Math.round(syncAgeMinutes)} min) - Force Restart...`);
        await releaseSyncLock();
        await triggerSync(req);
        result.actions.push('Hängender Sync wurde force-restarted');
      }
    }

    // 4. Auto-Start: Wenn kein Sync läuft und keiner geplant ist
    if (!lockStatus.locked && !syncProgress) {
      // Prüfe ob letzter Sync schon lange her ist (optional)
      const lastSync = syncStats?.endTime;
      if (lastSync) {
        const lastSyncMinutes = (Date.now() - new Date(lastSync).getTime()) / 60000;
        
        // Wenn letzter Sync älter als 2 Stunden (optional - kann angepasst werden)
        if (lastSyncMinutes > 120) {
          console.log(`ℹ️  Letzter Sync vor ${Math.round(lastSyncMinutes)} Minuten - Starte Routine-Sync`);
          await triggerSync(req);
          result.actions.push('Routine-Sync wurde gestartet');
        }
      }
    }

    // Response
    const statusCode = result.healthy ? 200 : 503;
    
    return res.status(statusCode).json({
      success: result.healthy,
      health: result,
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
    
    // Fire-and-forget request
    fetch(syncUrl, {
      method: 'POST',
      headers: {
        'x-auth-token': authToken || '',
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(2000)
    }).catch(() => {
      // Ignore errors - request wurde gesendet
    });
    
    console.log('✅ Sync Request gesendet');
  } catch (error) {
    console.error('❌ Fehler beim Sync-Trigger:', error);
  }
}
