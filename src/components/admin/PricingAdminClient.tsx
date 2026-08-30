'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveFoodPricingAction } from '@/app/actions/foodPricingAdmin';
import { saveRoomPricingAction } from '@/app/actions/roomPricingAdmin';
import {
  foodPricingDisplayLabel,
  PRICING_FOOD_ITEM_IDS,
} from '@/lib/pricing/defaultFoodPrices';
import {
  applyFoodItemPriceDraft,
  hasPendingFoodChanges,
  listPendingFoodChanges,
  type FoodPriceMap,
} from '@/lib/pricing/foodPricing';
import { useTranslation } from '@/lib/i18n/useTranslation';
import {
  applyGroupPriceDraft,
  applyRoomPriceDraft,
  centsToDollars,
  formatPriceCents,
  groupRoomsByPrice,
  hasPendingChanges,
  listPendingChanges,
  mergeEffectivePrices,
  parsePriceInput,
  type RoomPriceMap,
} from '@/lib/pricing/roomPricing';

type ActiveCategory = 'rooms' | 'food';

type ModalKind =
  | { type: 'group'; fromCents: number }
  | { type: 'room'; roomId: string; fromCents: number }
  | { type: 'food_item'; itemId: string; fromCents: number }
  | { type: 'review'; scope: ActiveCategory }
  | { type: 'beer' }
  | null;

