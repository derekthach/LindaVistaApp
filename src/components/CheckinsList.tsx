'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckIn, UserRole } from '@/types';
import Button from '@/components/Button';

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// --- Helpers (PR timezone: bucketing uses normalized HH:mm from America/Puerto_Rico) ---

/** Parse "HH:mm" to minutes since midnight. Invalid => 0. */
function timeToMinutes(timeHHmm: string): number {
  const parts = String(timeHHmm).trim().split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

/** Bucket 1: 0..480 (12:00am-8:00am), Bucket 2: 481..960 (8:01am-4:00pm), Bucket 3: 961..1439 (4:01pm-11:59pm). */
const BUCKET_RANGES: [number, number][] = [
  [0, 480],
  [481, 960],
  [961, 1439],
];

const SECTION_LABELS = ['12:00am-8:00am', '8:01am-4:00pm', '4:01pm-11:59pm'];

function getBucketIndex(mins: number): number {
  for (let i = 0; i < BUCKET_RANGES.length; i++) {
    const [lo, hi] = BUCKET_RANGES[i];
    if (mins >= lo && mins <= hi) return i;
  }
  return 2;
}

/** Safe parse to integer cents. Handles number, "$23.00", "23.00". */
function costToCents(cost: unknown): number {
  if (typeof cost === 'number' && !Number.isNaN(cost)) return Math.round(cost * 100);
  if (typeof cost === 'string') {
    const cleaned = cost.replace(/^\s*\$?\s*/, '').trim();
    const n = parseFloat(cleaned);
    if (!Number.isNaN(n)) return Math.round(n * 100);
  }
  return 0;
}

function centsToCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(
    cents / 100
  );
}

