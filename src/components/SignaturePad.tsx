"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Trash2, CheckCircle2, Eraser, PenTool } from 'lucide-react';
import { Badge } from './ui/badge';

interface SignaturePadProps {
  onSave: (signatureUrl: string) => void;
  onClear?: () => void;
  title: string;
}

export function SignaturePad({ onSave, onClear, title }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Scale for high resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b'; // Slate 800
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSaved) return;
    setIsDrawing(true);
    setHasContent(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSaved) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasContent(false);
      setIsSaved(false);
      onClear?.();
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas && hasContent) {
      setIsSaved(true);
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
          <PenTool size={14} className="text-blue-600" /> {title}
        </p>
        {isSaved ? (
          <Badge className="bg-green-600 text-white border-none text-[8px] uppercase">Firma Registrada</Badge>
        ) : (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[8px] border-blue-100 uppercase">Táctil</Badge>
        )}
      </div>
      
      <div className={cn(
        "border-2 rounded-[1.5rem] bg-white overflow-hidden touch-none shadow-inner transition-all",
        isSaved ? "border-green-500 opacity-60" : "border-slate-200 active:border-blue-400"
      )}>
        <canvas
          ref={canvasRef}
          className="w-full h-40 cursor-crosshair touch-none bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]"
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="lg" className="flex-1 h-12 rounded-xl text-slate-500 font-bold border-slate-200" onClick={clear}>
          <Eraser size={16} className="mr-2" /> LIMPIAR
        </Button>
        <Button 
          size="lg" 
          className={cn(
            "flex-1 h-12 rounded-xl font-bold transition-all",
            isSaved ? "bg-green-600 text-white" : "bg-slate-900 text-white shadow-lg active:scale-95"
          )} 
          onClick={handleSave} 
          disabled={!hasContent || isSaved}
        >
          {isSaved ? <CheckCircle2 size={18} className="mr-2" /> : <CheckCircle2 size={18} className="mr-2" />}
          {isSaved ? 'FIRMA OK' : 'FIJAR FIRMA'}
        </Button>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
