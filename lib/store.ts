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
 * Vercel KV Store (wenn verfügbar)
 */
let kvStore: any = null;

// Versuche Vercel KV zu laden
try {
  const { kv } = require('@vercel/kv');
  kvStore = kv;
} catch (error) {
  console.log('Vercel KV nicht verfügbar, nutze In-Memory Store');
}

/**
 * Lädt den aktuellen Bot-Status
 */
export async function loadState(): Promise<BotState> {
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
