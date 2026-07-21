"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim().toLowerCase();
      setLastHeard(transcript);
      onCommandRef.current?.(transcript);
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
      recognition.onend = null;
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
