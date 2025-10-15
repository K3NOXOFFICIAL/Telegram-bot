/**
 * API-Endpunkt zum manuellen Freigeben von Sync-Locks
 * Nützlich wenn ein Lock hängt und manuell freigegeben werden muss
 */

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Nur POST-Requests erlauben
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Methode nicht erlaubt. Verwende POST.' });
    }

    // Importiere Store-Funktionen
    const { releaseSyncLock, getSyncLockStatus, saveSyncStats } = await import('../lib/store');

    // Hole aktuellen Lock-Status
    const lockStatus = await getSyncLockStatus();

    if (!lockStatus.locked) {
      return res.status(200).json({
        success: true,
        message: 'Kein Lock vorhanden - nichts zu tun',
        lockStatus
      });
    }

    console.log('🔓 Force-Unlock angefordert...');
    console.log(`   Lock-Alter: ${lockStatus.age ? Math.round(lockStatus.age / 1000) : 'unbekannt'}s`);

    // Gebe Lock frei
    await releaseSyncLock();

    // Setze isRunning in Stats auf false
    const { loadSyncStats } = await import('../lib/store');
    const stats = await loadSyncStats();
    if (stats) {
      await saveSyncStats({
        ...stats,
        isRunning: false,
        lastUpdate: Date.now()
      });
      console.log('✅ Stats-Flag isRunning auf false gesetzt');
    }

    // Prüfe ob Lock wirklich weg ist
    const newLockStatus = await getSyncLockStatus();

    return res.status(200).json({
      success: true,
      message: 'Lock erfolgreich freigegeben',
      previousLockStatus: lockStatus,
      currentLockStatus: newLockStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Fehler beim Force-Unlock:', error);
    return res.status(500).json({
      error: 'Interner Serverfehler',
      message: error?.message || String(error),
      timestamp: new Date().toISOString()
    });
  }
}
