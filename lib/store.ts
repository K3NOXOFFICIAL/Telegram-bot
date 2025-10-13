/**
 * Persistente Speicherverwaltung
 * Speichert Informationen über gepostete Dateien und Topic-Mappings
 */

import { BotState, PostedFile, TopicMapping } from './types';

// Fallback: In-Memory Store für lokale Entwicklung
let memoryStore: BotState = {
  postedFiles: [],
  topicMappings: [],
  lastSync: new Date().toISOString(),
};

/**
 * Redis/KV Store (wenn verfügbar)
 */
let kvStore: any = null;
let storeInitialized = false;
let storeInitializing: Promise<void> | null = null;

// Versuche Redis-Store zu initialisieren
async function initializeStore() {
  if (storeInitialized) return;
  if (storeInitializing) return storeInitializing;
  
  storeInitializing = (async () => {
    // Priorität 1: REDIS_URL (Standard Redis)
    if (process.env.REDIS_URL) {
      try {
        const { createClient } = require('redis');
        const client = createClient({
          url: process.env.REDIS_URL
        });
        
        await client.connect();
        console.log('✅ Redis verbunden (REDIS_URL)');
        
        // Erstelle ein KV-kompatibles Interface
        kvStore = {
          get: async (key: string) => {
            const data = await client.get(key);
            return data ? JSON.parse(data) : null;
          },
          set: async (key: string, value: any, options?: any) => {
            const serialized = JSON.stringify(value);
            if (options?.nx && options?.px) {
              // SET with NX and PX options
              const result = await client.set(key, serialized, {
                NX: true,
                PX: options.px
              });
              return result === 'OK';
            } else if (options?.px) {
              await client.set(key, serialized, { PX: options.px });
              return true;
            } else {
              await client.set(key, serialized);
              return true;
            }
          },
          del: async (key: string | string[]) => {
            await client.del(key);
          },
          _client: client
        };
        storeInitialized = true;
        return;
      } catch (error) {
        console.log('❌ Redis-Verbindung fehlgeschlagen:', error);
      }
    }
    
    // Priorität 2: Vercel KV (nur wenn KV_REST_API_URL gesetzt ist)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const { kv } = require('@vercel/kv');
        kvStore = kv;
        console.log('✅ Vercel KV verbunden');
        storeInitialized = true;
        return;
      } catch (error) {
        console.log('❌ Vercel KV fehlgeschlagen:', error);
      }
    }
    
    // Fallback: In-Memory Store
    console.log('⚠️  Nutze In-Memory Store (keine persistente Speicherung)');
    storeInitialized = true;
  })();
  
  return storeInitializing;
}

/**
 * Lädt den aktuellen Bot-Status
 */
export async function loadState(): Promise<BotState> {
  await initializeStore();
  
  try {
    if (kvStore) {
      const state = await kvStore.get('bot_state');
      if (state) {
        return state as BotState;
      }
    }
  } catch (error) {
    console.error('Fehler beim Laden des Status aus KV:', error);
  }

  return memoryStore;
}

/**
 * Speichert den Bot-Status
 */
export async function saveState(state: BotState): Promise<void> {
  await initializeStore();
  
  try {
    if (kvStore) {
      await kvStore.set('bot_state', state);
    }
  } catch (error) {
    console.error('Fehler beim Speichern des Status in KV:', error);
  }

  // Immer auch im Memory Store speichern
  memoryStore = state;
}

/**
 * Prüft, ob eine Datei bereits gepostet wurde
 */
export async function isFilePosted(fileId: string): Promise<boolean> {
  await initializeStore();
  
  try {
    if (kvStore) {
      // Versuche direkt aus Redis zu prüfen
      const posted = await kvStore.get(`file:${fileId}`);
      return !!posted;
    }
  } catch (error) {
    console.error('Fehler beim Prüfen der Datei in KV:', error);
  }
  
  // Fallback auf bot_state
  const state = await loadState();
  return state.postedFiles.some(f => f.fileId === fileId);
}

/**
 * Markiert eine Datei als gepostet
 */
