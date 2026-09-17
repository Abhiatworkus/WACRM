"use client";

import { useState, useRef, useCallback, type ReactNode, useEffect } from "react";
import { CornerUpLeft, Copy, SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Message } from "@/types";
import { useTranslations } from "next-intl";

// WhatsApp's authentic quick-reaction bar
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageActionsProps {
  message: Message;
  onReply: () => void;
  onReact: (emoji: string) => void;
  children: ReactNode;
}

/**
 * WhatsApp-style swipe-to-reply and long-press reaction toolbar wrapper.
 */
export function MessageActions({
  message,
  onReply,
  onReact,
  children,
}: MessageActionsProps) {
  const t = useTranslations("Inbox.actions");

  const [touchOpen, setTouchOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrollingRef = useRef(false);

  const isAgent =
    message.sender_type === "agent" || message.sender_type === "bot";

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearLongPress();
  }, [clearLongPress]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setTouchOpen(true);
  };

  const handleCopy = async () => {
    const text = message.content_text ?? "";
    if (!text) {
      toast.error(t("nothingToCopy"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
    setTouchOpen(false);
  };

  const handlePickEmoji = (emoji: string) => {
    onReact(emoji);
    setPickerOpen(false);
    setTouchOpen(false);
  };

  const handleReply = useCallback(() => {
    onReply();
    setTouchOpen(false);
  }, [onReply]);

  // Touch handlers for swipe-to-reply and long-press
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isScrollingRef.current = false;

    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setTouchOpen(true);
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(25);
      }
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    // Detect vertical scroll
    if (Math.abs(deltaY) > 8) {
      isScrollingRef.current = true;
      clearLongPress();
      if (swipeOffset > 0) setSwipeOffset(0);
      return;
    }

    if (isScrollingRef.current) return;

    if (Math.abs(deltaX) > 10) {
      clearLongPress();
    }

    // Swiping right (swipe-to-reply)
    if (deltaX > 0) {
      const clamped = Math.min(deltaX * 0.6, 56);
      setSwipeOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();
    if (swipeOffset > 38) {
      handleReply();
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(20);
      }
    }
    setSwipeOffset(0);
  };

  return (
    <div
      className={cn(
        "relative flex w-full select-none",
        isAgent ? "justify-end" : "justify-start",
      )}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        clearLongPress();
        setSwipeOffset(0);
      }}
    >
      {/* Swipe to reply indicator */}
      {swipeOffset > 6 && (
        <div
          className="pointer-events-none absolute left-2 top-1/2 z-0 -translate-y-1/2 transition-opacity"
          style={{
            opacity: Math.min(swipeOffset / 32, 1),
            transform: `translateY(-50%) scale(${Math.min(swipeOffset / 38, 1)})`,
          }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00a884] text-white shadow-md">
            <CornerUpLeft className="h-4 w-4 stroke-[2.5]" />
          </div>
        </div>
      )}

      {/* Bubble Container with horizontal translation */}
      <div
        className="group/actions relative min-w-0 max-w-[78%]"
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
          transition: swipeOffset === 0 ? "transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)" : "none",
        }}
      >
        {children}

        {/* WhatsApp Reaction & Action Floating Bar */}
        <div
          data-touch-open={touchOpen || pickerOpen ? "true" : undefined}
          className={cn(
            "absolute -top-4 z-20 flex h-8 items-center gap-1 rounded-full border border-border/80 bg-white/95 px-1.5 shadow-lg backdrop-blur-md transition-all dark:bg-[#202c33]/95",
            "opacity-0 scale-95 group-hover/actions:opacity-100 group-hover/actions:scale-100 group-focus-within/actions:opacity-100 group-focus-within/actions:scale-100",
            "data-[touch-open=true]:opacity-100 data-[touch-open=true]:scale-100",
            isAgent ? "right-2" : "left-2",
          )}
        >
          {/* Quick Reaction Emojis */}
          <div className="flex items-center gap-0.5 border-r border-border/60 pr-1">
            {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handlePickEmoji(emoji)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-sm transition-transform hover:scale-125 active:scale-95"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              aria-label={t("react")}
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              className="flex w-auto flex-row gap-1 border-border bg-popover/95 p-1.5 shadow-xl backdrop-blur-md"
              sideOffset={8}
            >
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => handlePickEmoji(e)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-muted active:scale-90"
                  aria-label={t("reactWith", { emoji: e })}
                >
                  {e}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={handleReply}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
            aria-label={t("reply")}
            title={t("reply")}
          >
            <CornerUpLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
            aria-label={t("copyText")}
            title={t("copyText")}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
