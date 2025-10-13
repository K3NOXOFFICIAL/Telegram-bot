/**
 * Typdefinitionen für das OneDrive-Telegram Bot Projekt
 */

// Telegram API Typen
export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
}

export interface TelegramTopic {
  message_thread_id: number;
  name: string;
  icon_color: number;
  icon_custom_emoji_id?: string;
}

export interface TelegramResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

// OneDrive API Typen
export interface OneDriveItem {
  id: string;
  name: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@microsoft.graph.downloadUrl'?: string;
}

export interface OneDriveFolder {
  id: string;
  name: string;
  path: string;
}

// Speicher-Typen
export interface PostedFile {
  fileId: string;
  fileName: string;
  folderName: string;
  messageId: number;
  postedAt: string;
}

export interface TopicMapping {
  folderName: string;
  topicId: number;
  topicName: string;
  createdAt: string;
}

export interface SyncStats {
  filesFound: number;
  filesPosted: number;
  errors: number;
  foldersProcessed: number;
  startTime: number;
  lastUpdate: number;
}

export interface BotState {
  postedFiles: PostedFile[];
  topicMappings: TopicMapping[];
  lastSync: string;
  currentStats?: SyncStats;
}

// Konfigurationstyp
export interface BotConfig {
  telegramBotToken: string;
  telegramChatId: string;
  microsoftClientId: string;
  microsoftClientSecret: string;
  microsoftTenantId: string;
  onedriveFolderPath: string;
  rateLimitDelay: number;
  sharepointSiteId?: string;
  sharepointDriveId?: string;
}
