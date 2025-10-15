/**
 * Vercel Serverless Function: Settings Management
 * Endpoint: /api/settings
 * Allows dynamic configuration changes during runtime
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getRuntimeSettings, updateRuntimeSettings } from '../lib/store';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Setze CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Aktuelle Einstellungen abrufen
    if (req.method === 'GET') {
      const settings = await getRuntimeSettings();
      return res.status(200).json({
        success: true,
        settings,
        timestamp: new Date().toISOString(),
      });
    }

    // POST/PUT: Einstellungen aktualisieren
    if (req.method === 'POST' || req.method === 'PUT') {
      const { uploadDelay, concurrentFolders } = req.body;

      // Validierung
      const errors: string[] = [];

      if (uploadDelay !== undefined) {
        const delay = parseInt(uploadDelay, 10);
        if (isNaN(delay) || delay < 100 || delay > 10000) {
          errors.push('uploadDelay muss zwischen 100 und 10000 ms liegen');
        }
      }

      if (concurrentFolders !== undefined) {
        const concurrent = parseInt(concurrentFolders, 10);
        if (isNaN(concurrent) || concurrent < 1 || concurrent > 30) {
          errors.push('concurrentFolders muss zwischen 1 und 30 liegen');
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          errors,
          timestamp: new Date().toISOString(),
        });
      }

      // Aktualisiere Einstellungen
      const currentSettings = await getRuntimeSettings();
      const newSettings = {
        uploadDelay: uploadDelay !== undefined 
          ? parseInt(uploadDelay, 10) 
          : currentSettings.uploadDelay,
        concurrentFolders: concurrentFolders !== undefined 
          ? parseInt(concurrentFolders, 10) 
          : currentSettings.concurrentFolders,
        updatedAt: Date.now(),
      };

      await updateRuntimeSettings(newSettings);

      console.log('⚙️ Einstellungen aktualisiert:', newSettings);

      return res.status(200).json({
        success: true,
        settings: newSettings,
        message: 'Einstellungen erfolgreich aktualisiert',
        note: 'Änderungen werden beim nächsten Sync-Chunk wirksam',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Methode nicht erlaubt',
      allowed: ['GET', 'POST', 'PUT'],
    });

  } catch (error: any) {
    console.error('❌ Fehler im Settings-Endpoint:', error);

    return res.status(500).json({
      success: false,
      error: 'Settings-Operation fehlgeschlagen',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
