import type { NextApiRequest, NextApiResponse } from 'next';
import { saveDetection } from '../../lib/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, result, confidence, metadata } = req.body;

    // Validate required fields
    if (!type || !result) {
      return res.status(400).json({ error: 'Missing required fields: type and result' });
    }

    // Save to database
    const saveResult = await saveDetection({
      type,
      result,
      confidence,
      metadata
    });

    if (saveResult.success) {
      return res.status(200).json({ 
        success: true, 
        id: saveResult.id,
        message: 'Detection saved successfully' 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save detection' 
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
