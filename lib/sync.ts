/**
 * Hauptsynchronisierungslogik
 * Koordiniert OneDrive-Überwachung und Telegram-Posts
 */

import { OneDriveClient } from './onedrive';
import { TelegramBot } from './bot';
import { TopicManager } from './topicManager';
import { isFilePosted, markFileAsPosted, acquireSyncLock, releaseSyncLock } from './store';
import { BotConfig, OneDriveItem } from './types';

/**
 * Synchronisierungsstatistiken
 */
export interface SyncStats {
  foldersScanned: number;
  filesFound: number;
  filesPosted: number;
  errors: number;
  duration: number;
}

/**
 * Hauptsynchronisierungsfunktion
 */
export async function syncOneDriveToTelegram(config: BotConfig): Promise<SyncStats> {
  const startTime = Date.now();
  const stats: SyncStats = {
    foldersScanned: 0,
    filesFound: 0,
    filesPosted: 0,
    errors: 0,
    duration: 0,
  };

  try {
    console.log('🔄 Starte Synchronisierung...');
    
    // Versuche Lock zu erhalten (verhindert mehrere gleichzeitige Syncs)
    const lockAcquired = await acquireSyncLock();
    if (!lockAcquired) {
      console.log('⏸️  Synchronisierung läuft bereits - überspringe');
      stats.duration = Date.now() - startTime;
      return stats;
    }

    // Initialisiere Clients
    const onedrive = new OneDriveClient(config);
    const bot = new TelegramBot(config);
    const topicManager = new TopicManager(bot);

    // Hole alle Unterordner aus dem konfigurierten OneDrive-Pfad
    const folders = await onedrive.listSubfolders(config.onedriveFolderPath);
    console.log(`📁 ${folders.length} Ordner gefunden`);

    if (folders.length === 0) {
      console.log('⚠️ Keine Ordner zum Synchronisieren gefunden');
      stats.duration = Date.now() - startTime;
      return stats;
    }

    // Verarbeite jeden Ordner
    for (const folder of folders) {
      stats.foldersScanned++;

      try {
        console.log(`\n📂 Verarbeite Ordner: ${folder.name}`);

        // Hole oder erstelle Topic für diesen Ordner
        const topicId = await topicManager.getOrCreateTopic(folder.name);

        if (!topicId) {
          console.error(`❌ Konnte Topic für ${folder.name} nicht erstellen`);
          stats.errors++;
          continue;
        }

        // Hole alle Dateien aus dem Ordner UND Unterordnern (z.B. images/, videos/)
        const files = await onedrive.listFilesRecursive(folder.path);
        console.log(`   📄 ${files.length} Dateien insgesamt gefunden (inkl. Unterordner)`);
        
        const mediaFiles = files.filter(file => onedrive.isMediaFile(file));
        console.log(`   🎬 ${mediaFiles.length} Mediendateien (Bilder/Videos) gefunden`);
        stats.filesFound += mediaFiles.length;

        if (mediaFiles.length === 0) {
          console.log(`   ⚠️  Keine Medien zum Posten`);
          continue;
        }

        // Sortiere nach Erstellungsdatum (älteste zuerst)
        mediaFiles.sort((a, b) => {
          return new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime();
        });

        // Verarbeite jede Datei
        for (const file of mediaFiles) {
          try {
            // Prüfe, ob Datei bereits gepostet wurde
            if (await isFilePosted(file.id)) {
              console.log(`⏭️ Überspringe bereits gepostete Datei: ${file.name}`);
              continue;
            }

            console.log(`📤 Poste: ${file.name} (${file.file?.mimeType})`);

            // Bestimme Dateityp
            const mimeType = file.file?.mimeType || '';
            const isVideo = mimeType.startsWith('video/');
            const isImage = mimeType.startsWith('image/');

            if (!isVideo && !isImage) {
              console.log(`   ⏭️  Überspringe nicht-Medien-Datei`);
              continue;
            }

            // Hole Download-URL
            const downloadUrl = await onedrive.getDownloadUrl(file.id);

            if (!downloadUrl) {
              console.error(`   ❌ Keine Download-URL für ${file.name}`);
              stats.errors++;
              continue;
            }

            // Poste Datei
            let message;
            if (isVideo) {
              console.log(`   🎥 Sende Video...`);
              message = await bot.sendVideoByUrl(downloadUrl, file.name, topicId);
            } else {
              console.log(`   🖼️  Sende Bild...`);
              message = await bot.sendPhotoByUrl(downloadUrl, file.name, topicId);
            }

            if (message) {
              // Markiere als gepostet
              await markFileAsPosted(file.id, file.name, folder.name, message.message_id);
              stats.filesPosted++;
              console.log(`   ✅ Erfolgreich gepostet: ${file.name}`);
            } else {
              console.error(`   ❌ Fehler beim Posten von ${file.name}`);
              stats.errors++;
            }

            // Rate Limiting: Warte zwischen Posts
            await bot.delay(config.rateLimitDelay);

          } catch (fileError) {
            console.error(`❌ Fehler bei Datei ${file.name}:`, fileError);
            stats.errors++;
          }
        }

      } catch (folderError) {
        console.error(`❌ Fehler bei Ordner ${folder.name}:`, folderError);
        stats.errors++;
      }
    }

    stats.duration = Date.now() - startTime;

    console.log('\n✨ Synchronisierung abgeschlossen');
    console.log(`📊 Statistiken:`);
    console.log(`   - Ordner gescannt: ${stats.foldersScanned}`);
    console.log(`   - Dateien gefunden: ${stats.filesFound}`);
    console.log(`   - Dateien gepostet: ${stats.filesPosted}`);
    console.log(`   - Fehler: ${stats.errors}`);
    console.log(`   - Dauer: ${(stats.duration / 1000).toFixed(2)}s`);

    // Lock freigeben
    await releaseSyncLock();

    return stats;

  } catch (error) {
    console.error('❌ Kritischer Fehler bei der Synchronisierung:', error);
    stats.errors++;
    stats.duration = Date.now() - startTime;
    
    // Lock auch im Fehlerfall freigeben
    await releaseSyncLock();
    
    throw error;
  }
}

