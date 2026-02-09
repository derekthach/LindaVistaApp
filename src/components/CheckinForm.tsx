'use client';

import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { useRouter } from 'next/navigation';
import { LanguageProvider, LanguageToggle, useLanguage } from './LanguageToggle';

function CheckinFormContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const [receiptNumber, setReceiptNumber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    fetch('/api/next-receipt')
      .then((res) => res.json())
      .then((data) => setReceiptNumber(data.next_receipt_number || '0001'));

    const now = DateTime.now().setZone('America/Puerto_Rico');
    setDate(now.toISODate() || '');
    setTime(now.toFormat('HH:mm'));
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });
    sessionStorage.setItem('checkinData', JSON.stringify(data));
    router.push('/checkin/verify');
  };

  const staffMembers = [
    'Benjamin (Siky)',
    'Luis',
    'Tonito',
    'Tono',
    'Jose (Ivan)',
    'Makito',
    'Keith Thach',
    'Duyen Thach',
    'Derek Thach',
  ];

  const carColors = [
    'black',
    'white',
    'gray',
    'silver',
    'red',
    'blue',
    'brown',
    'green',
    'beige',
    'yellow',
  ];

  return (
    <div className="card">
      <LanguageToggle />
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <label>
            <div>{t('room_number')}</div>
            <select name="room_id" required>
              {Array.from({ length: 40 }, (_, i) => i + 1).map((room) => (
                <option key={room} value={room}>
                  Room {room}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div>{t('receipt_number')}</div>
            <input name="receipt_number" value={receiptNumber} readOnly />
          </label>

          <label>
            <div>{t('date')}</div>
            <input name="date" value={date} readOnly />
          </label>

          <label>
            <div>{t('time')}</div>
            <input name="time" value={time} readOnly />
          </label>

          <label>
            <div>{t('cost')}</div>
            <input name="cost" type="number" step="0.01" required />
          </label>

          <label>
            <div>{t('payment_method')}</div>
            <select name="payment_method" required>
              <option value="cash">{t('cash')}</option>
              <option value="ath_mobil">{t('ath_mobil')}</option>
            </select>
          </label>

          <label>
            <div>{t('car_plate')}</div>
            <input name="car_plate" required />
          </label>

          <label>
            <div>{t('car_make')}</div>
            <input name="car_make" required />
          </label>

          <label>
            <div>{t('car_color')}</div>
            <select name="car_color" required>
              {carColors.map((color) => (
                <option key={color} value={color}>
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div>{t('staff_name')}</div>
            <select name="staff_name" required>
              <option value="">Select staff member</option>
              {staffMembers.map((staff) => (
                <option key={staff} value={staff}>
                  {staff}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <div>{t('note')} (Optional)</div>
          <textarea name="note" rows={3} />
        </label>

        <button
          type="submit"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#166534',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('submit')}
        </button>
      </form>
    </div>
  );
}

export default function CheckinForm() {
  return (
    <LanguageProvider>
      <CheckinFormContent />
    </LanguageProvider>
  );
}
