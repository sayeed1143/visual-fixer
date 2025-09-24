export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-openrouter-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageDataUrl, originalText, newText, coordinates, fontStyle, colorAnalysis } = req.body || {};
  if (!imageDataUrl || !originalText || !newText || !coordinates) {
    return res.status(400).json({ error: 'Image data, original text, new text, and coordinates are required' });
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

  const models = [
    'black-forest-labs/flux-1.1-pro',
    'black-forest-labs/flux-dev',
    'google/gemini-2.5-flash-image-preview'
  ];

  let prompt;
  if (fontStyle && colorAnalysis) {
    prompt = `You are a specialized AI model for high-fidelity, pixel-perfect text inpainting. Your sole function is to replace text while flawlessly matching the original styling.

**Task:**
In the provided image, locate and replace the text "${originalText}" with "${newText}".

**Mandatory Directives (Non-negotiable):**
1.  **Exact Location:** The target text, "${originalText}", is within the bounding box: (x: ${coordinates.x.toFixed(2)}%, y: ${coordinates.y.toFixed(2)}%, width: ${coordinates.width.toFixed(2)}%, height: ${coordinates.height.toFixed(2)}%). Perform the replacement ONLY within this area.
2.  **Style Replication:** The new text, "${newText}", MUST be rendered with the IDENTICAL visual properties of the original text. This includes:
    *   **Size:** The font size must be an exact match.
    *   **Thickness (Font Weight):** The boldness or thinness of the characters must be replicated perfectly.
    *   **Color:** The exact color, including any gradients or subtle variations, must be matched.
    *   **Font Family:** Match the font style (serif, sans-serif, etc.) as closely as possible.
    *   **Blending:** The new text must blend seamlessly with the background texture, lighting, and any effects (shadows, glows) present on the original text.

**Frontend Analysis (Use as a primary guide):**
- **Color:** The detected text color is '${colorAnalysis.textColor}'. The background is '${colorAnalysis.averageColor}'.
- **Font Weight:** The estimated font weight is '${fontStyle.fontWeight}'.

**Final Output Rule:** The result must look like the text was never edited. Any deviation in size, thickness, or color from the original text is a failure.
`;
  } else {
    prompt = `You are a specialized AI model for high-fidelity, pixel-perfect text inpainting. Your sole function is to replace text while flawlessly matching the original styling.

**Task:**
In the provided image, locate and replace the text "${originalText}" with "${newText}".

**Mandatory Directives (Non-negotiable):**
1.  **Exact Location:** The target text, "${originalText}", is within the bounding box: (x: ${coordinates.x.toFixed(2)}%, y: ${coordinates.y.toFixed(2)}%, width: ${coordinates.width.toFixed(2)}%, height: ${coordinates.height.toFixed(2)}%). Perform the replacement ONLY within this area.
2.  **Style Replication:** The new text, "${newText}", MUST be rendered with the IDENTICAL visual properties of the original text. You must analyze the image yourself to determine these properties. This includes:
    *   **Size:** The font size must be an exact match.
    *   **Thickness (Font Weight):** The boldness or thinness of the characters must be replicated perfectly.
    *   **Color:** The exact color, including any gradients or subtle variations, must be matched.
    *   **Font Family:** Match the font style (serif, sans-serif, etc.) as closely as possible.
    *   **Blending:** The new text must blend seamlessly with the background texture, lighting, and any effects (shadows, glows) present on the original text.

**Final Output Rule:** The result must look like the text was never edited. Any deviation in size, thickness, or color from the original text is a failure.
`;
  }


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
