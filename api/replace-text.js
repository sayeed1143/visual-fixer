export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-openrouter-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageDataUrl, originalText, newText, coordinates, fontStyle, colorAnalysis } = req.body || {};
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
    const message = data?.choices?.[0]?.message;
    if (message?.images && message.images.length > 0) {
      const image = message.images[0];
      if (image?.image_url?.url) return image.image_url.url;
      if (image?.url) return image.url;
    }
    const choice = message?.content;
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

  // Using only powerful image generation models. Removed text-only models.
  const models = [
    'black-forest-labs/flux-1.1-pro',
    'black-forest-labs/flux-dev',
    'google/gemini-2.5-flash-image-preview'
  ];

  let styleInstructions;
  if (fontStyle && colorAnalysis) {
    styleInstructions = `
- **AI Analysis Hint (Color):** The original text color is detected as '${colorAnalysis.textColor}' on a background of '${colorAnalysis.averageColor}'. Use this as a strong hint, but verify against the image.
- **AI Analysis Hint (Font):** The font weight is estimated as '${fontStyle.fontWeight}'. Prioritize the VISUAL thickness you see in the image.
- **Your Task:** Replicate the font, thickness, color, lighting, perspective, and texture of the original text with MAXIMUM PRECISION. The new text must look like it was always there.`;
  } else {
    styleInstructions = `Pay extreme attention to the font, thickness, color, lighting, perspective, and any textures or effects on the original text. You must replicate this style perfectly for the new text.`;
  }

  const locationPrompt = coordinates
    ? `The text to replace, "${originalText}", is located inside the approximate bounding box (x: ${coordinates.x.toFixed(2)}%, y: ${coordinates.y.toFixed(2)}%, width: ${coordinates.width.toFixed(2)}%, height: ${coordinates.height.toFixed(2)}%).`
    : `The text to replace is "${originalText}".`;

  const prompt = `You are an expert digital artist specializing in seamless, photorealistic image manipulation.
Your task is to replace a piece of text in the provided image. The replacement must be undetectable.

**Operation Details:**
1.  **Locate:** Find the text "${originalText}". ${locationPrompt}
2.  **Replace:** Replace it with "${newText}".

**CRITICAL STYLE REPLICATION RULES:**
${styleInstructions}

**FINAL CHECK:** Before outputting, ensure the new text is perfectly blended. It must match the original's style exactly. DO NOT change the color vibrancy or font weight. If the original is dark and bold, the new text must be dark and bold.
`;


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
