import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Lock, LogOut, RefreshCw, Save } from 'lucide-react';
import { Check } from '@/components/animate-ui/icons/check';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { api } from '../services/api';
import { AdminStats, ClassSession, ContactMessage, Booking } from '../types';
import { AdminMembers } from './AdminMembers';
import { ModalSheet } from './ModalSheet';

type AdminTab = 'overview' | 'members';
/** Panels take focus (tabIndex 0) so keyboard users can move from the tabs into them; the ring shows on keyboard only. */
const PANEL = 'focus:outline-none focus-visible:outline-2 focus-visible:outline-accent-text focus-visible:outline-offset-4 rounded-[16px]';

const TABS: ReadonlyArray<readonly [AdminTab, string]> = [
  ['overview', 'Overview'],
  ['members', 'Members'],
];

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('yp_admin_token'));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [stats, setStats] = useState<
    (AdminStats & { upcomingSessions: ClassSession[]; recentMessages: ContactMessage[]; bookings: Booking[] }) | null
  >(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [settingsDriveLink, setSettingsDriveLink] = useState('');
  const [settingsNotifyEmail, setSettingsNotifyEmail] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [tab, setTab] = useState<AdminTab>('overview');
  /** Bumped by Refresh so the Members panel fetches its list again too. */
  const [membersRefresh, setMembersRefresh] = useState(0);
  const tabRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (token && isOpen) {
      loadStats(token);
    }
  }, [token, isOpen]);

  const loadStats = async (adminToken: string) => {
    try {
      setLoadingStats(true);
      const data = await api.getAdminStats(adminToken);
      setStats(data);
      setSettingsDriveLink(data.googleDriveLink || '');
      setSettingsNotifyEmail(data.notificationEmail || '');
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('expired') || err?.message?.includes('Unauthorized')) {
        handleLogout();
      }
    } finally {
      setLoadingStats(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoginLoading(true);
      setLoginError(null);
      const res = await api.adminLogin(password);
      setToken(res.token);
      localStorage.setItem('yp_admin_token', res.token);
      setPassword('');
      loadStats(res.token);
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    // End the session on the server too; the local sign-out happens either way.
    if (token) api.adminLogout(token).catch(() => undefined);
    setToken(null);
    localStorage.removeItem('yp_admin_token');
    setStats(null);
    setTab('overview');
  };

  // Tabs (WAI-ARIA): arrows, Home and End move between them, and the focused tab is shown at once.
  const handleTabKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex(([key]) => key === tab);
    const last = TABS.length - 1;
    const next =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    const key = TABS[next][0];
    setTab(key);
    tabRefs.current[key]?.focus();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setSavingSettings(true);
      setSettingsSaved(false);
      await api.updateAdminSettings(token, {
        googleDriveLink: settingsDriveLink,
        notificationEmail: settingsNotifyEmail,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Scale the chart to the best month so real (often small) numbers stay readable.
  const maxEarnings = stats ? Math.max(0, ...stats.earnings6Months.map((m) => m.amountAed)) : 0;

  const titleId = 'admin-modal-title';
  const sectionTitle = 'font-display font-normal text-h3 text-ink';
  const tile = 'bg-surface-alt rounded-[16px] p-5 flex flex-col gap-1';
  const tileLabel = 'text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft';
  const tileValue = 'font-display font-normal text-[34px] leading-[1.1] text-ink tabular-nums';
  const tileNote = 'text-xs text-ink-soft';

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      closeLabel="Close admin dashboard"
      size={token ? 'wide' : 'default'}
      dismissible={false}
    >
      {/* LOGIN SCREEN */}
      {!token ? (
        <div className="max-w-md mx-auto py-4 flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center justify-center size-12 rounded-full bg-surface-alt text-accent-text">
              <Lock className="size-5" aria-hidden="true" />
            </span>
            <h2 id={titleId} className="font-display font-normal text-title sm:text-title-lg text-ink">
              Instructor Portal
            </h2>
            <p className="text-sm leading-[1.5] text-ink-soft">
              Priyanshi&apos;s private studio dashboard. Protected by lockout security.
            </p>
          </div>

          {loginError && (
            <div role="alert" className={ui.error}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="admin-password" className={ui.label}>
                Admin Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter studio password..."
                className={ui.input}
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className={cn(ui.secondary, 'flex-1')}>
                Close
              </button>
              <button type="submit" disabled={loginLoading} className={cn(ui.primary, 'flex-1')}>
                {loginLoading ? 'Verifying...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* AUTHENTICATED DASHBOARD */
        <div className="flex flex-col gap-8">
          {/* Top bar */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-line">
            <div className="flex flex-col gap-2 pr-12 lg:pr-0">
              <span className={cn(ui.eyebrow, 'text-accent-text')}>Studio Operations</span>
              <h2 id={titleId} className="font-display font-normal text-title sm:text-title-lg text-ink">
                Priyanshi&apos;s Studio Overview
              </h2>
            </div>

            <div className="flex items-center gap-2 lg:mr-14">
              <button
                type="button"
                onClick={() => {
                  loadStats(token);
                  if (tab === 'members') setMembersRefresh((n) => n + 1);
                }}
                className="press inline-flex items-center justify-center size-11 rounded-full border border-line text-ink hover:border-ink transition duration-200 ease-spring active:duration-100"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('size-4', loadingStats && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
              </button>
              <button type="button" onClick={handleLogout} className={ui.secondary}>
                <LogOut className="size-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="inline-flex self-start gap-1 p-1 bg-surface-alt rounded-full"
          >
            {TABS.map(([key, label]) => (
              <button
                key={key}
                ref={(el) => {
                  tabRefs.current[key] = el;
                }}
                type="button"
                role="tab"
                id={`admin-tab-${key}`}
                aria-selected={tab === key}
                // Only the shown panel is in the DOM, so only its tab points at it.
                aria-controls={tab === key ? `admin-panel-${key}` : undefined}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={handleTabKey}
                className={cn(
                  'press-soft min-h-11 px-5 rounded-full text-sm font-medium transition duration-200 ease-spring active:duration-100',
                  tab === key ? 'bg-ink text-on-ink' : 'text-ink-soft hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'members' ? (
            <div role="tabpanel" id="admin-panel-members" aria-labelledby="admin-tab-members" tabIndex={0} className={PANEL}>
              <AdminMembers token={token} onUnauthorized={handleLogout} refreshKey={membersRefresh} />
            </div>
          ) : (
            <div role="tabpanel" id="admin-panel-overview" aria-labelledby="admin-tab-overview" tabIndex={0} className={PANEL}>
              {loadingStats && !stats ? (
                <div className="py-20 flex flex-col items-center gap-3 text-center">
                  <RefreshCw className="size-8 text-accent-text animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <p className="text-sm text-ink-soft">Loading metrics...</p>
                </div>
              ) : stats ? (
                <div className="flex flex-col gap-12">
                  {/* 1. Stat tiles (PRD §6.7) */}
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={tile}>
                      <span className={tileLabel}>Total Revenue</span>
                      <span className={tileValue}>AED {stats.totalRevenueAed.toLocaleString()}</span>
                      <span className={tileNote}>Confirmed payments only</span>
                    </div>
                    <div className={tile}>
                      <span className={tileLabel}>Total Clients</span>
                      <span className={tileValue}>{stats.totalClients}</span>
                      <span className={tileNote}>Registered in database</span>
                    </div>
                    <div className={tile}>
                      <span className={tileLabel}>New Clients (This Month)</span>
                      <span className={tileValue}>{stats.newClientsThisMonth}</span>
                      <span className={tileNote}>First booked this month</span>
                    </div>
                    <div className={tile}>
                      <span className={tileLabel}>Upcoming Bookings</span>
                      <span className={cn(tileValue, 'text-accent-text')}>{stats.upcomingBookingsCount}</span>
                      <span className={tileNote}>Active seat reservations</span>
                    </div>
                  </div>

                  {/* 2. Earnings, last 6 months */}
                  <div className="bg-surface-alt rounded-[16px] p-5 sm:p-8 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <h3 className={sectionTitle}>Earnings — Last 6 Months (AED)</h3>
                      <p className="text-sm text-ink-soft">
                        {stats.earnings6Months.some((m) => m.amountAed > 0)
                          ? 'Confirmed payments by month across single drop-ins, 10-packs, and 20-packs.'
                          : 'No confirmed payments yet. Months fill in as payments are recorded.'}
                      </p>
                    </div>

                    <div
                      role="img"
                      aria-label={`Earnings by month, in AED: ${stats.earnings6Months
                        .map((m) => `${m.month} ${m.amountAed.toLocaleString()}`)
                        .join(', ')}`}
                      className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-44 pt-6 pb-2 border-b border-line"
                    >
                      {stats.earnings6Months.map((item, idx) => {
                        const heightPercent = maxEarnings > 0 ? Math.round((item.amountAed / maxEarnings) * 100) : 0;
                        const isCurrent = idx === stats.earnings6Months.length - 1;

                        return (
                          <div key={item.month} className="flex flex-col items-center h-full justify-end group">
                            <span className="text-xs text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity duration-200 mb-1 tabular-nums">
                              {item.amountAed.toLocaleString()}
                            </span>
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className={cn(
                                'w-full max-w-[48px] rounded-t-[4px] transition-colors duration-200',
                                isCurrent ? 'bg-accent' : 'bg-ink/70 hover:bg-ink'
                              )}
                            />
                            <span className="text-xs font-medium text-ink mt-2">{item.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Upcoming classes (next 10) */}
                  <div className="flex flex-col gap-4">
                    <h3 className={sectionTitle}>Upcoming Classes (Next 10 Scheduled Slots)</h3>
                    <div
                      tabIndex={0}
                      role="region"
                      aria-label="Upcoming classes table"
                      className="overflow-x-auto rounded-[16px] bg-surface-alt"
                    >
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-[0.14em] text-ink-soft border-b border-line">
                          <tr>
                            <th className="p-3 font-semibold">Class</th>
                            <th className="p-3 font-semibold">Date & Time (Dubai)</th>
                            <th className="p-3 font-semibold">Capacity</th>
                            <th className="p-3 font-semibold">Booked</th>
                            <th className="p-3 font-semibold">Spots Left</th>
                            <th className="p-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {stats.upcomingSessions.map((session) => (
                            <tr key={session.id} className="hover:bg-surface/60 transition-colors duration-200">
                              <td className="p-3 font-semibold text-ink whitespace-nowrap">{session.className}</td>
                              <td className="p-3 text-ink-soft whitespace-nowrap tabular-nums">
                                {session.dateDubai} · {session.timeDubai}
                              </td>
                              <td className="p-3 tabular-nums">{session.capacity}</td>
                              <td className="p-3 tabular-nums font-semibold">{session.bookedCount}</td>
                              <td className="p-3 tabular-nums font-semibold text-ink">{session.spotsLeft}</td>
                              <td className="p-3">
                                <span
                                  className={cn(
                                    'uppercase text-xs font-semibold tracking-[0.1em]',
                                    session.status === 'full' ? 'text-error' : 'text-success'
                                  )}
                                >
                                  {session.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. Recent contact messages */}
                  <div className="flex flex-col gap-4">
                    <h3 className={sectionTitle}>Recent Messages (Contact Form)</h3>
                    <div className="flex flex-col gap-3">
                      {stats.recentMessages.length === 0 ? (
                        <p className="text-sm text-ink-soft">No incoming messages yet.</p>
                      ) : (
                        stats.recentMessages.map((msg) => (
                          <div key={msg.id} className="bg-surface-alt rounded-[16px] p-4 sm:p-5 flex flex-col gap-3 text-sm">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="font-semibold text-ink">{msg.name}</span>
                                <a
                                  href={`mailto:${msg.email}`}
                                  className="self-start inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:no-underline break-all"
                                >
                                  {msg.email}
                                </a>
                                {msg.phone && (
                                  <a
                                    href={`tel:${msg.phone.replace(/[^\d+]/g, '')}`}
                                    className="self-start inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:no-underline tabular-nums"
                                  >
                                    {msg.phone}
                                  </a>
                                )}
                              </div>
                              <span className="text-xs text-ink-soft tabular-nums shrink-0">
                                {new Date(msg.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <span className={ui.eyebrow}>Interest: {msg.interest}</span>
                            {/* A membership request may come without preferred times. */}
                            {msg.message && (
                              <p className="text-ink-soft leading-[1.6] bg-surface rounded-[12px] p-3 whitespace-pre-wrap">
                                &ldquo;{msg.message}&rdquo;
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 5. Settings: Drive link and notification email (PRD §6.7) */}
                  <div className="bg-surface-alt rounded-[16px] p-5 sm:p-8 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <h3 className={sectionTitle}>Studio Integration Settings</h3>
                      <p className="text-sm text-ink-soft">
                        Update your shared Google Drive schedule sheet and alert recipient email address.
                      </p>
                    </div>

                    <form onSubmit={handleSaveSettings} className="flex flex-col gap-6 max-w-xl">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="admin-drive-link" className={ui.label}>
                          Google Drive / Sheet Link
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="admin-drive-link"
                            type="url"
                            value={settingsDriveLink}
                            placeholder="Not set"
                            onChange={(e) => setSettingsDriveLink(e.target.value)}
                            className={cn(ui.input, 'flex-1 bg-surface')}
                          />
                          {settingsDriveLink && (
                            <a
                              href={settingsDriveLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="press inline-flex items-center justify-center size-12 shrink-0 rounded-full border border-line text-ink hover:border-ink transition duration-200 ease-spring active:duration-100"
                              title="Open Sheet"
                              aria-label="Open Sheet"
                            >
                              <ExternalLink className="size-4" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="admin-notify-email" className={ui.label}>
                          Studio Notification Alert Email
                        </label>
                        <input
                          id="admin-notify-email"
                          type="email"
                          required
                          value={settingsNotifyEmail}
                          onChange={(e) => setSettingsNotifyEmail(e.target.value)}
                          className={cn(ui.input, 'bg-surface')}
                        />
                        <p className="text-xs text-ink-soft">
                          Where instant alerts for new bookings and contact form submissions are delivered.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <button type="submit" disabled={savingSettings} className={ui.primary}>
                          <Save className="size-4" aria-hidden="true" />
                          {savingSettings ? 'Saving...' : 'Persist Settings'}
                        </button>

                        {settingsSaved && (
                          <span className="text-sm text-success font-medium flex items-center gap-2">
                            <Check size={16} animateOnView animateOnViewOnce aria-hidden="true" />
                            Settings updated successfully.
                          </span>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </ModalSheet>
  );
};
