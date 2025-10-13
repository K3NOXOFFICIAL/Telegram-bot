/**
 * Vercel Serverless Function: Synchronisierung
 * Endpoint: /api/sync
 * Kann manuell aufgerufen oder per Cron-Job ausgelöst werden
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { loadConfig, validateConfig } from '../lib/config';
import { syncOneDriveToTelegram } from '../lib/sync';

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

    // Starte Synchronisierung
    const stats = await syncOneDriveToTelegram(config);

    // Erfolgreiche Antwort
    return res.status(200).json({
      success: true,
      stats,
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
