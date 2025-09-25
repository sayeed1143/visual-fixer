export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageDataUrl, textToAnalyze, coordinates } = req.body;

  if (!imageDataUrl || !textToAnalyze || !coordinates) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenRouter API key not configured' });
  }

  // Financial data detection
  const isFinancialData = /[\£\$\€\¥][\d,]+\.?\d{0,2}|^\d+[\.,]\d{2}$/.test(textToAnalyze);
  
  // Create comprehensive analysis prompt
  const analysisPrompt = `You are a forensic typography expert. Analyze the text "${textToAnalyze}" in this image and provide EXACT measurements and characteristics for manual editing reference.

${isFinancialData ? `**🏦 FINANCIAL DATA DETECTED:**
This is financial/banking app text. Pay special attention to:
- Currency symbol sizing and positioning
- Main amount vs cents size differences (common in banking apps)
- Professional financial interface typography standards
- Decimal alignment and number spacing precision` : ''}

**REQUIRED DETAILED ANALYSIS:**

**1. THICKNESS ANALYSIS:**
- Measure stroke thickness in pixels
- Determine if it's thin, regular, medium, or bold
- Provide exact pixel measurement of stroke width

**2. COLOR ANALYSIS:**
- Extract exact RGB values (e.g., RGB(51, 51, 51))
- Provide HSL values if available
- Note any color variations or gradients

**3. FONT ANALYSIS:**
- Identify font family or closest match
- Determine exact font weight (100-900 scale)
- Note font style (normal, italic, etc.)
- Identify any special characteristics

**4. SIZE MEASUREMENTS:**
- Calculate exact font size in pixels
- Measure character height and width
- Note baseline positioning

**5. MIXED TYPOGRAPHY (if applicable):**
- If financial amount, measure main digits vs cents separately
- Calculate size ratio (e.g., cents are 75% of main amount)
- Note decimal point positioning and size

**6. SPACING ANALYSIS:**
- Letter spacing measurement
- Word spacing (if multiple words)
- Line height and baseline positioning

**7. EFFECTS ANALYSIS:**
- Detect any shadows, outlines, or glows
- Note antialiasing patterns
- Identify any special text effects

**8. POSITIONING DETAILS:**
- Exact coordinates within image
- Alignment characteristics (left, center, right)
- Baseline and positioning relative to other elements

**PROVIDE YOUR ANALYSIS IN THIS EXACT FORMAT:**

THICKNESS: [X pixels thick, weight description]
COLOR: [RGB(r,g,b) and HSL if available]
FONT: [Family name, weight number, style]
SIZE: [X pixels font size]
MIXED_SIZING: [If financial: main amount Xpx, cents Ypx, ratio Z]
SPACING: [Letter spacing, word spacing details]
EFFECTS: [Any shadows, outlines, or special effects]
POSITION: [Alignment and baseline details]
RECOMMENDATIONS: [Manual editing tips for exact replication]

Focus on providing precise, measurable data that a human editor could use to manually recreate this text with perfect accuracy.`;

  // Use verified models for analysis
  const models = [
    'google/gemini-2.5-flash-image-preview',
    'google/gemini-1.5-flash',
    'google/gemini-pro-1.5',
    'openai/gpt-4o',
    'openai/gpt-4o-mini'
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
                { type: 'text', text: analysisPrompt }, 
                { type: 'image_url', image_url: { url: imageDataUrl } } 
              ] 
            }
          ],
          max_tokens: 1500,
          temperature: 0.1, // Low temperature for consistent analysis
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Analysis model ${model} failed with status ${response.status}:`, errorText);
        continue;
      }
      
      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        const analysis = data.choices[0].message.content;
        
        // Parse the analysis into structured data
        const parsedAnalysis = parseAnalysisResponse(analysis);
        
        return res.status(200).json({ 
          success: true, 
          analysis: analysis,
          parsed: parsedAnalysis,
          model: model,
          coordinates: coordinates,
          isFinancialData: isFinancialData
        });
      } else {
        console.log(`Analysis model ${model} returned no content. Response structure:`, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.log(`Analysis model ${model} failed:`, e.message);
      continue;
    }
  }

  return res.status(502).json({ error: 'All models failed to analyze text' });
}

// Helper function to parse analysis response into structured data
function parseAnalysisResponse(analysis) {
  const parsed = {};
  
  try {
    // Extract key measurements using regex patterns
    const thicknessMatch = analysis.match(/THICKNESS:\s*([^\n]+)/i);
    const colorMatch = analysis.match(/COLOR:\s*([^\n]+)/i);
    const fontMatch = analysis.match(/FONT:\s*([^\n]+)/i);
    const sizeMatch = analysis.match(/SIZE:\s*([^\n]+)/i);
    const mixedMatch = analysis.match(/MIXED_SIZING:\s*([^\n]+)/i);
    const spacingMatch = analysis.match(/SPACING:\s*([^\n]+)/i);
    const effectsMatch = analysis.match(/EFFECTS:\s*([^\n]+)/i);
    const positionMatch = analysis.match(/POSITION:\s*([^\n]+)/i);
    const recommendationsMatch = analysis.match(/RECOMMENDATIONS:\s*([^\n]+)/i);
    
    if (thicknessMatch) parsed.thickness = thicknessMatch[1].trim();
    if (colorMatch) parsed.color = colorMatch[1].trim();
    if (fontMatch) parsed.font = fontMatch[1].trim();
    if (sizeMatch) parsed.size = sizeMatch[1].trim();
    if (mixedMatch) parsed.mixedSizing = mixedMatch[1].trim();
    if (spacingMatch) parsed.spacing = spacingMatch[1].trim();
    if (effectsMatch) parsed.effects = effectsMatch[1].trim();
    if (positionMatch) parsed.position = positionMatch[1].trim();
    if (recommendationsMatch) parsed.recommendations = recommendationsMatch[1].trim();
    
    // Extract RGB values if present
    const rgbMatch = analysis.match(/RGB\((\d+),\s*(\d+),\s*(\d+)\)/i);
    if (rgbMatch) {
      parsed.rgbValues = {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    }
    
    // Extract font weight number if present
    const weightMatch = analysis.match(/(\d{3})\s*(weight|font-weight)/i);
    if (weightMatch) {
      parsed.fontWeight = parseInt(weightMatch[1]);
    }
    
    // Extract pixel measurements
    const pixelMatches = analysis.match(/(\d+)\s*px/gi);
    if (pixelMatches) {
      parsed.pixelMeasurements = pixelMatches.map(match => parseInt(match.replace(/px/i, '')));
    }
    
  } catch (error) {
    console.log('Error parsing analysis response:', error);
  }
  
  return parsed;
}