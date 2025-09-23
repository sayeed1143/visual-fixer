export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-openrouter-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageDataUrl, originalText, newText, coordinates } = req.body || {};
  if (!imageDataUrl || !originalText || !newText) {
    return res.status(400).json({ error: 'Image data, original text, and new text are required' });
  }

  const headerKey = req.headers['x-openrouter-key'];
  const apiKey = headerKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
  }

  // Helper to safely extract an image (base64 or URL) from OpenRouter response
  const extractImageFromResponse = (data) => {
    // New OpenRouter format: check images field first
    const message = data?.choices?.[0]?.message;
    if (message?.images && message.images.length > 0) {
      const image = message.images[0];
      if (image?.image_url?.url) return image.image_url.url;
      if (image?.url) return image.url;
    }
    
    // Legacy format: check content field
    const choice = message?.content;
    if (!choice) return null;
    // If content is an array, look for image-like items
    if (Array.isArray(choice)) {
      for (const item of choice) {
        if (!item) continue;
        if (item.type === 'image' && item.data) return item.data; // base64
        if (item.type === 'image_url' && item.image_url?.url) return item.image_url.url; // URL
        if (item.type === 'output_image' && item.image_url) return item.image_url; // some models
        if (typeof item.text === 'string') {
          const m = item.text.match(/data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+/);
          if (m) return m[0];
        }
      }
    }
    // If content is a string, try to parse base64 data url
    if (typeof choice === 'string') {
      const m = choice.match(/data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+/);
      if (m) return m[0];
    }
    return null;
  };

  // Use only models that actually generate images
  const models = [
    'google/gemini-2.5-flash-image-preview'
  ];

  const prompt = coordinates
    ? `Looking at this image, recreate it exactly but replace the text at position x:${coordinates.x}%, y:${coordinates.y}% with "${newText}". Keep everything else identical - same colors, fonts, layout, background, and style.`
    : `Looking at this image, recreate it exactly but replace the text "${originalText}" with "${newText}". Keep everything else identical - same colors, fonts, layout, background, and style.`;

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageDataUrl } }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.3,
          // modalities parameter removed as it can cause 400 errors
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Model ${model} failed with status ${response.status}:`, errorText);
        continue;
      }
      
      const data = await response.json();
      const img = extractImageFromResponse(data);
      if (img) {
        return res.status(200).json({ success: true, editedImage: img, model });
      } else {
        console.log(`Model ${model} returned no image. Response structure:`, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.log(`Model ${model} failed:`, e.message);
      continue;
    }
  }

  return res.status(502).json({ error: 'All models failed to replace text' });
}
