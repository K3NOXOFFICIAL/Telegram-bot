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
            // Prüfe 1: Redis File-ID Check (wurde bereits hochgeladen?)
            const alreadyPosted = await isFilePosted(file.id);
            if (alreadyPosted) {
              console.log(`⏭️ Überspringe bereits gepostete Datei: ${file.name} (in Redis gefunden)`);
              continue;
            }

            // Prüfe 2: Topic-Dateien Check (existiert im Topic?)
            const { isFileInTopic, loadTopicFiles, saveTopicFiles } = await import('./store');
            const existsInTopic = await isFileInTopic(topicId, file.name);
            if (existsInTopic) {
              console.log(`⏭️ Überspringe: ${file.name} (bereits im Topic)`);
              // Markiere auch in Redis, um zukünftige Prüfungen zu beschleunigen
              await markFileAsPosted(file.id, file.name, folder.name, 0);
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

            // Poste Datei mit Retry-Logik
            let message;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
              try {
                if (isVideo) {
                  console.log(`   🎥 Sende Video...`);
                  message = await bot.sendVideoByUrl(downloadUrl, file.name, topicId);
                } else {
                  console.log(`   🖼️  Sende Bild...`);
                  message = await bot.sendPhotoByUrl(downloadUrl, file.name, topicId);
                }
                break; // Erfolgreich
              } catch (sendError: any) {
                if (sendError?.error_code === 429) {
                  const retryAfter = sendError?.parameters?.retry_after || 10;
                  console.log(`   ⏳ Rate limit - warte ${retryAfter}s (Versuch ${retryCount + 1}/${maxRetries})`);
                  await bot.delay(retryAfter * 1000);
                  retryCount++;
                } else {
                  throw sendError;
                }
              }
            }

            if (message) {
              // Markiere als gepostet in Redis
              await markFileAsPosted(file.id, file.name, folder.name, message.message_id);
              
              // Füge Dateiname auch zur Topic-Files-Liste hinzu
              const topicFiles = await loadTopicFiles(topicId);
              topicFiles.add(file.name);
              await saveTopicFiles(topicId, Array.from(topicFiles));
              
              stats.filesPosted++;
              console.log(`   ✅ Erfolgreich gepostet: ${file.name}`);
            } else {
              console.error(`   ❌ Fehler beim Posten von ${file.name}`);
              stats.errors++;
            }

            // Rate Limiting: 3s zwischen Posts (20 msg/min Limit)
            await bot.delay(3000);

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
 * Mit robustem Error Handling - Fehler stoppen nicht den gesamten Prozess
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
    const folderStartTime = Date.now();
    const timestamp = new Date().toLocaleTimeString('de-DE');
    console.log(`\n📂 [${timestamp}] [${folder.name}] Start`);

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
          console.error(`   ❌ [${folder.name}] Keine Download-URL für ${file.name}`);
          localStats.errors++;
          continue; // Weiter mit nächster Datei
        }

        let message;
        let retryCount = 0;
        const maxRetries = 5; // Erhöht von 3 auf 5
        let lastError: any = null;

        while (retryCount < maxRetries) {
          try {
            if (isVideo) {
              message = await bot.sendVideoByUrl(downloadUrl, file.name, topicId);
            } else {
              message = await bot.sendPhotoByUrl(downloadUrl, file.name, topicId);
            }
            break; // Erfolgreich
          } catch (sendError: any) {
            lastError = sendError;
            retryCount++;
            
            // Rate Limit Error - warte und versuche erneut
            if (sendError?.error_code === 429) {
              const retryAfter = sendError?.parameters?.retry_after || 10;
              console.log(`   ⏳ [${folder.name}] Rate limit - warte ${retryAfter}s (Versuch ${retryCount}/${maxRetries})`);
              await bot.delay(retryAfter * 1000);
            } 
            // Timeout Error - warte kurz und versuche erneut
            else if (sendError?.message?.includes('timeout') || sendError?.code === 'ETIMEDOUT') {
              console.log(`   ⏳ [${folder.name}] Timeout - warte 5s (Versuch ${retryCount}/${maxRetries})`);
              await bot.delay(5000);
            }
            // Network Error - warte und versuche erneut
            else if (sendError?.code === 'ECONNRESET' || sendError?.code === 'ENOTFOUND') {
              console.log(`   ⏳ [${folder.name}] Netzwerkfehler - warte 10s (Versuch ${retryCount}/${maxRetries})`);
              await bot.delay(10000);
            }
            // Andere Fehler - logge und breche ab
            else {
              console.error(`   ❌ [${folder.name}] Fehler beim Upload (${sendError?.error_code || sendError?.code}): ${sendError?.description || sendError?.message}`);
              break; // Kein Retry bei unbekannten Fehlern
            }
          }
        }

        if (message) {
          // Speichere in Redis file:ID mit Error Handling
          try {
            await markFileAsPosted(file.id, file.name, folder.name, message.message_id);
          } catch (markError) {
            console.error(`   ⚠️  [${folder.name}] Konnte file:ID nicht speichern (Upload erfolgreich):`, markError);
            // Nicht kritisch, versuche topic_files trotzdem
          }
          
          // Füge Dateiname auch zur Topic-Files-Liste hinzu
          try {
            const { loadTopicFiles, saveTopicFiles } = await import('./store');
            const topicFiles = await loadTopicFiles(topicId);
            topicFiles.add(file.name);
            await saveTopicFiles(topicId, Array.from(topicFiles));
          } catch (topicFilesError) {
            console.error(`   ⚠️  [${folder.name}] Konnte topic_files nicht aktualisieren:`, topicFilesError);
            // Nicht kritisch, da file:ID bereits gespeichert wurde
          }
          
          localStats.filesPosted++;
          console.log(`   ✅ [${folder.name}] ${file.name}`);
        } else {
          console.error(`   ❌ [${folder.name}] Upload fehlgeschlagen nach ${maxRetries} Versuchen: ${file.name}`);
          if (lastError) {
            console.error(`   ❌ [${folder.name}] Letzter Fehler:`, lastError?.description || lastError?.message);
          }
          localStats.errors++;
          // Weiter mit nächster Datei - nicht abbrechen!
        }

        // Telegram Limit: 20 msg/min pro Chat = 3s zwischen msgs
        // Bei 6 parallelen Topics = 30 msg/sec insgesamt (Max!)
        await bot.delay(3000);

      } catch (fileError: any) {
        console.error(`   ❌ [${folder.name}] Fehler bei ${file.name}:`, fileError?.message || fileError);
        localStats.errors++;
        // Weiter mit nächster Datei - nicht abbrechen!
        continue;
      }
    }

    const folderDuration = ((Date.now() - folderStartTime) / 1000).toFixed(1);
    const timestamp2 = new Date().toLocaleTimeString('de-DE');
    console.log(`✅ [${timestamp2}] [${folder.name}] Fertig (${localStats.filesPosted}/${mediaFiles.length} gepostet, ${localStats.errors} Fehler in ${folderDuration}s)`);
    return localStats;

  } catch (folderError: any) {
    console.error(`❌ [${folder.name}] Kritischer Ordner-Fehler:`, folderError?.message || folderError);
    localStats.errors++;
    // Gebe Stats zurück, damit andere Ordner weiterlaufen
    return localStats;
  }
}