export default function PricingAdminClient({
  initialRoomPrices,
  initialFoodPrices,
}: {
  initialRoomPrices: RoomPriceMap;
  initialFoodPrices: FoodPriceMap;
}) {
  const { t, language } = useTranslation();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('rooms');

  const [roomPersisted, setRoomPersisted] = useState<RoomPriceMap>(initialRoomPrices);
  const [roomDraft, setRoomDraft] = useState<RoomPriceMap>({});

  const [foodPersisted, setFoodPersisted] = useState<FoodPriceMap>(initialFoodPrices);
  const [foodDraft, setFoodDraft] = useState<FoodPriceMap>({});

  const [modal, setModal] = useState<ModalKind>(null);
  const [priceInput, setPriceInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRoomPersisted(initialRoomPrices);
  }, [initialRoomPrices]);

  useEffect(() => {
    setFoodPersisted(initialFoodPrices);
  }, [initialFoodPrices]);

  const roomEffective = useMemo(
    () => mergeEffectivePrices(roomPersisted, roomDraft),
    [roomPersisted, roomDraft]
  );
  const roomGroups = useMemo(() => groupRoomsByPrice(roomEffective), [roomEffective]);
  const roomPending = useMemo(
    () => listPendingChanges(roomPersisted, roomDraft),
    [roomPersisted, roomDraft]
  );
  const roomCanSave = hasPendingChanges(roomPersisted, roomDraft);

  const foodEffective = useMemo(
    () => mergeEffectivePrices(foodPersisted, foodDraft),
    [foodPersisted, foodDraft]
  );
  const foodPending = useMemo(
    () => listPendingFoodChanges(foodPersisted, foodDraft),
    [foodPersisted, foodDraft]
  );
  const foodCanSave = hasPendingFoodChanges(foodPersisted, foodDraft);

  const canSave = activeCategory === 'rooms' ? roomCanSave : foodCanSave;
  const pendingCount =
    activeCategory === 'rooms' ? roomPending.length : foodPending.length;

  function selectCategory(next: ActiveCategory) {
    setActiveCategory(next);
    setSuccessMessage(null);
    setSaveError(null);
  }

  function openBeerPlaceholder() {
    setSaveError(null);
    setModal({ type: 'beer' });
  }

  function openGroupModal(fromCents: number) {
    setSuccessMessage(null);
    setSaveError(null);
    setInputError(null);
    setPriceInput(centsToDollars(fromCents).toFixed(2));
    setModal({ type: 'group', fromCents });
  }

  function openRoomModal(roomId: string, fromCents: number) {
    setSuccessMessage(null);
    setSaveError(null);
    setInputError(null);
    setPriceInput(centsToDollars(fromCents).toFixed(2));
    setModal({ type: 'room', roomId, fromCents });
  }

  function openFoodItemModal(itemId: string, fromCents: number) {
    setSuccessMessage(null);
    setSaveError(null);
    setInputError(null);
    setPriceInput(centsToDollars(fromCents).toFixed(2));
    setModal({ type: 'food_item', itemId, fromCents });
  }

  function closeEditModal() {
    setModal(null);
    setInputError(null);
  }

  function applyEditModal() {
    if (!modal || modal.type === 'review' || modal.type === 'beer') return;
    const parsed = parsePriceInput(priceInput);
    if (!parsed.ok) {
      const reasonKey =
        parsed.reason === 'blank'
          ? 'pricing_error_blank'
          : parsed.reason === 'not_positive'
            ? 'pricing_error_not_positive'
            : parsed.reason === 'too_many_decimals'
              ? 'pricing_error_decimals'
              : 'pricing_error_not_numeric';
      setInputError(t(reasonKey));
      return;
    }
    if (modal.type === 'group') {
      setRoomDraft((d) =>
        applyGroupPriceDraft(roomPersisted, d, modal.fromCents, parsed.cents)
      );
    } else if (modal.type === 'room') {
      setRoomDraft((d) =>
        applyRoomPriceDraft(roomPersisted, d, modal.roomId, parsed.cents)
      );
    } else {
      setFoodDraft((d) =>
        applyFoodItemPriceDraft(foodPersisted, d, modal.itemId, parsed.cents)
      );
    }
    setModal(null);
    setInputError(null);
  }

  function openReview() {
    if (!canSave) return;
    setSaveError(null);
    setSuccessMessage(null);
    setModal({ type: 'review', scope: activeCategory });
  }

  async function confirmSave() {
    if (!modal || modal.type !== 'review' || saving) return;
    const scope = modal.scope;
    const scopeCanSave = scope === 'rooms' ? roomCanSave : foodCanSave;
    if (!scopeCanSave) return;

    setSaving(true);
    setSaveError(null);
    try {
      if (scope === 'rooms') {
        const result = await saveRoomPricingAction(
          roomPending.map((c) => ({ roomId: c.roomId, priceCents: c.toCents }))
        );
        if (!result.ok) {
          setSaveError(result.error);
          setSaving(false);
          return;
        }
        const next: RoomPriceMap = { ...roomPersisted };
        for (const c of roomPending) next[c.roomId] = c.toCents;
        setRoomPersisted(next);
        setRoomDraft({});
        setSuccessMessage(t('pricing_success'));
      } else {
        const result = await saveFoodPricingAction(
          foodPending.map((c) => ({ itemId: c.itemId, priceCents: c.toCents }))
        );
        if (!result.ok) {
          setSaveError(result.error);
          setSaving(false);
          return;
        }
        const next: FoodPriceMap = { ...foodPersisted };
        for (const c of foodPending) next[c.itemId] = c.toCents;
        setFoodPersisted(next);
        setFoodDraft({});
        setSuccessMessage(t('pricing_food_success'));
      }
      setModal(null);
      router.refresh();
    } catch {
      setSaveError(t('pricing_error_save_failed'));
    } finally {
      setSaving(false);
    }
  }

  const roomWord = t('pricing_room_word');
  const lang = language === 'es' ? 'es' : 'en';

  return (
    <div className="pricing-page">
      <div className="pricing-category-tabs" role="tablist" aria-label={t('pricing_categories_aria')}>
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'rooms'}
          className={`pricing-category-tab${activeCategory === 'rooms' ? ' pricing-category-tab--active' : ''}`}
          onClick={() => selectCategory('rooms')}
        >
          {t('pricing_tab_rooms')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'food'}
          className={`pricing-category-tab${activeCategory === 'food' ? ' pricing-category-tab--active' : ''}`}
          onClick={() => selectCategory('food')}
        >
          {t('pricing_tab_food')}
        </button>
        <button
          type="button"
          className="pricing-category-tab"
          onClick={openBeerPlaceholder}
        >
          {t('pricing_tab_beer')}
        </button>
      </div>

      {activeCategory === 'rooms' ? (
        <section className="pricing-category" aria-labelledby="pricing-room-heading">
          <div className="pricing-category-header">
            <h2 id="pricing-room-heading" className="pricing-category-title">
              {t('pricing_room_section')}
            </h2>
            <button
              type="button"
              className="btn btn-primary pricing-save-btn"
              disabled={!roomCanSave || saving}
              onClick={openReview}
            >
              {t('pricing_save_changes')}
            </button>
          </div>

          {successMessage && activeCategory === 'rooms' ? (
            <div className="pricing-banner pricing-banner--success" role="status">
              {successMessage}
            </div>
          ) : null}
          {saveError && modal?.type !== 'review' ? (
            <div className="pricing-banner pricing-banner--error" role="alert">
              {saveError}
            </div>
          ) : null}
          {roomCanSave ? (
            <p className="pricing-pending-hint">
              {t('pricing_pending_hint', { count: pendingCount })}
            </p>
          ) : null}

          <div className="pricing-groups">
            {roomGroups.map((group) => {
              const hasDraftInGroup = group.roomIds.some(
                (id) => roomDraft[id] !== undefined && roomDraft[id] !== roomPersisted[id]
              );
              return (
                <article
                  key={group.priceCents}
                  className={`pricing-group card${hasDraftInGroup ? ' pricing-group--pending' : ''}`}
                >
                  <div className="pricing-group-top">
                    <h3 className="pricing-group-price">
                      {formatPriceCents(group.priceCents)}
                    </h3>
                    <button
                      type="button"
                      className="btn btn-secondary pricing-group-change-btn"
                      onClick={() => openGroupModal(group.priceCents)}
                    >
                      {t('pricing_change_group')}
                    </button>
                  </div>
                  <p className="pricing-group-rooms-label">
                    {group.roomIds.length === 1
                      ? t('pricing_room_singular')
                      : t('pricing_rooms_plural')}
                  </p>
                  <ul className="pricing-room-list">
                    {group.roomIds.map((roomId) => {
                      const isPending =
                        roomDraft[roomId] !== undefined &&
                        roomDraft[roomId] !== roomPersisted[roomId];
                      return (
                        <li key={roomId} className="pricing-room-row">
                          <span className="pricing-room-label">
                            {roomWord} {roomId}
                            {isPending ? (
                              <span
                                className="pricing-pending-dot"
                                title={t('pricing_pending_room')}
                              />
                            ) : null}
                          </span>
                          <span className="pricing-room-amount">
                            {formatPriceCents(roomEffective[roomId] ?? group.priceCents)}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost pricing-room-edit-btn"
                            onClick={() =>
                              openRoomModal(
                                roomId,
                                roomEffective[roomId] ?? group.priceCents
                              )
                            }
                            aria-label={t('pricing_edit_room_aria', { room: roomId })}
                          >
                            {t('pricing_edit')}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeCategory === 'food' ? (
        <section className="pricing-category" aria-labelledby="pricing-food-heading">
          <div className="pricing-category-header">
            <h2 id="pricing-food-heading" className="pricing-category-title">
              {t('pricing_food_section')}
            </h2>
            <button
              type="button"
              className="btn btn-primary pricing-save-btn"
              disabled={!foodCanSave || saving}
              onClick={openReview}
            >
              {t('pricing_save_changes')}
            </button>
          </div>

          {successMessage && activeCategory === 'food' ? (
            <div className="pricing-banner pricing-banner--success" role="status">
              {successMessage}
            </div>
          ) : null}
          {saveError && modal?.type !== 'review' ? (
            <div className="pricing-banner pricing-banner--error" role="alert">
              {saveError}
            </div>
          ) : null}
          {foodCanSave ? (
            <p className="pricing-pending-hint">
              {t('pricing_food_pending_hint', { count: pendingCount })}
            </p>
          ) : null}

          <div className="pricing-item-table card">
            <div className="pricing-item-table-head" aria-hidden>
              <span>{t('pricing_col_item')}</span>
              <span>{t('pricing_col_price')}</span>
              <span>{t('pricing_col_action')}</span>
            </div>
            <ul className="pricing-item-list">
              {PRICING_FOOD_ITEM_IDS.map((itemId) => {
                const cents = foodEffective[itemId];
                const isPending =
                  foodDraft[itemId] !== undefined &&
                  foodDraft[itemId] !== foodPersisted[itemId];
                const label = foodPricingDisplayLabel(itemId, lang);
                return (
                  <li
                    key={itemId}
                    className={`pricing-item-row${isPending ? ' pricing-item-row--pending' : ''}`}
                  >
                    <span className="pricing-item-label">
                      {label}
                      {isPending ? (
                        <span
                          className="pricing-pending-dot"
                          title={t('pricing_pending_room')}
                        />
                      ) : null}
                    </span>
                    <span className="pricing-item-amount">
                      {typeof cents === 'number' ? formatPriceCents(cents) : '—'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost pricing-room-edit-btn"
                      onClick={() =>
                        openFoodItemModal(itemId, cents ?? foodPersisted[itemId] ?? 0)
                      }
                      aria-label={t('pricing_edit_item_aria', { item: label })}
                    >
                      {t('pricing_edit')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {modal &&
      (modal.type === 'group' || modal.type === 'room' || modal.type === 'food_item') ? (
        <div
          className="pricing-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
        >
          <div
            className="pricing-modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-edit-title"
          >
            <h2 id="pricing-edit-title" className="pricing-modal-title">
              {modal.type === 'group'
                ? t('pricing_change_group_title')
                : modal.type === 'room'
                  ? t('pricing_edit_room_title', { room: modal.roomId })
                  : t('pricing_edit_item_title', {
                      item: foodPricingDisplayLabel(modal.itemId, lang),
                    })}
            </h2>
            <p className="pricing-modal-current">
              {t('pricing_current_price')}: {formatPriceCents(modal.fromCents)}
            </p>
            <label className="pricing-field">
              <span>{t('pricing_new_price')}</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  setInputError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyEditModal();
                  }
                }}
                aria-invalid={inputError ? true : undefined}
              />
            </label>
            {inputError ? (
              <p className="pricing-field-error" role="alert">
                {inputError}
              </p>
            ) : null}
            <div className="pricing-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
                {t('pricing_cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={applyEditModal}>
                {t('pricing_apply')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal?.type === 'review' ? (
        <div
          className="pricing-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setModal(null);
          }}
        >
          <div
            className="pricing-modal card pricing-modal--review"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-review-title"
          >
            <h2 id="pricing-review-title" className="pricing-modal-title">
              {t('pricing_review_title')}
            </h2>
            <ul className="pricing-review-list">
              {modal.scope === 'rooms'
                ? roomPending.map((change) => (
                    <li key={change.roomId} className="pricing-review-row">
                      <span className="pricing-review-room">
                        {roomWord} {change.roomId}
                      </span>
                      <span className="pricing-review-change">
                        <span>{formatPriceCents(change.fromCents)}</span>
                        <span className="pricing-review-arrow" aria-hidden>
                          →
                        </span>
                        <span className="pricing-review-new">
                          {formatPriceCents(change.toCents)}
                        </span>
                      </span>
                    </li>
                  ))
                : foodPending.map((change) => (
                    <li key={change.itemId} className="pricing-review-row">
                      <span className="pricing-review-room">
                        {foodPricingDisplayLabel(change.itemId, lang)}
                      </span>
                      <span className="pricing-review-change">
                        <span>{formatPriceCents(change.fromCents)}</span>
                        <span className="pricing-review-arrow" aria-hidden>
                          →
                        </span>
                        <span className="pricing-review-new">
                          {formatPriceCents(change.toCents)}
                        </span>
                      </span>
                    </li>
                  ))}
            </ul>
            {saveError ? (
              <p className="pricing-field-error" role="alert">
                {saveError}
              </p>
            ) : null}
            <div className="pricing-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => setModal(null)}
              >
                {t('pricing_cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => void confirmSave()}
              >
                {saving ? t('pricing_saving') : t('pricing_confirm_save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal?.type === 'beer' ? (
        <div
          className="pricing-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className="pricing-modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-beer-title"
          >
            <h2 id="pricing-beer-title" className="pricing-modal-title">
              {t('pricing_tab_beer')}
            </h2>
            <p className="pricing-beer-message">{t('pricing_beer_building')}</p>
            <div className="pricing-modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModal(null)}
              >
                {t('pricing_close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
