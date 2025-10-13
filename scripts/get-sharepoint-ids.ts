/**
 * Hilfsskript zum Abrufen von SharePoint Site ID und Drive ID
 * Führe dieses Skript aus, um die IDs für deine Vercel Environment Variables zu erhalten
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Lade .env Datei
dotenv.config();

async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  try {
    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data.access_token;
  } catch (error: any) {
    console.error('Fehler beim Abrufen des Access Tokens:', error.response?.data || error.message);
    throw error;
  }
}

async function getSharePointIds(
  hostname: string,
  sitePath: string,
  accessToken: string
): Promise<{ siteId: string; driveId: string }> {
  try {
    // Hole Site ID
    const siteUrl = `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`;
    console.log('📍 Rufe Site-Informationen ab...');
    console.log(`   URL: ${siteUrl}`);
    
    const siteResponse = await axios.get(siteUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const siteId = siteResponse.data.id;
    console.log(`✅ Site ID gefunden: ${siteId}`);

    // Hole alle Drives für diese Site
    const drivesUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
    console.log('\n📍 Rufe Drive-Informationen ab...');
    
    const drivesResponse = await axios.get(drivesUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const drives = drivesResponse.data.value;
    console.log(`\n✅ ${drives.length} Drive(s) gefunden:`);
    
    drives.forEach((drive: any, index: number) => {
      console.log(`\n${index + 1}. ${drive.name}`);
      console.log(`   ID: ${drive.id}`);
      console.log(`   Type: ${drive.driveType}`);
    });

    // Verwende das erste Drive (normalerweise das Hauptlaufwerk)
    const driveId = drives[0].id;

    return { siteId, driveId };
  } catch (error: any) {
    console.error('Fehler beim Abrufen der SharePoint-IDs:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 SharePoint ID Finder\n');

  // Lese Umgebungsvariablen
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.error('❌ Fehler: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID und MICROSOFT_CLIENT_SECRET müssen gesetzt sein');
    process.exit(1);
  }

  // Parse den Share-Link
  // Format: https://28yxf4.sharepoint.com/:f:/s/K3Drive/...
  const shareLink = 'https://28yxf4.sharepoint.com/:f:/s/K3Drive/EoPgI4rU4LBFg55ZGy1uluEB08KHoJuQzcx3ivcg-JzgWQ?e=ymrJ9S';
  
  const url = new URL(shareLink);
  const hostname = url.hostname; // 28yxf4.sharepoint.com
  
  // Extrahiere Site-Pfad aus der URL
  const pathMatch = shareLink.match(/\/s\/([^\/]+)/);
  const siteName = pathMatch ? pathMatch[1] : 'K3Drive';
  const sitePath = `/sites/${siteName}`;

  console.log(`📌 Hostname: ${hostname}`);
  console.log(`📌 Site Path: ${sitePath}\n`);

  try {
    // Hole Access Token
    console.log('🔑 Authentifizierung...');
    const accessToken = await getAccessToken(tenantId, clientId, clientSecret);
    console.log('✅ Access Token erhalten\n');

    // Hole SharePoint IDs
    const { siteId, driveId } = await getSharePointIds(hostname, sitePath, accessToken);

    console.log('\n' + '='.repeat(80));
    console.log('✨ ERFOLGREICH! Füge diese Werte zu deinen Vercel Environment Variables hinzu:');
    console.log('='.repeat(80));
    console.log(`\nSHAREPOINT_SITE_ID=${siteId}`);
    console.log(`SHAREPOINT_DRIVE_ID=${driveId}`);
    console.log(`\nONEDRIVE_FOLDER_PATH=/Documents/Main/Images/OnlyFans & Fansly Downloads/K3NOX`);
    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n❌ Fehler beim Abrufen der IDs');
    process.exit(1);
  }
}

main();
