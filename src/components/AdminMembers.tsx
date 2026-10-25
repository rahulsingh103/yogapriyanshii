import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { ApiError, api } from '../services/api';
import type { MemberFormat, MemberStatus, MembersPage, MembershipRequest } from '../types';

interface AdminMembersProps {
  token: string;
  /** A 401: the session ended, so the dashboard signs out. */
  onUnauthorized: () => void;
  /** Bumped by the dashboard's Refresh button: fetch the list again. */
  refreshKey?: number;
}

const STATUS_LABELS: Record<MemberStatus, string> = { new: 'New', contacted: 'Contacted', active: 'Active' };
const STATUS_TONE: Record<MemberStatus, string> = {
  new: 'bg-surface text-ink',
  contacted: 'border border-line-strong text-ink-soft',
  active: 'bg-success text-on-ink',
};
const FORMAT_LABELS: Record<MemberFormat, string> = { in_person: 'In person in Dubai', online: 'Live online' };

/** The moves the server allows (backend/membership.ts): one step forward or back, no New -> Active jump. */
const NEXT: Record<MemberStatus, readonly MemberStatus[]> = {
  new: ['contacted'],
  contacted: ['new', 'active'],
  active: ['contacted'],
};

const FILTERS: ReadonlyArray<MemberStatus | null> = [null, 'new', 'contacted', 'active'];
const PAGE_SIZE = 20;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD of an instant, in Dubai. */
function dubaiYmd(at: Date | string = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(typeof at === 'string' ? new Date(at) : at);
}

