/**
 * Advanced color detection utilities for seamless text replacement
 */

export interface ColorAnalysis {
  dominantColor: string;
  averageColor: string;
  contrastRatio: number;
  textColor: string;
  backgroundColors: string[];
  confidence: number;
}

export class AdvancedColorDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Analyzes colors in a specific region of an image to determine optimal text color
   */
  async analyzeTextRegion(
    imageDataUrl: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<ColorAnalysis> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Set canvas size to match the region
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        
        // Draw the image
        this.ctx.drawImage(img, 0, 0);
        
        // Get pixel data for the specified region
        const regionX = Math.max(0, Math.floor((x / 100) * img.width));
        const regionY = Math.max(0, Math.floor((y / 100) * img.height));
        const regionWidth = Math.min(img.width - regionX, Math.floor((width / 100) * img.width));
        const regionHeight = Math.min(img.height - regionY, Math.floor((height / 100) * img.height));
        
        const imageData = this.ctx.getImageData(regionX, regionY, regionWidth, regionHeight);
        const pixels = imageData.data;
        
        const analysis = this.analyzePixels(pixels);
        resolve(analysis);
      };
      img.src = imageDataUrl;
    });
  }

  private analyzePixels(pixels: Uint8ClampedArray): ColorAnalysis {
    const colors: Array<[number, number, number]> = [];
    const colorCounts = new Map<string, number>();
    
    // Sample pixels (every 4th pixel for performance)
    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const alpha = pixels[i + 3];
      
      if (alpha > 128) { // Only consider non-transparent pixels
        colors.push([r, g, b]);
        const colorKey = `${r},${g},${b}`;
        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
      }
    }

    if (colors.length === 0) {
      return {
        dominantColor: '#000000',
        averageColor: '#000000',
        contrastRatio: 0,
        textColor: '#000000',
        backgroundColors: ['#ffffff'],
        confidence: 0
      };
    }

    // Find dominant color
    let dominantColor = '#000000';
    let maxCount = 0;
    for (const [colorKey, count] of colorCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        const [r, g, b] = colorKey.split(',').map(Number);
        dominantColor = this.rgbToHex(r, g, b);
      }
    }

    // Calculate average color
    const avgR = Math.round(colors.reduce((sum, [r]) => sum + r, 0) / colors.length);
    const avgG = Math.round(colors.reduce((sum, [, g]) => sum + g, 0) / colors.length);
    const avgB = Math.round(colors.reduce((sum, [, , b]) => sum + b, 0) / colors.length);
    const averageColor = this.rgbToHex(avgR, avgG, avgB);

    // Determine if background is light or dark to choose optimal text color
    const brightness = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;
    const textColor = brightness > 128 ? '#000000' : '#ffffff';
    
    // Calculate contrast ratio
    const contrastRatio = this.calculateContrastRatio(
      [avgR, avgG, avgB],
      textColor === '#ffffff' ? [255, 255, 255] : [0, 0, 0]
    );

    // Get background color variations
    const backgroundColors = this.extractBackgroundColors(colors);

    return {
      dominantColor,
      averageColor,
      contrastRatio,
      textColor,
      backgroundColors,
      confidence: Math.min(maxCount / colors.length, 1)
    };
  }

  private extractBackgroundColors(colors: Array<[number, number, number]>): string[] {
    // Cluster colors into background variations
    const clusters = this.kMeansColors(colors, 3);
    return clusters.map(([r, g, b]) => this.rgbToHex(r, g, b));
  }

  private kMeansColors(colors: Array<[number, number, number]>, k: number): Array<[number, number, number]> {
    if (colors.length <= k) return colors;
    
    // Simple k-means clustering for color grouping
    let centroids = colors.slice(0, k);
    
    for (let iteration = 0; iteration < 10; iteration++) {
      const clusters: Array<Array<[number, number, number]>> = Array(k).fill(null).map(() => []);
      
      // Assign each color to nearest centroid
      for (const color of colors) {
        let minDistance = Infinity;
        let nearestCluster = 0;
        
        for (let i = 0; i < centroids.length; i++) {
          const distance = this.colorDistance(color, centroids[i]);
          if (distance < minDistance) {
            minDistance = distance;
            nearestCluster = i;
          }
        }
        
        clusters[nearestCluster].push(color);
      }
      
      // Update centroids
      const newCentroids: Array<[number, number, number]> = [];
      for (const cluster of clusters) {
        if (cluster.length > 0) {
          const avgR = Math.round(cluster.reduce((sum, [r]) => sum + r, 0) / cluster.length);
          const avgG = Math.round(cluster.reduce((sum, [, g]) => sum + g, 0) / cluster.length);
          const avgB = Math.round(cluster.reduce((sum, [, , b]) => sum + b, 0) / cluster.length);
          newCentroids.push([avgR, avgG, avgB]);
        } else {
          newCentroids.push(centroids[newCentroids.length]);
        }
      }
      
      centroids = newCentroids;
    }
    
    return centroids;
  }

  private colorDistance(color1: [number, number, number], color2: [number, number, number]): number {
    const [r1, g1, b1] = color1;
    const [r2, g2, b2] = color2;
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }

  private calculateContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
    const luminance1 = this.relativeLuminance(color1);
    const luminance2 = this.relativeLuminance(color2);
    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private relativeLuminance([r, g, b]: [number, number, number]): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  }
}

/**
 * Smart text color detection that analyzes the surrounding area
 */
export async function detectOptimalTextColor(
  imageDataUrl: string,
  textRegion: { x: number; y: number; width: number; height: number }
): Promise<{
  color: string;
  shadowColor?: string;
  outlineColor?: string;
  confidence: number;
}> {
  const detector = new AdvancedColorDetector();
  const analysis = await detector.analyzeTextRegion(
    imageDataUrl,
    textRegion.x,
    textRegion.y,
    textRegion.width,
    textRegion.height
  );

  // Determine if we need text shadows or outlines for better visibility
  const needsEnhancement = analysis.contrastRatio < 3;
  
  return {
    color: analysis.textColor,
    shadowColor: needsEnhancement ? (analysis.textColor === '#ffffff' ? '#000000' : '#ffffff') : undefined,
    outlineColor: needsEnhancement ? analysis.backgroundColors[0] : undefined,
    confidence: analysis.confidence
  };
}
