/**
 * Lokales Test-Skript
 * Nur für Entwicklung - testet die Synchronisierung lokal
 */

import 'dotenv/config';
import { loadConfig } from './lib/config';
import { syncOneDriveToTelegram } from './lib/sync';

async function main() {
  try {
    console.log('🚀 Starte lokalen Test...\n');

    const config = loadConfig();
    const stats = await syncOneDriveToTelegram(config);

    console.log('\n✅ Test abgeschlossen!');
    console.log('Statistiken:', JSON.stringify(stats, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Fehler beim Test:', error);
    process.exit(1);
  }
}

main();
