// frontend/src/components/common/Input.jsx
import React from 'react';

export default function Input({
  label,
  error,
  type = 'text',
  placeholder,
  value,
  onChange,
  onKeyDown,
  className = '',
  inputRef,
  autoFocus = false,
  ...props
}) {
  return (
    <div className={`${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`input ${error ? 'input-error' : ''}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
    </div>
  );
}