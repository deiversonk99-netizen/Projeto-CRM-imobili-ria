import React from 'react';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  intent?: 'danger' | 'info' | 'success' | 'warning';
}

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  intent = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const styles = {
    danger: {
      icon: <AlertTriangle className="h-6 w-6" />,
      iconBg: 'bg-red-100 text-red-600',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6" />,
      iconBg: 'bg-orange-100 text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700 text-white',
    },
    info: {
      icon: <Info className="h-6 w-6" />,
      iconBg: 'bg-blue-100 text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    success: {
      icon: <CheckCircle className="h-6 w-6" />,
      iconBg: 'bg-green-100 text-green-600',
      button: 'bg-green-600 hover:bg-green-700 text-white',
    }
  };

  const currentStyle = styles[intent];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${currentStyle.iconBg}`}>
              {currentStyle.icon}
            </div>
            <div className="pt-1">
              <h3 className="text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="bg-muted/50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-border">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80 rounded-xl transition-colors border border-transparent hover:border-border"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-xl transition-all shadow-sm ${currentStyle.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
