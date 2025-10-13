/**
 * Test-Skript zum Überprüfen des SharePoint-Ordnerpfads
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await axios.post(tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return response.data.access_token;
}

async function testPath(token: string, path: string) {
  const siteId = process.env.SHAREPOINT_SITE_ID;
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  
  const encodedPath = encodeURIComponent(path);
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:${encodedPath}`;
  
  console.log(`\nTeste Pfad: ${path}`);
  console.log(`URL: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('✅ Pfad gefunden!');
    console.log('Name:', response.data.name);
    console.log('ID:', response.data.id);
    return true;
  } catch (error: any) {
    console.log('❌ Pfad nicht gefunden:', error.response?.data?.error?.message || error.message);
    return false;
  }
}

async function listRootFolders(token: string) {
  const siteId = process.env.SHAREPOINT_SITE_ID;
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children`;
  
  console.log('\n📁 Ordner im Root-Verzeichnis:');
  
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    response.data.value
      .filter((item: any) => item.folder)
      .forEach((folder: any) => {
        console.log(`  - ${folder.name}`);
      });
  } catch (error: any) {
    console.log('❌ Fehler:', error.response?.data?.error?.message || error.message);
  }
}

async function main() {
  console.log('🔍 SharePoint Pfad Tester\n');
  
  const token = await getAccessToken();
  console.log('✅ Access Token erhalten');
  
  // Liste Root-Ordner
  await listRootFolders(token);
  
  // Teste verschiedene Pfadvarianten
  const pathsToTest = [
    '/Documents/Main/Images/OnlyFans & Fansly Downloads/K3NOX',
    '/Documents',
    '/Main/Images/OnlyFans & Fansly Downloads/K3NOX',
    '/Main',
    '/Images',
  ];
  
  for (const path of pathsToTest) {
    await testPath(token, path);
  }
}

main().catch(console.error);
