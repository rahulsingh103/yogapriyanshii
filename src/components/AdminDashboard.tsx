import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AdminStats, ClassSession, ContactMessage, Booking } from '../types';
import { Lock, LogOut, ExternalLink, Save, CheckCircle2, AlertCircle, RefreshCw, Users, Calendar, DollarSign, X } from 'lucide-react';

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

  useEffect(() => {
    if (token && isOpen) {
      loadStats(token);
    }
  }, [token, isOpen]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0f0e0b]/85 backdrop-blur-xs">
      <div className="bg-[#faf8f3] text-[#0f0e0b] border border-[#0f0e0b]/15 max-w-5xl w-full p-5 sm:p-8 md:p-10 shadow-2xl relative max-h-[92vh] overflow-y-auto rounded-xs">
        {/* Top-right dismiss button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#0f0e0b]/50 hover:text-[#0f0e0b] transition-colors rounded-xs z-10"
          aria-label="Close admin dashboard"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LOGIN SCREEN */}
        {!token ? (
          <div className="max-w-md mx-auto py-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-[#0f0e0b] text-[#faf8f3] flex items-center justify-center mx-auto mb-4">
                <Lock className="w-5 h-5 text-[#c4b48a]" />
              </div>
              <h3 className="font-serif text-3xl text-[#0f0e0b] mb-2">Instructor Portal</h3>
              <p className="text-xs text-[#0f0e0b]/60">
                Priyanshi&apos;s private studio dashboard. Protected by lockout security.
              </p>
            </div>

            {loginError && (
              <div className="p-4 mb-6 bg-red-50 border border-red-200 text-xs text-red-900 leading-relaxed rounded-xs">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter studio password..."
                  className="w-full px-4 py-3 bg-[#f2ede4] border border-[#0f0e0b]/20 text-base sm:text-sm focus:outline-hidden focus:border-[#0f0e0b] rounded-xs min-h-[44px]"
                />
                <p className="text-[11px] text-[#0f0e0b]/50 mt-1">
                  Default credentials: <code>Priyanshi2026!</code>
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 min-h-[44px] border border-[#0f0e0b]/20 text-xs font-semibold uppercase tracking-widest text-[#0f0e0b] rounded-xs hover:border-[#0f0e0b] transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1 py-3 min-h-[44px] bg-[#0f0e0b] hover:bg-[#262420] text-[#faf8f3] text-xs font-semibold uppercase tracking-widest transition-colors rounded-xs shadow-xs"
                >
                  {loginLoading ? 'Verifying...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED DASHBOARD */
          <div>
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#0f0e0b]/10 mb-8 gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-[#c4b48a] font-semibold block">
                  Studio Operations
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl text-[#0f0e0b]">
                  Priyanshi&apos;s Studio Overview
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => loadStats(token)}
                  className="p-2 border border-[#0f0e0b]/15 text-[#0f0e0b]/70 hover:text-[#0f0e0b] transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#0f0e0b]/20 text-xs uppercase tracking-wider text-[#0f0e0b] hover:bg-[#0f0e0b] hover:text-[#faf8f3] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#0f0e0b] text-[#faf8f3] text-xs uppercase tracking-wider"
                >
                  Close
                </button>
              </div>
            </div>

            {loadingStats && !stats ? (
              <div className="py-20 text-center">
                <RefreshCw className="w-8 h-8 mx-auto text-[#c4b48a] animate-spin mb-3" />
                <p className="text-xs text-[#0f0e0b]/60">Loading metrics...</p>
              </div>
            ) : stats ? (
              <div className="space-y-10">
                {/* 1. Stat Tiles per PRD §6.7 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-5">
                    <span className="text-[11px] uppercase tracking-wider text-[#0f0e0b]/60 block mb-1">
                      Total Revenue
                    </span>
                    <span className="font-serif text-2xl sm:text-3xl text-[#0f0e0b] font-semibold block">
                      AED {stats.totalRevenueAed.toLocaleString()}
                    </span>
                    <span className="text-xs text-[#0f0e0b]/50 font-mono mt-1 block">
                      Confirmed payments only
                    </span>
                  </div>

                  <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-5">
                    <span className="text-[11px] uppercase tracking-wider text-[#0f0e0b]/60 block mb-1">
                      Total Clients
                    </span>
                    <span className="font-serif text-2xl sm:text-3xl text-[#0f0e0b] font-semibold block tabular-nums">
                      {stats.totalClients}
                    </span>
                    <span className="text-[10px] text-[#0f0e0b]/50 font-mono mt-1 block">
                      Registered in database
                    </span>
                  </div>

                  <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-5">
                    <span className="text-[11px] uppercase tracking-wider text-[#0f0e0b]/60 block mb-1">
                      New Clients (This Month)
                    </span>
                    <span className="font-serif text-2xl sm:text-3xl text-[#0f0e0b] font-semibold block tabular-nums">
                      {stats.newClientsThisMonth}
                    </span>
                    <span className="text-xs text-[#0f0e0b]/50 font-mono mt-1 block">
                      First booked this month
                    </span>
                  </div>

                  <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-5">
                    <span className="text-[11px] uppercase tracking-wider text-[#0f0e0b]/60 block mb-1">
                      Upcoming Bookings
                    </span>
                    <span className="font-serif text-2xl sm:text-3xl text-[#0f0e0b] font-semibold block tabular-nums text-[#c4b48a]">
                      {stats.upcomingBookingsCount}
                    </span>
                    <span className="text-[10px] text-[#0f0e0b]/50 font-mono mt-1 block">
                      Active seat reservations
                    </span>
                  </div>
                </div>

                {/* 2. Earnings Last 6 Months Bar Chart */}
                <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-6 sm:p-8">
                  <h4 className="font-serif text-lg text-[#0f0e0b] mb-1">
                    Earnings — Last 6 Months (AED)
                  </h4>
                  <p className="text-xs text-[#0f0e0b]/60 mb-6">
                    {stats.earnings6Months.some((m) => m.amountAed > 0)
                      ? 'Confirmed payments by month across single drop-ins, 10-packs, and 20-packs.'
                      : 'No confirmed payments yet. Months fill in as payments are recorded.'}
                  </p>

                  <div
                    role="img"
                    aria-label={`Earnings by month, in AED: ${stats.earnings6Months
                      .map((m) => `${m.month} ${m.amountAed.toLocaleString()}`)
                      .join(', ')}`}
                    className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-44 pt-6 pb-2 border-b border-[#0f0e0b]/15"
                  >
                    {stats.earnings6Months.map((item, idx) => {
                      const heightPercent = maxEarnings > 0 ? Math.round((item.amountAed / maxEarnings) * 100) : 0;
                      const isCurrent = idx === stats.earnings6Months.length - 1;

                      return (
                        <div key={item.month} className="flex flex-col items-center h-full justify-end group">
                          <span className="text-[10px] font-mono text-[#0f0e0b]/70 opacity-0 group-hover:opacity-100 transition-opacity mb-1 tabular-nums">
                            {item.amountAed.toLocaleString()}
                          </span>
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full max-w-[48px] transition-all rounded-xs ${
                              isCurrent ? 'bg-[#c4b48a]' : 'bg-[#0f0e0b]/75 hover:bg-[#0f0e0b]'
                            }`}
                          />
                          <span className="text-xs font-medium text-[#0f0e0b] mt-2">
                            {item.month}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Upcoming Classes List (Next 10) */}
                <div>
                  <h4 className="font-serif text-lg text-[#0f0e0b] mb-4">
                    Upcoming Classes (Next 10 Scheduled Slots)
                  </h4>
                  <div className="overflow-x-auto border border-[#0f0e0b]/10 bg-[#f2ede4]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0f0e0b] text-[#faf8f3] uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3">Class</th>
                          <th className="p-3">Date & Time (Dubai)</th>
                          <th className="p-3">Capacity</th>
                          <th className="p-3">Booked</th>
                          <th className="p-3">Spots Left</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0f0e0b]/10">
                        {stats.upcomingSessions.map((session) => (
                          <tr key={session.id} className="hover:bg-[#faf8f3]/60 transition-colors">
                            <td className="p-3 font-semibold text-[#0f0e0b]">{session.className}</td>
                            <td className="p-3 font-mono">{session.dateDubai} · {session.timeDubai}</td>
                            <td className="p-3 tabular-nums">{session.capacity}</td>
                            <td className="p-3 tabular-nums font-semibold">{session.bookedCount}</td>
                            <td className="p-3 tabular-nums font-bold text-[#c4b48a]">
                              {session.spotsLeft}
                            </td>
                            <td className="p-3">
                              <span
                                className={`uppercase text-[10px] font-semibold tracking-wider ${
                                  session.status === 'full' ? 'text-red-700' : 'text-emerald-700'
                                }`}
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

                {/* 4. Recent Contact Inquiries */}
                <div>
                  <h4 className="font-serif text-lg text-[#0f0e0b] mb-4">
                    Recent Messages (Contact Form)
                  </h4>
                  <div className="space-y-3">
                    {stats.recentMessages.length === 0 ? (
                      <p className="text-xs text-[#0f0e0b]/50">No incoming messages yet.</p>
                    ) : (
                      stats.recentMessages.map((msg) => (
                        <div key={msg.id} className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-4 text-xs">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-semibold text-sm text-[#0f0e0b] block">{msg.name}</span>
                              <a href={`mailto:${msg.email}`} className="text-[#c4b48a] hover:underline">
                                {msg.email}
                              </a>
                            </div>
                            <span className="text-[10px] text-[#0f0e0b]/50 font-mono">
                              {new Date(msg.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="inline-block text-[10px] uppercase tracking-wider font-semibold text-[#0f0e0b]/60 mb-2">
                            Interest: {msg.interest}
                          </span>
                          <p className="text-[#0f0e0b]/80 leading-relaxed bg-[#faf8f3] p-3 border border-[#0f0e0b]/5">
                            &ldquo;{msg.message}&rdquo;
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 5. Settings: Drive Link & Notification Email per PRD §6.7 */}
                <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-6 sm:p-8">
                  <h4 className="font-serif text-lg text-[#0f0e0b] mb-2">
                    Studio Integration Settings
                  </h4>
                  <p className="text-xs text-[#0f0e0b]/60 mb-6">
                    Update your shared Google Drive schedule sheet and alert recipient email address.
                  </p>

                  <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                        Google Drive / Sheet Link
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={settingsDriveLink}
                          placeholder="Not set"
                          onChange={(e) => setSettingsDriveLink(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-[#faf8f3] border border-[#0f0e0b]/20 text-xs focus:outline-hidden focus:border-[#0f0e0b]"
                        />
                        {settingsDriveLink && (
                          <a
                            href={settingsDriveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2.5 bg-[#0f0e0b] text-[#faf8f3] text-xs flex items-center gap-1 hover:bg-[#262420]"
                            title="Open Sheet"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                        Studio Notification Alert Email
                      </label>
                      <input
                        type="email"
                        required
                        value={settingsNotifyEmail}
                        onChange={(e) => setSettingsNotifyEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#faf8f3] border border-[#0f0e0b]/20 text-xs focus:outline-hidden focus:border-[#0f0e0b]"
                      />
                      <p className="text-[11px] text-[#0f0e0b]/50 mt-1">
                        Where instant alerts for new bookings and contact form submissions are delivered.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-4">
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="px-6 py-2.5 bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-widest transition-colors flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingSettings ? 'Saving...' : 'Persist Settings'}
                      </button>

                      {settingsSaved && (
                        <span className="text-xs text-emerald-800 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
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
    </div>
  );
};
