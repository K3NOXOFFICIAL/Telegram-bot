/**
 * Local Watchdog Script
 * Überwacht die lokale Entwicklungsumgebung und startet Services automatisch neu
 * Verwendung: npm run watchdog
 */

import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CHECK_INTERVAL = 30000; // 30 Sekunden
const MAX_RETRIES = 3;

interface HealthStatus {
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
}

const status: HealthStatus = {
  healthy: true,
  lastCheck: new Date(),
  consecutiveFailures: 0
};

/**
 * Prüft den Health Status
 */
async function checkHealth(): Promise<void> {
  try {
    console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Prüfe Health Status...`);
    
    const response = await axios.get(`${BASE_URL}/api/health-monitor`, {
      timeout: 10000
    });

    if (response.data.success) {
      if (status.consecutiveFailures > 0) {
        console.log('✅ System ist wieder gesund!');
      }
      status.healthy = true;
      status.consecutiveFailures = 0;
      status.lastCheck = new Date();
      
      if (response.data.health.actions && response.data.health.actions.length > 0) {
        console.log('⚡ Auto-Recovery Aktionen durchgeführt:');
        response.data.health.actions.forEach((action: string) => {
          console.log(`   - ${action}`);
        });
      }
    } else {
      handleUnhealthy(response.data);
    }

  } catch (error: any) {
    status.consecutiveFailures++;
    status.healthy = false;
    
    console.error(`❌ Health Check fehlgeschlagen (${status.consecutiveFailures}/${MAX_RETRIES}):`, error.message);
    
    if (status.consecutiveFailures >= MAX_RETRIES) {
      await attemptRecovery();
    }
  }
}

/**
 * Behandelt unhealthy Status
 */
function handleUnhealthy(data: any): void {
  status.consecutiveFailures++;
  status.healthy = false;
  
  console.warn(`⚠️  System nicht gesund (${status.consecutiveFailures}/${MAX_RETRIES})`);
  
  if (data.health && data.health.issues) {
    console.warn('   Probleme:');
    data.health.issues.forEach((issue: string) => {
      console.warn(`   - ${issue}`);
    });
  }
  
  if (data.health && data.health.actions) {
    console.log('   Auto-Recovery Aktionen:');
    data.health.actions.forEach((action: string) => {
      console.log(`   - ${action}`);
    });
  }
}

/**
 * Versucht System-Recovery
 */
async function attemptRecovery(): Promise<void> {
  console.log('\n🚨 Maximale Fehler erreicht - versuche Recovery...');
  
  try {
    // 1. Versuche Lock freizugeben
    console.log('🔓 Gebe Lock frei...');
    await axios.post(`${BASE_URL}/api/force-unlock`, {
      timeout: 5000
    });
    console.log('✅ Lock freigegeben');
    
    // 2. Triggere Sync neu
    console.log('🔄 Starte Sync neu...');
    await axios.post(`${BASE_URL}/api/sync`, {
      timeout: 5000
    });
    console.log('✅ Sync gestartet');
    
    status.consecutiveFailures = 0;
    
  } catch (error: any) {
    console.error('❌ Recovery fehlgeschlagen:', error.message);
    console.log('⚠️  Manuelle Intervention erforderlich!');
  }
}

/**
 * Zeigt Status-Summary
 */
function showStatus(): void {
  const uptime = Date.now() - startTime;
  const uptimeMinutes = Math.floor(uptime / 60000);
  const uptimeSeconds = Math.floor((uptime % 60000) / 1000);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 WATCHDOG STATUS');
  console.log('='.repeat(50));
  console.log(`Status: ${status.healthy ? '✅ Gesund' : '❌ Nicht gesund'}`);
  console.log(`Letzter Check: ${status.lastCheck.toLocaleTimeString()}`);
  console.log(`Aufeinanderfolgende Fehler: ${status.consecutiveFailures}/${MAX_RETRIES}`);
  console.log(`Uptime: ${uptimeMinutes}m ${uptimeSeconds}s`);
  console.log('='.repeat(50) + '\n');
}

// Start
const startTime = Date.now();

console.log('🐕 Watchdog gestartet');
console.log(`📍 Überwache: ${BASE_URL}`);
console.log(`⏱️  Check-Interval: ${CHECK_INTERVAL / 1000}s`);
console.log('');

// Initial check
checkHealth();

// Periodische Checks
setInterval(checkHealth, CHECK_INTERVAL);

// Status-Summary alle 5 Minuten
setInterval(showStatus, 300000);

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Watchdog wird beendet...');
  showStatus();
  process.exit(0);
});
