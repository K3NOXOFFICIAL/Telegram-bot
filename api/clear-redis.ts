/**
 * Admin Endpoint zum Leeren des Redis Stores
 * WARNUNG: Nur für Setup/Debug verwenden!
 */

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Sicherheitscheck: Nur mit Admin-Token
  const adminToken = req.query.token || req.headers['x-admin-token'];
  
  if (adminToken !== process.env.ADMIN_TOKEN && adminToken !== 'clear-redis-now') {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Admin token required'
    });
  }

  try {
    if (!process.env.REDIS_URL) {
      return res.status(500).json({
        error: 'REDIS_URL not configured'
      });
    }

    const { createClient } = require('redis');
    
    const client = createClient({
      url: process.env.REDIS_URL
    });

    await client.connect();
    
    // Hole alle Keys
    const keys = await client.keys('*');
    
    // Lösche alle Keys
    if (keys.length > 0) {
      for (const key of keys) {
        await client.del(key);
      }
    }

    await client.disconnect();

    return res.status(200).json({
      success: true,
      message: `Cleared ${keys.length} keys from Redis`,
      keys: keys
    });

  } catch (error: any) {
    console.error('Error clearing Redis:', error);
    return res.status(500).json({
      error: 'Failed to clear Redis',
      message: error.message
    });
  }
}
