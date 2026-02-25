"use client";

import { useEffect, useRef, useState } from "react";
import { ProfileIcon, BellIcon, SettingsIcon } from "@/app/components/ui/icons";
import type { UserResponse } from "@/lib/api";

const THEME_KEY = "app-theme";
const NOTIFICATIONS_KEY = "app-notifications";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" ? "dark" : "light";
}

function getStoredNotifications(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIFICATIONS_KEY) === "true";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

const iconButtonClass =
  "p-2 rounded-[var(--radius)] text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors";

const dropdownClass =
  "absolute right-0 top-full z-50 mt-1 py-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-lg";

export function SettingsMenu({
  user,
  onLogout,
}: {
  user: UserResponse | null;
  onLogout: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [notifications, setNotifications] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = getStoredTheme();
    setTheme(t);
    applyTheme(t);
    setNotifications(getStoredNotifications());
  }, []);

  useEffect(() => {
    const isOpen = profileOpen || notificationsOpen || settingsOpen;
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        profileRef.current?.contains(target) ||
        notificationsRef.current?.contains(target) ||
        settingsRef.current?.contains(target)
      ) {
        return;
      }
      setProfileOpen(false);
      setNotificationsOpen(false);
      setSettingsOpen(false);
    };
    const id = setTimeout(() => {
      document.addEventListener("click", close, true);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", close, true);
    };
  }, [profileOpen, notificationsOpen, settingsOpen]);

  const handleTheme = (next: Theme) => {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };

  const handleNotifications = (enabled: boolean) => {
    setNotifications(enabled);
    localStorage.setItem(NOTIFICATIONS_KEY, enabled ? "true" : "false");
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {/* Profile */}
      <div className="relative" ref={profileRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setProfileOpen((o) => !o);
            setNotificationsOpen(false);
            setSettingsOpen(false);
          }}
          className={iconButtonClass}
          title="Profile"
          aria-label="Profile"
        >
          <ProfileIcon className="w-5 h-5" />
        </button>
        {profileOpen && (
          <div className={`${dropdownClass} w-56 min-w-[14rem]`}>
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Profile
              </p>
              <p
                className="mt-2 text-sm text-slate-800 dark:text-slate-200 truncate"
                title={user?.email ?? ""}
              >
                {user?.full_name || user?.email || "—"}
              </p>
              {user?.email && user?.full_name && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user.email}
                </p>
              )}
              {user?.role && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="relative" ref={notificationsRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setNotificationsOpen((o) => !o);
            setProfileOpen(false);
            setSettingsOpen(false);
          }}
          className={iconButtonClass}
          title="Notifications"
          aria-label="Notifications"
        >
          <BellIcon className="w-5 h-5" />
        </button>
        {notificationsOpen && (
          <div className={`${dropdownClass} w-64 min-w-[16rem]`}>
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Notifications
              </p>
              <label className="mt-3 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => handleNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Enable notifications
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Settings (Theme, Logout) */}
      <div className="relative" ref={settingsRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSettingsOpen((o) => !o);
            setProfileOpen(false);
            setNotificationsOpen(false);
          }}
          className={iconButtonClass}
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
        {settingsOpen && (
          <div className={`${dropdownClass} w-52 min-w-[13rem]`}>
            <div className="px-4 py-2 border-b border-[var(--border)]">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Theme
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTheme("light")}
                  className={`flex-1 px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium transition-colors ${
                    theme === "light"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-500"
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => handleTheme("dark")}
                  className={`flex-1 px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium transition-colors ${
                    theme === "dark"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-500"
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
