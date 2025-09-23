import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Text as FabricText, Rect, Image as FabricImage, Shadow } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TextDetection } from "./TextDetection";
import { AdvancedTextReplacement } from "./AdvancedTextReplacement";
import { toast } from "sonner";
import { detectOptimalTextColor } from "@/utils/colorDetection";
import { matchFont } from "@/utils/fontAnalysis";
import {
  Brain,
  Zap,
  Upload,
  Download,
  Wand2,
  Target,
  Sparkles,
  Eye,
  Layers,
  Palette,
  Type,
  RotateCcw,
  RotateCw,
  Save,
  Share2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MousePointer,
  Move,
  Trash2
} from "lucide-react";

interface DetectedText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export const FuturisticImageEditor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [currentImageDataUrl, setCurrentImageDataUrl] = useState<string>("");
  const [detectedTexts, setDetectedTexts] = useState<DetectedText[]>([]);
  const [selectedText, setSelectedText] = useState<DetectedText | null>(null);
  const [textHighlights, setTextHighlights] = useState<Rect[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [activeTool, setActiveTool] = useState<"select" | "move" | "analyze">("select");

  // Initialize the futuristic canvas (once)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current);
    canvas.setDimensions({ width: canvasSize.width, height: canvasSize.height });
    canvas.backgroundColor = "#0a0a0a";
    canvas.renderAll();

    setFabricCanvas(canvas);

    toast("Neural Image Editor Initialized", {
      description: "Advanced AI-powered text replacement ready",
      icon: <Brain className="h-4 w-4 text-primary" />
    });

    return () => {
      canvas.dispose();
    };
  }, []);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !fabricCanvas) {
      console.log('Upload failed: missing file or canvas', { file: !!file, fabricCanvas: !!fabricCanvas });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast("Invalid file type", {
        description: "Please select an image file"
      });
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast("File too large", {
        description: "Please select an image smaller than 50MB"
      });
      return;
    }

    console.log('Starting file upload:', file.name, file.type, file.size);
    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const imgUrl = e.target?.result as string;
        if (!imgUrl) {
          throw new Error('Failed to read file');
        }
        
        console.log('File read successfully, loading into canvas...');
        setCurrentImageDataUrl(imgUrl);
        
        const img = await FabricImage.fromURL(imgUrl);
        const imgWidth = img.width || 1;
        const imgHeight = img.height || 1;
        
        console.log('Image loaded:', { imgWidth, imgHeight });
        
        // Smart canvas sizing
        const maxWidth = 1400;
        const maxHeight = 900;
        
        let newWidth = imgWidth;
        let newHeight = imgHeight;
        
        if (imgWidth > maxWidth || imgHeight > maxHeight) {
          const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
          newWidth = imgWidth * scale;
          newHeight = imgHeight * scale;
        }
        
        console.log('Canvas sizing:', { newWidth, newHeight });
        
        setCanvasSize({ width: newWidth, height: newHeight });
        fabricCanvas.setDimensions({ width: newWidth, height: newHeight });
        
        // Perfect image positioning
        img.scaleToWidth(newWidth);
        img.scaleToHeight(newHeight);
        img.set({
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
        });
        
        fabricCanvas.clear();
        fabricCanvas.add(img);
        fabricCanvas.renderAll();
        
        setIsProcessing(false);
        toast("Image loaded successfully", {
          description: "Ready for advanced text analysis",
          icon: <Sparkles className="h-4 w-4 text-primary" />
        });
        
        console.log('Image upload completed successfully');
        // Reset input so selecting the same file triggers change
        (event.target as HTMLInputElement).value = '';
      } catch (error) {
        console.error('Error loading image:', error);
        setIsProcessing(false);
        toast("Failed to load image", {
          description: error instanceof Error ? error.message : "Unknown error occurred"
        });
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      setIsProcessing(false);
      toast("Failed to read file", {
        description: "There was an error reading the selected file"
      });
    };
    
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error starting file read:', error);
      setIsProcessing(false);
      toast("Failed to process file", {
        description: "Unable to process the selected file"
      });
    }
  }, [fabricCanvas]);

  // Load image if it was selected before canvas was ready
  useEffect(() => {
    const load = async () => {
      if (!fabricCanvas || !currentImageDataUrl) return;
      try {
        setIsProcessing(true);
        const img = await FabricImage.fromURL(currentImageDataUrl);
        const imgWidth = img.width || 1;
        const imgHeight = img.height || 1;
        const maxWidth = 1400;
        const maxHeight = 900;
        let newWidth = imgWidth;
        let newHeight = imgHeight;
        if (imgWidth > maxWidth || imgHeight > maxHeight) {
          const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
          newWidth = imgWidth * scale;
          newHeight = imgHeight * scale;
        }
        setCanvasSize({ width: newWidth, height: newHeight });
        fabricCanvas.setDimensions({ width: newWidth, height: newHeight });
        img.scaleToWidth(newWidth);
        img.scaleToHeight(newHeight);
        img.set({ left: 0, top: 0, selectable: false, evented: false });
        fabricCanvas.clear();
        fabricCanvas.add(img);
        fabricCanvas.renderAll();
        toast("Image loaded successfully", {
          description: "Ready for advanced text analysis",
          icon: <Sparkles className="h-4 w-4 text-primary" />
        });
      } catch (e) {
        console.error('Deferred image load failed', e);
      } finally {
        setIsProcessing(false);
      }
    };
    load();
  }, [fabricCanvas, currentImageDataUrl]);

  const handleTextDetected = useCallback((texts: DetectedText[]) => {
    if (!fabricCanvas) return;
    
    // Clear existing highlights
    textHighlights.forEach(highlight => fabricCanvas.remove(highlight));
    setTextHighlights([]);
    
    // Create futuristic highlight rectangles
    const highlights = texts.map((detectedText, index) => {
      const highlight = new Rect({
        left: (detectedText.x * canvasSize.width) / 100,
        top: (detectedText.y * canvasSize.height) / 100,
        width: (detectedText.width * canvasSize.width) / 100,
        height: (detectedText.height * canvasSize.height) / 100,
        fill: 'transparent',
        stroke: '#8b5cf6',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: true,
        hoverCursor: 'pointer',
        moveCursor: 'pointer',
        opacity: 0,
        shadow: new Shadow({
          color: '#8b5cf6',
          blur: 10,
          offsetX: 0,
          offsetY: 0,
        })
      });

      // Store original text data
      (highlight as any).originalText = detectedText;

      // Add futuristic hover effects
      highlight.on('mouseover', () => {
        highlight.set({ stroke: '#a855f7', strokeWidth: 3 });
        fabricCanvas.renderAll();
      });

      highlight.on('mouseout', () => {
        highlight.set({ stroke: '#8b5cf6', strokeWidth: 2 });
        fabricCanvas.renderAll();
      });

      // Selection handler
      highlight.on('mousedown', () => {
        setSelectedText(detectedText);
        toast(`Selected: "${detectedText.text}"`, {
          description: "Use advanced replacement panel to modify",
          icon: <Target className="h-4 w-4 text-primary" />
        });
      });

      // Animate highlight appearance
      setTimeout(() => {
        highlight.set({ opacity: 0.8 });
        fabricCanvas.renderAll();
      }, index * 100);

      return highlight;
    });

    highlights.forEach(highlight => fabricCanvas.add(highlight));
    setTextHighlights(highlights);
    setDetectedTexts(texts);
    fabricCanvas.renderAll();
  }, [fabricCanvas, canvasSize, textHighlights]);

  const handleAdvancedTextReplace = useCallback(async (
    textId: string,
    newText: string,
    styling: any
  ) => {
    if (!fabricCanvas) return;

    const targetHighlight = textHighlights.find(h => 
      (h as any).originalText?.id === textId
    );
    
    if (!targetHighlight) return;

    const bounds = targetHighlight.getBoundingRect();
    
    // Remove old text objects in the area with fade animation
    const objectsToRemove = fabricCanvas.getObjects().filter(obj => {
      if (textHighlights.includes(obj as Rect)) return false;
      
      const objBounds = obj.getBoundingRect();
      return !(
        objBounds.left > bounds.left + bounds.width ||
        objBounds.left + objBounds.width < bounds.left ||
        objBounds.top > bounds.top + bounds.height ||
        objBounds.top + objBounds.height < bounds.top
      );
    });

    // Remove old objects and create new text
    objectsToRemove.forEach(obj => fabricCanvas.remove(obj));

    setTimeout(() => {
      const newTextObj = new FabricText(newText, {
        left: bounds.left + 4,
        top: bounds.top + (bounds.height - styling.fontSize) / 2,
        fontSize: styling.fontSize,
        fill: styling.color,
        fontFamily: styling.fontFamily,
        fontWeight: styling.fontWeight,
        textAlign: 'left',
        editable: true,
      });

      fabricCanvas.add(newTextObj);
      fabricCanvas.remove(targetHighlight);
      setTextHighlights(prev => prev.filter(h => h !== targetHighlight));
      fabricCanvas.renderAll();
    }, 250);
  }, [fabricCanvas, textHighlights]);

  const exportImage = useCallback(() => {
    if (!fabricCanvas) return;

    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2, // Higher resolution export
    });

    const link = document.createElement('a');
    link.download = `neural-edit-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    toast("Image exported!", {
      description: "High-resolution export complete",
      icon: <Download className="h-4 w-4 text-primary" />
    });
  }, [fabricCanvas]);

  const clearCanvas = useCallback(() => {
    if (!fabricCanvas) return;
    
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#0a0a0a";
    setDetectedTexts([]);
    setTextHighlights([]);
    setCurrentImageDataUrl("");
    setSelectedText(null);
    fabricCanvas.renderAll();
    
    toast("Canvas cleared", {
      icon: <Trash2 className="h-4 w-4" />
    });
  }, [fabricCanvas]);

  return (
    <div className="min-h-screen bg-gradient-neural bg-[length:400%_400%] animate-neural-flow">
      {/* Futuristic Header */}
      <div className="border-b border-primary/30 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-primary animate-pulse-glow" />
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Neural Text Editor
              </h1>
            </div>
            <Badge 
              variant="secondary" 
              className="bg-primary/10 text-primary border-primary/30 shadow-glow-primary"
            >
              AI-Powered
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="border-primary/30 hover:bg-primary/10"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFullscreenMode(!fullscreenMode)}
              className="border-primary/30 hover:bg-primary/10"
            >
              {fullscreenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Advanced Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-96'} transition-all duration-300 border-r border-primary/30 bg-background/80 backdrop-blur-xl overflow-y-auto`}>
          {!sidebarCollapsed && (
            <div className="p-6 space-y-6">
              {/* Upload Section */}
              <Card className="p-4 bg-gradient-secondary border-primary/30 shadow-glow">
                <div className="flex items-center mb-3">
                  <Upload className="mr-2 h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Image Upload</h3>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full bg-gradient-primary hover:shadow-glow-primary transition-all duration-300"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isProcessing ? "Processing..." : "Upload Image"}
                </Button>
              </Card>

              {/* Text Detection */}
              <TextDetection
                onTextDetected={handleTextDetected}
                imageDataUrl={currentImageDataUrl}
              />

              {/* Advanced Text Replacement */}
              <AdvancedTextReplacement
                detectedTexts={detectedTexts}
                selectedText={selectedText}
                imageDataUrl={currentImageDataUrl}
                onTextReplace={handleAdvancedTextReplace}
                onTextSelect={setSelectedText}
              />

              {/* Quick Actions */}
              <Card className="p-4 bg-gradient-secondary border-primary/30">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Zap className="mr-2 h-4 w-4 text-primary" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={exportImage}
                    variant="outline"
                    size="sm"
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Export
                  </Button>
                  <Button
                    onClick={clearCanvas}
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Clear
                  </Button>
                </div>
              </Card>

              {/* Stats Panel */}
              {detectedTexts.length > 0 && (
                <Card className="p-4 bg-gradient-accent border-primary/30">
                  <h3 className="font-semibold mb-3 flex items-center">
                    <Eye className="mr-2 h-4 w-4 text-primary" />
                    Detection Stats
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Detected Texts:</span>
                      <Badge variant="secondary">{detectedTexts.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Confidence:</span>
                      <Badge variant="secondary">
                        {Math.round(detectedTexts.reduce((sum, t) => sum + t.confidence, 0) / detectedTexts.length * 100)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Selected:</span>
                      <Badge variant={selectedText ? "default" : "secondary"}>
                        {selectedText ? "1" : "0"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hologram animate-hologram opacity-20 pointer-events-none" />
          
          <div className="h-full flex items-center justify-center p-6">
            <div 
              className="relative rounded-lg overflow-hidden shadow-2xl"
              style={{
                boxShadow: '0 0 40px hsl(262 83% 58% / 0.3), inset 0 0 40px hsl(262 83% 58% / 0.1)'
              }}
            >
              <canvas 
                ref={canvasRef} 
                className="max-w-full max-h-full border border-primary/30 rounded-lg"
              />
              
              {/* Loading Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Brain className="h-12 w-12 text-primary animate-pulse-glow mx-auto" />
                    <p className="text-primary font-medium">Neural Processing...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