/**
 * Verarbeitet eine einzelne Datei (für inkrementelle Verarbeitung)
 */
export async function processFile(
  config: BotConfig,
  file: OneDriveItem,
  folderName: string,
  topicId: number
): Promise<boolean> {
  try {
    const onedrive = new OneDriveClient(config);
    const bot = new TelegramBot(config);

    // Prüfe, ob bereits gepostet
    if (await isFilePosted(file.id)) {
      return false;
    }

    const isVideo = file.file?.mimeType.startsWith('video/');
    const downloadUrl = await onedrive.getDownloadUrl(file.id);

    let message;
    if (isVideo) {
      message = await bot.sendVideoByUrl(downloadUrl, file.name, topicId);
    } else {
      message = await bot.sendPhotoByUrl(downloadUrl, file.name, topicId);
    }

    if (message) {
      await markFileAsPosted(file.id, file.name, folderName, message.message_id);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Fehler beim Verarbeiten von ${file.name}:`, error);
    return false;
  }
}

/**
 * Verarbeitet einen Ordner (Helper für parallele Verarbeitung)
 */
async function processFolderParallel(
  folder: { id: string; name: string; path: string },
  onedrive: OneDriveClient,
  bot: TelegramBot,
  topicManager: TopicManager,
  config: BotConfig
): Promise<{ filesFound: number; filesPosted: number; errors: number }> {
  const localStats = {
    filesFound: 0,
    filesPosted: 0,
    errors: 0
  };

  try {
    console.log(`\n📂 [${folder.name}] Start`);

    const topicId = await topicManager.getOrCreateTopic(folder.name);
    if (!topicId) {
      console.error(`❌ [${folder.name}] Topic-Erstellung fehlgeschlagen`);
      localStats.errors++;
      return localStats;
    }

    const files = await onedrive.listFilesRecursive(folder.path);
    const mediaFiles = files.filter(file => onedrive.isMediaFile(file));
    
    console.log(`   [${folder.name}] ${mediaFiles.length} Medien gefunden`);
    localStats.filesFound = mediaFiles.length;

    if (mediaFiles.length === 0) {
      return localStats;
    }

    mediaFiles.sort((a, b) => {
      return new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime();
    });

    for (const file of mediaFiles) {
      try {
        // Prüfe 1: Redis File-ID Check (wurde bereits hochgeladen?)
        const alreadyPosted = await isFilePosted(file.id);
        if (alreadyPosted) {
          console.log(`   ⏭️  [${folder.name}] Überspringe: ${file.name} (in Redis gefunden)`);
          continue;
        }

        // Prüfe 2: Topic-Dateien Check (existiert im Topic?)
        const { isFileInTopic } = await import('./store');
        const existsInTopic = await isFileInTopic(topicId, file.name);
        if (existsInTopic) {
          console.log(`   ⏭️  [${folder.name}] Überspringe: ${file.name} (bereits im Topic)`);
          // Markiere auch in Redis, um zukünftige Prüfungen zu beschleunigen
          await markFileAsPosted(file.id, file.name, folder.name, 0);
          continue;
        }

        const mimeType = file.file?.mimeType || '';
        const isVideo = mimeType.startsWith('video/');
        const isImage = mimeType.startsWith('image/');

        if (!isVideo && !isImage) {
          continue;
        }

        const downloadUrl = await onedrive.getDownloadUrl(file.id);
        if (!downloadUrl) {
          localStats.errors++;
          continue;
        }

        let message;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            if (isVideo) {
              message = await bot.sendVideoByUrl(downloadUrl, file.name, topicId);
            } else {
              message = await bot.sendPhotoByUrl(downloadUrl, file.name, topicId);
            }
            break; // Erfolgreich
          } catch (sendError: any) {
            if (sendError?.error_code === 429) {
              const retryAfter = sendError?.parameters?.retry_after || 10;
              console.log(`   ⏳ [${folder.name}] Rate limit - warte ${retryAfter}s (Versuch ${retryCount + 1}/${maxRetries})`);
              await bot.delay(retryAfter * 1000);
              retryCount++;
            } else {
              throw sendError;
            }
          }
        }

        if (message) {
          await markFileAsPosted(file.id, file.name, folder.name, message.message_id);
          
          // Füge Dateiname auch zur Topic-Files-Liste hinzu
          const { loadTopicFiles, saveTopicFiles } = await import('./store');
          const topicFiles = await loadTopicFiles(topicId);
          topicFiles.add(file.name);
          await saveTopicFiles(topicId, Array.from(topicFiles));
          
          localStats.filesPosted++;
          console.log(`   ✅ [${folder.name}] ${file.name}`);
        } else {
          localStats.errors++;
        }

        await bot.delay(config.rateLimitDelay);

      } catch (fileError) {
        console.error(`   ❌ [${folder.name}] ${file.name}:`, fileError);
        localStats.errors++;
      }
    }

    console.log(`✅ [${folder.name}] Fertig (${localStats.filesPosted} gepostet)`);
    return localStats;

  } catch (folderError) {
    console.error(`❌ [${folder.name}] Ordner-Fehler:`, folderError);
    localStats.errors++;
    return localStats;
  }
}

/**
 * Parallele Synchronisierungsfunktion
 * Verarbeitet mehrere Ordner gleichzeitig
 */
export async function syncOneDriveToTelegramParallel(config: BotConfig): Promise<SyncStats> {
  const startTime = Date.now();
  
  // Versuche vorherige Stats zu laden
  const { loadSyncStats, saveSyncStats } = await import('./store');
  const previousStats = await loadSyncStats();
  
  const stats: SyncStats = previousStats || {
    foldersScanned: 0,
    filesFound: 0,
    filesPosted: 0,
    errors: 0,
    duration: 0,
  };
  
  // Setze Startzeit nur wenn neue Session
  if (!previousStats) {
    (stats as any).startTime = startTime;
  }

  try {
    console.log('🔄 Starte PARALLELE Synchronisierung...');
    
    const lockAcquired = await acquireSyncLock();
    if (!lockAcquired) {
      console.log(`⏸️  Synchronisierung läuft bereits - überspringe`);
      stats.duration = Date.now() - startTime;
      return stats;
    }

    const onedrive = new OneDriveClient(config);
    const bot = new TelegramBot(config);
    const topicManager = new TopicManager(bot);

    const folders = await onedrive.listSubfolders(config.onedriveFolderPath);
    console.log(`📁 ${folders.length} Ordner gefunden`);

    if (folders.length === 0) {
      console.log('⚠️ Keine Ordner gefunden');
      stats.duration = Date.now() - startTime;
      await releaseSyncLock();
      return stats;
    }

    // PARALLEL: 2 Ordner gleichzeitig
    const CONCURRENT = 2;
    
    for (let i = 0; i < folders.length; i += CONCURRENT) {
      const batch = folders.slice(i, i + CONCURRENT);
      console.log(`\n📦 Batch ${Math.floor(i / CONCURRENT) + 1}/${Math.ceil(folders.length / CONCURRENT)}: ${batch.map(f => f.name).join(', ')}`);
      
      const batchResults = await Promise.all(
        batch.map(folder => 
          processFolderParallel(folder, onedrive, bot, topicManager, config)
        )
      );

      // Aggregiere Statistiken
      batchResults.forEach(result => {
        stats.foldersScanned++;
        stats.filesFound += result.filesFound;
        stats.filesPosted += result.filesPosted;
        stats.errors += result.errors;
      });

      console.log(`   📊 Batch-Fortschritt: ${stats.filesPosted} von ${stats.filesFound} Dateien gepostet`);
      
      // Speichere Stats nach jedem Batch
      await saveSyncStats({
        ...stats,
        lastUpdate: Date.now(),
        isRunning: true
      });
    }

    stats.duration = Date.now() - startTime;

    console.log('\n✨ Synchronisierung abgeschlossen');
    console.log(`📊 Finale Statistiken:`);
    console.log(`   - Ordner: ${stats.foldersScanned}`);
    console.log(`   - Dateien gefunden: ${stats.filesFound}`);
    console.log(`   - Dateien gepostet: ${stats.filesPosted}`);
    console.log(`   - Fehler: ${stats.errors}`);
    console.log(`   - Dauer: ${(stats.duration / 1000).toFixed(2)}s`);

    // Markiere als abgeschlossen und speichere
    await saveSyncStats({
      ...stats,
      lastUpdate: Date.now(),
      isRunning: false
    });

    await releaseSyncLock();
    return stats;

  } catch (error) {
    console.error('❌ Kritischer Fehler:', error);
    stats.errors++;
    stats.duration = Date.now() - startTime;
    
    // Speichere Stats im Fehlerfall
    await saveSyncStats({
      ...stats,
      lastUpdate: Date.now(),
      isRunning: false,
      error: error instanceof Error ? error.message : String(error)
    });
    
    await releaseSyncLock();
    throw error;
  }
}
