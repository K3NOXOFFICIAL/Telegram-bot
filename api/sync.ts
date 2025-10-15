/**
 * Vercel Serverless Function: Synchronisierung
 * Endpoint: /api/sync
 * Kann manuell aufgerufen oder per Cron-Job ausgelöst werden
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { loadConfig, validateConfig } from '../lib/config';
import { syncOneDriveToTelegramParallel } from '../lib/sync';

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
    console.log('🚀 Sync-Endpoint aufgerufen');

    // Validiere Konfiguration
    const validation = validateConfig();
    if (!validation.valid) {
      console.error('Konfigurationsfehler:', validation.errors);
      return res.status(500).json({
        success: false,
        error: 'Konfiguration unvollständig',
        details: validation.errors,
      });
    }

    // Lade Konfiguration
    const config = loadConfig();

    // Optional: Einfache Authentifizierung per Query-Parameter oder Header
    const authToken = req.query.token || req.headers['x-auth-token'];
    const expectedToken = process.env.SYNC_AUTH_TOKEN;

    if (expectedToken && authToken !== expectedToken) {
      console.warn('⚠️ Unbefugter Zugriff versucht');
      return res.status(401).json({
        success: false,
        error: 'Nicht autorisiert',
      });
    }

    // Starte PARALLELE Synchronisierung
    const stats = await syncOneDriveToTelegramParallel(config);

    // Prüfe ob Fortsetzung nötig ist
    if ((stats as any).needsContinuation) {
      console.log('🔄 Sync benötigt Fortsetzung - triggere neuen Request...');
      
      // Triggere SOFORT einen neuen Request über /api/continue-sync
      // Dies ist kritisch für Vercel Serverless - setTimeout funktioniert nicht!
      try {
        const baseUrl = `https://${req.headers.host}`;
        const continueUrl = `${baseUrl}/api/continue-sync`;
        
        console.log('▶️  Auto-Continue: Starte nächsten Chunk sofort...');
        
        // Fire-and-forget Request - warte NICHT auf Response
        fetch(continueUrl, {
          method: 'POST',
          headers: {
            'x-auth-token': (authToken as string) || '',
            'Content-Type': 'application/json'
          }
        }).catch(error => {
          // Log error but don't block
          console.error('❌ Auto-Continue Request fehlgeschlagen:', error);
        });
        
        console.log('✅ Auto-Continue Request gesendet');
        
      } catch (error) {
        console.error('❌ Fehler bei Auto-Continue Trigger:', error);
      }
      
      return res.status(202).json({
        success: true,
        stats,
        message: 'Sync Chunk abgeschlossen - wird automatisch fortgesetzt',
        needsContinuation: true,
        progress: {
          currentFolder: (stats as any).foldersScanned,
          totalFolders: (stats as any).totalFolders || 0,
          percentComplete: (stats as any).totalFolders 
            ? Math.round(((stats as any).foldersScanned / (stats as any).totalFolders) * 100)
            : 0
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Erfolgreiche Antwort (komplett abgeschlossen)
    return res.status(200).json({
      success: true,
      stats,
      message: 'Synchronisierung vollständig abgeschlossen',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Fehler im Sync-Endpoint:', error);

    return res.status(500).json({
      success: false,
      error: 'Synchronisierung fehlgeschlagen',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
