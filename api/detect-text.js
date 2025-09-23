export default async function handler(req, res) {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageDataUrl } = req.body;
  
  if (!imageDataUrl) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenRouter API key not configured' });
  }

  // Models in order of preference: cost-effective -> premium -> precise
  const models = [
    'google/gemini-2.5-flash-preview',
    'openai/gpt-4o',
    'anthropic/claude-3.5-sonnet'
  ];

  const prompt = `Analyze this image and detect all text elements with high precision. Return a JSON array with each text element containing: text content, x/y coordinates (as percentages 0-100 from top-left), width/height (as percentages), and confidence (0-1). Be very accurate with positioning for text replacement. Format: [{"text":"example","x":10,"y":20,"width":15,"height":5,"confidence":0.95}]`;

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
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageDataUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 1500,
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        console.error(`${model} failed:`, response.status);
        continue; // Try next model
      }

      const data = await response.json();
      const textContent = data.choices[0]?.message?.content || '';
      
      // Parse the JSON response
      const jsonMatch = textContent.match(/\[.*\]/s);
      if (jsonMatch) {
        const detectedTexts = JSON.parse(jsonMatch[0]).map((item, index) => ({
          id: `text-${index}`,
          text: item.text,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          confidence: item.confidence || 0.8,
          model: model // Track which model detected this
        }));
        
        return res.status(200).json({ 
          success: true, 
          detectedTexts,
          model: model 
        });
      }
    } catch (error) {
      console.error(`Error with ${model}:`, error);
      continue; // Try next model
    }
  }

  return res.status(500).json({ error: 'All models failed to detect text' });
}