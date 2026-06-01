'use client';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
};

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  danger = false,
}: Props) {
  return (
    <div className="quota-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="quota-modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quota-modal__header">
          <h2 id="confirm-modal-title" className="quota-modal__title">
            {title}
          </h2>
          <button type="button" className="icon-button close-button" aria-label={cancelLabel} onClick={onClose}>
            ✕
          </button>
        </div>
        <p id="confirm-modal-desc" className="quota-modal__text confirm-modal__text">
          {message}
        </p>
        <div className="quota-modal__actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-ghost danger' : 'btn-save'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
