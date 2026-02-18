'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitCheckinAction } from '@/app/actions/checkin';
import { getCarColorLabel } from '@/lib/checkins/colors';

export default function VerifyCheckinForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, string> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const data = sessionStorage.getItem('checkinData');
    if (!data) {
      router.push('/checkins/new');
      return;
    }
    setFormData(JSON.parse(data));
  }, [router]);

  const handleConfirm = async () => {
    if (!formData) return;
    setSubmitError(null);
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
  };

  if (!formData) {
    return <div>Loading...</div>;
  }

  const fields = [
    { label: 'Room Number', value: `Room ${formData.room_id}` },
    { label: 'Receipt Number', value: formData.receipt_number },
    { label: 'Date', value: formData.date },
    { label: 'Time', value: formData.time },
    { label: 'Cost', value: `$${formData.cost}` },
    { label: 'Payment Method', value: formData.payment_method === 'cash' ? 'Cash' : 'ATH Móvil' },
    { label: 'License Plate', value: formData.car_plate },
    { label: 'Car Make', value: formData.car_make },
    { label: 'Car Color', value: getCarColorLabel(formData.car_color) || formData.car_color },
    { label: 'Staff Name', value: formData.staff_name },
    { label: 'Note', value: formData.note || 'N/A' },
  ];

  return (
    <div className="card">
      {submitError && (
        <div style={{ padding: 12, marginBottom: 16, background: '#fef2f2', color: '#dc2626', borderRadius: 8 }}>
          {submitError}
        </div>
      )}
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {fields.map((field) => (
          <div key={field.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{field.label}:</strong>
            <span>{field.value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#166534',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
