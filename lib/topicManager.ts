/**
 * Topic Manager
 * Verwaltet Telegram Topics und deren Zuordnung zu OneDrive-Ordnern
 * Unterstützt sowohl TelegramBot als auch MultiBotManager
 */

import { TelegramBot, MultiBotManager } from './bot';
import { getTopicMapping, saveTopicMapping } from './store';
import { TopicMapping } from './types';

/**
 * Topic Manager Klasse
 */
export class TopicManager {
  constructor(private bot: TelegramBot | MultiBotManager) {}

  /**
   * Holt oder erstellt ein Topic für einen Ordner
   */
  async getOrCreateTopic(folderName: string): Promise<number | null> {
    // Prüfe, ob bereits ein Topic-Mapping existiert
    const existingMapping = await getTopicMapping(folderName);

    if (existingMapping) {
      console.log(`Verwende existierendes Topic: ${existingMapping.topicName} (ID: ${existingMapping.topicId})`);
      
      // Scanne Topic nach existierenden Dateien (IMMER bei jedem Sync)
      await this.scanTopicFiles(existingMapping.topicId);
      
      return existingMapping.topicId;
    }

    // Erstelle ein neues Topic
    console.log(`Erstelle neues Topic für Ordner: ${folderName}`);
    const topic = await this.bot.createForumTopic(folderName);

    if (!topic) {
      console.error(`Konnte Topic für ${folderName} nicht erstellen`);
      return null;
    }

    // Speichere das Mapping
    await saveTopicMapping(folderName, topic.message_thread_id, topic.name);

    console.log(`✅ Topic erstellt: ${topic.name} (ID: ${topic.message_thread_id})`);

    // Scanne auch neu erstellte Topics (könnte existieren falls Redis gelöscht wurde)
    await this.scanTopicFiles(topic.message_thread_id);

    // Rate limiting - warte kurz vor dem nächsten API-Call
    await this.bot.delay(1000);

    return topic.message_thread_id;
  }

  /**
   * Lädt Topic-Dateien aus Redis Cache
   * 
   * ⚠️ WICHTIG: Kein API-Scan mehr, da Webhook aktiv ist und getUpdates blockiert!
   * Redis topic_files Cache ist die einzige Quelle der Wahrheit.
   * 
   * Der Cache wird aktualisiert durch:
   * - Jeden erfolgreichen Upload
   * - Manuelles Scannen (falls Redis neu aufgebaut werden muss)
   */
  async scanTopicFiles(topicId: number): Promise<void> {
    try {
      const { loadTopicFiles } = await import('./store');
      
      // Lade bereits gespeicherte Dateien aus Redis
      const cachedFiles = await loadTopicFiles(topicId);
      
      if (cachedFiles.size > 0) {
        console.log(`✓ Topic ${topicId}: ${cachedFiles.size} Dateien im Redis-Cache`);
      } else {
        console.log(`ℹ️  Topic ${topicId}: Noch keine Dateien im Cache (wird beim Upload aufgebaut)`);
      }
    } catch (error) {
      console.error(`❌ Fehler beim Laden von Topic ${topicId}:`, error);
    }
  }

  /**
   * Holt alle existierenden Topic-Mappings
   */
  async getAllMappings(): Promise<TopicMapping[]> {
    const { getAllTopicMappings } = await import('./store');
    return getAllTopicMappings();
  }

  /**
   * Bereinigt ein Topic-Mapping (falls Topic gelöscht wurde)
   */
  async removeMapping(folderName: string): Promise<void> {
    const { loadState, saveState } = await import('./store');
    const state = await loadState();

    state.topicMappings = state.topicMappings.filter(
      m => m.folderName !== folderName
    );

    await saveState(state);
  }
}
