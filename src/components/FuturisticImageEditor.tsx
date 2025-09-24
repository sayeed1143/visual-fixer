import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas } from "fabric";
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
  Eye,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Trash2,
  Share2,
  Sparkles,
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
          backgroundColor: "transparent"
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
        fabricCanvas.backgroundColor = "transparent";
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
        fabricCanvas.backgroundColor = "transparent";
        fabricCanvas.add(img);
        fabricCanvas.renderAll();
        
        setCurrentImageDataUrl(styling.editedImage);
        setDetectedTexts([]);
        setSelectedText(null);
        
        toast.success("Text replaced with AI precision!");
      } else {
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
      link.download = `snapedit-${Date.now()}.png`;
      link.href = dataURL;
      link.click();
      
      toast.success("Image exported!");
    } catch (error) {
      toast.error("Export failed");
    }
  }, [fabricCanvas]);

  const shareImage = useCallback(async () => {
    if (!fabricCanvas) return;

    try {
      const dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });

      const response = await fetch(dataURL);
      const blob = await response.blob();
      const file = new File([blob], `snapedit-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'SnapEdit - AI Image Editor',
          text: 'Check out this image I edited with SnapEdit!',
          files: [file],
        });
        toast.success("Image shared successfully!");
      } else {
        if (navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          toast.success("Image copied to clipboard!");
        } else {
          toast.error("Share not supported on your browser.");
        }
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error("Failed to share image");
    }
  }, [fabricCanvas]);

  const clearCanvas = useCallback(() => {
    if (!fabricCanvas) return;
    
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "transparent";
    setDetectedTexts([]);
    setCurrentImageDataUrl("");
    setSelectedText(null);
    fabricCanvas.renderAll();
    
    toast.info("Canvas cleared");
  }, [fabricCanvas]);

  return (
    <div className={`w-full min-h-screen bg-background text-foreground ${fullscreenMode ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 border-b border-white/10 bg-background/80 backdrop-blur-xl animate-fade-in-down">
        <div className="flex items-center justify-between p-4 h-[73px]">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-pink-400">
                SnapEdit
              </h1>
            </div>
            <Badge variant="outline" className="border-primary/50 text-primary">
              AI-Powered
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-muted-foreground hover:text-foreground"
            >
              {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFullscreenMode(!fullscreenMode)}
              className="text-muted-foreground hover:text-foreground"
            >
              {fullscreenMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? 'w-0 -translate-x-full' : 'w-96'} transition-all duration-300 border-r border-white/10 bg-card/50 backdrop-blur-xl overflow-y-auto pt-[73px] animate-fade-in`}>
          {!sidebarCollapsed && (
            <div className="p-6 space-y-6">
              {/* Upload Section */}
              <Card className="p-4 bg-white/5 border-white/10 shadow-lg">
                <div className="flex items-center mb-3">
                  <Upload className="mr-2 h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Image Upload</h3>
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
                  className="w-full bg-gradient-to-r from-primary to-pink-500 text-white font-semibold hover:scale-105 transition-transform duration-200 hover:shadow-glow"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isProcessing ? "Processing..." : "Upload Image"}
                </Button>
              </Card>

              <TextDetection
                onTextDetected={handleTextDetected}
                imageDataUrl={currentImageDataUrl}
                disabled={!currentImageDataUrl}
              />

              <AdvancedTextReplacement
                detectedTexts={detectedTexts}
                selectedText={selectedText}
                imageDataUrl={currentImageDataUrl}
                onTextReplace={handleAdvancedTextReplace}
                onTextSelect={setSelectedText}
                disabled={detectedTexts.length === 0}
              />

              <Card className="p-4 bg-white/5 border-white/10 shadow-lg">
                <h3 className="font-semibold text-foreground mb-3 flex items-center">
                  <Zap className="mr-2 h-4 w-4 text-primary" />
                  Quick Actions
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={exportImage} variant="outline" size="sm" disabled={!currentImageDataUrl}>
                    <Download className="mr-2 h-3 w-3" /> Export
                  </Button>
                  <Button onClick={shareImage} variant="outline" size="sm" disabled={!currentImageDataUrl}>
                    <Share2 className="mr-2 h-3 w-3" /> Share
                  </Button>
                  <Button onClick={clearCanvas} variant="destructive" size="sm" className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 hover:text-white">
                    <Trash2 className="mr-2 h-3 w-3" /> Clear
                  </Button>
                </div>
              </Card>

              {detectedTexts.length > 0 && (
                <Card className="p-4 bg-white/5 border-white/10 shadow-lg">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center">
                    <Eye className="mr-2 h-4 w-4 text-primary" />
                    Detection Stats
                  </h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex justify-between"><span>Detected Texts:</span><Badge variant="secondary">{detectedTexts.length}</Badge></div>
                    <div className="flex justify-between"><span>Avg. Confidence:</span><Badge variant="secondary">{Math.round((detectedTexts.reduce((sum, t) => sum + t.confidence, 0) / detectedTexts.length) * 100)}%</Badge></div>
                    <div className="flex justify-between"><span>Selected:</span><Badge variant={selectedText ? "default" : "secondary"}>{selectedText ? "1" : "0"}</Badge></div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 relative overflow-hidden pt-[73px] animate-fade-in">
          <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" style={{ maskImage: 'radial-gradient(ellipse at center, white 20%, transparent 70%)' }}/>
          
          <div className="h-full flex items-center justify-center p-6">
            <div className="relative rounded-lg overflow-hidden shadow-2xl shadow-black/50 border border-white/10" style={{ width: canvasSize.width, height: canvasSize.height }}>
              <canvas ref={canvasRef} className="max-w-full max-h-full" />

              {detectedTexts.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {detectedTexts.map((t) => {
                    const isSel = selectedText?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`absolute rounded-md transition-all duration-300 cursor-pointer group ${isSel ? 'ring-2 ring-pink-400 shadow-glow' : 'ring-1 ring-primary/60 hover:ring-primary'}`}
                        style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.width}%`, height: `${t.height}%`, background: 'hsla(262, 83%, 68%, 0.1)' }}
                        onClick={() => setSelectedText(t)}
                      >
                        <div className="absolute -top-6 left-0 text-xs px-1.5 py-0.5 rounded-md bg-card/80 backdrop-blur-sm text-foreground border border-white/10 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {t.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isProcessing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Brain className="h-12 w-12 text-primary animate-pulse mx-auto" />
                    <p className="text-primary font-medium">Processing Image...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