export async function markFileAsPosted(
  fileId: string,
  fileName: string,
  folderName: string,
  messageId: number
): Promise<void> {
  await initializeStore();
  
  const postedFile: PostedFile = {
    fileId,
    fileName,
    folderName,
    messageId,
    postedAt: new Date().toISOString(),
  };

  let redisSuccess = false;
  let stateSuccess = false;

  // Versuch 1: Speichere in Redis
  try {
    if (kvStore) {
      await kvStore.set(`file:${fileId}`, postedFile);
      redisSuccess = true;
    }
  } catch (error) {
    console.error('❌ Fehler beim Markieren der Datei in Redis:', error);
  }

  // Versuch 2: Speichere in bot_state (Fallback)
  try {
    const state = await loadState();
    // Prüfe ob bereits vorhanden (verhindere Duplikate)
    if (!state.postedFiles.some(f => f.fileId === fileId)) {
      state.postedFiles.push(postedFile);
      state.lastSync = new Date().toISOString();
      await saveState(state);
      stateSuccess = true;
    } else {
      stateSuccess = true; // Bereits vorhanden = Erfolg
    }
  } catch (error) {
    console.error('❌ Fehler beim Speichern in bot_state:', error);
  }

  // Mindestens eine Speichermethode muss erfolgreich sein
  if (!redisSuccess && !stateSuccess) {
    throw new Error(`Konnte Datei ${fileName} nicht als gepostet markieren`);
  }
}

/**
 * Holt das Topic-Mapping für einen Ordner
 */
export async function getTopicMapping(folderName: string): Promise<TopicMapping | null> {
  await initializeStore();
  
  try {
    if (kvStore) {
      // Versuche direkt aus Redis zu laden
      const mapping = await kvStore.get(`topic:${folderName}`);
      if (mapping) {
        console.log(`✅ Topic-Mapping aus Redis geladen: ${folderName} → ${mapping.topicId}`);
        return mapping as TopicMapping;
      } else {
        console.log(`ℹ️  Kein Topic-Mapping in Redis für: ${folderName}`);
      }
    }
  } catch (error) {
    console.error('Fehler beim Laden des Topic-Mappings aus KV:', error);
  }
  
  // Fallback auf bot_state
  const state = await loadState();
  const fallbackMapping = state.topicMappings.find(m => m.folderName === folderName);
  if (fallbackMapping) {
    console.log(`⚠️  Topic-Mapping aus bot_state geladen (Fallback): ${folderName} → ${fallbackMapping.topicId}`);
  }
  return fallbackMapping || null;
}

/**
 * Speichert ein Topic-Mapping
 */
export async function saveTopicMapping(
  folderName: string,
  topicId: number,
  topicName: string
): Promise<void> {
  await initializeStore();
  
  // Validierung: Prüfe ob topicId bereits für einen anderen Ordner verwendet wird
  const state = await loadState();
  const conflictingMapping = state.topicMappings.find(
    m => m.topicId === topicId && m.folderName !== folderName
  );
  
  if (conflictingMapping) {
    console.warn(`⚠️  Topic ${topicId} ist bereits Ordner '${conflictingMapping.folderName}' zugeordnet`);
    // Entferne altes Mapping
    state.topicMappings = state.topicMappings.filter(
      m => m.topicId !== topicId
    );
  }
  
  const mapping: TopicMapping = {
    folderName,
    topicId,
    topicName,
    createdAt: new Date().toISOString(),
  };

  try {
    if (kvStore) {
      // Speichere direkt in Redis mit separatem Key
      await kvStore.set(`topic:${folderName}`, mapping);
      console.log(`✅ Topic-Mapping gespeichert: ${folderName} → Topic ${topicId}`);
    }
  } catch (error) {
    console.error('Fehler beim Speichern des Topic-Mappings in KV:', error);
    // Trotzdem in bot_state speichern
  }

  // Auch im bot_state speichern (Fallback)
  state.topicMappings = state.topicMappings.filter(
    m => m.folderName !== folderName
  );
  state.topicMappings.push(mapping);
  await saveState(state);
}

/**
 * Holt alle Topic-Mappings aus Redis (primär) oder bot_state (fallback)
 */
