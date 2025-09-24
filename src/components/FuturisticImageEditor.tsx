import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TextDetection } from "./TextDetection";
import { AdvancedTextReplacement } from "./AdvancedTextReplacement";
import { toast } from "sonner";
import jsPDF from "jspdf";
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
  FileImage,
  Settings,
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
  const [exportFormat, setExportFormat] = useState('png');
  const [exportQuality, setExportQuality] = useState(0.9);
  const [originalFormat, setOriginalFormat] = useState('png');
  const [batchImages, setBatchImages] = useState<any[]>([]);
  const [batchResults, setBatchResults] = useState<any[]>([]);

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
        
        // Detect original format from file
        const detectedFormat = file.type.split('/')[1] || 'png';
        setOriginalFormat(detectedFormat);
        setExportFormat(detectedFormat);
        
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

  const exportImage = useCallback((format = exportFormat, quality = exportQuality) => {
    if (!fabricCanvas) return;

    try {
      let outputFormat = format;
      let mimeType = 'image/png';
      
      // Handle different export formats
      switch (format) {
        case 'jpg':
        case 'jpeg':
          outputFormat = 'jpeg';
          mimeType = 'image/jpeg';
          break;
        case 'webp':
          outputFormat = 'webp';
          mimeType = 'image/webp';
          break;
        case 'pdf':
          // For PDF, we'll export as high-quality PNG first
          outputFormat = 'png';
          mimeType = 'image/png';
          quality = 1;
          break;
        default:
          outputFormat = 'png';
          mimeType = 'image/png';
      }

      const dataURL = fabricCanvas.toDataURL({
        format: outputFormat as 'png' | 'jpeg' | 'webp',
        quality: outputFormat === 'png' ? 1 : quality,
        multiplier: 2,
      });

      // For PDF export, convert to PDF
      if (format === 'pdf') {
        exportAsPDF(dataURL);
        return;
      }

      const link = document.createElement('a');
      link.download = `snapedit-${Date.now()}.${format}`;
      link.href = dataURL;
      link.click();
      
      toast.success(`Image downloaded as ${format.toUpperCase()}!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Export failed");
    }
  }, [fabricCanvas, exportFormat, exportQuality]);

  const exportAsPDF = useCallback((imageDataURL: string) => {
    try {
      const img = new Image();
      
      img.onload = () => {
        // Create PDF with proper dimensions
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.width, img.height]
        });
        
        // Add image to PDF
        pdf.addImage(imageDataURL, 'PNG', 0, 0, img.width, img.height);
        
        // Download PDF
        pdf.save(`snapedit-${Date.now()}.pdf`);
        
        toast.success("PDF export completed!");
      };
      
      img.onerror = () => {
        toast.error("Failed to load image for PDF export");
      };
      
      img.src = imageDataURL;
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error("PDF export failed");
    }
  }, []);

  const handleBatchUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;

    toast.loading(`Processing ${files.length} images...`);
    
    const newBatchImages: any[] = [];
    let processedCount = 0;

    files.forEach((file, index) => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        newBatchImages.push({
          id: `batch-${Date.now()}-${index}`,
          name: file.name,
          dataUrl: e.target?.result as string,
          format: file.type.split('/')[1]
        });
        
        processedCount++;
        if (processedCount === files.length) {
          setBatchImages((prev: any[]) => [...prev, ...newBatchImages]);
          toast.success(`Added ${newBatchImages.length} images to batch`);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const processBatch = useCallback(async () => {
    if (!batchImages.length) {
      toast.error("No images in batch");
      return;
    }

    setIsProcessing(true);
    const loadingToast = toast.loading(`Processing batch of ${batchImages.length} images...`);

    try {
      const response = await fetch('/api/batch-detect-text', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-openrouter-key': process.env.OPENROUTER_API_KEY || ''
        },
        body: JSON.stringify({ images: batchImages }),
      });

      const result = await response.json();
      toast.dismiss(loadingToast);
      
      if (result.success && result.summary) {
        const { total, successful, failed } = result.summary;
        
        if (successful === total) {
          toast.success(`✅ Batch completed! All ${total} images processed successfully.`);
        } else if (successful > 0) {
          toast.success(`⚠️ Batch completed! ${successful}/${total} images processed successfully. ${failed} failed.`, {
            description: "Check individual results below."
          });
        } else {
          toast.error(`❌ Batch failed! All ${total} images failed to process.`);
        }
        
        // Store detailed results for UI display
        setBatchResults(result.results);
        console.log('Batch processing results:', result.results);
      } else {
        toast.error("Batch processing failed");
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Batch processing error:', error);
      toast.error("Batch processing error");
    } finally {
      setIsProcessing(false);
    }
  }, [batchImages]);

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
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Format</Label>
                      <Select value={exportFormat} onValueChange={setExportFormat}>
                        <SelectTrigger className="bg-background/50 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={originalFormat}>Original ({originalFormat.toUpperCase()})</SelectItem>
                          <SelectItem value="png">PNG</SelectItem>
                          <SelectItem value="jpg">JPG</SelectItem>
                          <SelectItem value="webp">WebP</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Quality</Label>
                      <Select value={exportQuality.toString()} onValueChange={(v) => setExportQuality(parseFloat(v))}>
                        <SelectTrigger className="bg-background/50 border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.6">Low (60%)</SelectItem>
                          <SelectItem value="0.8">Medium (80%)</SelectItem>
                          <SelectItem value="0.9">High (90%)</SelectItem>
                          <SelectItem value="1.0">Maximum (100%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={() => exportImage()} variant="outline" size="sm" disabled={!currentImageDataUrl}>
                      <Download className="mr-2 h-3 w-3" /> Download
                    </Button>
                    <Button onClick={shareImage} variant="outline" size="sm" disabled={!currentImageDataUrl}>
                      <Share2 className="mr-2 h-3 w-3" /> Share
                    </Button>
                    <Button onClick={clearCanvas} variant="destructive" size="sm" className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 hover:text-white">
                      <Trash2 className="mr-2 h-3 w-3" /> Clear
                    </Button>
                  </div>
                </div>
              </Card>

              {batchResults.length > 0 && (
                <Card className="p-4 bg-white/5 border-white/10 shadow-lg">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center">
                    <FileImage className="mr-2 h-4 w-4 text-primary" />
                    Batch Results
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {batchResults.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded bg-background/30 border border-white/10">
                        <div className="flex-1 text-sm truncate">
                          <span className="text-foreground">{result.imageName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <>
                              <Badge variant="outline" className="text-green-400 border-green-400/50">
                                ✓ {result.data?.detectedTexts?.length || 0} texts
                              </Badge>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-red-400 border-red-400/50">
                              ✗ Failed
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => setBatchResults([])} 
                    size="sm" 
                    variant="ghost" 
                    className="w-full mt-2 text-muted-foreground"
                  >
                    Clear Results
                  </Button>
                </Card>
              )}

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
