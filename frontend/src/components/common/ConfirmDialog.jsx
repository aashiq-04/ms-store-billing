// frontend/src/components/common/ConfirmDialog.jsx
import React from 'react';
import Button from './Button';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger', 'warning', 'primary'
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: '🗑️',
      gradient: 'from-red-600 to-rose-700',
      buttonClass: 'btn-danger',
    },
    warning: {
      icon: '⚠️',
      gradient: 'from-amber-600 to-orange-700',
      buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    primary: {
      icon: 'ℹ️',
      gradient: 'from-primary-600 to-blue-700',
      buttonClass: 'btn-primary',
    },
  };

  const style = variantStyles[variant];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${style.gradient} px-6 py-4 rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{style.icon}</span>
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 text-lg leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="ghost"
            fullWidth
            onClick={onCancel}
            className="border-2 border-gray-300"
          >
            {cancelText}
          </Button>
          <Button
            className={`${style.buttonClass} shadow-lg`}
            fullWidth
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}