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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  CHANNEL_ICONS,
  CHANNEL_ICON_LIST,
  CHANNEL_COLOR_SWATCHES,
  ChannelIconName,
  resolveChannelAvatarData,
  getChannelDisplayName,
} from '../../lib/channelAvatars';
import { ChannelDoc } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface EditChannelDialogProps {
  isOpen: boolean;
  channel: ChannelDoc | null;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const CROP_CONTAINER_SIZE = 192; // px square crop container

export const EditChannelDialog: React.FC<EditChannelDialogProps> = ({
  isOpen,
  channel,
  onClose,
  returnFocusRef,
}) => {
  const { updateChannelData, showToast } = useApp();

  const [mode, setMode] = useState<'icon' | 'photo'>('icon');
  const [selectedIcon, setSelectedIcon] = useState<ChannelIconName>('Hash');
  const [selectedColor, setSelectedColor] = useState<string>('#1E3F35');
  const [description, setDescription] = useState<string>('');

  // Crop & pan state for photo mode
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

  // Sync state whenever dialog opens with channel
  useEffect(() => {
    if (isOpen && channel) {
      const resolved = resolveChannelAvatarData(channel.id, channel);
      setMode(resolved.avatarMode);
      setSelectedIcon(resolved.avatarIcon);
      setSelectedColor(resolved.avatarColor);
      setRawImageSrc(resolved.avatarPhoto);
      setDescription(resolved.description || '');
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, channel]);

  useFocusTrap(dialogRef, isOpen, { onEscape: () => handleClose() });

  const handleClose = () => {
    onClose();
    if (returnFocusRef?.current) {
      setTimeout(() => {
        returnFocusRef.current?.focus();
      }, 50);
    }
  };

  // Drag handlers for photo cropping
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // File upload handler with 5 MB & supported type validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setErrorMessage('Please choose a PNG, JPG or WebP image under 5 MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        setRawImageSrc(src);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setMode('photo');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Could not read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setRawImageSrc('');
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setMode('icon');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * Browser Photo Processing:
   * Draw the crop on a 256x256 canvas, export as JPEG at quality 0.8,
   * and lower the quality in steps down to 0.5 (then 192x192) until it is under 60 KB.
   * Never store the original.
   */
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

          const scaleToCanvas = 256 / CROP_CONTAINER_SIZE;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const imgRatio = img.naturalWidth / img.naturalHeight;
          let baseW = CROP_CONTAINER_SIZE;
          let baseH = CROP_CONTAINER_SIZE;
          if (imgRatio > 1) {
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
    if (!channel) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      let finalPhoto = '';
      if (mode === 'photo') {
        if (rawImageSrc) {
          finalPhoto = await generateCroppedDataUrl();
        } else {
          setErrorMessage('Please upload a photo or switch to Icon mode.');
          setIsSaving(false);
          return;
        }
      }

      const trimmedDescription = (description || '').trim().slice(0, 120);

      await updateChannelData(channel.id, {
        avatarMode: mode,
        avatarIcon: selectedIcon,
        avatarColor: selectedColor,
        avatarPhoto: finalPhoto,
        description: trimmedDescription,
      });

      showToast('Channel updated');
      handleClose();
    } catch (err: any) {
      console.error('Error updating channel avatar:', err);
      setErrorMessage(err?.message || 'Failed to update channel. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !channel) return null;

  const channelTitle = getChannelDisplayName(channel.name || channel.id);
  const PreviewIcon = CHANNEL_ICONS[selectedIcon] || CHANNEL_ICONS.Users;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-channel-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none animate-fadeIn"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-[480px] bg-[#1F2C33] rounded-[16px] border border-white/[0.08] shadow-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto scrollbar-thin outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3.5">
          <div className="min-w-0">
            <h2 id="edit-channel-title" className="text-[17px] font-semibold text-[#E9EDEF] truncate">
              Edit {channelTitle}
            </h2>
            <p className="text-[12px] text-[#8696A0] truncate">
              Set channel avatar and discovery description
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="text-[#8696A0] hover:text-[#E9EDEF] p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-[8px] bg-[#E5484D]/15 border border-[#E5484D]/30 text-[#E5484D] text-[13px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Large Avatar Preview: 96px round */}
        <div className="flex flex-col items-center justify-center pt-1 pb-2">
          <div className="text-[11px] font-semibold text-[#8696A0] uppercase tracking-wider mb-2.5">
            Avatar Preview
          </div>
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-2 border-white/[0.1] overflow-hidden flex-shrink-0 transition-colors"
            style={{
              backgroundColor: mode === 'photo' && rawImageSrc ? '#111B21' : selectedColor,
            }}
          >
            {mode === 'photo' && rawImageSrc ? (
              <img
                src={rawImageSrc}
                alt={`${channelTitle} preview`}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <PreviewIcon size={44} strokeWidth={1.75} className="text-white flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Segmented Control: "Icon" and "Photo" */}
        <div className="bg-[#111B21] p-1 rounded-[10px] flex gap-1 border border-white/[0.04]">
          <button
            type="button"
            onClick={() => setMode('icon')}
            className={`flex-1 h-[34px] rounded-[7px] text-[13px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'icon'
                ? 'bg-[#2A3942] text-[#00A884] shadow-sm'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            <span>Icon</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex-1 h-[34px] rounded-[7px] text-[13px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'photo'
                ? 'bg-[#2A3942] text-[#00A884] shadow-sm'
                : 'text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>
        </div>

        {/* ICON MODE CONTROLS */}
        {mode === 'icon' && (
          <div className="space-y-4">
            {/* Grid of the 10 Icons */}
            <div>
              <label className="block text-[12px] font-medium text-[#8696A0] uppercase tracking-wider mb-2">
                Choose Icon
              </label>
              <div className="grid grid-cols-5 gap-2">
                {CHANNEL_ICON_LIST.map((iconName) => {
                  const CurrentIcon = CHANNEL_ICONS[iconName];
                  const isSelected = selectedIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setSelectedIcon(iconName)}
                      className={`relative h-[48px] rounded-[10px] border flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#00A884]/15 border-[#00A884] text-[#00A884]'
                          : 'bg-[#111B21] border-white/[0.06] text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.02]'
                      }`}
                      title={iconName}
                      aria-label={iconName}
                    >
                      <CurrentIcon size={22} strokeWidth={1.75} />
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#00A884] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-[#111B21] stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row of 8 Desaturated Color Swatches */}
            <div>
              <label className="block text-[12px] font-medium text-[#8696A0] uppercase tracking-wider mb-2">
                Choose Color
              </label>
              <div className="grid grid-cols-8 gap-2">
                {CHANNEL_COLOR_SWATCHES.map((swatch) => {
                  const isSelected = selectedColor.toLowerCase() === swatch.hex.toLowerCase();
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setSelectedColor(swatch.hex)}
                      className={`w-full aspect-square rounded-full flex items-center justify-center transition-transform cursor-pointer border border-white/[0.1] ${
                        isSelected ? 'ring-2 ring-[#00A884] ring-offset-2 ring-offset-[#1F2C33] scale-105' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                      title={swatch.name}
                      aria-label={`${swatch.name} background color`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PHOTO MODE CONTROLS */}
        {mode === 'photo' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {!rawImageSrc ? (
              <div className="p-6 rounded-[12px] border-2 border-dashed border-white/[0.12] bg-[#111B21]/60 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#00A884]/15 border border-[#00A884]/30 text-[#00A884] flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-[38px] px-4 rounded-[8px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <span>Upload photo</span>
                  </button>
                  <p className="text-[11px] text-[#8696A0] mt-2">
                    PNG, JPG or WebP up to 5 MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                {/* Crop Viewport (192px square) */}
                <div
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="w-[192px] h-[192px] rounded-full border-2 border-[#00A884] overflow-hidden relative bg-black/40 cursor-grab active:cursor-grabbing flex items-center justify-center select-none shadow-inner"
                  title="Drag to reposition photo"
                >
                  <img
                    src={rawImageSrc}
                    alt="Crop preview"
                    draggable={false}
                    className="max-w-none select-none pointer-events-none transition-transform duration-75"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      width: `${CROP_CONTAINER_SIZE}px`,
                      height: `${CROP_CONTAINER_SIZE}px`,
                      objectFit: 'cover',
                    }}
                  />
                </div>

                <p className="text-[11px] text-[#8696A0]">
                  Drag to reposition, use slider to zoom
                </p>

                {/* Zoom Controls */}
                <div className="w-full flex items-center justify-center gap-3 px-4">
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
                    className="text-[#8696A0] hover:text-[#E9EDEF] p-1 cursor-pointer"
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-44 h-1.5 bg-[#111B21] rounded-lg appearance-none cursor-pointer accent-[#00A884]"
                    aria-label="Zoom scale"
                  />
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
                    className="text-[#8696A0] hover:text-[#E9EDEF] p-1 cursor-pointer"
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Photo Actions */}
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-[34px] px-3 rounded-[8px] bg-[#2A3942] hover:bg-[#34454F] text-[#E9EDEF] text-[12px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Change photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="h-[34px] px-3 rounded-[8px] bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[12px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove photo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description Input (max 120 characters) */}
        <div className="border-t border-white/[0.06] pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="channel-description-input" className="text-[12px] font-medium text-[#8696A0] uppercase tracking-wider">
              Description
            </label>
            <span className="text-[11px] text-[#8696A0] font-mono tabular-nums">
              {description.length}/120
            </span>
          </div>
          <input
            id="channel-description-input"
            type="text"
            maxLength={120}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief channel purpose & team guidance..."
            className="w-full h-[40px] px-3.5 rounded-[8px] bg-[#111B21] text-[#E9EDEF] placeholder-[#8696A0] text-[13px] border border-white/[0.08] focus:border-[#00A884] focus:outline-none transition-colors"
          />
        </div>

        {/* Modal Action Buttons */}
        <div className="flex gap-2.5 pt-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 h-[44px] rounded-[10px] bg-[#00A884] hover:bg-[#008F72] text-white text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1 h-[44px] rounded-[10px] bg-transparent hover:bg-white/[0.05] border border-white/[0.12] text-[#E9EDEF] text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
