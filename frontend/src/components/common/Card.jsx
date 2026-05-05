// frontend/src/components/common/Card.jsx
import React from 'react';

export default function Card({ title, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}