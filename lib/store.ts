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

  try {
    if (kvStore) {
      // Speichere direkt in Redis mit separatem Key
      await kvStore.set(`file:${fileId}`, postedFile);
    }
  } catch (error) {
    console.error('Fehler beim Markieren der Datei in KV:', error);
  }

  // Auch im bot_state speichern (Fallback)
  const state = await loadState();
  state.postedFiles.push(postedFile);
  state.lastSync = new Date().toISOString();
  await saveState(state);
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
  }

  // Auch im bot_state speichern (Fallback)
  const state = await loadState();
  state.topicMappings = state.topicMappings.filter(
    m => m.folderName !== folderName
  );
  state.topicMappings.push(mapping);
  await saveState(state);
}

/**
 * Holt alle Topic-Mappings
 */
export async function getAllTopicMappings(): Promise<TopicMapping[]> {
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
  
  try {
    if (kvStore) {
      await kvStore.set(`topic_files:${topicId}`, fileNames);
      console.log(`✅ ${fileNames.length} Dateien für Topic ${topicId} gespeichert`);
    }
  } catch (error) {
    console.error('Fehler beim Speichern der Topic-Dateien:', error);
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
        return new Set(files);
      }
    }
  } catch (error) {
    console.error('Fehler beim Laden der Topic-Dateien:', error);
  }
  
  return new Set();
}

/**
 * Prüft ob eine Datei bereits im Topic existiert (anhand des Dateinamens)
 */
export async function isFileInTopic(topicId: number, fileName: string): Promise<boolean> {
  const topicFiles = await loadTopicFiles(topicId);
  return topicFiles.has(fileName);
}

/**
 * Löscht alte gepostete Dateien (älter als X Tage)
 * Verhindert, dass der Store zu groß wird
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
    const timestamp = Date.now().toString();
    
    // Versuche Lock zu setzen mit NX (only if not exists) und PX (expire in milliseconds)
    const result = await kvStore.set(lockKey, timestamp, {
      nx: true,  // Nur setzen wenn Key nicht existiert
      px: 1800000  // Expire nach 30 Minuten (in milliseconds)
    });
    
    if (result) {
      console.log('🔒 Sync-Lock erhalten');
      return true;
    }
    
    console.log('⏸️  Sync läuft bereits - überspringe');
    return false;
  } catch (error) {
    console.error('Fehler beim Lock-Handling:', error);
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
    console.error('Fehler beim Lock-Release:', error);
  }
}
