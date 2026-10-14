import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Trash2,
  Check,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertCircle,
  Camera,
  Sun,
  Moon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AVATAR_COLOR_SWATCHES, getAvatarColor, getInitials } from '../../lib/avatar';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const CROP_CONTAINER_SIZE = 192; // px

export const ProfileDialog: React.FC<ProfileDialogProps> = ({
  isOpen,
  onClose,
  returnFocusRef,
}) => {
  const { currentSession, getDirectoryUser, updateUserProfileAvatar, theme, toggleTheme } = useApp();
  const dirUser = currentSession ? getDirectoryUser(currentSession.uid) : undefined;

  const currentMode = dirUser?.avatarMode || 'initials';
  const currentColor = dirUser?.avatarColor || getAvatarColor(currentSession?.fullName || '').bg;
  const currentPhoto = dirUser?.avatarPhoto || '';

  const [mode, setMode] = useState<'initials' | 'photo'>(currentMode);
  const [selectedColor, setSelectedColor] = useState<string>(currentColor);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(currentPhoto);

  // Crop & pan state
  const [rawImageSrc, setRawImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Processing & feedback state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Sync state whenever dialog opens
  useEffect(() => {
    if (isOpen) {
      const initialMode = dirUser?.avatarMode || 'initials';
      const initialColor = dirUser?.avatarColor || getAvatarColor(currentSession?.fullName || '').bg;
      const initialPhoto = dirUser?.avatarPhoto || '';

      setMode(initialMode);
      setSelectedColor(initialColor);
      setPhotoDataUrl(initialPhoto);
      setRawImageSrc(initialPhoto);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, dirUser, currentSession]);

  useFocusTrap(dialogRef, isOpen, { onEscape: () => handleClose() });

  const handleClose = () => {
    onClose();
    if (returnFocusRef?.current) {
      setTimeout(() => {
        returnFocusRef.current?.focus();
      }, 50);
    }
  };

  // Drag handlers for repositioning crop
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // File selection & validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    // Validate type and size (max 5 MB)
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const isValidType = validTypes.includes(file.type);
    const isValidSize = file.size <= 5 * 1024 * 1024;

    if (!isValidType || !isValidSize) {
      setErrorMessage('Please choose a PNG, JPG or WebP image under 5 MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        setRawImageSrc(src);
        setPhotoDataUrl(src);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read selected image. Please try again.');
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl('');
    setRawImageSrc('');
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setMode('initials');
  };

  // Generate cropped output canvas with compression stepping
  const generateCroppedDataUrl = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!rawImageSrc) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const exportCanvas = document.createElement('canvas');
          exportCanvas.width = 256;
          exportCanvas.height = 256;
          const ctx = exportCanvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          // Calculate scale ratio between container (192px) and canvas (256px)
          const scaleToCanvas = 256 / CROP_CONTAINER_SIZE;

          // Render with smooth scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Base cover size in 192px box
          const containerRatio = 1;
          const imgRatio = img.naturalWidth / img.naturalHeight;
          let baseW = CROP_CONTAINER_SIZE;
          let baseH = CROP_CONTAINER_SIZE;
          if (imgRatio > containerRatio) {
            baseW = CROP_CONTAINER_SIZE * imgRatio;
          } else {
            baseH = CROP_CONTAINER_SIZE / imgRatio;
          }

          const drawnW = baseW * zoom * scaleToCanvas;
          const drawnH = baseH * zoom * scaleToCanvas;
          const drawnX = (128 - drawnW / 2) + pan.x * scaleToCanvas;
          const drawnY = (128 - drawnH / 2) + pan.y * scaleToCanvas;

          ctx.drawImage(img, drawnX, drawnY, drawnW, drawnH);

          // Step 1: Export JPEG at quality 0.8
          let quality = 0.8;
          let dataUrl = exportCanvas.toDataURL('image/jpeg', quality);
          let byteSize = Math.round((dataUrl.length * 3) / 4);

          // Step 2: Step down quality to 0.5 if > 60 KB
          const qualitySteps = [0.7, 0.6, 0.5];
          for (const q of qualitySteps) {
            if (byteSize <= 60 * 1024) break;
            quality = q;
            dataUrl = exportCanvas.toDataURL('image/jpeg', quality);
            byteSize = Math.round((dataUrl.length * 3) / 4);
          }

          // Step 3: If still > 60 KB, reduce size to 192x192
          if (byteSize > 60 * 1024) {
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = 192;
            smallCanvas.height = 192;
            const sCtx = smallCanvas.getContext('2d');
            if (sCtx) {
              sCtx.imageSmoothingEnabled = true;
              sCtx.imageSmoothingQuality = 'high';
              sCtx.drawImage(exportCanvas, 0, 0, 192, 192);

              dataUrl = smallCanvas.toDataURL('image/jpeg', 0.7);
              byteSize = Math.round((dataUrl.length * 3) / 4);
              if (byteSize > 60 * 1024) {
                dataUrl = smallCanvas.toDataURL('image/jpeg', 0.5);
              }
            }
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for cropping'));
      img.src = rawImageSrc;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (mode === 'photo') {
        if (!photoDataUrl && !rawImageSrc) {
          // No photo provided, save as initials
          await updateUserProfileAvatar('initials', selectedColor, '');
        } else {
          // Crop and compress
          const finalPhoto = await generateCroppedDataUrl();
          await updateUserProfileAvatar('photo', selectedColor, finalPhoto);
        }
      } else {
        // Initials mode: clear avatarPhoto per Requirement 3
        await updateUserProfileAvatar('initials', selectedColor, '');
      }

      handleClose();
    } catch (err: any) {
      console.error('Error saving profile avatar:', err);
      setErrorMessage('Could not update avatar. Your previous settings have been retained.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const displayName = currentSession?.fullName || 'User';
  const initials = getInitials(displayName);
  const colorTheme = getAvatarColor(displayName, selectedColor);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn select-none"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[460px] bg-[#1F2C33] rounded-[16px] border border-white/[0.08] shadow-2xl p-6 text-left relative flex flex-col max-h-[90vh] overflow-y-auto scrollbar-thin outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h2 id="profile-dialog-title" className="text-[17px] font-semibold text-[#E9EDEF]">
              Edit profile avatar
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-11 h-11 flex items-center justify-center rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] transition-standard cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-[#8696A0] hover:text-[#E9EDEF]" strokeWidth={1.75} />
              ) : (
                <Moon className="w-5 h-5 text-[#8696A0] hover:text-[#E9EDEF]" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              aria-label="Close profile dialog"
              className="w-11 h-11 flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] rounded-full hover:bg-white/[0.05] transition-standard cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-[8px] bg-[#E5484D]/15 border border-[#E5484D]/30 flex items-start gap-2.5 text-[#E5484D] text-[13px]">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top 96px Round Live Preview */}
        <div className="flex flex-col items-center justify-center my-2">
          {mode === 'photo' && photoDataUrl ? (
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#00A884] shadow-lg bg-[#111B21]">
              <img
                src={photoDataUrl}
                alt={`${displayName}'s preview avatar`}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          ) : (
            <div
              style={{
                backgroundColor: colorTheme.bg,
                color: colorTheme.text,
                border: `2px solid ${colorTheme.border}`,
              }}
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg"
              aria-label={`${displayName}'s avatar preview`}
            >
              {initials}
            </div>
          )}
          <p className="text-[13px] font-medium text-[#E9EDEF] mt-2.5">{displayName}</p>
          <p className="text-[11px] text-[#8696A0]">{currentSession?.department || 'Operations'}</p>
        </div>

        {/* Segmented Control: Initials vs Photo */}
        <div className="flex bg-[#111B21] rounded-[10px] p-1 border border-white/[0.06] my-4">
          <button
            type="button"
            onClick={() => setMode('initials')}
            className={`flex-1 py-1.5 text-[13px] font-medium rounded-[8px] transition-colors cursor-pointer ${
              mode === 'initials'
                ? 'bg-[#202C33] text-[#00A884] shadow-sm'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            Initials
          </button>
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex-1 py-1.5 text-[13px] font-medium rounded-[8px] transition-colors cursor-pointer ${
              mode === 'photo'
                ? 'bg-[#202C33] text-[#00A884] shadow-sm'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            Photo
          </button>
        </div>

        {/* Mode 1: Initials Swatch Picker */}
        {mode === 'initials' && (
          <div className="space-y-3 my-2">
            <label className="text-[12px] font-medium text-[#8696A0] uppercase tracking-wider block">
              Choose Avatar Color
            </label>
            <div className="grid grid-cols-4 gap-2.5 p-3 rounded-[10px] bg-[#111B21] border border-white/[0.04]">
              {AVATAR_COLOR_SWATCHES.map((swatch) => {
                const isSelected = selectedColor.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => setSelectedColor(swatch.hex)}
                    title={swatch.name}
                    aria-label={`Select ${swatch.name} color`}
                    style={{ backgroundColor: swatch.hex, borderColor: swatch.border }}
                    className="h-10 rounded-[8px] border flex items-center justify-center transition-transform hover:scale-105 cursor-pointer relative"
                  >
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#00A884] flex items-center justify-center text-white shadow">
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#8696A0] leading-relaxed">
              Initials are derived automatically from your display name. High-contrast colors ensure accessibility.
            </p>
          </div>
        )}

        {/* Mode 2: Photo Upload & Crop */}
        {mode === 'photo' && (
          <div className="space-y-3.5 my-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
            />

            {/* If photo is selected: show interactive round crop mask */}
            {rawImageSrc ? (
              <div className="space-y-3">
                <div className="flex flex-col items-center">
                  <div
                    style={{ width: `${CROP_CONTAINER_SIZE}px`, height: `${CROP_CONTAINER_SIZE}px` }}
                    className="relative rounded-full overflow-hidden border-2 border-[#00A884] bg-black/60 shadow-inner cursor-grab active:cursor-grabbing touch-none select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <img
                      ref={imageRef}
                      src={rawImageSrc}
                      alt="Crop target"
                      draggable={false}
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                      }}
                      className="w-full h-full object-cover pointer-events-none select-none block"
                    />
                  </div>
                  <span className="text-[11px] text-[#8696A0] mt-1.5">
                    Drag image to reposition
                  </span>
                </div>

                {/* Zoom control slider */}
                <div className="flex items-center gap-3 px-3 py-2 bg-[#111B21] rounded-[8px] border border-white/[0.04]">
                  <ZoomOut className="w-4 h-4 text-[#8696A0]" />
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.02"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#202C33] rounded-lg appearance-none cursor-pointer accent-[#00A884]"
                    aria-label="Zoom image"
                  />
                  <ZoomIn className="w-4 h-4 text-[#8696A0]" />
                </div>
              </div>
            ) : null}

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 h-[40px] rounded-[8px] bg-[#202C33] hover:bg-[#283740] border border-white/[0.08] text-[#E9EDEF] text-[13px] font-medium flex items-center justify-center gap-2 transition-standard cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#00A884]" />
                <span>{rawImageSrc ? 'Change photo' : 'Upload photo'}</span>
              </button>

              {rawImageSrc && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="h-[40px] px-3.5 rounded-[8px] bg-transparent hover:bg-white/[0.05] border border-white/[0.1] hover:border-red-500/40 text-[#8696A0] hover:text-red-400 text-[13px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove photo</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-[#8696A0] leading-relaxed">
              Square photos work best. Your photo is visible to other members.
            </p>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex gap-2.5 pt-4 border-t border-white/[0.06] mt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1 h-[42px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[13px] font-medium transition-standard cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 h-[42px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-semibold transition-standard cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
