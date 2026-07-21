"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// How long an interim transcript has to stop changing before we act on it,
// instead of waiting for the browser's own (much slower — often several
// seconds) full finalization. See the settle-timer logic below.
const SETTLE_MS = 200;

/**
 * Wraps the browser's SpeechRecognition API so components can listen for
 * short voice commands ("next step", "repeat", "loop on", ...) without
 * dealing with the underlying event wiring directly.
 *
 * Only available in browsers that implement SpeechRecognition /
 * webkitSpeechRecognition (Chrome, Edge, most Chromium-based browsers).
 * Safari/iOS support is inconsistent as of this build.
 */
export function useVoiceCommands(onCommand) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    // This is the actual latency fix: with interimResults off, onresult
    // only ever fires once the browser's speech engine fully finalizes an
    // utterance, which can take several seconds — long after the
    // transcript itself has stopped changing. Acting on a settled interim
    // result (below) instead of waiting for that finalization is what
    // gets response time down.
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // Per-utterance bookkeeping, keyed by each result's index in
    // event.results. In continuous mode, each distinct thing you say gets
    // its own stable index for the life of one recognition session —
    // interim results for the same utterance keep updating that same
    // index until it's marked final. Keying by index (rather than one
    // shared flag) means two commands said close together, each mid-settle
    // at once, can't clobber each other's timers or handled-state.
    const settleTimers = new Map(); // index -> timeout id
    const handledIndices = new Set(); // indices already dispatched

    const clearSettleTimer = (index) => {
      const existing = settleTimers.get(index);
      if (existing) {
        clearTimeout(existing);
        settleTimers.delete(index);
      }
    };

    const dispatch = (index, transcript) => {
      handledIndices.add(index);
      // Bounded cleanup for a long listening session — old entries are
      // never looked at again once past, this just caps memory.
      if (handledIndices.size > 50) handledIndices.clear();
      setLastHeard(transcript);
      onCommandRef.current?.(transcript);
    };

    recognition.onresult = (event) => {
      const index = event.results.length - 1;
      const result = event.results[index];
      const transcript = result[0].transcript.trim().toLowerCase();

      // Already acted on this utterance — ignore any further interim
      // refinements, and the eventual (slow) final result too.
      if (handledIndices.has(index)) return;

      clearSettleTimer(index);

      if (result.isFinal) {
        dispatch(index, transcript);
        return;
      }

      // Interim: wait for the transcript to stop changing for SETTLE_MS
      // before acting, so a command doesn't fire on a half-spoken phrase
      // (e.g. "play" before "play sear the meat at half speed" finishes).
      // Restarted on every new interim result for this same index.
      settleTimers.set(
        index,
        setTimeout(() => {
          settleTimers.delete(index);
          if (handledIndices.has(index)) return;
          dispatch(index, transcript);
        }, SETTLE_MS)
      );
    };

    recognition.onerror = (event) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        listeningRef.current = false;
        setListening(false);
      }
      // 'no-speech' / 'aborted' are routine while listening in a noisy kitchen;
      // onend below will restart recognition automatically.
    };

    // A fresh recognition session (the initial start, or each auto-restart
    // below) renumbers event.results from 0 again. Clearing here — on
    // session start, not on every utterance — is deliberate: clearing
    // handledIndices per-utterance would risk wiping out the entry for an
    // utterance whose slow "final" result is still in flight right as the
    // next one begins, which would let it double-fire. A session restart
    // is the only time an index number can actually get reused.
    recognition.onstart = () => {
      for (const timer of settleTimers.values()) clearTimeout(timer);
      settleTimers.clear();
      handledIndices.clear();
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          // recognition may already be starting; ignore
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      listeningRef.current = false;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onstart = null;
      recognition.onend = null;
      for (const timer of settleTimers.values()) clearTimeout(timer);
      settleTimers.clear();
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    listeningRef.current = true;
    setListening(true);
    try {
      recognitionRef.current.start();
    } catch {
      // already started
    }
  }, []);

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, lastHeard, start, stop, toggle };
}
