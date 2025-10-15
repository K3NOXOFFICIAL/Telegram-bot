/**
 * OneDrive API Wrapper
 * Verwendet Microsoft Graph API für OneDrive-Zugriff
 */

import axios from 'axios';
import { OneDriveItem, OneDriveFolder } from './types';
import { BotConfig } from './types';

/**
 * OneDrive Client Klasse
 */
export class OneDriveClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private config: BotConfig) {}

  /**
   * Holt ein neues Access Token von Microsoft
   */
  private async getAccessToken(): Promise<string> {
    // Prüfe, ob Token noch gültig ist
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.config.microsoftTenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.config.microsoftClientId,
      client_secret: this.config.microsoftClientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    try {
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = response.data.access_token;
      // Token läuft in ca. 1 Stunde ab, wir setzen Ablauf auf 55 Minuten
      this.tokenExpiry = Date.now() + 55 * 60 * 1000;

      return this.accessToken || '';
    } catch (error: any) {
      console.error('Fehler beim Abrufen des Access Tokens:', error.response?.data || error.message);
      throw new Error('Konnte kein Access Token erhalten');
    }
  }

  /**
   * Macht einen authentifizierten Graph API Call
   */
  private async graphApiCall<T>(endpoint: string): Promise<T> {
    const token = await this.getAccessToken();

    try {
      const response = await axios.get<T>(
        `https://graph.microsoft.com/v1.0${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Graph API Fehler:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Macht einen Graph API Call mit Paginierung (alle Results)
   */
  private async graphApiCallPaginated<T extends { value: any[]; '@odata.nextLink'?: string }>(
    endpoint: string
  ): Promise<any[]> {
    const token = await this.getAccessToken();
    const allItems: any[] = [];
    let nextLink: string | undefined = `https://graph.microsoft.com/v1.0${endpoint}`;

    try {
      while (nextLink) {
        const response: { data: T } = await axios.get<T>(nextLink, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        allItems.push(...response.data.value);
        nextLink = response.data['@odata.nextLink'];

        // No delay needed - Graph API handles rate limiting automatically
      }

      return allItems;
    } catch (error: any) {
      console.error('Graph API Fehler (Paginiert):', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Erstellt den richtigen API-Endpunkt basierend auf SharePoint oder OneDrive
   */
  private getDriveEndpoint(path: string, action: 'children' | 'item' = 'children'): string {
    // Wenn SharePoint Site und Drive IDs vorhanden sind, verwende SharePoint-Endpunkt
    if (this.config.sharepointSiteId && this.config.sharepointDriveId) {
      const encodedPath = encodeURIComponent(path);
      if (action === 'children') {
        return `/sites/${this.config.sharepointSiteId}/drives/${this.config.sharepointDriveId}/root:${encodedPath}:/children`;
      } else {
        return `/sites/${this.config.sharepointSiteId}/drives/${this.config.sharepointDriveId}/root:${encodedPath}`;
      }
    }
    
    // Fallback zu persönlichem OneDrive
    const encodedPath = encodeURIComponent(path);
    if (action === 'children') {
      return `/me/drive/root:${encodedPath}:/children`;
    } else {
      return `/me/drive/root:${encodedPath}`;
    }
  }

  /**
   * Listet alle Unterordner in einem bestimmten Pfad auf
   */
  async listSubfolders(folderPath: string): Promise<OneDriveFolder[]> {
    try {
      const endpoint = this.getDriveEndpoint(folderPath, 'children');

      const items = await this.graphApiCallPaginated<{ value: OneDriveItem[]; '@odata.nextLink'?: string }>(endpoint);

      // Filtere nur Ordner
      const folders: OneDriveFolder[] = items
        .filter(item => item.folder)
        .map(item => ({
          id: item.id,
          name: item.name,
          path: `${folderPath}/${item.name}`,
        }));

      return folders;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`Ordner nicht gefunden: ${folderPath}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Listet alle Dateien in einem Ordner auf (mit Paginierung)
   */
  async listFilesInFolder(folderPath: string): Promise<OneDriveItem[]> {
    try {
      const endpoint = this.getDriveEndpoint(folderPath, 'children');

      const items = await this.graphApiCallPaginated<{ value: OneDriveItem[]; '@odata.nextLink'?: string }>(endpoint);

      // Filtere nur Dateien (keine Ordner)
      return items.filter(item => item.file);
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`Ordner nicht gefunden: ${folderPath}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Listet rekursiv alle Dateien in einem Ordner und seinen Unterordnern auf
   */
  async listFilesRecursive(folderPath: string, maxDepth: number = 2): Promise<OneDriveItem[]> {
    const allFiles: OneDriveItem[] = [];
    
    try {
      await this.listFilesRecursiveHelper(folderPath, allFiles, 0, maxDepth);
    } catch (error: any) {
      console.error(`Fehler beim rekursiven Durchsuchen von ${folderPath}:`, error.message);
    }
    
    return allFiles;
  }

  /**
   * Hilfsfunktion für rekursives Durchsuchen mit Paginierung
   */
  private async listFilesRecursiveHelper(
    folderPath: string,
    allFiles: OneDriveItem[],
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    if (currentDepth > maxDepth) {
      return;
    }

    try {
      const endpoint = this.getDriveEndpoint(folderPath, 'children');
      const items = await this.graphApiCallPaginated<{ value: OneDriveItem[]; '@odata.nextLink'?: string }>(endpoint);

      for (const item of items) {
        if (item.file) {
          // Es ist eine Datei, füge sie hinzu
          allFiles.push(item);
        } else if (item.folder && currentDepth < maxDepth) {
          // Es ist ein Ordner, durchsuche ihn rekursiv
          const subfolderPath = `${folderPath}/${item.name}`;
          await this.listFilesRecursiveHelper(subfolderPath, allFiles, currentDepth + 1, maxDepth);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`Ordner nicht gefunden: ${folderPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Prüft, ob eine Datei ein Bild oder Video ist
   */
  isMediaFile(item: OneDriveItem): boolean {
    if (!item.file?.mimeType) return false;

    const mediaTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
    ];

    return mediaTypes.some(type => item.file!.mimeType.startsWith(type.split('/')[0]));
  }

  /**
   * Lädt eine Datei herunter
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const token = await this.getAccessToken();
      
      // Verwende SharePoint oder OneDrive Endpunkt
      let endpoint: string;
      if (this.config.sharepointSiteId && this.config.sharepointDriveId) {
        endpoint = `https://graph.microsoft.com/v1.0/sites/${this.config.sharepointSiteId}/drives/${this.config.sharepointDriveId}/items/${fileId}/content`;
      } else {
        endpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
      }

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error(`Fehler beim Herunterladen der Datei ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Holt die Download-URL für eine Datei
   */
  async getDownloadUrl(fileId: string): Promise<string> {
    try {
      let endpoint: string;
      if (this.config.sharepointSiteId && this.config.sharepointDriveId) {
        endpoint = `/sites/${this.config.sharepointSiteId}/drives/${this.config.sharepointDriveId}/items/${fileId}`;
      } else {
        endpoint = `/me/drive/items/${fileId}`;
      }
      
      const response = await this.graphApiCall<OneDriveItem>(endpoint);

      if (response['@microsoft.graph.downloadUrl']) {
        return response['@microsoft.graph.downloadUrl'];
      }

      throw new Error('Keine Download-URL verfügbar');
    } catch (error) {
      console.error(`Fehler beim Abrufen der Download-URL für ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * 🚀 OPTIMIERUNG: Holt Download-URLs für mehrere Dateien PARALLEL
   * Reduziert Latenz drastisch durch gleichzeitige API Calls
   */
  async getBatchDownloadUrls(fileIds: string[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();
    
    if (fileIds.length === 0) {
      return urlMap;
    }

    // Hole alle URLs parallel
    const urlPromises = fileIds.map(async (fileId) => {
      try {
        const url = await this.getDownloadUrl(fileId);
        return { fileId, url };
      } catch (error) {
        console.error(`Fehler beim Abrufen der Download-URL für ${fileId}:`, error);
        return { fileId, url: null };
      }
    });

    const results = await Promise.all(urlPromises);
    
    // Baue Map auf
    for (const result of results) {
      if (result.url) {
        urlMap.set(result.fileId, result.url);
      }
    }

    return urlMap;
  }
}
