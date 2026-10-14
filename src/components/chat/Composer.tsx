import React, { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  Send,
  X,
  FileText,
  Loader2,
  Image as ImageIcon,
  Reply,
  Pencil,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MessageReplyTo } from '../../types';
import {
  ProcessedFile,
  validateSelectedFile,
  processPhotoFile,
  processDocumentFile,
  formatFileSize,
} from '../../lib/fileProcessing';

interface ComposerProps {
  onSendMessage: (text: string, replyTo?: MessageReplyTo) => void;
  onSendFileMessage: (fileData: ProcessedFile, caption: string, replyTo?: MessageReplyTo) => void;
  disabled?: boolean;
  replyingTo?: MessageReplyTo | null;
  onCancelReply?: () => void;
  editingMessage?: { id: string; text: string; createdAt: any } | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (messageId: string, newText: string) => Promise<void>;
  onTyping?: () => void;
  onClearTyping?: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSendMessage,
  onSendFileMessage,
  disabled = false,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
  onTyping,
  onClearTyping,
}) => {
  const { showToast } = useApp();
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Attachment menu and staged file state
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [stagedFile, setStagedFile] = useState<ProcessedFile | null>(null);
  const [fileCaption, setFileCaption] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Typing throttle and inactivity timeout refs
  const lastTypingSentRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showAttachMenu]);

  // When editingMessage changes, update textarea text
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      setStagedFile(null);
      setFileCaption('');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            textareaRef.current.value.length,
            textareaRef.current.value.length
          );
        }
      }, 50);
    }
  }, [editingMessage]);

  // When replyingTo changes, focus textarea
  useEffect(() => {
    if (replyingTo) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [replyingTo]);

  // Clean up typing document on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onClearTyping?.();
    };
  }, [onClearTyping]);

  /**
   * Handle incoming file selection from input
   */
  const handleSelectedFile = async (file: File) => {
    setShowAttachMenu(false);

    // 1. Validation
    const validation = validateSelectedFile(file);
    if (!validation.valid) {
      showToast(validation.error || "This file type isn't supported");
      return;
    }

    setIsProcessingFile(true);

    try {
      if (validation.isPhoto) {
        const processed = await processPhotoFile(file);
        setStagedFile(processed);
        setFileCaption('');
      } else {
        const processed = await processDocumentFile(file);
        setStagedFile(processed);
        setFileCaption('');
      }
    } catch (err: any) {
      console.error('File processing error:', err);
      showToast("This file type isn't supported");
    } finally {
      setIsProcessingFile(false);
    }
  };

  /**
   * Handle text changes & typing indicator
   */
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // If input is cleared, clear typing status immediately
    if (!val.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onClearTyping?.();
      return;
    }

    // While typing, write document at most once every 3 seconds
    const now = Date.now();
    if (now - lastTypingSentRef.current >= 3000) {
      lastTypingSentRef.current = now;
      onTyping?.();
    }

    // Reset 5-second inactivity timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onClearTyping?.();
    }, 5000);
  };

  /**
   * Check 15-minute edit restriction
   */
  const isEditWithin15Min = (createdAt: any): boolean => {
    if (!createdAt) return true;
    let ms = 0;
    if (typeof createdAt.toMillis === 'function') {
      ms = createdAt.toMillis();
    } else if (typeof createdAt.toDate === 'function') {
      ms = createdAt.toDate().getTime();
    } else if (createdAt.seconds) {
      ms = createdAt.seconds * 1000;
    } else if (createdAt instanceof Date) {
      ms = createdAt.getTime();
    }
    if (!ms) return true;
    return Date.now() - ms < 15 * 60 * 1000;
  };

  /**
   * Send staged file
   */
  const handleSendStagedFile = () => {
    if (!stagedFile || disabled || isProcessingFile) return;

    if (fileCaption.length > 500) {
      showToast('Caption cannot exceed 500 characters');
      return;
    }

    // Clear typing status on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onClearTyping?.();

    onSendFileMessage(stagedFile, fileCaption.trim(), replyingTo || undefined);

    setStagedFile(null);
    setFileCaption('');
    onCancelReply?.();
  };

  /**
   * Send normal text message or edit save
   */
  const handleSend = async () => {
    if (disabled || isProcessingFile) return;

    // Check if in Edit Mode
    if (editingMessage) {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length < 1) {
        showToast('Message cannot be empty');
        return;
      }
      if (trimmed.length > 4000) {
        showToast('Message cannot exceed 4000 characters');
        return;
      }
      if (!isEditWithin15Min(editingMessage.createdAt)) {
        showToast('You can only edit a message within 15 minutes');
        onCancelEdit?.();
        setText('');
        return;
      }
      if (onSaveEdit) {
        await onSaveEdit(editingMessage.id, trimmed);
      }
      setText('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onClearTyping?.();
      return;
    }

    // Normal text message
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.length > 4000) {
      showToast('Message cannot exceed 4000 characters');
      return;
    }

    // Clear typing status on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onClearTyping?.();

    onSendMessage(trimmed, replyingTo || undefined);

    setText('');
    onCancelReply?.();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = text.trim().length > 0 && !disabled && !isProcessingFile;

  return (
    <div className="bg-[#202C33] border-t border-white/[0.06] flex flex-col flex-shrink-0 relative">
      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleSelectedFile(file);
          e.target.value = '';
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.csv,.docx,.xlsx,.pptx,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleSelectedFile(file);
          e.target.value = '';
        }}
      />

      {/* REPLY BAR ABOVE COMPOSER */}
      {replyingTo && !editingMessage && (
        <div className="px-4 py-2 bg-[#172228] border-b border-white/[0.06] flex items-center justify-between gap-3 text-[13px] animate-fadeIn select-none">
          <div className="flex items-center gap-2.5 min-w-0 border-l-[3px] border-[#00A884] pl-2.5">
            <Reply className="w-4 h-4 text-[#00A884] flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[#00A884] truncate">
                Replying to {replyingTo.senderName}
              </div>
              <div className="text-[12px] text-[#8696A0] truncate max-w-[450px]">
                {replyingTo.preview}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-[#8696A0] hover:text-[#E9EDEF] rounded-full transition-colors cursor-pointer"
            title="Cancel reply"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* EDITING BAR ABOVE COMPOSER */}
      {editingMessage && (
        <div className="px-4 py-2 bg-[#172228] border-b border-white/[0.06] flex items-center justify-between gap-3 text-[13px] animate-fadeIn select-none">
          <div className="flex items-center gap-2.5 min-w-0 border-l-[3px] border-[#00A884] pl-2.5">
            <Pencil className="w-4 h-4 text-[#00A884] flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[#00A884]">Editing message</div>
              <div className="text-[12px] text-[#8696A0] truncate max-w-[450px]">
                {editingMessage.text}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setText('');
              onCancelEdit?.();
            }}
            className="p-1 text-[#8696A0] hover:text-[#E9EDEF] rounded-full transition-colors cursor-pointer"
            title="Cancel edit"
            aria-label="Cancel edit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 2: PREVIEW PANEL BEFORE SENDING */}
      {stagedFile && (
        <div className="p-3 bg-[#182229] border-b border-white/[0.08] flex flex-col gap-2.5 animate-fadeIn select-none">
          <div className="flex items-center justify-between gap-3">
            {/* File Thumbnail or Icon + Details */}
            <div className="flex items-center gap-3 min-w-0">
              {stagedFile.isImage ? (
                <div className="w-14 h-14 rounded-[8px] overflow-hidden bg-black/30 border border-white/[0.1] flex-shrink-0">
                  <img
                    src={
                      stagedFile.thumb ||
                      (stagedFile.data.startsWith('data:')
                        ? stagedFile.data
                        : `data:${stagedFile.fileType};base64,${stagedFile.data}`)
                    }
                    alt={stagedFile.fileName}
                    className="w-full h-full object-cover block"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-[8px] bg-[#223038] border border-white/[0.1] flex items-center justify-center text-[#00A884] flex-shrink-0">
                  <FileText className="w-6 h-6" strokeWidth={1.75} />
                </div>
              )}

              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#E9EDEF] truncate max-w-[280px] sm:max-w-[420px]">
                  {stagedFile.fileName}
                </div>
                <div className="text-[11px] text-[#8696A0] tabular-nums mt-0.5">
                  {formatFileSize(stagedFile.fileSize)}
                </div>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => {
                setStagedFile(null);
                setFileCaption('');
              }}
              className="p-1.5 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/[0.05] rounded-full transition-standard cursor-pointer flex-shrink-0"
              title="Cancel attachment"
              aria-label="Cancel attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Caption Input Row with Green Send Button */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                maxLength={500}
                placeholder="Add a caption... (optional)"
                value={fileCaption}
                onChange={(e) => setFileCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendStagedFile();
                  }
                }}
                className="w-full h-[36px] px-3 pr-14 rounded-[8px] bg-[#223038] text-[#E9EDEF] placeholder-[#8696A0] text-[13px] border border-transparent focus:border-[#00A884] focus:outline-none"
              />
              {fileCaption.length > 0 && (
                <span className="absolute right-3 text-[10px] text-[#8696A0] font-mono tabular-nums pointer-events-none">
                  {fileCaption.length}/500
                </span>
              )}
            </div>

            {/* Green Send Button */}
            <button
              type="button"
              onClick={handleSendStagedFile}
              className="h-[36px] px-4 rounded-[8px] bg-[#00A884] hover:bg-[#008F72] text-white text-[13px] font-medium flex items-center gap-1.5 transition-standard cursor-pointer flex-shrink-0 shadow-sm"
              title="Send file"
              aria-label="Send file"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Processing Loader Banner */}
      {isProcessingFile && (
        <div className="px-4 py-2 bg-[#172228] border-b border-white/[0.06] flex items-center gap-2 text-[#00A884] text-[12px] animate-fadeIn select-none">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Processing file in browser...</span>
        </div>
      )}

      {/* Input controls row (when not staging a file) */}
      {!stagedFile && (
        <div className="px-3 sm:px-4 py-2.5 flex items-end gap-2 sm:gap-3">
          {/* Paperclip button with attachment menu */}
          <div className="relative" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu((prev) => !prev)}
              disabled={disabled || isProcessingFile || !!editingMessage}
              className="h-[44px] w-[40px] flex items-center justify-center text-[#8696A0] hover:text-[#00A884] transition-standard rounded-[8px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Attach photo or document"
              aria-label="Attach photo or document"
            >
              <Paperclip className="w-5 h-5 rotate-45" strokeWidth={1.75} />
            </button>

            {/* Attach Menu: Photo and Document */}
            {showAttachMenu && (
              <div className="absolute left-0 bottom-full mb-2 z-40 bg-[#233138] rounded-[8px] border border-white/[0.08] shadow-xl py-1.5 w-40 select-none animate-fadeIn">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    photoInputRef.current?.click();
                  }}
                  className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#00A884]" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachMenu(false);
                    docInputRef.current?.click();
                  }}
                  className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#182229] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#00A884]" />
                  <span>Document</span>
                </button>
              </div>
            )}
          </div>

          {/* Message input */}
          <div className="flex-1 relative bg-[#26353D] rounded-[10px] border border-white/[0.08] focus-within:border-[#00A884] transition-standard flex items-center px-3 py-1">
            <textarea
              ref={textareaRef}
              rows={1}
              maxLength={4000}
              placeholder={
                disabled
                  ? 'You do not have access to send messages in this channel'
                  : editingMessage
                  ? 'Edit message...'
                  : 'Type a message'
              }
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
              className="w-full bg-transparent text-[#E9EDEF] placeholder-[#8696A0] text-[14px] leading-relaxed resize-none focus:outline-none max-h-[130px] py-1.5 scrollbar-thin"
            />

            {/* Subtle keyboard shortcut hint on desktop when focused & empty */}
            {isFocused && !text.trim() && !disabled && (
              <span className="hidden lg:inline text-[11px] text-[#8696A0]/80 select-none absolute right-3 pointer-events-none">
                Press Enter to send, Shift+Enter for new line
              </span>
            )}
          </div>

          {/* Send button (Primary solid green, 44px) */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={`w-[44px] h-[44px] rounded-full flex items-center justify-center text-white transition-standard flex-shrink-0 ${
              canSend
                ? 'bg-[#00A884] hover:bg-[#008F72] cursor-pointer'
                : 'bg-[#00A884]/40 opacity-40 cursor-not-allowed'
            }`}
            aria-label={editingMessage ? 'Save edited message' : 'Send message'}
            title={editingMessage ? 'Save changes' : 'Send'}
          >
            {isProcessingFile ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4 ml-0.5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      )}
    </div>
  );
};
