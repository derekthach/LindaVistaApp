'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckIn, UserRole, LineItem, SummarizedItem } from '@/types';
import Button from '@/components/Button';
import {
  SECTION_LABELS,
  buildSectionedData,
  type SectionTotals,
} from '@/lib/checkins/sectioning';
import { getCarColorLabel } from '@/lib/checkins/colors';
import EditCheckinModal, { type EditCheckinDraft } from '@/components/checkins/EditCheckinModal';
import ConfirmDiffModal, { type DiffLine } from '@/components/checkins/ConfirmDiffModal';
import EditHistoryPanel from '@/components/checkins/EditHistoryPanel';
import { formatReceiptNumber } from '@/lib/checkins/receipt';
import { getPaymentMethodTranslationKey } from '@/lib/checkins/paymentMethods';
import { useLanguage, type TranslationKey } from '@/components/LanguageToggle';

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
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

function orDash(value: string | undefined): string {
  return value?.trim() ? value.trim() : '—';
}

function DetailsPanel({ checkin, t }: { checkin: CheckIn; t: (key: TranslationKey) => string }) {
  const isRoom = checkin.checkInType !== 'food' && checkin.checkInType !== 'beer';
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '6px 16px',
    alignItems: 'baseline',
    fontSize: 13,
  };
  const labelStyle = { color: '#6b7280', fontWeight: 500 };
  const valueStyle = { fontWeight: 500 };

  if (isRoom) {
    const paymentLabel = checkin.payment_method
      ? t(getPaymentMethodTranslationKey(checkin.payment_method))
      : '—';
    return (
      <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 8, margin: 4 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>Room check-in details</div>
        <dl style={{ margin: 0, ...gridStyle } as React.CSSProperties}>
          <dt style={labelStyle}>License Plate</dt>
          <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.car_plate)}</dd>
          <dt style={labelStyle}>Payment Method</dt>
          <dd style={{ margin: 0, ...valueStyle }}>{paymentLabel}</dd>
          <dt style={labelStyle}>Car Make</dt>
          <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.car_make)}</dd>
          <dt style={labelStyle}>Car Color</dt>
          <dd style={{ margin: 0, ...valueStyle }}>{checkin.car_color ? getCarColorLabel(checkin.car_color) : '—'}</dd>
          <dt style={labelStyle}>Notes</dt>
          <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.note)}</dd>
        </dl>
      </div>
    );
  }

  const items = (checkin.summarizedItems ?? checkin.lineItems ?? []) as SummarizedItem[] | LineItem[];
  const itemsSummary =
    items.length > 0
      ? items
          .map((item: SummarizedItem | LineItem) => {
            const label = 'itemLabel' in item ? item.itemLabel : (item as LineItem).itemLabel;
            const q = 'totalQuantitySold' in item ? (item as SummarizedItem).totalQuantitySold : (item as LineItem).quantitySold;
            const a = 'totalAmountCollected' in item ? (item as SummarizedItem).totalAmountCollected : (item as LineItem).amountCollected;
            return `${label ?? item.itemId}: ${q} × $${Number(a).toFixed(2)}`;
          })
          .join('; ')
      : '—';

  return (
    <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 8, margin: 4 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
        {checkin.checkInType === 'food' ? 'Food & Beverage' : 'Beer'} details
      </div>
      <dl style={{ margin: 0, ...gridStyle } as React.CSSProperties}>
        <dt style={labelStyle}>Staff</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.staff_name)}</dd>
        <dt style={labelStyle}>Items</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{itemsSummary}</dd>
        <dt style={labelStyle}>Total</dt>
        <dd style={{ margin: 0, ...valueStyle }}>${Number(checkin.cost).toFixed(2)}</dd>
        <dt style={labelStyle}>Notes</dt>
        <dd style={{ margin: 0, ...valueStyle }}>{orDash(checkin.note)}</dd>
      </dl>
    </div>
  );
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
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? '');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCheckin, setEditingCheckin] = useState<CheckIn | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{ checkin: CheckIn; draft: EditCheckinDraft } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CheckIn | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAdmin = role === 'admin';
  const colCount = 8;
  const colCountForTotal = colCount - 1;
  const toggleExpanded = (checkin: CheckIn) => {
    const id = checkin.id ?? checkin.receipt_number;
    setExpandedId((prev) => (prev === id ? null : id));
  };

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

  function getFirstItemLabel(c: CheckIn): string {
    const line = c.lineItems?.[0];
    if (line?.itemLabel) return line.itemLabel;
    const sum = c.summarizedItems?.[0];
    if (sum?.itemLabel) return sum.itemLabel;
    return '';
  }
  function getFirstQuantity(c: CheckIn): number {
    const line = c.lineItems?.[0];
    if (line != null && typeof line.quantitySold === 'number') return line.quantitySold;
    const sum = c.summarizedItems?.[0];
    if (sum != null && typeof sum.totalQuantitySold === 'number') return sum.totalQuantitySold;
    return 1;
  }
  function getFirstAmountCollected(c: CheckIn): number {
    const line = c.lineItems?.[0];
    if (line != null && typeof line.amountCollected === 'number') return line.amountCollected;
    const sum = c.summarizedItems?.[0];
    if (sum != null && typeof sum.totalAmountCollected === 'number') return sum.totalAmountCollected;
    return Number(c.cost) || 0;
  }

  function buildDiffLines(checkin: CheckIn, draft: EditCheckinDraft): DiffLine[] {
    const lines: DiffLine[] = [];
    const receiptFrom = formatReceiptNumber(checkin.receipt_number ?? '');
    if (draft.receipt_number !== receiptFrom) {
      lines.push({ label: 'Receipt #', from: receiptFrom, to: draft.receipt_number });
    }
    if (draft.staff_name !== (checkin.staff_name ?? '')) {
      lines.push({ label: 'Staff', from: checkin.staff_name ?? '', to: draft.staff_name });
    }
    const isRoom = checkin.checkInType !== 'food' && checkin.checkInType !== 'beer';
    if (isRoom) {
      if (draft.cost != null && Number(draft.cost) !== Number(checkin.cost)) {
        lines.push({
          label: 'Cost',
          from: `$${Number(checkin.cost).toFixed(2)}`,
          to: `$${Number(draft.cost).toFixed(2)}`,
        });
      }
      if (draft.room_id != null && draft.room_id !== (checkin.room_id ?? 0)) {
        lines.push({ label: 'Room', from: String(checkin.room_id ?? ''), to: String(draft.room_id) });
      }
    } else {
      const fromLabel = getFirstItemLabel(checkin);
      if (draft.itemLabel != null && draft.itemLabel !== fromLabel) {
        lines.push({ label: 'Item', from: fromLabel || '(empty)', to: draft.itemLabel });
      }
      if (draft.quantity != null && draft.quantity !== getFirstQuantity(checkin)) {
        lines.push({ label: 'Quantity', from: String(getFirstQuantity(checkin)), to: String(draft.quantity) });
      }
      if (draft.amountCollected != null && Number(draft.amountCollected) !== getFirstAmountCollected(checkin)) {
        lines.push({
          label: 'Amount Collected',
          from: `$${getFirstAmountCollected(checkin).toFixed(2)}`,
          to: `$${Number(draft.amountCollected).toFixed(2)}`,
        });
      }
    }
    return lines;
  }

  const handleEditSave = (draft: EditCheckinDraft) => {
    if (!editingCheckin) return;
    const diffLines = buildDiffLines(editingCheckin, draft);
    if (diffLines.length === 0) return;
    setPendingUpdate({ checkin: editingCheckin, draft });
    setEditingCheckin(null);
  };

  const handleConfirmUpdate = async () => {
    if (!pendingUpdate?.checkin.id) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/checkins/${pendingUpdate.checkin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          pendingUpdate.checkin.checkInType === 'room'
            ? {
                receipt_number: pendingUpdate.draft.receipt_number,
                staff_name: pendingUpdate.draft.staff_name,
                cost: pendingUpdate.draft.cost,
                room_id: pendingUpdate.draft.room_id,
              }
            : {
                receipt_number: pendingUpdate.draft.receipt_number,
                staff_name: pendingUpdate.draft.staff_name,
                itemId: pendingUpdate.draft.itemId,
                itemLabel: pendingUpdate.draft.itemLabel,
                quantity: pendingUpdate.draft.quantity,
                amountCollected: pendingUpdate.draft.amountCollected,
              }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : 'Update failed';
        throw new Error(msg);
      }
      setPendingUpdate(null);
      setEditingCheckin(null);
      setSuccessMessage('Record updated.');
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsUpdating(false);
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
    const rowId = checkin.id ?? checkin.receipt_number;
    const isExpanded = expandedId === rowId;
    return (
      <td style={{ padding: 8, width: 112, textAlign: 'right', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => toggleExpanded(checkin)}
            className="btn btn-ghost"
            style={{ minWidth: 32, height: 32, padding: 0 }}
            aria-label={isExpanded ? 'Hide details' : 'View details'}
            title={isExpanded ? 'Hide details' : 'View details'}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
          {isAdmin && checkin.id && (
            <>
              <button
                type="button"
                onClick={() => setEditingCheckin(checkin)}
                className="btn btn-ghost"
                style={{ minWidth: 32, height: 32, padding: 0 }}
                aria-label="Edit check-in"
                title="Edit check-in"
              >
                <EditIcon />
              </button>
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
            </>
          )}
        </div>
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
                <Fragment key={checkin.id ?? checkin.receipt_number}>
                  <tr>
                    <td style={{ padding: 8 }}>{formatReceiptNumber(checkin.receipt_number ?? '')}</td>
                    <td style={{ padding: 8 }}>{checkin.date}</td>
                    <td style={{ padding: 8 }}>{checkin.time}</td>
                    <td style={{ padding: 8 }}>{checkin.checkInType ?? 'room'}</td>
                    <td style={{ padding: 8 }}>{roomDisplay(checkin)}</td>
                    <td style={{ padding: 8 }}>{checkin.staff_name}</td>
                    <td style={{ padding: 8 }}>${Number(checkin.cost).toFixed(2)}</td>
                    {renderActionsCell(checkin)}
                  </tr>
                  {expandedId === (checkin.id ?? checkin.receipt_number) && (
                    <tr>
                      <td colSpan={colCount} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                        <div className="checkin-expanded-grid">
                          <div style={{ minWidth: 0 }}>
                            <DetailsPanel checkin={checkin} t={t} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <EditHistoryPanel checkinId={checkin.id ?? ''} checkin={checkin} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
      <Fragment key={checkin.id ?? checkin.receipt_number}>
        <tr>
          <td style={{ padding: 8 }}>{formatReceiptNumber(checkin.receipt_number ?? '')}</td>
          <td style={{ padding: 8 }}>{checkin.date}</td>
          <td style={{ padding: 8 }}>{checkin.time}</td>
          <td style={{ padding: 8 }}>{checkin.checkInType ?? 'room'}</td>
          <td style={{ padding: 8 }}>{roomDisplay(checkin)}</td>
          <td style={{ padding: 8 }}>{checkin.staff_name}</td>
          <td style={{ padding: 8 }}>${Number(checkin.cost).toFixed(2)}</td>
          {renderActionsCell(checkin)}
        </tr>
        {expandedId === (checkin.id ?? checkin.receipt_number) && (
          <tr>
            <td colSpan={colCount} style={{ padding: 0, borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
              <div className="checkin-expanded-grid">
                <div style={{ minWidth: 0 }}>
                  <DetailsPanel checkin={checkin} t={t} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <EditHistoryPanel checkinId={checkin.id ?? ''} checkin={checkin} />
                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
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
              {['Receipt #', 'Date', 'Time', 'Type', 'Room', 'Staff', 'Cost'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                  {h}
                </th>
              ))}
              <th key="actions" style={{ width: 112, padding: 8, borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>{tableBody()}</tbody>
        </table>
        {initialCheckins.length === 0 && <div style={{ padding: 16 }}>No check-ins found.</div>}
      </div>

      <EditCheckinModal
        open={!!editingCheckin}
        onOpenChange={(open) => !open && setEditingCheckin(null)}
        checkin={editingCheckin}
        onSave={handleEditSave}
        saveDisabled={isUpdating}
      />
      <ConfirmDiffModal
        open={!!pendingUpdate}
        onOpenChange={(open) => !open && setPendingUpdate(null)}
        diffLines={pendingUpdate ? buildDiffLines(pendingUpdate.checkin, pendingUpdate.draft) : []}
        onConfirm={handleConfirmUpdate}
        isSubmitting={isUpdating}
      />
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
                <dd style={{ margin: 0 }}>{formatReceiptNumber(pendingDelete.receipt_number ?? '')}</dd>
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
