"use client";

import { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MediaPhoto } from '@/hooks/use-photo-picker';

interface InlinePhotoPickerProps {
  photos: MediaPhoto[];
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSelect: (selectedPhotos: MediaPhoto[]) => void;
  maxSelections?: number;
}

export function InlinePhotoPicker({
  photos,
  isOpen,
  isLoading,
  onClose,
  onSelect,
  maxSelections = 4
}: InlinePhotoPickerProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

  // Reset selection when picker closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPhotos(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const togglePhoto = (photo: MediaPhoto) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(photo.identifier)) {
        next.delete(photo.identifier);
      } else if (next.size < maxSelections) {
        next.add(photo.identifier);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = photos.filter(p => selectedPhotos.has(p.identifier));
    onSelect(selected);
    onClose();
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-3 animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Recent Photos {selectedPhotos.size > 0 && `(${selectedPhotos.size}/${maxSelections})`}
        </span>
        <div className="flex items-center gap-2">
          {selectedPhotos.size > 0 && (
            <Button
              size="sm"
              onClick={handleConfirm}
              className="h-7 text-xs"
            >
              Add {selectedPhotos.size}
            </Button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading photos...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && photos.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            No photos found. Please grant photo library access.
          </span>
        </div>
      )}

      {/* Photo Grid - Horizontal scrolling like iMessage */}
      {!isLoading && photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {photos.map((photo) => {
            const isSelected = selectedPhotos.has(photo.identifier);
            return (
              <button
                key={photo.identifier}
                onClick={() => togglePhoto(photo)}
                className={cn(
                  "relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden",
                  "border-2 transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-blue-400",
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 scale-95"
                    : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <img
                  src={photo.webPath}
                  alt="Photo"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5 shadow-sm">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                {/* Selection order indicator */}
                {isSelected && (
                  <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                    {Array.from(selectedPhotos).indexOf(photo.identifier) + 1}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