/**
 * Parallele Synchronisierungsfunktion
 * Verarbeitet mehrere Ordner gleichzeitig
 */
export async function syncOneDriveToTelegramParallel(config: BotConfig): Promise<SyncStats> {
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 4 * 60 * 1000; // 4 Minuten (Sicherheitspuffer von 1 Min)
  
  // Versuche vorherige Stats zu laden
  const { loadSyncStats, saveSyncStats, getSyncProgress, saveSyncProgress } = await import('./store');
  const previousStats = await loadSyncStats();
  const progress = await getSyncProgress();
  
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
    
    if (progress) {
      console.log(`📍 Setze fort bei Ordner ${progress.currentFolderIndex + 1}`);
    }
    
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
      await saveSyncProgress(null); // Kein Fortschritt zu speichern
      await releaseSyncLock();
      return stats;
    }

    // PARALLEL: 6 Ordner gleichzeitig (optimiert für Telegram Limits)
    // Telegram erlaubt: 20 msg/min pro Topic, 30 msg/sec broadcast insgesamt
    // 6 parallel = max. Nutzung der 30 msg/sec Gesamtkapazität
    const CONCURRENT = 6;
    const startIndex = progress?.currentFolderIndex || 0;
    let needsContinuation = false;
    
    for (let i = startIndex; i < folders.length; i += CONCURRENT) {
      // Prüfe ob wir dem Timeout nahe kommen
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_TIME) {
        console.log(`⏰ Zeit-Limit erreicht (${Math.round(elapsed/1000)}s) - stoppe und speichere Fortschritt`);
        needsContinuation = true;
        await saveSyncProgress({ currentFolderIndex: i, totalFolders: folders.length });
        break;
      }
      
      const batch = folders.slice(i, i + CONCURRENT);
      const batchNum = Math.floor(i / CONCURRENT) + 1;
      const totalBatches = Math.ceil(folders.length / CONCURRENT);
      
      console.log(`\n📦 Batch ${batchNum}/${totalBatches}: Starte ${batch.length} Ordner PARALLEL`);
      console.log(`   📂 ${batch.map(f => f.name).join(' | ')}`);
      
      const batchStartTime = Date.now();
      // Verwende allSettled statt all - Fehler in einem Ordner stoppen nicht die anderen
      const batchPromises = await Promise.allSettled(
        batch.map(folder => 
          processFolderParallel(folder, onedrive, bot, topicManager, config)
        )
      );
      
      // Extrahiere Results und logge Fehler
      const batchResults = batchPromises.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`❌ Batch ${batchNum} - Ordner ${batch[index].name} komplett fehlgeschlagen:`, result.reason);
          return { filesFound: 0, filesPosted: 0, errors: 1 };
        }
      });
      
      const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);

      // Aggregiere Statistiken
      let batchFilesPosted = 0;
      batchResults.forEach(result => {
        stats.foldersScanned++;
        stats.filesFound += result.filesFound;
        stats.filesPosted += result.filesPosted;
        stats.errors += result.errors;
        batchFilesPosted += result.filesPosted;
      });

      console.log(`✅ Batch ${batchNum} abgeschlossen in ${batchDuration}s`);
      console.log(`   📊 Batch: ${batchFilesPosted} Dateien gepostet`);
      console.log(`   📊 Gesamt: ${stats.filesPosted} von ${stats.filesFound} Dateien (${stats.errors} Fehler)`);
      
      // Speichere Stats nach jedem Batch mit Error Handling
      try {
        await saveSyncStats({
          ...stats,
          lastUpdate: Date.now(),
          isRunning: true
        });
      } catch (saveError) {
        console.error('⚠️  Konnte Stats nicht speichern (nicht kritisch):', saveError);
        // Weiter mit Upload - Stats sind nicht kritisch
      }
    }

    stats.duration = Date.now() - startTime;

    if (needsContinuation) {
      console.log('\n⏸️ Synchronisierung pausiert - wird automatisch fortgesetzt');
      console.log(`📊 Zwischenstand:`);
      console.log(`   - Ordner: ${stats.foldersScanned}/${folders.length}`);
      console.log(`   - Dateien gefunden: ${stats.filesFound}`);
      console.log(`   - Dateien gepostet: ${stats.filesPosted}`);
      console.log(`   - Fehler: ${stats.errors}`);
      console.log(`   - Dauer: ${(stats.duration / 1000).toFixed(2)}s`);
      
      // Speichere Stats mit 'needs continuation' Flag
      await saveSyncStats({
        ...stats,
        lastUpdate: Date.now(),
        isRunning: false,
        needsContinuation: true
      });
      
      await releaseSyncLock();
      
      // Triggere automatische Fortsetzung (nach 2 Sekunden Pause)
      console.log('🔄 Triggere automatische Fortsetzung...');
      return stats;
    }

    console.log('\n✨ Synchronisierung abgeschlossen');
    console.log(`📊 Finale Statistiken:`);
    console.log(`   - Ordner: ${stats.foldersScanned}`);
    console.log(`   - Dateien gefunden: ${stats.filesFound}`);
    console.log(`   - Dateien gepostet: ${stats.filesPosted}`);
    console.log(`   - Fehler: ${stats.errors}`);
    console.log(`   - Dauer: ${(stats.duration / 1000).toFixed(2)}s`);

    // Markiere als abgeschlossen und lösche Fortschritt
    await saveSyncProgress(null);
    await saveSyncStats({
      ...stats,
      lastUpdate: Date.now(),
      isRunning: false,
      needsContinuation: false
    });

    await releaseSyncLock();
    return stats;

  } catch (error: any) {
    console.error('❌ Kritischer Fehler:', error?.message || error);
    stats.errors++;
    stats.duration = Date.now() - startTime;
    
    // Speichere Stats im Fehlerfall (mit Error Handling)
    try {
      await saveSyncStats({
        ...stats,
        lastUpdate: Date.now(),
        isRunning: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } catch (saveError) {
      console.error('⚠️  Konnte Stats im Fehlerfall nicht speichern:', saveError);
    }
    
    // Garantiere Lock-Freigabe mit Error Handling
    try {
      await releaseSyncLock();
    } catch (lockError) {
      console.error('⚠️  Konnte Lock nicht freigeben:', lockError);
    }
    
    // Werfe Fehler NICHT weiter - erlaube Fortsetzung
    console.log('🔄 Fehler geloggt - Sync kann fortgesetzt werden');
    return stats;
  }
}
