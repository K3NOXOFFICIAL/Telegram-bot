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
          set: async (key: string, value: any) => {
            await client.set(key, JSON.stringify(value));
          }
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
  const state = await loadState();

  const postedFile: PostedFile = {
    fileId,
    fileName,
    folderName,
    messageId,
    postedAt: new Date().toISOString(),
  };

  state.postedFiles.push(postedFile);
  state.lastSync = new Date().toISOString();

  await saveState(state);
}

/**
 * Holt das Topic-Mapping für einen Ordner
 */
export async function getTopicMapping(folderName: string): Promise<TopicMapping | null> {
  const state = await loadState();
  return state.topicMappings.find(m => m.folderName === folderName) || null;
}

/**
 * Speichert ein Topic-Mapping
 */
export async function saveTopicMapping(
  folderName: string,
  topicId: number,
  topicName: string
): Promise<void> {
  const state = await loadState();

  // Entferne altes Mapping, falls vorhanden
  state.topicMappings = state.topicMappings.filter(
    m => m.folderName !== folderName
  );

  const mapping: TopicMapping = {
    folderName,
    topicId,
    topicName,
    createdAt: new Date().toISOString(),
  };

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
    const existingLock = await kvStore.get(lockKey);
    
    if (existingLock) {
      const lockTime = new Date(existingLock.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - lockTime.getTime()) / 1000 / 60;
      
      // Lock ist älter als 30 Minuten? Wahrscheinlich crashed - überschreiben
      if (diffMinutes > 30) {
        console.log('🔓 Alter Lock gefunden (>30min) - überschreibe');
      } else {
        console.log(`🔒 Sync läuft bereits (seit ${Math.round(diffMinutes)}min) - überspringe`);
        return false;
      }
    }
    
    // Setze neuen Lock
    await kvStore.set(lockKey, {
      timestamp: new Date().toISOString(),
      deployment: process.env.VERCEL_DEPLOYMENT_ID || 'local'
    });
    
    console.log('🔒 Sync-Lock erhalten');
    return true;
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
    
    // Erstelle einen Redis-Client mit DEL-Unterstützung
    if (process.env.REDIS_URL) {
      const { createClient } = require('redis');
      const client = createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.del(lockKey);
      await client.disconnect();
    } else {
      // Vercel KV - setze auf null mit kurzer TTL
      await kvStore.set(lockKey, null);
    }
    
    console.log('🔓 Sync-Lock freigegeben');
  } catch (error) {
    console.error('Fehler beim Lock-Release:', error);
  }
}
