import type { NextApiRequest, NextApiResponse } from 'next';
import { getRecentDetections } from '../../lib/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limitCount = parseInt(req.query.limit as string) || 20;

    const result = await getRecentDetections(limitCount);

    if (result.success) {
      return res.status(200).json({ 
        success: true, 
        data: result.data 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch detections' 
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
