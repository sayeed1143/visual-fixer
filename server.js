import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// CORS middleware - restrict to localhost and replit domains for security
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    /\.replit\.dev$/,
    /\.repl\.co$/
  ];
  
  if (allowedOrigins.some(allowed => {
    if (typeof allowed === 'string') return origin === allowed;
    return origin && allowed.test(origin);
  })) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-openrouter-key');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Helper to get API key from header/body/env
const getOpenRouterKey = (req) => {
  const headerKey = req.headers['x-openrouter-key'];
  const bodyKey = req.body?.apiKey;
  return headerKey || bodyKey || process.env.OPENROUTER_API_KEY || '';
};

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

// Text detection endpoint
app.post('/api/detect-text', async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    if (!imageDataUrl) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const apiKey = getOpenRouterKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
    }

    const result = await detectTextInImage(imageDataUrl, apiKey);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(502).json({ error: result.error || 'All models failed to detect text' });
    }
  } catch (error) {
    console.error('Text detection error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Image Editing Endpoint using multiple models
app.post('/api/edit-image', async (req, res) => {
  try {
    const { imageDataUrl, prompt } = req.body;
    if (!imageDataUrl || !prompt) {
      return res.status(400).json({ error: 'Image data and prompt are required' });
    }

    const apiKey = getOpenRouterKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
    }

    // Valid models for image editing - using only verified working image generation models
    const models = [
      'google/gemini-2.5-flash-image-preview'
    ];

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
                  { type: 'text', text: `Looking at this image, recreate it but with this modification: ${prompt}. Keep all other aspects as similar as possible.` },
                  { type: 'image_url', image_url: { url: imageDataUrl } }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.7,
            modalities: ['text', 'image']
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.log(`Model ${model} failed with status ${response.status}:`, errorText);
          continue;
        }
        const data = await response.json();
        
        // Extract image from the response using the existing helper function
        const img = extractImageFromResponse(data);
        if (img) {
          return res.status(200).json({ success: true, editedImage: img, model });
        } else {
          console.log(`Model ${model} returned no image. Response structure:`, JSON.stringify(data, null, 2));
        }
      } catch (e) {
        // try next model
        continue;
      }
    }

    return res.status(502).json({ error: 'All models failed to edit image' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Text Replacement Endpoint (Specific use case)
app.post('/api/replace-text', async (req, res) => {
  try {
    const { imageDataUrl, originalText, newText, coordinates, fontStyle, colorAnalysis } = req.body;
    if (!imageDataUrl || !originalText || !newText || !coordinates) {
      return res.status(400).json({ error: 'Image data, original text, new text, and coordinates are required' });
    }

    const apiKey = getOpenRouterKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
    }

    // Valid models for text replacement - using only verified working image generation models
    const models = [
      'google/gemini-2.5-flash-image-preview'
    ];

    let prompt;
    if (fontStyle && colorAnalysis) {
      // Detect if this is financial/numerical data for specialized handling
      const isFinancialData = /[£$€¥₹₨]|[0-9,]+\.[0-9]{2}|\b\d{1,3}(,\d{3})*(\.\d{2})?\b/.test(originalText + newText);
      
      // Analyze typography components for mixed sizing
      const analyzeTypographyComponents = (text) => {
        const components = {
          currency: '',
          mainAmount: '',
          decimal: '',
          cents: '',
          hasMixedSizing: false
        };
        
        // Match currency + amount + decimal + cents pattern like "£2,906.01"
        const match = text.match(/([£$€¥₹₨]?)\s*([0-9,]+)(\.)([0-9]{1,2})/);
        if (match) {
          components.currency = match[1] || '';
          components.mainAmount = match[2];
          components.decimal = match[3];
          components.cents = match[4];
          components.hasMixedSizing = true;
        }
        return components;
      };
      
      const originalComponents = analyzeTypographyComponents(originalText);
      const newComponents = analyzeTypographyComponents(newText);
      // Only enable mixed typography when both sides have valid decimal components
      const hasMixedTypography = originalComponents.hasMixedSizing && newComponents.hasMixedSizing && 
                                originalComponents.cents && newComponents.cents;
      
      prompt = `You are a world-class image forensics expert specializing in PIXEL-PERFECT text replacement with expertise in financial app interface replication. Your task is to perform invisible text replacement that maintains absolute visual fidelity.

**CRITICAL ANALYSIS & REPLACEMENT MISSION:**
Replace "${originalText}" with "${newText}" while preserving EVERY visual characteristic with forensic precision.
${isFinancialData ? '\n**SPECIAL FINANCIAL DATA REQUIREMENTS:**\nThis appears to be financial/numerical data. Apply EXTRA precision for currency symbols, number formatting, decimal alignment, and banking app font characteristics.' : ''}
${hasMixedTypography ? `\n**CRITICAL MIXED TYPOGRAPHY ANALYSIS:**\nThis financial amount may use different font sizes for different components - measure to confirm:\n- ORIGINAL: Currency "${originalComponents.currency}" + Main Amount "${originalComponents.mainAmount}" + Decimal "${originalComponents.decimal}" + Cents "${originalComponents.cents}"\n- NEW: Currency "${newComponents.currency}" + Main Amount "${newComponents.mainAmount}" + Decimal "${newComponents.decimal}" + Cents "${newComponents.cents}"\n\n**MANDATORY SIZE RELATIONSHIPS:**\n- Main amount (${originalComponents.mainAmount} → ${newComponents.mainAmount}): PRIMARY font size (100% scale baseline)\n- Cents (.${originalComponents.cents} → .${newComponents.cents}): Use measured size ratio; if ratio ≈ 1.0, keep same size; otherwise apply exact measured ratio\n- Currency symbol: Measure and replicate original relative sizing\n- Decimal point: Measure and replicate original sizing group (main vs cents)\n\n**EXACT MEASUREMENT & SIZING INSTRUCTIONS:**\n1. FIRST: Measure the pixel height ratio between main amount "${originalComponents.mainAmount}" and cents ".${originalComponents.cents}" in the original image\n2. SECOND: Determine which size group the decimal point belongs to (main amount size or cents size)\n3. CONDITIONAL: If measurement shows equal sizes (ratio ≈ 1.0), keep cents and decimal exactly the same size as the main amount\n4. THIRD: Apply the EXACT measured ratio to the new text: main "${newComponents.mainAmount}" vs cents ".${newComponents.cents}"\n5. FOURTH: Maintain identical baseline alignment and decimal point positioning as measured` : ''}

**MANDATORY PRE-REPLACEMENT ANALYSIS:**
1. **Color Analysis**: Measure exact RGB/HSL values of text color '${colorAnalysis.textColor}'
2. **Typography Analysis**: Determine precise font family, weight ${fontStyle.fontWeight}, and style characteristics
3. **Dimensional Analysis**: Calculate exact pixel dimensions and proportions
4. **Background Analysis**: Analyze background color '${colorAnalysis.averageColor}' and texture patterns
5. **Effect Analysis**: Detect any shadows, outlines, gradients, or special text effects

**PRECISE REPLACEMENT PARAMETERS:**
- **Exact Location**: Position at (${coordinates.x.toFixed(2)}%, ${coordinates.y.toFixed(2)}%) with dimensions ${coordinates.width.toFixed(2)}% × ${coordinates.height.toFixed(2)}%
- **Color Matching**: Use EXACT hex color '${colorAnalysis.textColor}' - no variation allowed
- **Background Integration**: Seamlessly blend with background '${colorAnalysis.averageColor}'
- **Font Replication**: Match font weight '${fontStyle.fontWeight}' and thickness precisely - pay special attention to numerical font weight consistency
- **Size Precision**: Scale to match original dimensions exactly - crucial for financial data where size differences are immediately noticeable
- **Character Metrics**: Preserve original letter-spacing, word-spacing, and baseline
- **Antialiasing**: Match original text's edge smoothing and rendering quality
- **Effects Preservation**: Replicate any shadows, outlines, or special effects
${isFinancialData ? '- **Currency Symbol Precision**: Ensure currency symbols (£, $, €) match exact size, weight, and positioning relative to numbers\n- **Decimal Alignment**: Maintain precise decimal point alignment and number spacing\n- **Banking Font Characteristics**: Replicate the clean, professional banking app font style with exact thickness and weight\n- **Number Formatting**: Preserve comma separators, decimal places, and numerical spacing precisely' : ''}

**QUALITY ASSURANCE CHECKS:**
- Text edges must be identical to original smoothness
- Color gradients (if any) must be preserved
- Background must appear undisturbed
- No visible artifacts or inconsistencies
- New text must appear as if originally typed

**ABSOLUTE FAILURE CONDITIONS:**
- ANY color shift (even 1 RGB value difference)
- ANY size or thickness variation
- ANY spacing irregularities
- ANY edge quality degradation
- ANY background disturbance
- ANY visible editing artifacts

Generate the perfect replacement image where "${newText}" replaces "${originalText}" with complete visual invisibility of the edit.`;
    } else {
      // Detect if this is financial/numerical data for specialized handling
      const isFinancialData = /[£$€¥₹₨]|[0-9,]+\.[0-9]{2}|\b\d{1,3}(,\d{3})*(\.\d{2})?\b/.test(originalText + newText);
      
      // Analyze typography components for mixed sizing (same function as above)
      const analyzeTypographyComponents = (text) => {
        const components = {
          currency: '',
          mainAmount: '',
          decimal: '',
          cents: '',
          hasMixedSizing: false
        };
        
        const match = text.match(/([£$€¥₹₨]?)\s*([0-9,]+)(\.)([0-9]{1,2})/);
        if (match) {
          components.currency = match[1] || '';
          components.mainAmount = match[2];
          components.decimal = match[3];
          components.cents = match[4];
          components.hasMixedSizing = true;
        }
        return components;
      };
      
      const originalComponents = analyzeTypographyComponents(originalText);
      const newComponents = analyzeTypographyComponents(newText);
      // Only enable mixed typography when both sides have valid decimal components
      const hasMixedTypography = originalComponents.hasMixedSizing && newComponents.hasMixedSizing && 
                                originalComponents.cents && newComponents.cents;
      
      prompt = `You are a world-class forensic image analyst specializing in INVISIBLE text replacement with expertise in banking and financial app interfaces. Your mission is to perform comprehensive visual analysis and create a perfect replacement that cannot be detected by human inspection.

**COMPREHENSIVE ANALYSIS MISSION:**
Replace "${originalText}" with "${newText}" after conducting thorough forensic analysis of ALL visual characteristics.
${isFinancialData ? '\n**CRITICAL FINANCIAL DATA NOTICE:**\nThis appears to be financial/numerical data from a banking or financial app. Apply MAXIMUM precision for currency symbols, number formatting, decimal alignment, and professional banking app font characteristics. Even tiny differences in thickness, weight, or spacing will be immediately visible to users.' : ''}
${hasMixedTypography ? `\n**CRITICAL MIXED TYPOGRAPHY ANALYSIS:**\nThis financial amount may use different font sizes - measure to confirm component-level sizing:\n- ORIGINAL COMPONENTS: "${originalComponents.currency}${originalComponents.mainAmount}${originalComponents.decimal}${originalComponents.cents}"\n- NEW COMPONENTS: "${newComponents.currency}${newComponents.mainAmount}${newComponents.decimal}${newComponents.cents}"\n\n**COMPONENT-SPECIFIC MEASUREMENT & ANALYSIS:**\n1. MEASURE original main amount "${originalComponents.mainAmount}" pixel height (baseline size)\n2. MEASURE original cents ".${originalComponents.cents}" pixel height and calculate exact ratio\n3. DETERMINE decimal point size group (matches main amount or cents size)\n4. CONDITIONAL: If measurement shows equal sizes (ratio ≈ 1.0), keep all components the same size\n5. REPLICATE measured size ratio exactly for new text: "${newComponents.mainAmount}" vs ".${newComponents.cents}"\n6. MAINTAIN identical baseline alignment and spacing relationships` : ''}

**MANDATORY DETAILED ANALYSIS (Perform in this exact order):**
1. **Color Forensics**: Measure precise RGB/HSL values of the text "${originalText}"
2. **Typography Forensics**: Determine exact font family, weight (100-900 scale), style, and serif characteristics
3. **Dimensional Forensics**: Calculate precise font size in pixels and relative to image dimensions
4. **Background Forensics**: Analyze surrounding colors, gradients, textures, and patterns
5. **Effect Forensics**: Detect shadows (offset, blur, color), outlines, gradients, or special effects
6. **Edge Forensics**: Analyze antialiasing patterns and edge smoothing techniques
7. **Spacing Forensics**: Measure letter-spacing, word-spacing, and baseline positioning

**PRECISION REPLACEMENT PARAMETERS:**
- **Exact Coordinates**: Position at (${coordinates.x.toFixed(2)}%, ${coordinates.y.toFixed(2)}%) with dimensions ${coordinates.width.toFixed(2)}% × ${coordinates.height.toFixed(2)}%
- **Color Matching**: Use EXACT analyzed color - zero tolerance for variation
- **Font Replication**: Match analyzed font characteristics with perfect precision - critical for banking/financial app fonts
- **Size Replication**: Scale to match original dimensions exactly - any size difference will be immediately noticeable in financial data
- **Background Reconstruction**: Seamlessly reconstruct background where text was removed
- **Effect Replication**: Recreate any shadows, outlines, or special effects precisely
- **Antialiasing Matching**: Replicate original edge smoothing quality
${isFinancialData ? '- **Currency Symbol Analysis**: Analyze and replicate exact size, weight, and positioning of currency symbols (£, $, €)\n- **Numerical Precision**: Maintain precise decimal alignment, comma separators, and number spacing\n- **Banking Font Weight**: Analyze and replicate the specific font weight and thickness used in banking applications\n- **Professional Appearance**: Ensure replacement maintains the clean, professional appearance expected in financial interfaces' : ''}

**FORENSIC QUALITY STANDARDS:**
- Text must appear as if it was originally created, not edited
- Background must show no signs of manipulation
- Color gradients and textures must be perfectly preserved
- Edge quality must be identical to original rendering
- No visible artifacts, inconsistencies, or editing traces

**ZERO-TOLERANCE FAILURE CONDITIONS:**
- ANY detectable color shift or variation
- ANY size, thickness, or weight differences
- ANY spacing or alignment irregularities
- ANY edge quality degradation or artifacts
- ANY visible signs of background reconstruction
- ANY inconsistency in text rendering quality

Execute perfect forensic replacement of "${originalText}" with "${newText}" maintaining absolute visual invisibility.`;
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
            temperature: 0.1,
            modalities: ['text', 'image']
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
        // try next model
        continue;
      }
    }

    return res.status(502).json({ error: 'All models failed to replace text' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function for text detection logic (reusable for batch processing)
const detectTextInImage = async (imageDataUrl, apiKey) => {
  const models = [
    'google/gemini-2.5-flash',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-flash-1.5',
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-haiku',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.2-90b-vision-instruct',
    'qwen/qwen-2-vl-7b-instruct'
  ];

  const prompt = `You are a professional text detection AI. Analyze this image with extreme precision to detect ALL text elements for accurate replacement.

Provide a JSON array where each text element includes:
- text: exact text content (preserve case, punctuation, spacing)
- x, y: coordinates as percentages (0-100) from top-left corner
- width, height: dimensions as percentages of image size
- confidence: detection confidence (0-1)
- fontSize: estimated font size relative to image height (0-100)
- fontWeight: estimated weight (normal, bold, light)
- textColor: estimated hex color of the text
- backgroundColor: estimated hex color behind text

Be extremely precise with measurements for pixel-perfect replacement.
Format: [{"text":"example","x":10.5,"y":20.3,"width":15.2,"height":5.1,"confidence":0.95,"fontSize":12,"fontWeight":"bold","textColor":"#000000","backgroundColor":"#ffffff"}]`;

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
          max_tokens: 1500,
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        console.log(`Model ${model} failed with status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      const textBlob = Array.isArray(content)
        ? content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('\n')
        : (typeof content === 'string' ? content : '');
      const jsonMatch = textBlob.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const detectedTexts = parsed.map((item, index) => ({
          id: `text-${index}`,
          text: item.text,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          confidence: item.confidence || 0.8,
          fontSize: item.fontSize || null,
          fontWeight: item.fontWeight || null,
          textColor: item.textColor || null,
          backgroundColor: item.backgroundColor || null,
          model
        }));
        return { success: true, detectedTexts, model };
      }
    } catch (error) {
      console.log(`Model ${model} failed:`, error.message);
      continue;
    }
  }
  
  return { success: false, error: 'All models failed to detect text' };
};

// Batch Text Detection Endpoint
app.post('/api/batch-detect-text', async (req, res) => {
  try {
    const { images } = req.body;
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Images array is required' });
    }

    const apiKey = getOpenRouterKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenRouter API key not configured', code: 'MISSING_API_KEY' });
    }

    const results = [];
    const batchSize = 3; // Process 3 images concurrently

    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const promises = batch.map(async (imageData, index) => {
        try {
          const result = await detectTextInImage(imageData.dataUrl, apiKey);
          return { 
            index: i + index, 
            success: result.success, 
            data: result,
            imageName: imageData.name || `image-${i + index}`
          };
        } catch (error) {
          return { 
            index: i + index, 
            success: false, 
            error: error.message,
            imageName: imageData.name || `image-${i + index}`
          };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    res.json({ 
      success: true, 
      results,
      summary: {
        total: images.length,
        successful: successCount,
        failed: images.length - successCount
      }
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    res.status(500).json({ error: 'Batch processing failed' });
  }
});

// Image Format Conversion Endpoint
app.post('/api/convert-image', async (req, res) => {
  try {
    const { imageDataUrl, format, quality = 0.9, originalFormat } = req.body;
    if (!imageDataUrl) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // If requesting same format as original, return as-is
    if (format === originalFormat) {
      return res.json({ success: true, convertedImage: imageDataUrl, format: originalFormat });
    }

    const canvas = new (await import('canvas')).createCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    
    // For now, we'll handle format conversion on the client side
    // This endpoint provides the structure for server-side conversion if needed
    res.json({ 
      success: true, 
      convertedImage: imageDataUrl, 
      format,
      note: 'Client-side conversion recommended for better performance' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Image conversion failed' });
  }
});

// Batch Export Endpoint
app.post('/api/batch-export', async (req, res) => {
  try {
    const { images, format = 'png', quality = 0.9 } = req.body;
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Images array is required' });
    }

    const results = images.map((imageData, index) => ({
      index,
      success: true,
      data: {
        image: imageData.dataUrl,
        format,
        filename: `snapedit-${Date.now()}-${index}.${format}`
      }
    }));

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: 'Batch export failed' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

app.listen(PORT, 'localhost', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
