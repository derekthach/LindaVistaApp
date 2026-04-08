'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { submitCheckinAction } from '@/app/actions/checkin';
import { getCarColorLabel } from '@/lib/checkins/colors';
import { useLanguage } from '@/components/LanguageToggle';
import {
  calculatePaymentSplitTotal,
  formatPaymentBreakdownLines,
  validatePaymentSplits,
} from '@/lib/checkins/roomPaymentSplits';
import { isValidRoomSubmissionKey } from '@/lib/checkins/roomSubmissionKey';

export default function VerifyCheckinForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [formData, setFormData] = useState<Record<string, string> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    const data = sessionStorage.getItem('checkinData');
    if (!data) {
      router.push('/checkins/new');
      return;
    }
    const parsed = JSON.parse(data) as Record<string, string>;
    if (!parsed.payment_splits) {
      router.push('/checkins/new');
      return;
    }
    if (!isValidRoomSubmissionKey(parsed.submission_key)) {
      router.push('/checkins/new/room');
      return;
    }
    setFormData(parsed);
  }, [router]);

  const handleConfirm = async () => {
    if (!formData || submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const fd = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        fd.append(key, value);
      });
      const result = await submitCheckinAction(fd);
      if (result && !result.success) {
        setSubmitError(result.error ?? 'Something went wrong. Please try again.');
        return;
      }
      sessionStorage.removeItem('checkinData');
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'digest' in err &&
        typeof (err as { digest?: string }).digest === 'string' &&
        (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
      ) {
        sessionStorage.removeItem('checkinData');
        return;
      }
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!formData) {
    return <div>Loading...</div>;
  }

  const splitResult = validatePaymentSplits(formData.payment_splits);
  const paymentLines =
    splitResult.valid && splitResult.splits
      ? formatPaymentBreakdownLines(splitResult.splits)
      : [];
  const totalCollected =
    splitResult.valid && splitResult.splits
      ? calculatePaymentSplitTotal(splitResult.splits)
      : null;

  const fields = [
    { label: 'Room Number', value: `Room ${formData.room_id}` },
    { label: 'Receipt Number', value: formData.receipt_number },
    { label: 'Date', value: formData.date },
    { label: 'Time', value: formData.time },
    { label: 'License Plate', value: formData.car_plate },
    { label: 'Car Make', value: formData.car_make },
    { label: 'Car Color', value: getCarColorLabel(formData.car_color) || formData.car_color },
    { label: 'Staff Name', value: formData.staff_name },
    { label: 'Note', value: formData.note || 'N/A' },
  ];

  const disableActions = isSubmitting;

  return (
    <div className="card">
      {submitError && (
        <div style={{ padding: 12, marginBottom: 16, background: '#fef2f2', color: '#dc2626', borderRadius: 8 }}>
          {submitError}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleConfirm();
        }}
        style={{ display: 'grid', gap: 0 }}
      >
        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          {fields.map((field) => (
            <div key={field.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{field.label}:</strong>
              <span>{field.value}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
            <strong>{t('payment_breakdown')}</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {paymentLines.map((line, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {line}
                </li>
              ))}
            </ul>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              <span>{t('total_collected')}</span>
              <span>{totalCollected != null ? `$${totalCollected.toFixed(2)}` : '—'}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={disableActions}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              opacity: disableActions ? 0.6 : 1,
              cursor: disableActions ? 'not-allowed' : 'pointer',
            }}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={disableActions}
            aria-busy={isSubmitting}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: disableActions ? '#9ca3af' : '#166534',
              color: '#fff',
              fontWeight: 600,
              cursor: disableActions ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  );
}
