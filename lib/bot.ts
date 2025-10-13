/**
 * Telegram Bot API Wrapper
 * Behandelt alle Interaktionen mit der Telegram Bot API
 */

import axios from 'axios';
import FormData from 'form-data';
import { TelegramResponse, TelegramMessage, TelegramTopic } from './types';
import { BotConfig } from './types';

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
      
      console.error('Fehler beim Senden des Videos per URL:', errorData || error.message);
      return null;
    }
  }

  /**
   * Liest alle Nachrichten aus einem Topic und extrahiert Dateinamen
   * Verwendet Updates API um die letzten Nachrichten zu scannen
   * ⚠️ LIMITATION: getUpdates zeigt nur die letzten ~100 Updates
   * Für vollständige History müssen wir auf Redis-Cache vertrauen
   */
  async getTopicFileNames(topicId: number): Promise<Set<string>> {
    const fileNames = new Set<string>();
    
    try {
      // Verwende getUpdates um die letzten Messages zu holen
      const response = await axios.post<TelegramResponse<any[]>>(
        `${this.baseUrl}/getUpdates`,
        {
          allowed_updates: ['message'],
          limit: 100 // Maximum
        }
      );

      if (response.data.ok && response.data.result) {
        for (const update of response.data.result) {
          const message = update.message;
          
          // Prüfe ob Message im richtigen Topic ist
          if (message?.message_thread_id === topicId) {
            // Caption ist unser primärer Dateiname-Speicher
            if (message.caption) {
              fileNames.add(message.caption);
            }
            
            // Fallback: Document filename
            if (message.document?.file_name) {
              fileNames.add(message.document.file_name);
            }
            
            // Fallback: Video filename (falls vorhanden)
            if (message.video?.file_name) {
              fileNames.add(message.video.file_name);
            }
          }
        }
        
        console.log(`📋 Topic ${topicId}: ${fileNames.size} existierende Dateien über API gefunden`);
        
        // Wichtiger Hinweis: Diese Methode zeigt nur die letzten ~100 Updates
        // Daher MÜSSEN wir Redis topic_files:topicId als primäre Quelle verwenden
        if (fileNames.size >= 90) {
          console.warn(`⚠️  Topic ${topicId} hat viele Dateien (${fileNames.size}). Einige könnten fehlen!`);
          console.warn(`⚠️  Redis topic_files Cache ist essentiell für Duplikat-Vermeidung!`);
        }
      }

      return fileNames;
      
    } catch (error: any) {
      console.error('❌ Fehler beim Abrufen der Topic-Nachrichten:', error.response?.data || error.message);
      return fileNames;
    }
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
