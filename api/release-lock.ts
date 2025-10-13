/**
 * Admin Endpoint zum manuellen Freigeben des Sync-Locks
 * Nützlich wenn ein Sync hängt oder der Lock nicht automatisch freigegeben wurde
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { releaseSyncLock } from '../lib/store';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    console.log('🔓 Release-Lock Endpoint aufgerufen');

    // Optional: Einfache Authentifizierung
    const authToken = req.query.token || req.headers['x-auth-token'];
    const expectedToken = process.env.SYNC_AUTH_TOKEN || 'release-lock-now';

    if (authToken !== expectedToken) {
      console.warn('⚠️ Unbefugter Zugriff auf release-lock versucht');
      return res.status(401).json({
        success: false,
        error: 'Nicht autorisiert',
      });
    }

    // Gebe Lock frei
    await releaseSyncLock();

    console.log('✅ Sync-Lock erfolgreich freigegeben');

    return res.status(200).json({
      success: true,
      message: 'Sync-Lock wurde freigegeben',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Fehler beim Freigeben des Locks:', error);

    return res.status(500).json({
      success: false,
      error: 'Lock konnte nicht freigegeben werden',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
