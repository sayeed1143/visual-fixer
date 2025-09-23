/**
 * Advanced font analysis and matching utilities
 */

export interface FontMetrics {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  confidence: number;
}

export interface TextCharacteristics {
  isUpperCase: boolean;
  isLowerCase: boolean;
  hasNumbers: boolean;
  hasSpecialChars: boolean;
  isMonospace: boolean;
  isSerif: boolean;
  isBold: boolean;
  isItalic: boolean;
}

export class FontAnalyzer {
  private commonFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
    'Tahoma', 'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Courier New',
    'Palatino', 'Garamond', 'Bookman', 'Avant Garde', 'Calibri',
    'Segoe UI', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'
  ];

  private serifFonts = ['Times New Roman', 'Georgia', 'Palatino', 'Garamond', 'Bookman'];
  private sansSerifFonts = ['Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Calibri', 'Segoe UI'];
  private monospaceFonts = ['Courier New', 'Monaco', 'Consolas', 'Menlo'];

  /**
   * Analyzes text characteristics to suggest optimal font matching
   */
  analyzeTextCharacteristics(text: string): TextCharacteristics {
    return {
      isUpperCase: text === text.toUpperCase() && text !== text.toLowerCase(),
      isLowerCase: text === text.toLowerCase() && text !== text.toUpperCase(),
      hasNumbers: /\d/.test(text),
      hasSpecialChars: /[^a-zA-Z0-9\s]/.test(text),
      isMonospace: this.isLikelyMonospace(text),
      isSerif: false, // This would need image analysis
      isBold: false,  // This would need image analysis
      isItalic: false // This would need image analysis
    };
  }

  /**
   * Calculates optimal font size based on bounding box dimensions
   */
  calculateOptimalFontSize(
    boundingBox: { width: number; height: number },
    textLength: number,
    characteristics: TextCharacteristics
  ): number {
    // Base calculation on available height
    let fontSize = boundingBox.height * 0.7;
    
    // Adjust for text length to ensure it fits width
    const estimatedCharWidth = fontSize * (characteristics.isMonospace ? 0.6 : 0.55);
    const estimatedTextWidth = textLength * estimatedCharWidth;
    
    if (estimatedTextWidth > boundingBox.width) {
      fontSize = (boundingBox.width / textLength) / (characteristics.isMonospace ? 0.6 : 0.55);
    }
    
    // Apply constraints
    fontSize = Math.max(8, Math.min(72, fontSize));
    
    // Adjust for special characteristics
    if (characteristics.isUpperCase) fontSize *= 0.9;
    if (characteristics.hasNumbers) fontSize *= 0.95;
    
    return Math.round(fontSize);
  }

  /**
   * Suggests best font family based on text characteristics and context
   */
  suggestFontFamily(
    characteristics: TextCharacteristics,
    context: 'digital' | 'print' | 'ui' | 'code' | 'artistic' = 'digital'
  ): string {
    if (characteristics.isMonospace || context === 'code') {
      return this.monospaceFonts[0];
    }

    switch (context) {
      case 'print':
        return characteristics.hasNumbers ? 'Georgia' : 'Times New Roman';
      case 'ui':
        return 'Segoe UI';
      case 'artistic':
        return characteristics.isUpperCase ? 'Impact' : 'Trebuchet MS';
      default:
        return characteristics.hasSpecialChars ? 'Arial' : 'Helvetica';
    }
  }

  /**
   * Estimates font weight based on text analysis (would be enhanced with image analysis)
   */
  estimateFontWeight(characteristics: TextCharacteristics): string {
    if (characteristics.isUpperCase && !characteristics.hasNumbers) {
      return 'bold';
    }
    return 'normal';
  }

  /**
   * Calculates letter spacing for optimal text appearance
   */
  calculateLetterSpacing(
    fontSize: number,
    characteristics: TextCharacteristics
  ): number {
    let spacing = 0;
    
    if (characteristics.isUpperCase) {
      spacing = fontSize * 0.05; // More spacing for uppercase
    }
    
    if (characteristics.isMonospace) {
      spacing = 0; // Monospace doesn't need additional spacing
    }
    
    return Math.round(spacing * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Generates complete font metrics for text replacement
   */
  generateFontMetrics(
    text: string,
    boundingBox: { width: number; height: number },
    context: 'digital' | 'print' | 'ui' | 'code' | 'artistic' = 'digital'
  ): FontMetrics {
    const characteristics = this.analyzeTextCharacteristics(text);
    const fontSize = this.calculateOptimalFontSize(boundingBox, text.length, characteristics);
    const fontFamily = this.suggestFontFamily(characteristics, context);
    const fontWeight = this.estimateFontWeight(characteristics);
    const letterSpacing = this.calculateLetterSpacing(fontSize, characteristics);
    
    // Calculate confidence based on various factors
    let confidence = 0.7; // Base confidence
    
    if (characteristics.isMonospace) confidence += 0.2;
    if (text.length < 20) confidence += 0.1; // Shorter text is easier to match
    if (!characteristics.hasSpecialChars) confidence += 0.1;
    
    confidence = Math.min(1, confidence);

    return {
      fontSize,
      fontFamily,
      fontWeight,
      letterSpacing,
      lineHeight: fontSize * 1.2,
      confidence
    };
  }

  private isLikelyMonospace(text: string): boolean {
    // Simple heuristic: if text contains code-like patterns
    const codePatterns = [
      /\{.*\}/, // Braces
      /\[.*\]/, // Brackets
      /\d+\.\d+/, // Decimal numbers
      /[a-zA-Z]+\(\)/, // Function calls
      /\w+\s*=\s*\w+/ // Assignments
    ];
    
    return codePatterns.some(pattern => pattern.test(text));
  }
}

/**
 * Enhanced font matching with context awareness
 */
export function matchFont(
  originalText: string,
  boundingBox: { width: number; height: number },
  imageContext: 'screenshot' | 'photo' | 'document' | 'ui' = 'screenshot'
): FontMetrics {
  const analyzer = new FontAnalyzer();
  
  // Map image context to font context
  const contextMap = {
    'screenshot': 'ui' as const,
    'photo': 'artistic' as const,
    'document': 'print' as const,
    'ui': 'ui' as const
  };
  
  return analyzer.generateFontMetrics(
    originalText,
    boundingBox,
    contextMap[imageContext]
  );
}