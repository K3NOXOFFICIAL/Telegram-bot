import axios from 'axios';
import FormData from 'form-data';
import { BotConfig, TelegramMessage, TelegramResponse, TelegramTopic } from './types';

/**
 * Telegram Bot Client Klasse
 */
export class TelegramBot {
  private readonly baseUrl: string;

  constructor(private config: BotConfig) {
    this.baseUrl = `https://api.telegram.org/bot${config.telegramBotToken}`;
  }

  /**
   * Sendet eine Nachricht an einen Chat
   */
  async sendMessage(
    text: string,
    chatId?: string,
    messageThreadId?: number
  ): Promise<TelegramMessage | null> {
    try {
      const response = await axios.post<TelegramResponse<TelegramMessage>>(
        `${this.baseUrl}/sendMessage`,
        {
          chat_id: chatId || this.config.telegramChatId,
          text,
          message_thread_id: messageThreadId,
        }
      );

      if (response.data.ok) {
        return response.data.result!;
      }

      console.error('Telegram API Fehler:', response.data);
      return null;
    } catch (error: any) {
      console.error('Fehler beim Senden der Nachricht:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Sendet ein Foto an einen Chat
   */
  async sendPhoto(
    photoBuffer: Buffer,
    fileName: string,
    caption?: string,
    messageThreadId?: number
  ): Promise<TelegramMessage | null> {
    try {
      const formData = new FormData();
      formData.append('chat_id', this.config.telegramChatId);
      formData.append('photo', photoBuffer, { filename: fileName });

      if (caption) {
        formData.append('caption', caption);
      }

      if (messageThreadId) {
        formData.append('message_thread_id', messageThreadId.toString());
      }

      const response = await axios.post<TelegramResponse<TelegramMessage>>(
        `${this.baseUrl}/sendPhoto`,
        formData,
        {
          headers: formData.getHeaders(),
        }
      );

      if (response.data.ok) {
        return response.data.result!;
      }

      console.error('Telegram API Fehler:', response.data);
      return null;
    } catch (error: any) {
      console.error('Fehler beim Senden des Fotos:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Sendet ein Video an einen Chat
   */
  async sendVideo(
    videoBuffer: Buffer,
    fileName: string,
    caption?: string,
    messageThreadId?: number
  ): Promise<TelegramMessage | null> {
    try {
      const formData = new FormData();
      formData.append('chat_id', this.config.telegramChatId);
      formData.append('video', videoBuffer, { filename: fileName });

      if (caption) {
        formData.append('caption', caption);
      }

      if (messageThreadId) {
        formData.append('message_thread_id', messageThreadId.toString());
      }

      const response = await axios.post<TelegramResponse<TelegramMessage>>(
        `${this.baseUrl}/sendVideo`,
        formData,
        {
          headers: formData.getHeaders(),
        }
      );

      if (response.data.ok) {
        return response.data.result!;
      }

      console.error('Telegram API Fehler:', response.data);
      return null;
    } catch (error: any) {
      console.error('Fehler beim Senden des Videos:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Sendet eine Datei per URL (effizienter für große Dateien)
   */
  async sendPhotoByUrl(
    photoUrl: string,
    caption?: string,
    messageThreadId?: number,
    retryCount: number = 0
  ): Promise<TelegramMessage | null> {
    try {
      const response = await axios.post<TelegramResponse<TelegramMessage>>(
        `${this.baseUrl}/sendPhoto`,
        {
          chat_id: this.config.telegramChatId,
          photo: photoUrl,
          caption,
          message_thread_id: messageThreadId,
        }
      );

      if (response.data.ok) {
        return response.data.result!;
      }

      // Fallback: Telegram can't fetch the URL
      const errorData = response.data;
      if (
        errorData?.error_code === 400 &&
        typeof errorData?.description === 'string' &&
        errorData.description.includes('failed to get HTTP URL content')
      ) {
        try {
          // Download photo as buffer and send directly
          const photoBuffer = await this.downloadFileBuffer(photoUrl);
          return await this.sendPhoto(photoBuffer, 'photo.jpg', caption, messageThreadId);
        } catch (downloadErr) {
          console.error('Fallback-Fehler beim Herunterladen des Fotos:', downloadErr);
          return null;
        }
      }

      console.error('Telegram API Fehler:', response.data);
      return null;
    } catch (error: any) {
      const errorData = error.response?.data;
      // Handle 429 Rate Limit
      if (errorData?.error_code === 429 && retryCount < 3) {
        const retryAfter = errorData.parameters?.retry_after || 5;
        console.log(`⏳ Rate limit - warte ${retryAfter}s (Versuch ${retryCount + 1}/3)`);
        await this.delay(retryAfter * 1000);
        return this.sendPhotoByUrl(photoUrl, caption, messageThreadId, retryCount + 1);
      }
      // Fallback: Telegram can't fetch the URL
      if (
        errorData?.error_code === 400 &&
        typeof errorData?.description === 'string' &&
        errorData.description.includes('failed to get HTTP URL content')
      ) {
        try {
          const photoBuffer = await this.downloadFileBuffer(photoUrl);
          return await this.sendPhoto(photoBuffer, 'photo.jpg', caption, messageThreadId);
        } catch (downloadErr) {
          console.error('Fallback-Fehler beim Herunterladen des Fotos:', downloadErr);
          return null;
        }
      }
      console.error('Fehler beim Senden des Fotos per URL:', errorData || error.message);
      return null;
    }
  }

  /**
   * Sendet ein Video per URL
   */
  async sendVideoByUrl(
    videoUrl: string,
    caption?: string,
    messageThreadId?: number,
    retryCount: number = 0
  ): Promise<TelegramMessage | null> {
    try {
      const response = await axios.post<TelegramResponse<TelegramMessage>>(
        `${this.baseUrl}/sendVideo`,
        {
          chat_id: this.config.telegramChatId,
          video: videoUrl,
          caption,
          message_thread_id: messageThreadId,
        }
      );

      if (response.data.ok) {
        return response.data.result!;
      }

      // Fallback: Telegram can't fetch the URL
      const errorData = response.data;
      if (
        errorData?.error_code === 400 &&
        typeof errorData?.description === 'string' &&
        errorData.description.includes('failed to get HTTP URL content')
      ) {
        try {
          // Download video as buffer and send directly
          const videoBuffer = await this.downloadFileBuffer(videoUrl);
          return await this.sendVideo(videoBuffer, 'video.mp4', caption, messageThreadId);
        } catch (downloadErr) {
          console.error('Fallback-Fehler beim Herunterladen des Videos:', downloadErr);
          return null;
        }
      }

      console.error('Telegram API Fehler:', response.data);
      return null;
    } catch (error: any) {
      const errorData = error.response?.data;
      // Handle 429 Rate Limit
      if (errorData?.error_code === 429 && retryCount < 3) {
        const retryAfter = errorData.parameters?.retry_after || 5;
        console.log(`⏳ Rate limit - warte ${retryAfter}s (Versuch ${retryCount + 1}/3)`);
        await this.delay(retryAfter * 1000);
        return this.sendVideoByUrl(videoUrl, caption, messageThreadId, retryCount + 1);
      }
      // Fallback: Telegram can't fetch the URL
      if (
        errorData?.error_code === 400 &&
        typeof errorData?.description === 'string' &&
        errorData.description.includes('failed to get HTTP URL content')
      ) {
        try {
          const videoBuffer = await this.downloadFileBuffer(videoUrl);
          return await this.sendVideo(videoBuffer, 'video.mp4', caption, messageThreadId);
        } catch (downloadErr) {
          console.error('Fallback-Fehler beim Herunterladen des Videos:', downloadErr);
          return null;
        }
      }
      console.error('Fehler beim Senden des Videos per URL:', errorData || error.message);
      return null;
    }
  }
  
  /**
   * Hilfsfunktion: Lädt eine Datei von einer URL als Buffer herunter
   */
  async downloadFileBuffer(fileUrl: string): Promise<Buffer> {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }
  /**
   * Liest Topic-Dateien aus Redis-Cache
   * 
   * ⚠️ WICHTIG: Diese Methode verwendet NICHT getUpdates, da ein Webhook aktiv ist!
   * Telegram erlaubt nicht gleichzeitig Webhook + getUpdates.
   * 
   * Stattdessen verlassen wir uns auf:
   * 1. Redis topic_files Cache (wird bei jedem Upload aktualisiert)
   * 2. Initiales Scannen beim ersten Topic-Erstellen
   * 
   * Falls Redis gelöscht wurde, werden alte Dateien beim nächsten Upload
   * durch die file:ID Prüfung erkannt und Redis wird neu aufgebaut.
   */
  async getTopicFileNames(topicId: number): Promise<Set<string>> {
    // Leeres Set zurückgeben - Redis Cache ist die einzige Quelle
    // Diese Methode wird von scanTopicFiles aufgerufen, das dann mit Redis merged
    console.log(`ℹ️  Topic ${topicId}: Verwende ausschließlich Redis-Cache (Webhook-Modus)`);
    return new Set<string>();
  }

  /**
   * Holt alle existierenden Forum Topics
   */
  async getForumTopics(): Promise<Array<{ message_thread_id: number; name: string }>> {
    try {
      // Telegram API hat leider keine direkte Methode zum Abrufen aller Topics
      // Wir müssen stattdessen über getUpdates gehen, aber das ist nicht praktikabel
      // Daher geben wir eine leere Liste zurück
      return [];
    } catch (error: any) {
      console.error('Fehler beim Abrufen der Topics:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Erstellt ein neues Forum Topic
   */
  async createForumTopic(name: string): Promise<TelegramTopic | null> {
    try {
      const response = await axios.post<TelegramResponse<TelegramTopic>>(
        `${this.baseUrl}/createForumTopic`,
        {
          chat_id: this.config.telegramChatId,
          name,
        }
      );

      if (response.data.ok) {
        return response.data.result!;
      }

      console.error('Telegram API Fehler beim Erstellen des Topics:', response.data);
      return null;
    } catch (error: any) {
      console.error('Fehler beim Erstellen des Topics:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Verzögerung für Rate Limiting
   */
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Multi-Bot Manager für parallele Uploads
 * Verteilt Uploads auf mehrere Bots um Rate-Limits zu umgehen
 * 
 * Mit 3 Bots: 3x 17 msg/min = 51 msg/min pro Topic!
 * Performance-Boost: 3-5x schneller!
 */
export class MultiBotManager {
  private bots: TelegramBot[] = [];
  private currentBotIndex = 0;
  private chatId: string;

  constructor(config: BotConfig) {
    this.chatId = config.telegramChatId;
    
    // Erstelle Bot-Instanzen aus Tokens
    const tokens = config.telegramBotTokens || [config.telegramBotToken];
    
    tokens.forEach((token, index) => {
      const botConfig = { ...config, telegramBotToken: token };
      this.bots.push(new TelegramBot(botConfig));
    });
    
    console.log(`🤖 MultiBotManager initialisiert mit ${this.bots.length} Bot(s)`);
    console.log(`   📊 Rate-Limit Multiplikator: ${this.bots.length}x`);
    console.log(`   ⚡ Erwartete Performance: ${this.bots.length * 17} msg/min pro Topic`);
  }

  /**
   * Holt den nächsten verfügbaren Bot (Round-Robin)
   * Verteilt Last gleichmäßig auf alle Bots
   */
  getNextBot(): TelegramBot {
    const bot = this.bots[this.currentBotIndex];
    this.currentBotIndex = (this.currentBotIndex + 1) % this.bots.length;
    return bot;
  }

  /**
   * Holt einen spezifischen Bot nach Index
   */
  getBot(index: number): TelegramBot {
    return this.bots[index % this.bots.length];
  }

  /**
   * Anzahl verfügbarer Bots
   */
  getBotCount(): number {
    return this.bots.length;
  }

  /**
   * Sendet Foto mit automatischer Bot-Rotation
   */
  async sendPhotoByUrl(
    url: string,
    caption: string,
    topicId?: number
  ): Promise<TelegramMessage | null> {
    const bot = this.getNextBot();
    return bot.sendPhotoByUrl(url, caption, topicId);
  }

  /**
   * Sendet Video mit automatischer Bot-Rotation
   */
  async sendVideoByUrl(
    url: string,
    caption: string,
    topicId?: number
  ): Promise<TelegramMessage | null> {
    const bot = this.getNextBot();
    return bot.sendVideoByUrl(url, caption, topicId);
  }

  /**
   * Delay (verwendet ersten Bot)
   */
  async delay(ms: number): Promise<void> {
    return this.bots[0].delay(ms);
  }

  /**
   * Sendet Nachricht (verwendet ersten Bot)
   */
  async sendMessage(
    text: string,
    chatId?: string,
    topicId?: number
  ): Promise<TelegramMessage | null> {
    return this.bots[0].sendMessage(text, chatId, topicId);
  }

  /**
   * Erstellt Forum-Topic (verwendet ersten Bot)
   */
  async createForumTopic(name: string): Promise<TelegramTopic | null> {
    return this.bots[0].createForumTopic(name);
  }
}
