import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, FabricText, Rect, Circle, FabricImage, util } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Type, 
  Square, 
  Circle as CircleIcon, 
  Upload, 
  Download, 
  Share2,
  Undo2,
  Redo2,
  Trash2,
  Move,
  MousePointer,
  Palette
} from "lucide-react";

export const ImageEditor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "text" | "rectangle" | "circle" | "move">("select");
  const [textProperties, setTextProperties] = useState({
    text: "Edit text here",
    fontSize: 24,
    color: "#000000",
    fontFamily: "Arial"
  });
  const [shapeColor, setShapeColor] = useState("#8B5CF6");

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: "#ffffff",
    });

    setFabricCanvas(canvas);
    toast("Image Editor Ready! Upload an image or start creating.", {
      description: "Use the tools on the left to edit your images"
    });

    return () => {
      canvas.dispose();
    };
  }, []);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgUrl = e.target?.result as string;
      
      FabricImage.fromURL(imgUrl).then((img) => {
        // Scale image to fit canvas while maintaining aspect ratio
        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();
        const imgWidth = img.width || 1;
        const imgHeight = img.height || 1;
        
        const scale = Math.min(canvasWidth / imgWidth, canvasHeight / imgHeight);
        img.scale(scale * 0.8); // Leave some margin
        
        // Center the image
        img.set({
          left: (canvasWidth - img.getScaledWidth()) / 2,
          top: (canvasHeight - img.getScaledHeight()) / 2,
        });
        
        fabricCanvas.clear();
        fabricCanvas.add(img);
        fabricCanvas.renderAll();
        
        toast("Image uploaded successfully!", {
          description: "You can now edit text and add elements"
        });
      });
    };
    reader.readAsDataURL(file);
  }, [fabricCanvas]);

  const addText = useCallback(() => {
    if (!fabricCanvas) return;

    const text = new FabricText(textProperties.text, {
      left: 100,
      top: 100,
      fontSize: textProperties.fontSize,
      fill: textProperties.color,
      fontFamily: textProperties.fontFamily,
      editable: true,
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.renderAll();
    
    toast("Text added! Double-click to edit directly on canvas");
  }, [fabricCanvas, textProperties]);

  const addRectangle = useCallback(() => {
    if (!fabricCanvas) return;

    const rect = new Rect({
      left: 100,
      top: 100,
      fill: shapeColor,
      width: 100,
      height: 100,
      stroke: '#ffffff',
      strokeWidth: 2,
    });

    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    fabricCanvas.renderAll();
  }, [fabricCanvas, shapeColor]);

  const addCircle = useCallback(() => {
    if (!fabricCanvas) return;

    const circle = new Circle({
      left: 100,
      top: 100,
      fill: shapeColor,
      radius: 50,
      stroke: '#ffffff',
      strokeWidth: 2,
    });

    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
    fabricCanvas.renderAll();
  }, [fabricCanvas, shapeColor]);

  const deleteSelected = useCallback(() => {
    if (!fabricCanvas) return;

    const activeObjects = fabricCanvas.getActiveObjects();
    fabricCanvas.remove(...activeObjects);
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
    
    if (activeObjects.length > 0) {
      toast("Selected objects deleted");
    }
  }, [fabricCanvas]);

  const exportImage = useCallback(() => {
    if (!fabricCanvas) return;

    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });

    const link = document.createElement('a');
    link.download = 'edited-image.png';
    link.href = dataURL;
    link.click();
    
    toast("Image exported successfully!");
  }, [fabricCanvas]);

  const shareImage = useCallback(async () => {
    if (!fabricCanvas) return;

    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 0.8,
      multiplier: 1,
    });

    // Convert data URL to blob
    const response = await fetch(dataURL);
    const blob = await response.blob();
    
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], 'edited-image.png', { type: 'image/png' });
        await navigator.share({
          title: 'Edited Image',
          text: 'Check out my edited image!',
          files: [file],
        });
        toast("Image shared successfully!");
      } catch (error) {
        // Fallback to copy to clipboard
        copyToClipboard(blob);
      }
    } else {
      // Fallback to copy to clipboard
      copyToClipboard(blob);
    }
  }, [fabricCanvas]);

  const copyToClipboard = async (blob: Blob) => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      toast("Image copied to clipboard!", {
        description: "You can now paste it anywhere"
      });
    } catch (error) {
      toast("Sharing not supported", {
        description: "Use the download button instead"
      });
    }
  };

  const clearCanvas = useCallback(() => {
    if (!fabricCanvas) return;
    
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#ffffff";
    fabricCanvas.renderAll();
    toast("Canvas cleared");
  }, [fabricCanvas]);

  const updateSelectedText = useCallback(() => {
    if (!fabricCanvas) return;

    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject && activeObject.type === 'text') {
      const textObj = activeObject as FabricText;
      textObj.set({
        text: textProperties.text,
        fontSize: textProperties.fontSize,
        fill: textProperties.color,
        fontFamily: textProperties.fontFamily,
      });
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas, textProperties]);

  const toolButtons = [
    { id: "select", icon: MousePointer, label: "Select", onClick: () => setActiveTool("select") },
    { id: "text", icon: Type, label: "Add Text", onClick: addText },
    { id: "rectangle", icon: Square, label: "Rectangle", onClick: addRectangle },
    { id: "circle", icon: CircleIcon, label: "Circle", onClick: addCircle },
  ];

  return (
    <div className="min-h-screen bg-editor-bg">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-80 bg-editor-sidebar border-r border-border p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Upload Section */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-foreground">Upload Image</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                variant="outline"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose Image
              </Button>
            </Card>

            {/* Tools */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-foreground">Tools</h3>
              <div className="grid grid-cols-2 gap-2">
                {toolButtons.map((tool) => (
                  <Button
                    key={tool.id}
                    variant={activeTool === tool.id ? "default" : "outline"}
                    size="sm"
                    onClick={tool.onClick}
                    className="flex flex-col h-16 text-xs"
                  >
                    <tool.icon className="h-5 w-5 mb-1" />
                    {tool.label}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Text Properties */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-foreground">Text Properties</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="text-input" className="text-sm">Text</Label>
                  <Input
                    id="text-input"
                    value={textProperties.text}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, text: e.target.value }))}
                    onBlur={updateSelectedText}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Font Size: {textProperties.fontSize}px</Label>
                  <Slider
                    value={[textProperties.fontSize]}
                    onValueChange={([value]) => {
                      setTextProperties(prev => ({ ...prev, fontSize: value }));
                      updateSelectedText();
                    }}
                    min={8}
                    max={72}
                    step={1}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="text-color" className="text-sm">Text Color</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <input
                      id="text-color"
                      type="color"
                      value={textProperties.color}
                      onChange={(e) => {
                        setTextProperties(prev => ({ ...prev, color: e.target.value }));
                        updateSelectedText();
                      }}
                      className="w-8 h-8 rounded border"
                    />
                    <Input
                      value={textProperties.color}
                      onChange={(e) => {
                        setTextProperties(prev => ({ ...prev, color: e.target.value }));
                        updateSelectedText();
                      }}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Shape Properties */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-foreground">Shape Color</h3>
              <div className="flex items-center space-x-2">
                <Palette className="h-4 w-4" />
                <input
                  type="color"
                  value={shapeColor}
                  onChange={(e) => setShapeColor(e.target.value)}
                  className="w-8 h-8 rounded border"
                />
                <Input
                  value={shapeColor}
                  onChange={(e) => setShapeColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </Card>

            {/* Actions */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 text-foreground">Actions</h3>
              <div className="space-y-2">
                <Button onClick={deleteSelected} variant="outline" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
                <Button onClick={clearCanvas} variant="outline" className="w-full">
                  Clear Canvas
                </Button>
                <Separator />
                <Button onClick={exportImage} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button onClick={shareImage} variant="secondary" className="w-full">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-editor-canvas rounded-xl shadow-lg p-8 max-w-fit">
            <canvas 
              ref={canvasRef} 
              className="border border-border rounded-lg shadow-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
};