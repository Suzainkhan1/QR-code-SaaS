import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, Image as ImageIcon, X, RefreshCw, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';

interface ImageUploadInputProps {
  value: string;
  onChange: (url: string) => void;
  getHeaders?: () => Record<string, string>;
}

export default function ImageUploadInput({ value, onChange, getHeaders }: ImageUploadInputProps) {
  const [activeMode, setActiveMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setError(null);

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Only JPG, PNG, and WEBP images are supported.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size must be less than 5MB.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const headers: Record<string, string> = {};
      if (getHeaders) {
        const h = getHeaders();
        if (h['Authorization']) {
          headers['Authorization'] = h['Authorization'];
        }
      } else {
        const staffStorage = localStorage.getItem('crunchos-staff-auth');
        if (staffStorage) {
          const parsed = JSON.parse(staffStorage);
          if (parsed?.state?.token) {
            headers['Authorization'] = `Bearer ${parsed.state.token}`;
          }
        }
      }

      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to upload image');
      }

      const data = await res.json();
      onChange(data.url);
    } catch (err: any) {
      setError(err.message || 'Image upload failed. Try pasting an Image URL instead.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Item Image</label>
        <div className="flex gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveMode('upload')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
              activeMode === 'upload' ? 'bg-brand-accent text-brand-dark' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-3 h-3" /> Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('url')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
              activeMode === 'url' ? 'bg-brand-accent text-brand-dark' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-3 h-3" /> Image URL
          </button>
        </div>
      </div>

      {/* Image Preview if available */}
      {value ? (
        <div className="relative group bg-zinc-900/80 border border-zinc-800 rounded-xl p-2 flex items-center gap-3">
          <img
            src={value}
            alt="Preview"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60';
            }}
            className="w-14 h-14 object-cover rounded-lg border border-zinc-800 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-textPrimary truncate">{value}</p>
            <span className="text-[10px] text-zinc-500 block">Image set</span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold flex items-center gap-1"
              title="Replace image"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1.5 bg-red-950/30 hover:bg-red-900/50 text-red-400 rounded-lg text-[10px] font-bold"
              title="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Mode 1: File Upload / Drag & Drop */}
      {activeMode === 'upload' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-brand-accent bg-brand-accent/10'
              : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleFileChange}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-1 text-brand-accent py-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-xs font-semibold">Uploading image...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-brand-accent">
                <UploadCloud className="w-5 h-5 text-brand-accent" />
              </div>
              <div>
                <p className="text-xs font-bold text-brand-textPrimary">
                  Drag & Drop image here, or <span className="text-brand-accent underline">Browse</span>
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Supports JPG, PNG, WEBP (Max 5MB)</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mode 2: Direct URL Input */}
      {activeMode === 'url' && (
        <div className="relative">
          <input
            type="text"
            placeholder="Paste Image URL (e.g. https://images.unsplash.com/...)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 p-2.5 pl-9 text-xs text-brand-textPrimary rounded-xl focus:outline-none focus:border-brand-accent"
          />
          <ImageIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-1.5 text-red-400 text-[11px] bg-red-950/20 border border-red-900/40 p-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
