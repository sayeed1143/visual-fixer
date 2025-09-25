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
    'google/gemini-2.5-flash-image-preview'
  ];

  // Detect if this is financial/numerical data for specialized handling
  const isFinancialData = /[£$€¥₹₨]|[0-9,]+\.[0-9]{2}|\b\d{1,3}(,\d{3})*(\.\d{2})?\b/.test(originalText + newText);
  
  // Analyze typography components for mixed sizing in financial amounts
  const analyzeFinancialComponents = (text) => {
    const components = {
      currency: '',
      mainAmount: '',
      decimal: '',
      cents: '',
      hasMixedSizing: false
    };
    
    // Match patterns like "£ 2,906.01" or "$1,234.56"
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
  
  const originalComponents = analyzeFinancialComponents(originalText);
  const newComponents = analyzeFinancialComponents(newText);
  const hasMixedTypography = originalComponents.hasMixedSizing && newComponents.hasMixedSizing && 
                             originalComponents.cents && newComponents.cents;

  let prompt;
  if (fontStyle && colorAnalysis) {
    prompt = `You are a world-class forensic image specialist expert in INVISIBLE text replacement with expertise in banking and financial app interfaces. Your mission is to perform pixel-perfect text replacement that cannot be detected by human inspection.

**CRITICAL REPLACEMENT MISSION:**
Replace "${originalText}" with "${newText}" while preserving EVERY visual characteristic with absolute forensic precision.

${isFinancialData ? `**🏦 CRITICAL FINANCIAL DATA ANALYSIS:**
This is financial/numerical data from a banking app. Apply MAXIMUM precision for currency symbols, number formatting, decimal alignment, and banking app font characteristics. Even tiny differences in thickness, weight, or spacing will be immediately visible to users.` : ''}

${hasMixedTypography ? `**💰 MIXED TYPOGRAPHY DETECTION:**
Financial amount detected with different component sizes:
- ORIGINAL: "${originalComponents.currency}${originalComponents.mainAmount}${originalComponents.decimal}${originalComponents.cents}"
- NEW: "${newComponents.currency}${newComponents.mainAmount}${newComponents.decimal}${newComponents.cents}"

**MANDATORY COMPONENT-SPECIFIC SIZING:**
1. **FIRST**: Measure the pixel height of main amount "${originalComponents.mainAmount}" (this is your 100% baseline)
2. **SECOND**: Measure the pixel height of cents ".${originalComponents.cents}" and calculate exact ratio
3. **CRITICAL**: If cents are smaller than main amount, apply EXACT same ratio to new text
4. **APPLY**: Main "${newComponents.mainAmount}" = baseline size, Cents ".${newComponents.cents}" = measured ratio size
5. **BASELINE**: Maintain identical baseline alignment for all components` : ''}

**MANDATORY PRE-REPLACEMENT FORENSIC ANALYSIS:**
1. **Color Forensics**: Use EXACT hex color '${colorAnalysis.textColor}' - zero tolerance for variation
2. **Font Weight Analysis**: The detected font weight is '${fontStyle.fontWeight}' - replicate this EXACT thickness
3. **Background Integration**: Seamlessly blend with background '${colorAnalysis.averageColor}'
4. **Dimensional Analysis**: Position at (${coordinates.x.toFixed(2)}%, ${coordinates.y.toFixed(2)}%) with exact dimensions ${coordinates.width.toFixed(2)}% × ${coordinates.height.toFixed(2)}%

**CRITICAL SUCCESS CRITERIA:**
- Color MUST be identical (${colorAnalysis.textColor})
- Font weight MUST match original thickness ('${fontStyle.fontWeight}')
- Size relationships MUST be preserved exactly
- Background MUST appear undisturbed
- NO visible editing artifacts
- Text MUST appear as if originally typed

${isFinancialData ? '**BANKING APP REQUIREMENTS:**\n- Currency symbols must match exact size and weight\n- Decimal alignment must be precise\n- Number spacing must be identical\n- Font thickness must match banking app standards' : ''}

Execute perfect replacement where "${newText}" replaces "${originalText}" with complete visual invisibility.`;
  } else {
    prompt = `You are a world-class forensic image analyst specializing in INVISIBLE text replacement. Your mission is to perform comprehensive visual analysis and create a perfect replacement that cannot be detected by human inspection.

**COMPREHENSIVE ANALYSIS MISSION:**
Replace "${originalText}" with "${newText}" after conducting thorough forensic analysis of ALL visual characteristics.

${isFinancialData ? `**🏦 CRITICAL FINANCIAL DATA NOTICE:**
This appears to be financial/numerical data from a banking or financial app. Apply MAXIMUM precision for currency symbols, number formatting, decimal alignment, and professional banking app font characteristics. Even tiny differences in thickness, weight, or spacing will be immediately visible to users.` : ''}

${hasMixedTypography ? `**💰 MIXED TYPOGRAPHY ANALYSIS:**
Financial amount detected with different component sizes:
- ORIGINAL COMPONENTS: "${originalComponents.currency}${originalComponents.mainAmount}${originalComponents.decimal}${originalComponents.cents}"
- NEW COMPONENTS: "${newComponents.currency}${newComponents.mainAmount}${newComponents.decimal}${newComponents.cents}"

**ULTRA-PRECISE COMPONENT MEASUREMENT & ANALYSIS:**
1. **MEASURE BASELINE**: Original main amount "${originalComponents.mainAmount}" = X pixels height (your reference)
2. **MEASURE CENTS**: Original cents ".${originalComponents.cents}" = Y pixels height
3. **CALCULATE RATIO**: Cents ratio = Y/X (e.g., if cents are 18px and main is 24px = 0.75 ratio)
4. **STATE YOUR FINDINGS**: Before editing, explicitly state: "Main amount: Xpx, Cents: Ypx, Ratio: Z"
5. **VERIFY THICKNESS**: Measure stroke width of original text in pixels
6. **REPLICATE PRECISELY**: New "${newComponents.mainAmount}" at X pixels, new ".${newComponents.cents}" at Y pixels (maintaining exact ratio)
7. **VERIFY RESULT**: Confirm your replacement matches stated measurements exactly` : ''}

**MANDATORY MEASUREMENT-FIRST FORENSIC ANALYSIS (Perform in exact order):**
1. **THICKNESS MEASUREMENT**: Measure stroke thickness of "${originalText}" in pixels - state exact thickness before proceeding
2. **COLOR MEASUREMENT**: Extract precise RGB/HSL values - state exact values (e.g., "RGB(51, 51, 51)" or "HSL(0, 0%, 20%)")
3. **FONT WEIGHT DETECTION**: Determine exact weight on 100-900 scale - state numerical weight (e.g., "400", "500", "600")
4. **SIZE MEASUREMENT**: Calculate exact font size in pixels - state precise measurement
5. **TYPOGRAPHY ANALYSIS**: Identify font family and style characteristics
6. **BACKGROUND ANALYSIS**: Examine surrounding colors and textures for seamless blending
7. **VERIFICATION REQUIREMENT**: Before generating, state all measurements: "Thickness: Xpx, Color: RGB(r,g,b), Weight: W, Size: Spx"

**PRECISION REPLACEMENT PARAMETERS:**
- **Exact Coordinates**: Position at (${coordinates.x.toFixed(2)}%, ${coordinates.y.toFixed(2)}%) with dimensions ${coordinates.width.toFixed(2)}% × ${coordinates.height.toFixed(2)}%
- **Color Matching**: Use EXACT analyzed color - zero tolerance for variation
- **Font Replication**: Match analyzed font characteristics with perfect precision
- **Size Replication**: Scale to match original dimensions exactly
- **Background Reconstruction**: Seamlessly reconstruct background where text was removed
- **Effect Replication**: Recreate any shadows, outlines, or special effects precisely

${isFinancialData ? '**BANKING INTERFACE PRECISION:**\n- Analyze and replicate exact currency symbol positioning and weight\n- Maintain precise decimal alignment and number spacing\n- Replicate clean, professional banking app font characteristics\n- Ensure replacement maintains financial interface credibility' : ''}

**FORENSIC QUALITY STANDARDS:**
- Text must appear as if originally created, not edited
- Background must show no signs of manipulation
- Color gradients and textures must be perfectly preserved
- Edge quality must be identical to original rendering
- NO visible artifacts, inconsistencies, or editing traces

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
          temperature: 0.3,
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
      console.log(`Model ${model} failed:`, e.message);
      continue;
    }
  }

  return res.status(502).json({ error: 'All models failed to replace text' });
}
