'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckIn, UserRole } from '@/types';
import Button from '@/components/Button';
import {
  SECTION_LABELS,
  buildSectionedData,
  type SectionTotals,
} from '@/lib/checkins/sectioning';

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function centsToCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(
    cents / 100
  );
}

function renderTotalsBreakdown(totals: SectionTotals) {
  const carCount = totals.carCount ?? 0;
  return (
    <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
      Cars: {carCount} | Room: {centsToCurrency(totals.roomCents)} | Food: {centsToCurrency(totals.foodCents)} | Beer: {centsToCurrency(totals.beerCents)} | <strong>Total: {centsToCurrency(totals.totalCents)}</strong>
    </span>
  );
}

export type { SectionTotals } from '@/lib/checkins/sectioning';

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
    return buildSectionedData(initialCheckins);
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
