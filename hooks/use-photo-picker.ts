"use client";

import { useState, useCallback, useEffect } from 'react';
import { ImageContent } from '@/types/chat';

// Dynamic import check for Capacitor (only available in native)
let Capacitor: any = null;
let Media: any = null;

// Initialize Capacitor modules
const initCapacitor = async () => {
  if (typeof window === 'undefined') return false;

  try {
    const capacitorCore = await import('@capacitor/core');
    Capacitor = capacitorCore.Capacitor;

    if (Capacitor.isNativePlatform()) {
      const mediaModule = await import('@capacitor-community/media');
      Media = mediaModule.Media;
      return true;
    }
  } catch (e) {
    console.log('Capacitor not available, using web fallback');
  }
  return false;
};

export interface MediaPhoto {
  identifier: string;
  webPath: string;
  creationDate?: string;
}

export interface UsePhotoPickerResult {
  isNative: boolean;
  isLoading: boolean;
  isPickerOpen: boolean;
  recentPhotos: MediaPhoto[];
  openPicker: () => Promise<void>;
  closePicker: () => void;
  selectPhotos: (photos: MediaPhoto[]) => Promise<ImageContent[]>;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

export function usePhotoPicker(): UsePhotoPickerResult {
  const [isNative, setIsNative] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [recentPhotos, setRecentPhotos] = useState<MediaPhoto[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const native = await initCapacitor();
      setIsNative(native);
      setInitialized(true);
    };
    init();
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative || !Media) return false;

    try {
      const permission = await Media.checkPermissions();

      if (permission.photos === 'granted' || permission.photos === 'limited') {
        setHasPermission(true);
        return true;
      }

      const request = await Media.requestPermissions({ permissions: ['photos'] });
      const granted = request.photos === 'granted' || request.photos === 'limited';
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Error requesting photo permission:', error);
      return false;
    }
  }, [isNative]);

  const loadRecentPhotos = useCallback(async () => {
    if (!isNative || !Media) return;

    setIsLoading(true);
    try {
      const hasAccess = await requestPermission();
      if (!hasAccess) {
        setIsLoading(false);
        return;
      }

      // Get albums to find Camera Roll / Recents
      const albums = await Media.getAlbums();
      let albumIdentifier = '';

      // Try to find Camera Roll or Recents album
      const recentAlbum = albums.albums.find(
        (album: any) => album.name === 'Recents' || album.name === 'Camera Roll' || album.name === 'All Photos'
      );

      if (recentAlbum) {
        albumIdentifier = recentAlbum.identifier;
      }

      // Get photos from the album
      const result = await Media.getMedias({
        quantity: 30,
        sort: 'creationDate',
        albumIdentifier: albumIdentifier || undefined,
      });

      const photos: MediaPhoto[] = result.medias.map((media: any) => ({
        identifier: media.identifier,
        webPath: media.path || media.webPath,
        creationDate: media.creationDate,
      }));

      setRecentPhotos(photos);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isNative, requestPermission]);

  const openPicker = useCallback(async () => {
    if (isNative) {
      await loadRecentPhotos();
    }
    setIsPickerOpen(true);
  }, [isNative, loadRecentPhotos]);

  const closePicker = useCallback(() => {
    setIsPickerOpen(false);
  }, []);

  const selectPhotos = useCallback(async (photos: MediaPhoto[]): Promise<ImageContent[]> => {
    const images: ImageContent[] = [];

    for (const photo of photos) {
      try {
        // Fetch the image and convert to base64
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);

        images.push({
          type: 'image_url',
          image_url: {
            url: base64,
            detail: 'high',
          },
        });
      } catch (error) {
        console.error('Error converting photo:', error);
      }
    }

    return images;
  }, []);

  return {
    isNative: initialized && isNative,
    isLoading,
    isPickerOpen,
    recentPhotos,
    openPicker,
    closePicker,
    selectPhotos,
    hasPermission,
    requestPermission,
  };
}

// Helper function to convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
