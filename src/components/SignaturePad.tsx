"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Trash2, CheckCircle2, Eraser, PenTool, Maximize2, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onSave: (signatureUrl: string) => void;
  onClear?: () => void;
  title: string;
  defaultValue?: string;
}

export function SignaturePad({ onSave, onClear, title, defaultValue }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(!!defaultValue);
  const [isSaved, setIsSaved] = useState(!!defaultValue);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Pequeno delay para asegurar que el canvas este en el DOM
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Ajustar tamaño al contenedor real (pantalla completa)
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a'; // Slate 900
        
        // Desactivar scroll al tocar el canvas
        canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  const handleFinish = () => {
    const canvas = canvasRef.current;
    if (canvas && hasContent) {
      const url = canvas.toDataURL('image/png');
      setIsSaved(true);
      onSave(url);
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
          <PenTool size={12} className="text-blue-600" /> {title}
        </p>
        {isSaved ? (
          <Badge className="bg-green-600 text-white border-none text-[8px] uppercase">Registrada</Badge>
        ) : (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[8px] border-blue-100 uppercase animate-pulse">Pendiente</Badge>
        )}
      </div>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <div className={cn(
            "h-24 w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95",
            isSaved ? "bg-green-50 border-green-200" : "bg-white border-slate-200 hover:border-blue-300"
          )}>
            {isSaved ? (
              <div className="flex flex-col items-center gap-1">
                 <CheckCircle2 size={24} className="text-green-500" />
                 <p className="text-[9px] font-black text-green-700 uppercase">Pulsa para modificar</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                 <Maximize2 size={20} className="text-slate-300" />
                 <p className="text-[10px] font-black text-slate-400 uppercase">Pulsar para firmar</p>
              </div>
            )}
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-[100vw] h-[100dvh] p-0 gap-0 border-none rounded-none bg-white flex flex-col">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                   <PenTool size={20} />
                </div>
                <div>
                   <h3 className="text-sm font-black uppercase italic leading-none">{title}</h3>
                   <p className="text-[9px] text-white/50 font-bold uppercase mt-1">Gire el teléfono para mayor espacio</p>
                </div>
             </div>
             <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white rounded-full">
                <X size={24} />
             </Button>
          </div>

          <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col p-4">
             <div className="flex-1 bg-white border-2 border-slate-200 rounded-3xl shadow-inner relative overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair touch-none bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:24px_24px]"
                  onMouseDown={startDrawing}
                  onMouseUp={stopDrawing}
                  onMouseOut={stopDrawing}
                  onMouseMove={draw}
                  onTouchStart={startDrawing}
                  onTouchEnd={stopDrawing}
                  onTouchMove={draw}
                />
             </div>
          </div>

          <div className="p-4 bg-white border-t flex gap-3 shrink-0">
             <Button variant="outline" className="flex-1 h-16 rounded-2xl font-black text-xs uppercase text-slate-500" onClick={clear}>
                <Eraser size={20} className="mr-2" /> Borrar
             </Button>
             <Button className="flex-[2] h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-xl" onClick={handleFinish} disabled={!hasContent}>
                CONFIRMAR FIRMA
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
