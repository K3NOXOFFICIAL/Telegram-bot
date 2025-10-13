/**
 * Konfigurationsverwaltung
 * Lädt und validiert Umgebungsvariablen
 */

import { BotConfig } from './types';

/**
 * Lädt die Bot-Konfiguration aus Umgebungsvariablen
 */
export function loadConfig(): BotConfig {
  const config: BotConfig = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    microsoftClientId: process.env.MICROSOFT_CLIENT_ID || '',
    microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    microsoftTenantId: process.env.MICROSOFT_TENANT_ID || '',
    onedriveFolderPath: process.env.ONEDRIVE_FOLDER_PATH || '/Fotos',
    rateLimitDelay: parseInt(process.env.RATE_LIMIT_DELAY || '2000', 10),
    sharepointSiteId: process.env.SHAREPOINT_SITE_ID,
    sharepointDriveId: process.env.SHAREPOINT_DRIVE_ID,
  };

  // Validierung
  const requiredFields: (keyof BotConfig)[] = [
    'telegramBotToken',
    'telegramChatId',
    'microsoftClientId',
    'microsoftClientSecret',
    'microsoftTenantId',
  ];

  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `Fehlende Umgebungsvariablen: ${missingFields.join(', ')}`
    );
  }

  return config;
}

/**
 * Validiert, ob alle erforderlichen Umgebungsvariablen gesetzt sind
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    errors.push('TELEGRAM_BOT_TOKEN ist nicht gesetzt');
  }

  if (!process.env.TELEGRAM_CHAT_ID) {
    errors.push('TELEGRAM_CHAT_ID ist nicht gesetzt');
  }

  if (!process.env.MICROSOFT_CLIENT_ID) {
    errors.push('MICROSOFT_CLIENT_ID ist nicht gesetzt');
  }

  if (!process.env.MICROSOFT_CLIENT_SECRET) {
    errors.push('MICROSOFT_CLIENT_SECRET ist nicht gesetzt');
  }

  if (!process.env.MICROSOFT_TENANT_ID) {
    errors.push('MICROSOFT_TENANT_ID ist nicht gesetzt');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
