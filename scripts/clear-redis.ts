/**
 * Redis Store leeren
 * Löscht alle gespeicherten Topic-Mappings und geposteten Dateien
 */

import { config as loadEnv } from 'dotenv';

loadEnv();

async function clearRedis() {
  console.log('🗑️  Leere Redis Store...\n');

  if (!process.env.REDIS_URL) {
    console.error('❌ REDIS_URL nicht gesetzt!');
    console.log('⚠️  Überprüfe deine .env Datei');
    process.exit(1);
  }

  try {
    const { createClient } = require('redis');
    
    console.log('🔌 Verbinde mit Redis...');
    const client = createClient({
      url: process.env.REDIS_URL
    });

    await client.connect();
    console.log('✅ Verbunden!\n');

    // Hole alle Keys
    const keys = await client.keys('*');
    console.log(`📋 Gefundene Keys: ${keys.length}`);
    
    if (keys.length > 0) {
      console.log('   Keys:', keys.join(', '));
      console.log('');
      
      // Lösche alle Keys
      for (const key of keys) {
        await client.del(key);
        console.log(`   ✅ Gelöscht: ${key}`);
      }
    } else {
      console.log('   (Store ist bereits leer)');
    }

    await client.disconnect();
    
    console.log('\n✨ Redis Store wurde geleert!');
    console.log('💡 Der Bot wird jetzt alle Topics neu erstellen.');

  } catch (error: any) {
    console.error('❌ Fehler:', error.message);
    process.exit(1);
  }
}

clearRedis();
