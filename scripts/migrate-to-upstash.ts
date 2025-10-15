/**
 * Migration Script: Vercel KV to Upstash Redis
 * Migrates all data from Vercel KV to Upstash Redis
 */

import { kv } from '@vercel/kv';
import { Redis } from '@upstash/redis';

async function migrateToUpstash() {
  console.log('🔄 Starting migration from Vercel KV to Upstash Redis...\n');

  // Initialize Upstash Redis
  const upstash = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  try {
    // Test Upstash connection
    await upstash.ping();
    console.log('✅ Upstash Redis connection successful\n');

    let totalKeys = 0;
    let migratedKeys = 0;
    let errors = 0;

    // Migrate different key patterns
    const patterns = [
      'bot_state',
      'file:*',
      'topic:*',
      'topic_files:*',
      'sync_lock',
      'runtime_settings'
    ];

    for (const pattern of patterns) {
      console.log(`📋 Migrating pattern: ${pattern}`);
      
      try {
        if (pattern.includes('*')) {
          // For wildcard patterns, we need to scan
          // Note: Vercel KV doesn't support SCAN, so we use keys()
          const keys = await kv.keys(pattern);
          console.log(`  Found ${keys.length} keys`);
          totalKeys += keys.length;

          for (const key of keys) {
            try {
              const value = await kv.get(key);
              if (value !== null) {
                await upstash.set(key, value);
                migratedKeys++;
                console.log(`  ✅ Migrated: ${key}`);
              }
            } catch (error: any) {
              errors++;
              console.error(`  ❌ Failed to migrate ${key}: ${error.message}`);
            }
          }
        } else {
          // For single keys
          try {
            const value = await kv.get(pattern);
            if (value !== null) {
              await upstash.set(pattern, value);
              migratedKeys++;
              totalKeys++;
              console.log(`  ✅ Migrated: ${pattern}`);
            } else {
              console.log(`  ⏭️  Key not found: ${pattern}`);
            }
          } catch (error: any) {
            console.log(`  ℹ️  Key doesn't exist: ${pattern}`);
          }
        }
      } catch (error: any) {
        console.error(`  ❌ Error with pattern ${pattern}: ${error.message}`);
      }
      
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Migration Complete!\n');
    console.log('📊 Statistics:');
    console.log(`  Total keys found: ${totalKeys}`);
    console.log(`  Successfully migrated: ${migratedKeys}`);
    console.log(`  Errors: ${errors}`);
    console.log('═══════════════════════════════════════════════════════');

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const botState = await upstash.get('bot_state');
    if (botState) {
      console.log('✅ bot_state verified in Upstash');
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToUpstash()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