/** "25 Oct 2026" from YYYY-MM-DD. */
function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const segment = (on: boolean) =>
  cn(
    'press-soft min-h-11 px-4 rounded-full text-sm font-medium transition duration-200 ease-spring active:duration-100',
    on ? 'bg-ink text-on-ink' : 'text-ink-soft hover:text-ink'
  );

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export function AdminMembers({ token, onUnauthorized, refreshKey = 0 }: AdminMembersProps) {
  const [filter, setFilter] = useState<MemberStatus | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MembersPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Read out after a save ("Saved: Asha is now Contacted."). */
  const [savedNote, setSavedNote] = useState('');
  /** Only the newest list request may update the screen. */
  const requestSeq = useRef(0);
  /** After a save: the card to focus once the list has been fetched again. */
  const focusAfterLoad = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The parent passes a new function each render; a ref keeps `load` (and its effect) stable.
  const unauthorized = useRef(onUnauthorized);
  useEffect(() => {
    unauthorized.current = onUnauthorized;
  }, [onUnauthorized]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      const next = await api.getMembers(token, { page, status: filter });
      if (seq !== requestSeq.current) return;
      setData(next);
      setLoadError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      if (err instanceof ApiError && err.status === 401) unauthorized.current();
      else setLoadError(errorText(err, "Couldn't load the membership requests."));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, page, filter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // After a save and the refetch: focus the saved card's name, or the section heading if the
  // card has left this filtered list.
  useEffect(() => {
    const id = focusAfterLoad.current;
    if (!id || loading) return;
    focusAfterLoad.current = null;
    const name = rootRef.current?.querySelector<HTMLElement>(`[data-member-name="${id}"]`);
    (name ?? headingRef.current)?.focus();
  }, [data, loading]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  // A save can empty the last page of a filtered list: step back to the new last page.
  useEffect(() => {
    if (data && data.members.length === 0 && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  const chooseFilter = (next: MemberStatus | null) => {
    setFilter(next);
    setPage(1);
  };

  // The card shows what the server returned, then the list and counts are fetched again.
  const handleSaved = (member: MembershipRequest) => {
    setData((prev) =>
      prev ? { ...prev, members: prev.members.map((m) => (m.id === member.id ? member : m)) } : prev
    );
    setSavedNote(`Saved: ${member.name} is now ${STATUS_LABELS[member.status]}.`);
    focusAfterLoad.current = member.id;
    load();
  };

  const count = (s: MemberStatus) => data?.counts[s] ?? 0;

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        {savedNote}
      </p>
      <div className="flex flex-col gap-2">
        <h3 ref={headingRef} tabIndex={-1} className="font-display font-normal text-h3 text-ink focus:outline-none">
          Membership requests
        </h3>
        <p className="text-sm text-ink-soft">New, then Contacted, then Active with a start date.</p>
      </div>

      <div
        role="group"
        aria-label="Show requests"
        className="grid grid-cols-2 gap-1 p-1 bg-surface-alt rounded-[24px] sm:flex sm:self-start sm:rounded-full"
      >
        {FILTERS.map((f) => (
          <button
            key={f ?? 'all'}
            type="button"
            aria-pressed={filter === f}
            onClick={() => chooseFilter(f)}
            className={cn(segment(filter === f), 'tabular-nums')}
          >
            {f ? `${STATUS_LABELS[f]} (${count(f)})` : 'All'}
          </button>
        ))}
      </div>

      {loadError && (
        <div role="alert" className={ui.error}>
          {loadError}
        </div>
      )}

      {loading && !data ? (
        <p role="status" className="text-sm text-ink-soft">
          Loading requests...
        </p>
      ) : data ? (
        data.members.length === 0 ? (
          <p className="text-sm text-ink-soft">
            {filter ? 'No requests with this status.' : 'No membership requests yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.members.map((m) => (
              <MemberCard
                key={`${m.id}-${m.updatedAt}`}
                member={m}
                token={token}
                onSaved={handleSaved}
                onUnauthorized={onUnauthorized}
              />
            ))}
          </div>
        )
      ) : null}

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span aria-live="polite" className="text-sm text-ink-soft tabular-nums">
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className={ui.secondary}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className={ui.secondary}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MemberCardProps {
  member: MembershipRequest;
  token: string;
  onSaved: (member: MembershipRequest) => void;
  onUnauthorized: () => void;
}

function MemberCard({ member: m, token, onSaved, onUnauthorized }: MemberCardProps) {
  const [nextStatus, setNextStatus] = useState<MemberStatus>(m.status);
  const [startDate, setStartDate] = useState(m.startDate ?? dubaiYmd());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: MemberStatus[] = [m.status, ...NEXT[m.status]];
  const showDate = nextStatus === 'active';
  const unchanged = nextStatus === m.status && (m.status !== 'active' || startDate === m.startDate);
  const statusId = `member-status-${m.id}`;
  const dateId = `member-start-${m.id}`;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const res = await api.updateMember(token, m.id, {
        status: nextStatus,
        expectedStatus: m.status,
        ...(nextStatus === 'active' ? { startDate } : {}),
      });
      onSaved(res.member);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(errorText(err, "Couldn't save this change. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="member-request" className="bg-surface-alt rounded-[16px] p-4 sm:p-5 flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h4
              data-member-name={m.id}
              tabIndex={-1}
              className="min-w-0 break-words font-semibold text-ink focus:outline-none"
            >
              {m.name}
            </h4>
            <span className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]', STATUS_TONE[m.status])}>
              <span className="sr-only">Status: </span>
              <span data-testid="member-status">{STATUS_LABELS[m.status]}</span>
            </span>
          </div>
          <a
            href={`mailto:${m.email}`}
            className="self-start inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:no-underline break-all"
          >
            {m.email}
          </a>
          {m.phone && (
            <a
              href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}
              className="self-start inline-flex min-h-11 items-center text-ink underline underline-offset-2 hover:no-underline tabular-nums"
            >
              {m.phone}
            </a>
          )}
        </div>

        <div className="flex flex-col gap-1 text-ink-soft leading-[1.5]">
          <span className="text-ink">Format: {m.format ? FORMAT_LABELS[m.format] : 'Not given'}</span>
          <span className="whitespace-pre-wrap break-words">Preferred times: {m.preferredTimes || 'Not given'}</span>
          <span className="tabular-nums">
            {m.planLabel} · AED {m.priceAed.toLocaleString('en-US')} a month
          </span>
          <span className="tabular-nums">Requested {formatDay(dubaiYmd(m.requestedAt))}</span>
          {m.status === 'active' && m.startDate && (
            <span className="tabular-nums text-ink">Start date: {formatDay(m.startDate)}</span>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className={ui.error}>
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[180px]">
          <label htmlFor={statusId} className={ui.label}>
            Status
          </label>
          <div className="relative">
            <select
              id={statusId}
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as MemberStatus)}
              className={cn(ui.input, 'bg-surface appearance-none pr-10 cursor-pointer')}
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="size-4 text-ink-soft absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        {showDate && (
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <label htmlFor={dateId} className={ui.label}>
              Start date
            </label>
            <input
              id={dateId}
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn(ui.input, 'bg-surface')}
            />
          </div>
        )}

        <button type="submit" disabled={saving || unchanged} className={cn(ui.secondary, 'w-full sm:w-auto')}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}
