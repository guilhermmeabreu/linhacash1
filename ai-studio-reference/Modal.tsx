import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="sheet-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("sheet-content", className)}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-sm font-black tracking-widest uppercase">{title}</h3>
          <button onClick={onClose} className="btn-ghost">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
}
