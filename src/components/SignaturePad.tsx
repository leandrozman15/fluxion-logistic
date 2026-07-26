
"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Trash2, CheckCircle2, Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureUrl: string) => void;
  onClear?: () => void;
  title: string;
}

export function SignaturePad({ onSave, onClear, title }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

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
    
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a'; // Slate 900
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
    if (!isDrawing) return;
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
      onClear?.();
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas && hasContent) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{title}</p>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[8px] border-blue-100 uppercase">Pantalla Táctil Activa</Badge>
      </div>
      
      <div className="border-2 border-slate-200 rounded-2xl bg-slate-50 overflow-hidden touch-none shadow-inner">
        <canvas
          ref={canvasRef}
          className="w-full h-48 cursor-crosshair touch-none"
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
        <Button variant="ghost" size="sm" className="flex-1 text-slate-500 font-bold" onClick={clear}>
          <Eraser size={14} className="mr-1" /> LIMPIAR
        </Button>
        <Button size="sm" className="flex-1 bg-slate-900 text-white font-bold" onClick={handleSave} disabled={!hasContent}>
          <CheckCircle2 size={14} className="mr-1" /> FIJAR FIRMA
        </Button>
      </div>
    </div>
  );
}

import { Badge } from './ui/badge';
