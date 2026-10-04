"use client";

import { useEffect, useState } from "react";

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "ios" | "android" | "other";

declare global {
  interface Window { __shanyraqInstallPrompt?: InstallPromptEvent | null }
}

export const INSTALL_PROMPT_EVENT = "shanyraq-install-prompt";

/** Called once from the root layout so the early `beforeinstallprompt` event is never missed. */
export function captureInstallPrompt() {
  const onPrompt = (event: Event) => {
    event.preventDefault();
    window.__shanyraqInstallPrompt = event as InstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
  };
  const onInstalled = () => {
    window.__shanyraqInstallPrompt = null;
    window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function detectStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function usePwaInstall() {
  const [state, setState] = useState<{ ready: boolean; platform: InstallPlatform; standalone: boolean; prompt: InstallPromptEvent | null }>({ ready: false, platform: "other", standalone: false, prompt: null });

  useEffect(() => {
    const sync = () => setState({ ready: true, platform: detectPlatform(), standalone: detectStandalone(), prompt: window.__shanyraqInstallPrompt ?? null });
    sync();
    window.addEventListener(INSTALL_PROMPT_EVENT, sync);
    return () => window.removeEventListener(INSTALL_PROMPT_EVENT, sync);
  }, []);

  async function promptInstall() {
    const prompt = state.prompt;
    if (!prompt) return false;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    window.__shanyraqInstallPrompt = null;
    window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    return choice.outcome === "accepted";
  }

  return { ...state, promptInstall };
}
