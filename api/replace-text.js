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

  const models = [
    'black-forest-labs/flux-1.1-pro',
    'black-forest-labs/flux-1.1-schnell',
    'stability-ai/stable-diffusion'
  ];

  const prompt = coordinates
    ? `Replace the text at position x:${coordinates.x}%, y:${coordinates.y}% with text "${newText}". Maintain the same style, font, and background.`
    : `Replace the text "${originalText}" with "${newText}" in the image. Maintain the same style and appearance.`;

  const extractImageFromResponse = (data) => {
    const choice = data?.choices?.[0]?.message?.content;
    if (!choice) return null;
    if (Array.isArray(choice)) {
      for (const item of choice) {
        if (!item) continue;
        if (item.type === 'image' && item.data) return item.data;
        if (item.type === 'image_url' && item.image_url?.url) return item.image_url.url;
        if (item.type === 'output_image' && item.image_url) return item.image_url;
        if (typeof item.text === 'string') {
          const m = item.text.match(/data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+/);
          if (m) return m[0];
        }
      }
    }
    if (typeof choice === 'string') {
      const m = choice.match(/data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+/);
      if (m) return m[0];
    }
    return null;
  };

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
            { role: 'user', content: [ { type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } } ] }
          ],
          max_tokens: 1000,
          temperature: 0.3,
          modalities: ['image']
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const img = extractImageFromResponse(data);
      if (img) return res.status(200).json({ success: true, editedImage: img, model });
    } catch (e) {
      continue;
    }
  }

  return res.status(502).json({ error: 'All models failed to replace text' });
}
