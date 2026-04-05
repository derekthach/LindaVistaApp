'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckIn } from '@/types';
import { formatRoomDisplay } from '@/lib/checkins/rooms';
import RoomCheckoutModal from '@/components/checkins/RoomCheckoutModal';

export default function CheckoutRoomsSection({
  checkoutVariant = 'admin',
  employeeCleanerName,
}: {
  checkoutVariant?: 'admin' | 'employee';
  employeeCleanerName?: string;
} = {}) {
  const router = useRouter();
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CheckIn | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/checkins/active-occupied', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load');
      setCheckins(Array.isArray(data.checkins) ? data.checkins : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setCheckins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openModal = (c: CheckIn) => {
    setSelected(c);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    void load();
    router.refresh();
  };

  return (
    <>
      <section style={{ marginTop: 32 }}>
        <h2 className="page-title" style={{ fontSize: 22, marginBottom: 4 }}>
          Checkout Rooms
        </h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
          Rooms currently occupied or awaiting turnover
        </p>

        {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        {!loading && !error && checkins.length === 0 && (
          <p style={{ color: '#6b7280', padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            No rooms are currently checked in.
          </p>
        )}
        {!loading && checkins.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            {checkins.map((c) => (
              <button
                key={c.id ?? c.receipt_number}
                type="button"
                onClick={() => openModal(c)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  textAlign: 'center',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    color: '#374151',
                  }}
                >
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fill="currentColor"
                      d="M12 3L2 12h3v8a1 1 0 001 1h6v-6h2v6h6a1 1 0 001-1v-8h3L12 3z"
                    />
                  </svg>
                </span>
                <span style={{ fontWeight: 700, fontSize: 18 }}>{formatRoomDisplay(c.room_id)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <RoomCheckoutModal
        open={modalOpen}
        checkin={selected}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        onSuccess={handleSuccess}
        variant={checkoutVariant}
        employeeCleanerName={employeeCleanerName}
      />
    </>
  );
}
