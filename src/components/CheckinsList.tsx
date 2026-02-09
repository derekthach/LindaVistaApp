'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckIn } from '@/types';

export default function CheckinsList({ initialCheckins }: { initialCheckins: CheckIn[] }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    router.push(`/checkins?${params.toString()}`);
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    window.location.href = `/export?${params.toString()}`;
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <strong>Filter by Date Range</strong>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label>
            <div>Start Date</div>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            <div>End Date</div>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <button type="button" onClick={handleFilter} style={{ alignSelf: 'end' }}>
            Filter
          </button>
          <button type="button" onClick={handleExport} style={{ alignSelf: 'end' }}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Receipt #', 'Date', 'Time', 'Room', 'Staff', 'Plate', 'Cost'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initialCheckins.map((checkin) => (
              <tr key={checkin.receipt_number}>
                <td style={{ padding: 8 }}>{checkin.receipt_number}</td>
                <td style={{ padding: 8 }}>{checkin.date}</td>
                <td style={{ padding: 8 }}>{checkin.time}</td>
                <td style={{ padding: 8 }}>{checkin.room_id}</td>
                <td style={{ padding: 8 }}>{checkin.staff_name}</td>
                <td style={{ padding: 8 }}>{checkin.car_plate}</td>
                <td style={{ padding: 8 }}>${checkin.cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {initialCheckins.length === 0 && <div style={{ padding: 16 }}>No check-ins found.</div>}
      </div>
    </div>
  );
}