export async function getAllTopicMappings(): Promise<TopicMapping[]> {
  await initializeStore();
  
  try {
    if (kvStore) {
      // Versuche alle topic:* Keys aus Redis zu laden
      let topicKeys: string[] = [];
      
      // Redis mit _client (Standard Redis)
      if (kvStore._client) {
        try {
          topicKeys = await kvStore._client.keys('topic:*');
        } catch (error) {
          console.warn('⚠️  Redis KEYS Befehl fehlgeschlagen, nutze SCAN:', error);
          // Fallback: SCAN (sicherer für große Datenmengen)
          const keys: string[] = [];
          let cursor = '0';
          do {
            const result = await kvStore._client.scan(cursor, {
              MATCH: 'topic:*',
              COUNT: 100
            });
            cursor = result.cursor;
            keys.push(...result.keys);
          } while (cursor !== '0');
          topicKeys = keys;
        }
      } 
      // Vercel KV
      else if (kvStore.keys) {
        topicKeys = await kvStore.keys('topic:*');
      }
      
      if (topicKeys.length > 0) {
        // Lade alle Topic-Mappings parallel
        const mappings = await Promise.all(
          topicKeys.map(async (key) => {
            try {
              const mapping = await kvStore.get(key);
              return mapping as TopicMapping;
            } catch (error) {
              console.error(`Fehler beim Laden von ${key}:`, error);
              return null;
            }
          })
        );
        
        // Filtere null-Werte und sortiere nach createdAt
        const validMappings = mappings.filter(m => m !== null) as TopicMapping[];
        console.log(`📊 ${validMappings.length} Topic-Mappings aus Redis geladen`);
        return validMappings.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
    }
  } catch (error) {
    console.error('Fehler beim Laden der Topic-Mappings aus Redis:', error);
  }
  
  // Fallback: Aus bot_state laden
  console.log('⚠️  Fallback: Lade Topic-Mappings aus bot_state');
  const state = await loadState();
  return state.topicMappings;
}

/**
 * Speichert die aktuellen Sync-Stats in Redis
 */
export async function saveSyncStats(stats: any): Promise<void> {
  await initializeStore();
  
  try {
    if (kvStore) {
      await kvStore.set('sync_stats', stats);
    }
  } catch (error) {
    console.error('Fehler beim Speichern der Sync-Stats:', error);
  }
}

/**
 * Lädt die aktuellen Sync-Stats aus Redis
 */
export async function loadSyncStats(): Promise<any | null> {
  await initializeStore();
  
  try {
    if (kvStore) {
      return await kvStore.get('sync_stats');
    }
  } catch (error) {
    console.error('Fehler beim Laden der Sync-Stats:', error);
  }
  
  return null;
}

/**
 * Speichert die Liste der Dateien, die bereits im Topic existieren
 */
export async function saveTopicFiles(topicId: number, fileNames: string[]): Promise<void> {
  await initializeStore();
  
  // Validierung: Entferne Duplikate
  const uniqueFileNames = Array.from(new Set(fileNames));
  
  if (uniqueFileNames.length !== fileNames.length) {
    console.warn(`⚠️  ${fileNames.length - uniqueFileNames.length} Duplikate in Topic ${topicId} gefunden und entfernt`);
  }
  
  try {
    if (kvStore) {
      await kvStore.set(`topic_files:${topicId}`, uniqueFileNames);
      console.log(`✅ ${uniqueFileNames.length} Dateien für Topic ${topicId} gespeichert`);
    } else {
      console.warn('⚠️  Kein KV Store - Topic-Dateien können nicht persistent gespeichert werden');
    }
  } catch (error) {
    console.error('❌ Fehler beim Speichern der Topic-Dateien:', error);
    throw error; // Wirf Fehler weiter, damit Aufrufer reagieren kann
  }
}

/**
 * Lädt die Liste der Dateien, die bereits im Topic existieren
 */
export async function loadTopicFiles(topicId: number): Promise<Set<string>> {
  await initializeStore();
  
  try {
    if (kvStore) {
      const files = await kvStore.get(`topic_files:${topicId}`);
      if (files && Array.isArray(files)) {
        console.log(`📝 Lade ${files.length} Dateien für Topic ${topicId}`);
        return new Set(files);
      } else {
        console.log(`🆕 Keine gespeicherten Dateien für Topic ${topicId}`);
      }
    } else {
      console.log('⚠️  Kein KV Store - kann Topic-Dateien nicht laden');
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der Topic-Dateien:', error);
    // Gebe leeres Set zurück statt zu crashen
  }
  
  return new Set();
}

/**
 * Prüft ob eine Datei bereits im Topic existiert (anhand des Dateinamens)
 */
export async function isFileInTopic(topicId: number, fileName: string): Promise<boolean> {
  if (!fileName || fileName.trim() === '') {
    console.warn('⚠️  Leerer Dateiname in isFileInTopic');
    return false;
  }
  
  const topicFiles = await loadTopicFiles(topicId);
  const exists = topicFiles.has(fileName);
  
  if (exists) {
    console.log(`✅ Datei '${fileName}' bereits in Topic ${topicId}`);
  }
  
  return exists;
}

/**
 * Löscht alte gepostete Dateien (älter als X Tage)
 * ⚠️ WARNUNG: Diese Funktion sollte NICHT verwendet werden!
 * Wenn alte Datei-IDs gelöscht werden, würde der Bot diese Dateien beim nächsten
 * Sync erneut hochladen (Duplikate!). Das Topic-Scan-System verhindert zwar
 * Duplikate, aber es ist besser, alle Datei-IDs dauerhaft zu speichern.
 * 
 * Diese Funktion bleibt nur für manuelle Cleanup-Operationen verfügbar.
 */
export async function cleanupOldFiles(daysToKeep: number = 30): Promise<number> {
  const state = await loadState();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const originalCount = state.postedFiles.length;

  state.postedFiles = state.postedFiles.filter(file => {
    const postedDate = new Date(file.postedAt);
    return postedDate > cutoffDate;
  });

  const removedCount = originalCount - state.postedFiles.length;

  if (removedCount > 0) {
    await saveState(state);
  }

  return removedCount;
}

/**
 * Holt alle gespeicherten File-IDs aus Redis (für Debugging/Monitoring)
 */
export async function getAllPostedFileIds(): Promise<string[]> {
  await initializeStore();
  
  const fileIds: string[] = [];
  
  try {
    if (kvStore && kvStore._client) {
      // Verwende SCAN um alle file:* Keys zu finden (sicher für große Datensets)
      const keys = await kvStore._client.keys('file:*');
      fileIds.push(...keys.map((k: string) => k.replace('file:', '')));
    }
  } catch (error) {
    console.error('❌ Fehler beim Abrufen aller File-IDs:', error);
  }
  
  return fileIds;
}

/**
 * Prüft die Store-Konsistenz (für Monitoring/Debugging)
 */
export async function checkStoreConsistency(): Promise<{
  redisFiles: number;
  stateFiles: number;
  redisTopics: number;
  stateTopics: number;
  issues: string[];
}> {
  await initializeStore();
  
  const report = {
    redisFiles: 0,
    stateFiles: 0,
    redisTopics: 0,
    stateTopics: 0,
    issues: [] as string[],
  };
  
  try {
    // Zähle Redis Files
    if (kvStore && kvStore._client) {
      const fileKeys = await kvStore._client.keys('file:*');
      report.redisFiles = fileKeys.length;
      
      const topicKeys = await kvStore._client.keys('topic:*');
      report.redisTopics = topicKeys.length;
    }
    
    // Zähle State Files
    const state = await loadState();
    report.stateFiles = state.postedFiles.length;
    report.stateTopics = state.topicMappings.length;
    
    // Prüfe auf Inkonsistenzen
    if (report.redisFiles > 0 && report.stateFiles > 0) {
      if (Math.abs(report.redisFiles - report.stateFiles) > 10) {
        report.issues.push(`Große Differenz zwischen Redis (${report.redisFiles}) und State (${report.stateFiles}) Files`);
      }
    }
    
    if (report.redisTopics > 0 && report.stateTopics > 0) {
      if (report.redisTopics !== report.stateTopics) {
        report.issues.push(`Topic-Mappings unterschiedlich: Redis=${report.redisTopics}, State=${report.stateTopics}`);
      }
    }
    
  } catch (error) {
    report.issues.push(`Fehler bei Konsistenz-Prüfung: ${error}`);
  }
  
  return report;
}

/**
 * Setzt den Store zurück (nur für Tests/Entwicklung)
 */
export async function resetStore(): Promise<void> {
  const emptyState: BotState = {
    postedFiles: [],
    topicMappings: [],
    lastSync: new Date().toISOString(),
  };

  await saveState(emptyState);
}

/**
 * Versucht einen Sync-Lock zu erhalten
 * Verhindert, dass mehrere Deployments gleichzeitig synchronisieren
 */
export async function acquireSyncLock(): Promise<boolean> {
  await initializeStore();
  
  if (!kvStore) {
    // Ohne Redis/KV können wir keinen Lock setzen
    console.log('⚠️  Kein KV Store - kann Lock nicht setzen');
    return true;
  }

  try {
    const lockKey = 'sync_lock';
    const now = Date.now();
    const lockTimeout = 5 * 60 * 1000; // 5 Minuten (reduziert von 30)
    
    // Prüfe ob ein Lock existiert und ob er abgelaufen ist
    const existingLock = await kvStore.get(lockKey);
    if (existingLock) {
      const lockTimestamp = parseInt(existingLock, 10);
      const lockAge = now - lockTimestamp;
      
      if (lockAge > lockTimeout) {
        // Lock ist abgelaufen, lösche ihn
        console.log(`⏰ Lock ist abgelaufen (${Math.round(lockAge / 1000)}s alt) - lösche und setze neu`);
        await kvStore.del(lockKey);
      } else {
        console.log(`⏸️  Sync läuft bereits (${Math.round(lockAge / 1000)}s aktiv) - überspringe`);
        return false;
      }
    }
    
    // Versuche Lock zu setzen mit NX (only if not exists) und PX (expire in milliseconds)
    const result = await kvStore.set(lockKey, now.toString(), {
      nx: true,  // Nur setzen wenn Key nicht existiert
      px: lockTimeout  // Expire nach 5 Minuten
    });
    
    if (result) {
      console.log('🔒 Sync-Lock erhalten');
      return true;
    }
    
    console.log('⏸️  Sync läuft bereits - überspringe');
    return false;
  } catch (error) {
    console.error('❌ Fehler beim Lock-Handling:', error);
    return true; // Im Fehlerfall trotzdem ausführen
  }
}

/**
 * Gibt den Sync-Lock frei
 */
export async function releaseSyncLock(): Promise<void> {
  await initializeStore();
  
  if (!kvStore) {
    return;
  }

  try {
    const lockKey = 'sync_lock';
    await kvStore.del(lockKey);
    console.log('🔓 Sync-Lock freigegeben');
  } catch (error) {
    console.error('❌ Fehler beim Lock-Release:', error);
  }
}

/**
 * Holt den aktuellen Lock-Status (für Debugging)
 */
export async function getSyncLockStatus(): Promise<{
  locked: boolean;
  age?: number;
  timestamp?: number;
}> {
  await initializeStore();
  
  if (!kvStore) {
    return { locked: false };
  }

  try {
    const lockKey = 'sync_lock';
    const lockValue = await kvStore.get(lockKey);
    
    if (!lockValue) {
      return { locked: false };
    }
    
    const timestamp = parseInt(lockValue, 10);
    const age = Date.now() - timestamp;
    
    return {
      locked: true,
      age,
      timestamp
    };
  } catch (error) {
    console.error('❌ Fehler beim Abrufen des Lock-Status:', error);
    return { locked: false };
  }
}

/**
 * Speichert den aktuellen Sync-Fortschritt (für Chunked Processing)
 */
export async function saveSyncProgress(progress: { currentFolderIndex: number; totalFolders: number } | null): Promise<void> {
  await initializeStore();
  
  try {
    if (kvStore) {
      if (progress === null) {
        // Lösche Fortschritt (Sync abgeschlossen)
        await kvStore.del('sync_progress');
        console.log('🗑️  Sync-Fortschritt gelöscht');
      } else {
        await kvStore.set('sync_progress', progress);
        console.log(`💾 Fortschritt gespeichert: ${progress.currentFolderIndex}/${progress.totalFolders}`);
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Speichern des Fortschritts:', error);
  }
}

/**
 * Lädt den aktuellen Sync-Fortschritt
 */
export async function getSyncProgress(): Promise<{ currentFolderIndex: number; totalFolders: number } | null> {
  await initializeStore();
  
  try {
    if (kvStore) {
      const progress = await kvStore.get('sync_progress');
      if (progress) {
        console.log(`📂 Fortschritt geladen: Ordner ${progress.currentFolderIndex}/${progress.totalFolders}`);
        return progress;
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden des Fortschritts:', error);
  }
  
  return null;
}
