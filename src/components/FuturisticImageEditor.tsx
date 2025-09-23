import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Object as FabricObject } from "fabric";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TextDetection } from "./TextDetection";
import { AdvancedTextReplacement } from "./AdvancedTextReplacement";
import { toast } from "sonner";
import {
  Brain,
  Zap,
  Upload,
  Download,
  Target,
  Sparkles,
  Eye,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
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
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);

  // Initialize the canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const initFabric = async () => {
      try {
        const fabric = await import("fabric");
        const canvas = new fabric.Canvas(canvasRef.current, {
          width: canvasSize.width,
          height: canvasSize.height,
          backgroundColor: "#0a0a0a"
        });
        
        setFabricCanvas(canvas);

        toast.success("Neural Image Editor Initialized", {
          description: "Advanced AI-powered text replacement ready"
        });
      } catch (error) {
        console.error("Failed to initialize Fabric.js:", error);
        toast.error("Failed to initialize editor");
      }
    };

    initFabric();

    return () => {
      if (fabricCanvas) {
        fabricCanvas.dispose();
      }
    };
  }, []);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !fabricCanvas) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Invalid file type", {
        description: "Please select an image file"
      });
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large", {
        description: "Please select an image smaller than 50MB"
      });
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const imgUrl = e.target?.result as string;
        if (!imgUrl) throw new Error('Failed to read file');
        
        setCurrentImageDataUrl(imgUrl);
        
        const fabric = await import("fabric");
        const img = await fabric.Image.fromURL(imgUrl);
        
        const maxWidth = 1400;
        const maxHeight = 900;
        let newWidth = img.width || maxWidth;
        let newHeight = img.height || maxHeight;
        
        if (newWidth > maxWidth || newHeight > maxHeight) {
          const scale = Math.min(maxWidth / newWidth, maxHeight / newHeight);
          newWidth = newWidth * scale;
          newHeight = newHeight * scale;
        }
        
        setCanvasSize({ width: newWidth, height: newHeight });
        fabricCanvas.setDimensions({ width: newWidth, height: newHeight });
        
        img.scaleToWidth(newWidth);
        img.scaleToHeight(newHeight);
        img.set({ left: 0, top: 0, selectable: false, evented: false });
        
        fabricCanvas.clear();
        fabricCanvas.add(img);
        fabricCanvas.renderAll();
        
        toast.success("Image loaded successfully", {
          description: "Ready for advanced text analysis"
        });
      } catch (error) {
        console.error('Error loading image:', error);
        toast.error("Failed to load image");
      } finally {
        setIsProcessing(false);
        if (event.target) (event.target as HTMLInputElement).value = '';
      }
    };
    
    reader.onerror = () => {
      setIsProcessing(false);
      toast.error("Failed to read file");
      if (event.target) (event.target as HTMLInputElement).value = '';
    };
    
    reader.readAsDataURL(file);
  }, [fabricCanvas]);

  const handleTextDetected = useCallback((texts: DetectedText[]) => {
    setDetectedTexts(texts);
    if (texts.length > 0) {
      toast.success(`Detected ${texts.length} text regions`);
    } else {
      toast.info("No text detected in the image");
    }
  }, []);

  const handleAdvancedTextReplace = useCallback(async (
    textId: string,
    newText: string,
    styling: any
  ) => {
    if (!fabricCanvas || !currentImageDataUrl) return;

    try {
      if (styling.editedImage) {
        // Handle FLUX model response
        const fabric = await import("fabric");
        const img = await fabric.Image.fromURL(styling.editedImage);
        
        fabricCanvas.clear();
        img.set({ left: 0, top: 0, selectable: false, evented: false });
        fabricCanvas.add(img);
        fabricCanvas.renderAll();
        
        setCurrentImageDataUrl(styling.editedImage);
        setDetectedTexts([]);
        setSelectedText(null);
        
        toast.success("Text replaced with AI precision!");
      } else {
        // Manual replacement fallback
        toast.info("Manual text replacement applied");
      }
    } catch (error) {
      console.error('Error in text replacement:', error);
      toast.error("Failed to replace text");
    }
  }, [fabricCanvas, currentImageDataUrl]);

  const exportImage = useCallback(() => {
    if (!fabricCanvas) return;

    try {
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2,
      });

      const link = document.createElement('a');
      link.download = `neural-edit-${Date.now()}.png`;
      link.href = dataURL;
      link.click();
      
      toast.success("Image exported!");
    } catch (error) {
      toast.error("Export failed");
    }
  }, [fabricCanvas]);

  const clearCanvas = useCallback(() => {
    if (!fabricCanvas) return;
    
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#0a0a0a";
    setDetectedTexts([]);
    setCurrentImageDataUrl("");
    setSelectedText(null);
    fabricCanvas.renderAll();
    
    toast.info("Canvas cleared");
  }, [fabricCanvas]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <div className="border-b border-purple-500/30 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-purple-500" />
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Neural Text Editor
              </h1>
            </div>
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
              AI-Powered
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="border-purple-500/30 hover:bg-purple-500/10"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFullscreenMode(!fullscreenMode)}
              className="border-purple-500/30 hover:bg-purple-500/10"
            >
              {fullscreenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-96'} transition-all duration-300 border-r border-purple-500/30 bg-black/80 backdrop-blur-xl overflow-y-auto`}>
          {!sidebarCollapsed && (
            <div className="p-6 space-y-6">
              {/* Upload Section */}
              <Card className="p-4 bg-purple-500/5 border-purple-500/30">
                <div className="flex items-center mb-3">
                  <Upload className="mr-2 h-5 w-5 text-purple-500" />
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
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isProcessing ? "Processing..." : "Upload Image"}
                </Button>
              </Card>

              {/* Text Detection */}
              <TextDetection
                onTextDetected={handleTextDetected}
                imageDataUrl={currentImageDataUrl}
                disabled={!currentImageDataUrl}
              />

              {/* Advanced Text Replacement */}
              <AdvancedTextReplacement
                detectedTexts={detectedTexts}
                selectedText={selectedText}
                imageDataUrl={currentImageDataUrl}
                onTextReplace={handleAdvancedTextReplace}
                onTextSelect={setSelectedText}
                disabled={detectedTexts.length === 0}
              />

              {/* Quick Actions */}
              <Card className="p-4 bg-purple-500/5 border-purple-500/30">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Zap className="mr-2 h-4 w-4 text-purple-500" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={exportImage}
                    variant="outline"
                    size="sm"
                    className="border-purple-500/30 hover:bg-purple-500/10"
                    disabled={!currentImageDataUrl}
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Export
                  </Button>
                  <Button
                    onClick={clearCanvas}
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 hover:bg-red-500/10"
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Clear
                  </Button>
                </div>
              </Card>

              {/* Stats Panel */}
              {detectedTexts.length > 0 && (
                <Card className="p-4 bg-purple-500/5 border-purple-500/30">
                  <h3 className="font-semibold mb-3 flex items-center">
                    <Eye className="mr-2 h-4 w-4 text-purple-500" />
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
                        {Math.round((detectedTexts.reduce((sum, t) => sum + t.confidence, 0) / detectedTexts.length) * 100)}%
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
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 opacity-20 pointer-events-none" />
          
          <div className="h-full flex items-center justify-center p-6">
            <div className="relative rounded-lg overflow-hidden shadow-2xl border border-purple-500/30">
              <canvas 
                ref={canvasRef} 
                className="max-w-full max-h-full"
              />
              
              {isProcessing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Brain className="h-12 w-12 text-purple-500 animate-pulse mx-auto" />
                    <p className="text-purple-400 font-medium">Processing Image...</p>
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
