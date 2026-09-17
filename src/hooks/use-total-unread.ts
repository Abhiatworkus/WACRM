"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types";

/**
 * Count of conversations with at least one unread inbound message for
 * the current user. Used by the sidebar and mobile bottom-nav to surface
 * a live badge when the user is elsewhere in the app.
 *
 * Uses a single shared module-level store so all navigation components
 * stay in sync without duplicating Realtime channels or database queries.
 */
let currentTotal = 0;
const counts = new Map<string, number>();
const listeners = new Set<() => void>();
let activeChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function initChannel() {
  if (activeChannel || typeof window === "undefined") return;
  const supabase = createClient();

  (async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, unread_count");
    if (error || !data) return;

    counts.clear();
    let sum = 0;
    for (const row of data as { id: string; unread_count: number }[]) {
      const n = row.unread_count ?? 0;
      counts.set(row.id, n);
      if (n > 0) sum += 1;
    }
    currentTotal = sum;
    notify();
  })();

  const topic = `total-unread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  activeChannel = supabase
    .channel(topic)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as Partial<Conversation>;
          if (oldRow.id) counts.delete(oldRow.id);
        } else {
          const row = payload.new as Conversation;
          counts.set(row.id, row.unread_count ?? 0);
        }
        let sum = 0;
        for (const n of counts.values()) if (n > 0) sum += 1;
        currentTotal = sum;
        notify();
      },
    )
    .subscribe();
}

function teardownChannel() {
  if (listeners.size === 0 && activeChannel) {
    const supabase = createClient();
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    counts.clear();
    currentTotal = 0;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  initChannel();
  return () => {
    listeners.delete(callback);
    teardownChannel();
  };
}

function getSnapshot() {
  return currentTotal;
}

function getServerSnapshot() {
  return 0;
}

export function useTotalUnread(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
