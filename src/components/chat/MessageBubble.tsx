import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  FileText,
  Download,
  X,
  Maximize2,
  MoreVertical,
  Reply,
  Copy,
  Pencil,
  Trash2,
  Flag,
  Ban,
  Loader2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { Avatar } from '../common/Avatar';
import { useApp } from '../../context/AppContext';
import { fetchFileDocument } from '../../lib/firebaseService';
import { formatFileSize, downloadFileFromBase64 } from '../../lib/fileProcessing';

interface MessageBubbleProps {
  message: ChatMessage;
  isChannel: boolean;
  conversationType: 'channel' | 'direct';
  conversationId: string;
  isGrouped?: boolean;
  hideSenderHeader?: boolean;
  allMessages?: ChatMessage[];
  searchQuery?: string;
  isCurrentSearchResult?: boolean;
  isAdmin?: boolean;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onModeratorRemove?: (message: ChatMessage) => void;
  onReport?: () => void;
  onReplyClick?: (targetMessageId: string) => void;
  onRetry?: (message: ChatMessage) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isChannel,
  conversationType,
  conversationId,
  isGrouped = false,
  hideSenderHeader = false,
  allMessages = [],
  searchQuery,
  isCurrentSearchResult = false,
  isAdmin = false,
  onReply,
  onEdit,
  onDelete,
  onModeratorRemove,
  onReport,
  onReplyClick,
  onRetry,
}) => {
  const { showToast, currentSession } = useApp();
  const {
    isOutgoing,
    senderName,
    senderColor,
    text,
    timestamp,
    status,
    deleted,
    editedAt,
    replyTo,
    type,
    fileId,
    fileName,
    fileType,
    fileSize,
    thumb,
    fileUploadProgress,
    uploadFailed,
  } = message;

  const [viewerOpen, setViewerOpen] = useState(false);
  const [fullImageData, setFullImageData] = useState<string | null>(null);
  const [isLoadingFullImage, setIsLoadingFullImage] = useState(false);
  const [isDownloadingDoc, setIsDownloadingDoc] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Check 15-minute edit window
  const isWithin15Minutes = (): boolean => {
    if (!message.createdAt) return true;
    let createdMs = 0;
    if (typeof message.createdAt.toMillis === 'function') {
      createdMs = message.createdAt.toMillis();
    } else if (typeof message.createdAt.toDate === 'function') {
      createdMs = message.createdAt.toDate().getTime();
    } else if (message.createdAt.seconds) {
      createdMs = message.createdAt.seconds * 1000;
    } else if (message.createdAt instanceof Date) {
      createdMs = message.createdAt.getTime();
    }
    if (!createdMs) return true;
    return Date.now() - createdMs < 15 * 60 * 1000;
  };

  const isFileMessage = type === 'file' || !!fileId;
  const isPhoto = isFileMessage && (fileType?.startsWith('image/') || !!thumb);
  const isDocument = isFileMessage && !isPhoto;

  // Touch handlers for mobile long-press
  const handleTouchStart = () => {
    if (deleted) return;
    touchTimerRef.current = setTimeout(() => {
      setShowMenu(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  // Check referenced message status for reply
  const referencedMessage = replyTo ? allMessages.find((m) => m.id === replyTo.messageId) : undefined;
  const isOriginalDeleted = referencedMessage?.deleted;

  // Copy message text / caption
  const handleCopyText = async () => {
    setShowMenu(false);
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
      } catch (_) {
        showToast('Unable to copy text');
      }
    }
  };

  // Trigger edit (own text messages or messages with text)
  const handleEditClick = () => {
    setShowMenu(false);
    if (!isWithin15Minutes()) {
      showToast('You can only edit a message within 15 minutes');
      return;
    }
    if (onEdit) {
      onEdit(message);
    }
  };

  // Handle Photo Click: Load full image on demand
  const handlePhotoClick = async () => {
    setViewerOpen(true);
    if (fullImageData || !fileId) return;

    setIsLoadingFullImage(true);
    try {
      const fileDoc = await fetchFileDocument(conversationType, conversationId, fileId);
      if (fileDoc && fileDoc.data) {
        setFullImageData(fileDoc.data);
      } else {
        showToast('Image file could not be loaded');
      }
    } catch (err) {
      console.error('Failed to load image:', err);
      showToast('Failed to load image');
    } finally {
      setIsLoadingFullImage(false);
    }
  };

  // Handle Document Download Click: Load file on demand, build Blob, trigger download
  const handleDocumentDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fileId || isDownloadingDoc) return;

    setIsDownloadingDoc(true);
    try {
      const fileDoc = await fetchFileDocument(conversationType, conversationId, fileId);
      if (fileDoc && fileDoc.data) {
        downloadFileFromBase64(
          fileName || fileDoc.fileName || 'document',
          fileType || fileDoc.fileType,
          fileDoc.data
        );
      } else {
        showToast('File document is no longer available');
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast('Failed to download document');
    } finally {
      setIsDownloadingDoc(false);
    }
  };

  // Download photo from full-screen viewer
  const handleDownloadPhotoFromViewer = () => {
    if (fullImageData) {
      downloadFileFromBase64(fileName || 'photo.jpg', fileType || 'image/jpeg', fullImageData);
    } else if (thumb) {
      downloadFileFromBase64(fileName || 'photo.jpg', fileType || 'image/jpeg', thumb);
    }
  };

  // Highlight search matches
  const renderHighlightedText = (content: string) => {
    if (!searchQuery || !searchQuery.trim()) {
      return content;
    }
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = content.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === searchQuery.toLowerCase()) {
        return (
          <mark
            key={index}
            className={`rounded-[2px] px-0.5 text-inherit ${
              isCurrentSearchResult ? 'bg-[#00A884] text-white font-medium' : 'bg-[#00A884]/35'
            }`}
          >
            {part}
          </mark>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Check whether current user is an approved admin who can remove this channel message
  // Must be: non-deleted channel message, approved admin, sent by another person
  const canModeratorRemove = Boolean(
    isChannel &&
      conversationType === 'channel' &&
      isAdmin &&
      !deleted &&
      !isOutgoing &&
      message.senderId !== currentSession?.uid &&
      onModeratorRemove
  );

  return (
    <>
      <div
        id={`msg-${message.id}`}
        className={`flex w-full group relative transition-all duration-300 ${
          isOutgoing ? 'justify-end' : 'justify-start'
        } ${isGrouped ? 'mt-[2px]' : 'mt-3'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Outgoing Message Options Menu Trigger */}
        {isOutgoing && !deleted && !uploadFailed && (
          <div className="relative self-center mr-1 order-first" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-[#8696A0] hover:text-[#E9EDEF] rounded transition-opacity cursor-pointer"
              title="Message options"
              aria-label="Message options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-full mb-1 z-30 bg-[#233138] rounded-[8px] border border-white/[0.08] shadow-xl py-1 w-36 select-none animate-fadeIn"
              >
                {/* Reply */}
                {onReply && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onReply(message);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5 text-[#8696A0]" />
                    <span>Reply</span>
                  </button>
                )}

                {/* Copy Text */}
                {text && (
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#8696A0]" />
                    <span>Copy text</span>
                  </button>
                )}

                {/* Edit (Own message with text within 15 mins) */}
                {text && isWithin15Minutes() && onEdit && (
                  <button
                    type="button"
                    onClick={handleEditClick}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#8696A0]" />
                    <span>Edit</span>
                  </button>
                )}

                {/* Delete (Own message) */}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(message);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#E5484D] hover:bg-[#182229] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#E5484D]" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Message Bubble Container */}
        <div
          title={timestamp}
          className={`max-w-[85%] sm:max-w-[70%] rounded-[12px] px-3.5 py-2 text-[14px] leading-relaxed relative break-words [overflow-wrap:anywhere] shadow-sm transition-all duration-200 ${
            canModeratorRemove ? 'pr-8' : ''
          } ${
            isCurrentSearchResult ? 'ring-2 ring-[#00A884]' : ''
          } ${
            isOutgoing
              ? 'bg-[#005C4B] text-[#E9EDEF] rounded-tr-[4px]'
              : 'bg-[#202C33] text-[#E9EDEF] rounded-tl-[4px]'
          }`}
        >
          {/* Always-visible control for Admins on other people's non-deleted channel messages */}
          {canModeratorRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onModeratorRemove?.(message);
              }}
              title="Remove message (admin)"
              aria-label="Remove message (admin)"
              className="absolute -top-2 -right-2 z-10 w-[44px] h-[44px] flex items-center justify-center opacity-60 hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer focus:outline-none"
            >
              <span className="w-[28px] h-[28px] rounded-full bg-[#182229] border border-white/[0.12] shadow-sm flex items-center justify-center text-[#E5484D] hover:text-[#FF6B6B] hover:bg-[#202C33] hover:border-[#E5484D]/40 transition-colors">
                <Shield className="w-3.5 h-3.5" strokeWidth={1.75} />
              </span>
            </button>
          )}

          {/* DELETED MESSAGE RENDERING */}
          {deleted ? (
            message.deletedBy === 'admin' ? (
              <div className="py-0.5 select-none">
                <div className="flex items-center gap-2 text-[#8696A0] italic">
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                  <span className="text-[13px]">Removed by an administrator</span>
                </div>
                {(isOutgoing || message.senderId === currentSession?.uid) && message.deletedReason && (
                  <div className="text-[11px] text-[#8696A0] mt-0.5 pl-5.5 not-italic">
                    Reason: {message.deletedReason}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-0.5 text-[#8696A0] italic select-none">
                <Ban className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                <span className="text-[13px]">This message was deleted</span>
              </div>
            )
          ) : (
            <>
              {/* Channel sender name with Avatar for incoming message */}
              {!isOutgoing && isChannel && senderName && !hideSenderHeader && (
                <div className="flex items-center gap-2 mb-1.5 pt-0.5">
                  <Avatar uid={message.senderId} name={senderName} size={32} />
                  <div
                    className="text-[12px] font-medium truncate select-none"
                    style={{ color: senderColor || '#00A884' }}
                  >
                    {senderName}
                  </div>
                </div>
              )}

              {/* QUOTED REPLY BLOCK AT TOP */}
              {replyTo && (
                <div
                  onClick={() => onReplyClick?.(replyTo.messageId)}
                  className="mb-1.5 bg-black/20 hover:bg-black/30 border-l-[3px] border-[#00A884] rounded-[4px] px-2.5 py-1 cursor-pointer transition-colors select-none text-left"
                  title="Click to view original message"
                >
                  <div className="text-[12px] font-semibold text-[#00A884] truncate">
                    {replyTo.senderName}
                  </div>
                  <div className="text-[12px] text-[#8696A0] truncate">
                    {(referencedMessage?.deleted && (referencedMessage?.deletedBy === 'admin' || Boolean(referencedMessage?.deletedReason))) ||
                    replyTo.preview === 'Original message removed' ||
                    replyTo.preview === 'Message removed' ? (
                      <span className="italic text-[#8696A0]">Original message removed</span>
                    ) : isOriginalDeleted ? (
                      <span className="italic text-[#8696A0]">Original message deleted</span>
                    ) : (
                      replyTo.preview
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 5: PHOTO DISPLAY (Thumbnail max 260px, 10px radius) */}
              {isPhoto && (
                <div className="mb-1.5 mt-0.5">
                  <div
                    onClick={handlePhotoClick}
                    className="rounded-[10px] overflow-hidden max-w-[260px] bg-black/25 cursor-pointer relative group/img shadow-sm"
                  >
                    <img
                      src={
                        thumb ||
                        (message.fileDataUrl ? message.fileDataUrl : undefined)
                      }
                      alt={fileName || 'Photo'}
                      className="w-full max-w-[260px] max-h-[260px] object-cover rounded-[10px] block"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity rounded-[10px]">
                      <Maximize2 className="w-5 h-5 text-white" strokeWidth={1.75} />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 5: DOCUMENT DISPLAY CARD */}
              {isDocument && (
                <div className="mb-1.5 mt-0.5">
                  <div className="flex items-center gap-3 bg-black/20 p-2.5 rounded-[8px] border border-white/[0.06] min-w-[200px] max-w-[320px]">
                    <div className="w-10 h-10 rounded-[6px] bg-black/30 flex items-center justify-center flex-shrink-0 text-[#00A884]">
                      <FileText className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-[#E9EDEF] truncate" title={fileName}>
                        {fileName || 'Document'}
                      </div>
                      <div className="text-[11px] text-[#8696A0] tabular-nums mt-0.5">
                        {fileSize ? formatFileSize(fileSize) : ''}
                      </div>
                    </div>

                    {/* Download Button */}
                    <button
                      type="button"
                      onClick={handleDocumentDownload}
                      disabled={isDownloadingDoc || message.isPending}
                      className="p-1.5 text-[#8696A0] hover:text-[#00A884] transition-standard cursor-pointer rounded disabled:opacity-50"
                      title="Download document"
                      aria-label="Download document"
                    >
                      {isDownloadingDoc ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#00A884]" />
                      ) : (
                        <Download className="w-4 h-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* UPLOAD PROGRESS BAR WHILE SENDING */}
              {message.isPending && (
                <div className="mt-1.5 mb-1 text-[11px] text-[#00A884] space-y-1">
                  <div className="flex justify-between font-mono text-[10px] tabular-nums">
                    <span>Sending...</span>
                    <span>{fileUploadProgress || 20}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00A884] transition-all duration-200 rounded-full"
                      style={{ width: `${fileUploadProgress || 20}%` }}
                    />
                  </div>
                </div>
              )}

              {/* CAPTION DISPLAY UNDER FILE */}
              {text && (
                <div className="whitespace-pre-wrap pr-1 pb-0.5 break-words [overflow-wrap:anywhere] mt-1">
                  {renderHighlightedText(text)}
                </div>
              )}
            </>
          )}

          {/* Footer inside bubble: timestamp & edited label & status ticks / retry */}
          <div className="flex items-center justify-end gap-1 text-[11px] text-[#8696A0] select-none float-right ml-3 pt-0.5">
            {uploadFailed ? (
              <button
                type="button"
                onClick={() => onRetry?.(message)}
                className="text-[#E5484D] text-[11px] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                title="Tap to retry sending"
              >
                <AlertCircle className="w-3 h-3 text-[#E5484D]" />
                <span>Not sent. Tap to retry</span>
              </button>
            ) : (
              <>
                {editedAt && !deleted && (
                  <span className="text-[10px] text-[#8696A0] select-none mr-0.5">edited</span>
                )}
                <span className="tabular-nums">{timestamp}</span>

                {isOutgoing && (
                  <span className="flex items-center ml-0.5">
                    {message.isPending && (
                      <Clock className="w-3 h-3 text-[#8696A0]" strokeWidth={1.75} />
                    )}
                    {!message.isPending && status === 'sent' && (
                      <Check className="w-3.5 h-3.5 text-[#8696A0]" strokeWidth={1.75} />
                    )}
                    {!message.isPending && status === 'delivered' && (
                      <CheckCheck className="w-3.5 h-3.5 text-[#8696A0]" strokeWidth={1.75} />
                    )}
                    {!message.isPending && status === 'read' && (
                      <CheckCheck className="w-3.5 h-3.5 text-[#00A884]" strokeWidth={2} />
                    )}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Incoming Message Options Toolbar / Menu Trigger */}
        {!isOutgoing && !deleted && (
          <div className="relative self-center ml-1 flex items-center gap-0.5" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-[#8696A0] hover:text-[#E9EDEF] rounded transition-opacity cursor-pointer"
              title="Message options"
              aria-label="Message options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 bottom-full mb-1 z-30 bg-[#233138] rounded-[8px] border border-white/[0.08] shadow-xl py-1 w-36 select-none animate-fadeIn"
              >
                {/* Reply */}
                {onReply && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onReply(message);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5 text-[#8696A0]" />
                    <span>Reply</span>
                  </button>
                )}

                {/* Copy text (if text exists) */}
                {text && (
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#8696A0]" />
                    <span>Copy text</span>
                  </button>
                )}

                {/* Report message */}
                {onReport && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onReport();
                    }}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#E5484D] hover:bg-[#182229] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5 text-[#E5484D]" />
                    <span>Report message</span>
                  </button>
                )}

                {/* Remove message (admin) - Channels only, approved admins only, on other people's messages */}
                {canModeratorRemove && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onModeratorRemove?.(message);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-[#E5484D] hover:bg-[#182229] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#E5484D]" strokeWidth={1.75} />
                    <span>Remove message (admin)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FULL-SCREEN IMAGE VIEWER WITH SKELETON & DOWNLOAD BUTTON */}
      {viewerOpen && isPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewerOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 transition-standard animate-fadeIn"
        >
          {/* Top Control Bar */}
          <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadPhotoFromViewer();
              }}
              className="text-[#8696A0] hover:text-[#E9EDEF] p-2 bg-[#202C33] rounded-full transition-standard cursor-pointer"
              title="Download full image"
              aria-label="Download full image"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewerOpen(false)}
              className="text-[#8696A0] hover:text-[#E9EDEF] p-2 bg-[#202C33] rounded-full transition-standard cursor-pointer"
              title="Close viewer"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image Content or Skeleton while loading */}
          {isLoadingFullImage && !fullImageData ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-[300px] sm:w-[500px] h-[350px] sm:h-[420px] rounded-[10px] bg-white/[0.04] border border-white/[0.08] animate-pulse flex flex-col items-center justify-center text-[#8696A0] gap-3 select-none"
            >
              <Loader2 className="w-8 h-8 animate-spin text-[#00A884]" />
              <span className="text-[13px] text-[#8696A0]">Loading full image...</span>
            </div>
          ) : (
            <img
              src={
                fullImageData
                  ? fullImageData.startsWith('data:')
                    ? fullImageData
                    : `data:${fileType || 'image/jpeg'};base64,${fullImageData}`
                  : thumb
              }
              alt={fileName || 'Full view'}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[85vh] object-contain rounded-[8px] shadow-2xl block"
            />
          )}

          {fileName && (
            <div className="mt-3 text-[13px] text-[#8696A0] max-w-[80vw] truncate select-none">
              {fileName}
            </div>
          )}
        </div>
      )}
    </>
  );
};
