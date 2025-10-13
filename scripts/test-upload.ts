/**
 * Test-Script: Testet das Hochladen eines einzelnen Bildes
 */

import { config as loadEnv } from 'dotenv';
import { loadConfig } from '../lib/config';
import { OneDriveClient } from '../lib/onedrive';
import { TelegramBot } from '../lib/bot';
import { TopicManager } from '../lib/topicManager';

loadEnv();

async function testUpload() {
  console.log('🧪 Teste Upload-Funktionalität...\n');

  try {
    const config = loadConfig();
    const onedrive = new OneDriveClient(config);
    const bot = new TelegramBot(config);
    const topicManager = new TopicManager(bot);

    console.log('📁 Hauptordner:', config.onedriveFolderPath);
    console.log('💬 Telegram Chat ID:', config.telegramChatId);
    console.log('');

    // Hole alle Unterordner
    const folders = await onedrive.listSubfolders(config.onedriveFolderPath);
    console.log(`✅ ${folders.length} Ordner gefunden\n`);

    if (folders.length === 0) {
      console.error('❌ Keine Ordner gefunden!');
      return;
    }

    // Nimm den ersten Ordner mit Dateien
    for (const folder of folders) {
      console.log(`\n📂 Teste mit Ordner: ${folder.name}`);
      
      const files = await onedrive.listFilesRecursive(folder.path);
      const mediaFiles = files.filter(f => onedrive.isMediaFile(f));
      
      console.log(`   📄 ${files.length} Dateien gefunden`);
      console.log(`   🎬 ${mediaFiles.length} Mediendateien`);

      if (mediaFiles.length === 0) {
        console.log('   ⏭️  Überspringe leeren Ordner\n');
        continue;
      }

      // Hole oder erstelle Topic
      console.log(`\n📋 Erstelle/Finde Topic für "${folder.name}"...`);
      const topicId = await topicManager.getOrCreateTopic(folder.name);
      
      if (!topicId) {
        console.error('❌ Konnte Topic nicht erstellen!');
        continue;
      }
      
      console.log(`✅ Topic ID: ${topicId}`);

      // Nimm das erste Bild
      const testFile = mediaFiles[0];
      console.log(`\n📤 Teste Upload mit: ${testFile.name}`);
      console.log(`   MIME-Type: ${testFile.file?.mimeType}`);
      console.log(`   Größe: ${(testFile.size / 1024 / 1024).toFixed(2)} MB`);

      // Hole Download-URL
      console.log(`\n🔗 Hole Download-URL...`);
      const downloadUrl = await onedrive.getDownloadUrl(testFile.id);
      
      if (!downloadUrl) {
        console.error('❌ Keine Download-URL erhalten!');
        continue;
      }

      console.log(`✅ Download-URL erhalten (${downloadUrl.substring(0, 50)}...)`);

      // Versuche Upload
      console.log(`\n📤 Sende zu Telegram...`);
      const isVideo = testFile.file?.mimeType?.startsWith('video/');
      
      let message;
      try {
        if (isVideo) {
          console.log('   🎥 Sende als Video...');
          message = await bot.sendVideoByUrl(downloadUrl, testFile.name, topicId);
        } else {
          console.log('   🖼️  Sende als Bild...');
          message = await bot.sendPhotoByUrl(downloadUrl, testFile.name, topicId);
        }

        if (message) {
          console.log(`\n✅ ERFOLG! Nachricht gesendet:`);
          console.log(`   Message ID: ${message.message_id}`);
          console.log(`   Chat ID: ${message.chat.id}`);
        } else {
          console.error(`\n❌ Upload fehlgeschlagen (keine Antwort von Telegram)`);
        }
      } catch (error: any) {
        console.error(`\n❌ Upload-Fehler:`, error.response?.data || error.message);
      }

      // Nur eine Datei testen
      break;
    }

    console.log('\n\n✨ Test abgeschlossen');

  } catch (error: any) {
    console.error('❌ Fehler:', error.response?.data || error.message);
    process.exit(1);
  }
}

testUpload();
