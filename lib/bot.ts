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
    messageThreadId?: number
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
      console.error('Fehler beim Senden des Fotos per URL:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Sendet ein Video per URL
   */
  async sendVideoByUrl(
    videoUrl: string,
    caption?: string,
    messageThreadId?: number
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
      console.error('Fehler beim Senden des Videos per URL:', error.response?.data || error.message);
      return null;
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
