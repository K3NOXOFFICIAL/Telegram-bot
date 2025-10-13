/**
 * Vercel Serverless Function: Stop Sync
 * Endpoint: /api/stop
 * Gibt den Sync-Lock frei, um laufenden Sync zu stoppen
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { releaseSyncLock } from '../lib/store';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Setze CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Gebe Lock frei
    await releaseSyncLock();

    return res.status(200).json({
      success: true,
      message: 'Sync gestoppt - Lock freigegeben',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Fehler beim Stoppen:', error);

    return res.status(500).json({
      success: false,
      error: 'Stop fehlgeschlagen',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
