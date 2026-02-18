'use client';

import Button from '@/components/Button';

export interface DiffLine {
  label: string;
  from: string;
  to: string;
}

interface ConfirmDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diffLines: DiffLine[];
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export default function ConfirmDiffModal({
  open,
  onOpenChange,
  diffLines,
  onConfirm,
  isSubmitting = false,
}: ConfirmDiffModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-diff-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={() => !isSubmitting && onOpenChange(false)}
    >
      <div
        className="card"
        style={{ minWidth: 360, maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-diff-title" style={{ margin: '0 0 12px', fontSize: 18 }}>
          Confirm changes
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#6b7280' }}>
          The following fields will be updated:
        </p>
        <ul style={{ margin: '0 0 20px', paddingLeft: 20 }}>
          {diffLines.map((line, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              <strong>{line.label}:</strong> {line.from} → {line.to}
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Confirm Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