/** Single monetary amount for a check-in (already normalized: room cost or food/beer total). */
function getCheckinAmount(checkin: CheckIn): number {
  const n = Number(checkin.cost);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

type CheckinAmountByType = { room: number; food: number; beer: number };

/** Amount for this check-in attributed to each type (only one is non-zero). */
function getCheckinAmountByType(checkin: CheckIn): CheckinAmountByType {
  const amount = getCheckinAmount(checkin);
  const t = checkin.checkInType ?? 'room';
  if (t === 'room') return { room: amount, food: 0, beer: 0 };
  if (t === 'food') return { room: 0, food: amount, beer: 0 };
  return { room: 0, food: 0, beer: amount };
}

export type SectionTotals = {
  roomCents: number;
  foodCents: number;
  beerCents: number;
  totalCents: number;
};

function totalsToCents(checkins: CheckIn[]): SectionTotals {
  let roomCents = 0;
  let foodCents = 0;
  let beerCents = 0;
  for (const c of checkins) {
    const by = getCheckinAmountByType(c);
    roomCents += Math.round(by.room * 100);
    foodCents += Math.round(by.food * 100);
    beerCents += Math.round(by.beer * 100);
  }
  return {
    roomCents,
    foodCents,
    beerCents,
    totalCents: roomCents + foodCents + beerCents,
  };
}

function renderTotalsBreakdown(totals: SectionTotals) {
  return (
    <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
      Room: {centsToCurrency(totals.roomCents)} | Food: {centsToCurrency(totals.foodCents)} | Beer: {centsToCurrency(totals.beerCents)} | <strong>Total: {centsToCurrency(totals.totalCents)}</strong>
    </span>
  );
}

function sortCheckinsForSections(checkins: CheckIn[]): CheckIn[] {
  return [...checkins].sort((a, b) => {
    const minsA = timeToMinutes(a.time);
    const minsB = timeToMinutes(b.time);
    if (minsA !== minsB) return minsA - minsB;
    return (a.receipt_number || '').localeCompare(b.receipt_number || '');
  });
}

/** For food/beer, show placeholder instead of 0 or empty. */
function roomDisplay(checkin: CheckIn): string | number {
  if (checkin.checkInType === 'food' || checkin.checkInType === 'beer') return '—';
  return checkin.room_id;
}

function plateDisplay(checkin: CheckIn): string {
  if (checkin.checkInType === 'food' || checkin.checkInType === 'beer') return '—';
  return checkin.car_plate ?? '';
}

export default function CheckinsList({
  initialCheckins,
  initialDate,
  role,
}: {
  initialCheckins: CheckIn[];
  initialDate?: string;
  role?: UserRole;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? '');
  const [pendingDelete, setPendingDelete] = useState<CheckIn | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAdmin = role === 'admin';
  const colCount = isAdmin ? 9 : 8;
  const colCountForTotal = colCount - 1;

  useEffect(() => {
    setSelectedDate(initialDate ?? '');
  }, [initialDate]);

  const handleFilter = () => {
    const params = new URLSearchParams();
    const date = selectedDate.trim();
    if (date) params.set('date', date);
    router.push(`/checkins?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setSelectedDate('');
    router.replace('/checkins');
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    const date = selectedDate.trim();
    if (date) params.set('date', date);
    window.location.href = `/export?${params.toString()}`;
  };

  const handleDeleteClick = (checkin: CheckIn) => {
    setErrorMessage(null);
    setPendingDelete(checkin);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete?.id) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/checkins/${pendingDelete.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.message === 'string' ? data.message : 'Delete failed');
      }
      setPendingDelete(null);
      setSuccessMessage('Check-in deleted.');
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (!isDeleting) {
      setPendingDelete(null);
      setErrorMessage(null);
    }
  };

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const dateFilterActive = Boolean(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate));

  const sectioned = useMemo(() => {
    if (!dateFilterActive || initialCheckins.length === 0) return null;
    const sorted = sortCheckinsForSections(initialCheckins);
    const buckets: CheckIn[][] = [[], [], []];
    const sectionTotals: SectionTotals[] = [
      { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0 },
      { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0 },
      { roomCents: 0, foodCents: 0, beerCents: 0, totalCents: 0 },
    ];
    for (const c of sorted) {
      const mins = timeToMinutes(c.time);
      const idx = getBucketIndex(mins);
      buckets[idx].push(c);
      const t = totalsToCents([c]);
      sectionTotals[idx].roomCents += t.roomCents;
      sectionTotals[idx].foodCents += t.foodCents;
      sectionTotals[idx].beerCents += t.beerCents;
      sectionTotals[idx].totalCents += t.totalCents;
    }
    const dayTotals: SectionTotals = {
      roomCents: sectionTotals[0].roomCents + sectionTotals[1].roomCents + sectionTotals[2].roomCents,
      foodCents: sectionTotals[0].foodCents + sectionTotals[1].foodCents + sectionTotals[2].foodCents,
      beerCents: sectionTotals[0].beerCents + sectionTotals[1].beerCents + sectionTotals[2].beerCents,
      totalCents: sectionTotals[0].totalCents + sectionTotals[1].totalCents + sectionTotals[2].totalCents,
    };
    return { buckets, sectionTotals, dayTotals };
  }, [dateFilterActive, initialCheckins]);

  const renderActionsCell = (checkin: CheckIn) => {
    if (!isAdmin) return null;
    if (!checkin.id) return <td style={{ padding: 8 }} />;
    return (
      <td style={{ padding: 8, width: 48, textAlign: 'right' }}>
        <button
          type="button"
          onClick={() => handleDeleteClick(checkin)}
          className="btn btn-ghost"
          style={{ minWidth: 32, height: 32, padding: 0 }}
          aria-label="Delete check-in"
          title="Delete check-in"
        >
          <TrashIcon />
        </button>
      </td>
    );
  };

  const tableBody = () => {
    if (sectioned) {
      return (
        <>
          {SECTION_LABELS.map((label, idx) => (
            <Fragment key={idx}>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <td colSpan={colCount} style={{ padding: 8, fontWeight: 600 }}>
                  {label}
                </td>
              </tr>
              {sectioned.buckets[idx].map((checkin) => (
                <tr key={checkin.id ?? checkin.receipt_number}>
                  <td style={{ padding: 8 }}>{checkin.receipt_number}</td>
                  <td style={{ padding: 8 }}>{checkin.date}</td>
                  <td style={{ padding: 8 }}>{checkin.time}</td>
                  <td style={{ padding: 8 }}>{checkin.checkInType ?? 'room'}</td>
                  <td style={{ padding: 8 }}>{roomDisplay(checkin)}</td>
                  <td style={{ padding: 8 }}>{checkin.staff_name}</td>
                  <td style={{ padding: 8 }}>{plateDisplay(checkin)}</td>
                  <td style={{ padding: 8 }}>${Number(checkin.cost).toFixed(2)}</td>
                  {renderActionsCell(checkin)}
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <td colSpan={colCountForTotal} style={{ padding: 8, textAlign: 'right', fontWeight: 500 }}>
                  Section total
                </td>
                <td style={{ padding: 8, fontWeight: 500 }}>{renderTotalsBreakdown(sectioned.sectionTotals[idx])}</td>
              </tr>
            </Fragment>
          ))}
          <tr style={{ backgroundColor: '#e5e7eb', fontWeight: 600 }}>
            <td colSpan={colCountForTotal} style={{ padding: 8, textAlign: 'right' }}>
              Day total
            </td>
            <td style={{ padding: 8 }}>{renderTotalsBreakdown(sectioned.dayTotals)}</td>
          </tr>
        </>
      );
    }
    return initialCheckins.map((checkin) => (
      <tr key={checkin.id ?? checkin.receipt_number}>
        <td style={{ padding: 8 }}>{checkin.receipt_number}</td>
        <td style={{ padding: 8 }}>{checkin.date}</td>
        <td style={{ padding: 8 }}>{checkin.time}</td>
        <td style={{ padding: 8 }}>{checkin.checkInType ?? 'room'}</td>
        <td style={{ padding: 8 }}>{roomDisplay(checkin)}</td>
        <td style={{ padding: 8 }}>{checkin.staff_name}</td>
        <td style={{ padding: 8 }}>{plateDisplay(checkin)}</td>
        <td style={{ padding: 8 }}>${Number(checkin.cost).toFixed(2)}</td>
        {renderActionsCell(checkin)}
      </tr>
    ));
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <strong>Filter by Day</strong>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label>
            <div>Date</div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="primary" onClick={handleFilter}>
              Filter
            </Button>
            <Button variant="ghost" onClick={handleClearFilters} disabled={!dateFilterActive}>
              Clear Filters
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="card" style={{ padding: 12, backgroundColor: '#fef2f2', color: '#991b1b' }}>
          {errorMessage}
        </div>
      )}
      {successMessage && !errorMessage && (
        <div className="card" style={{ padding: 12, backgroundColor: '#f0fdf4', color: '#166534' }}>
          {successMessage}
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Receipt #', 'Date', 'Time', 'Type', 'Room', 'Staff', 'Plate', 'Cost'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                  {h}
                </th>
              ))}
              {isAdmin && (
                <th key="actions" style={{ width: 48, padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>{tableBody()}</tbody>
        </table>
        {initialCheckins.length === 0 && <div style={{ padding: 16 }}>No check-ins found.</div>}
      </div>

      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-checkin-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onClick={handleDeleteCancel}
        >
          <div
            className="card"
            style={{ minWidth: 320, maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-checkin-title" style={{ margin: '0 0 8px', fontSize: 18 }}>
              Delete check-in?
            </h2>
            <p style={{ margin: '0 0 16px', color: '#6b7280' }}>This action cannot be undone.</p>
            <dl style={{ margin: '0 0 20px', fontSize: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <dt style={{ fontWeight: 500 }}>Receipt #</dt>
                <dd style={{ margin: 0 }}>{pendingDelete.receipt_number}</dd>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <dt style={{ fontWeight: 500 }}>Date</dt>
                <dd style={{ margin: 0 }}>{pendingDelete.date}</dd>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <dt style={{ fontWeight: 500 }}>Time</dt>
                <dd style={{ margin: 0 }}>{pendingDelete.time}</dd>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <dt style={{ fontWeight: 500 }}>Room</dt>
                <dd style={{ margin: 0 }}>{pendingDelete.room_id}</dd>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <dt style={{ fontWeight: 500 }}>Cost</dt>
                <dd style={{ margin: 0 }}>${Number(pendingDelete.cost).toFixed(2)}</dd>
              </div>
            </dl>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={handleDeleteCancel} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
