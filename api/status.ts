/**
 * Vercel Serverless Function: Status-Check
 * Endpoint: /api/status
 * Zeigt den aktuellen Bot-Status und Konfiguration
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { validateConfig } from '../lib/config';
import { loadState, getAllTopicMappings, loadSyncStats, getSyncLockStatus, getSyncProgress } from '../lib/store';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Setze CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Validiere Konfiguration
    const validation = validateConfig();

    // Lade Bot-Status
    const state = await loadState();
    const mappings = await getAllTopicMappings();
    const syncStats = await loadSyncStats();
    const lockStatus = await getSyncLockStatus();
    const syncProgress = await getSyncProgress();

    // Erstelle Status-Response
    const status = {
      healthy: validation.valid,
      timestamp: new Date().toISOString(),
      config: {
        valid: validation.valid,
        errors: validation.errors,
        onedriveFolderPath: process.env.ONEDRIVE_FOLDER_PATH || 'nicht gesetzt',
        rateLimitDelay: process.env.RATE_LIMIT_DELAY || '2000',
      },
      state: {
        totalPostedFiles: state.postedFiles.length,
        totalTopicMappings: state.topicMappings.length,
        lastSync: state.lastSync,
      },
      syncLock: lockStatus.locked ? {
        locked: true,
        ageSeconds: Math.round(lockStatus.age! / 1000),
        ageMinutes: Math.round(lockStatus.age! / 60000),
        timestamp: new Date(lockStatus.timestamp!).toISOString(),
      } : { locked: false },
      syncProgress: syncProgress ? {
        currentFolder: syncProgress.currentFolderIndex + 1,
        totalFolders: syncProgress.totalFolders,
        percentComplete: Math.round((syncProgress.currentFolderIndex / syncProgress.totalFolders) * 100)
      } : null,
      currentSync: syncStats || null,
      topics: mappings.map(m => ({
        folderName: m.folderName,
        topicName: m.topicName,
        topicId: m.topicId,
        createdAt: m.createdAt,
      })),
      recentFiles: state.postedFiles
        .slice(-10)
        .reverse()
        .map(f => ({
          fileName: f.fileName,
          folderName: f.folderName,
          postedAt: f.postedAt,
        })),
    };

    return res.status(200).json(status);

  } catch (error: any) {
    console.error('❌ Fehler im Status-Endpoint:', error);

    return res.status(500).json({
      healthy: false,
      error: 'Status-Abfrage fehlgeschlagen',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
