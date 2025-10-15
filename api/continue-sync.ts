/**
 * Vercel Serverless Function: Sync Continuation
 * Endpoint: /api/continue-sync
 * Automatisch aufgerufen wenn ein Sync-Chunk das Zeit-Limit erreicht
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { loadConfig } from '../lib/config';
import { syncOneDriveToTelegramParallel } from '../lib/sync';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    console.log('🔄 Continue-Sync aufgerufen');

    // Lade Konfiguration
    const config = loadConfig();

    // Auth-Check
    const authToken = req.query.token || req.headers['x-auth-token'];
    const expectedToken = process.env.SYNC_AUTH_TOKEN;

    if (expectedToken && authToken !== expectedToken) {
      return res.status(401).json({
        success: false,
        error: 'Nicht autorisiert',
      });
    }

    // Starte Fortsetzung
    const stats = await syncOneDriveToTelegramParallel(config);

    // Wenn weitere Fortsetzung nötig, triggere erneut
    if ((stats as any).needsContinuation) {
      console.log('🔄 Weitere Fortsetzung nötig - triggere neuen Request...');
      
      try {
        const baseUrl = `https://${req.headers.host}`;
        const continueUrl = `${baseUrl}/api/continue-sync`;
        
        console.log('▶️  Continue-Sync: Sende nächsten Request');
        
        // Sende Request und warte kurz auf Initiierung
        const fetchPromise = fetch(continueUrl, {
          method: 'POST',
          headers: {
            'x-auth-token': (authToken as string) || '',
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(2000)
        }).then(() => {
          console.log('✅ Nächster Continue-Request gesendet');
        }).catch(error => {
          console.log('⚠️  Continue-Request initiiert (error ignoriert):', error.message);
        });
        
        // Warte max 500ms
        await Promise.race([
          fetchPromise,
          new Promise(resolve => setTimeout(resolve, 500))
        ]);
        
        console.log('✅ Nächste Continuation ausgelöst');
        
      } catch (error) {
        console.error('❌ Fehler bei Continuation Trigger:', error);
      }
      
      return res.status(202).json({
        success: true,
        stats,
        message: 'Sync wird fortgesetzt',
        needsContinuation: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Komplett abgeschlossen
    return res.status(200).json({
      success: true,
      stats,
      message: 'Sync vollständig abgeschlossen',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Fehler im Continue-Sync:', error);

    return res.status(500).json({
      success: false,
      error: 'Fortsetzung fehlgeschlagen',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
