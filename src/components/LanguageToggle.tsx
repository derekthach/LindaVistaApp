'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Language = 'en' | 'es';

const translations = {
  en: {
    room_number: 'Room Number',
    receipt_number: 'Receipt Number',
    date: 'Date',
    time: 'Time',
    cost: 'Cost',
    payment_method: 'Payment Method',
    cash: 'CASH',
    ath_mobil: 'ATH Móvil',
    venmo: 'Venmo',
    paypal: 'PayPal',
    cash_app: 'Cash App',
    car_plate: 'License Plate',
    car_make: 'Car Make',
    car_color: 'Car Color',
    staff_name: 'Staff Name',
    staff_select_placeholder: 'Select staff member',
    note: 'Note',
    submit: 'Check In',
    verify: 'Verify Check-In',
    confirm: 'Confirm',
    back: 'Back',
    english: 'English',
    spanish: 'Español',
    new_checkin: 'New Check-In',
    choose_type: 'Choose what you are registering',
    room_checkin_title: 'Room Check-In',
    food_checkin_title: 'Food & Beverage Check-In',
    beer_checkin_title: 'Beer Check-In',
    food_and_beverage: 'Food & Beverage',
    beer: 'Beer',
    room: 'Room',
    items: 'Items',
    item: 'Item',
    quantity_sold: 'Quantity Sold',
    amount_collected: 'Amount Collected',
    add_another_item: 'Add Another Item',
    notes: 'Notes',
    remove: 'Remove',
    merged_with_existing: 'Merged with existing item',
    item_select_placeholder: 'Select item',
    review: 'Review',
    cancel: 'Cancel',
    total_amount_collected: 'Total Amount Collected',
    total: 'Total',
    requiredStaff: 'Staff name is required.',
    requiredItem: 'Item is required.',
    atLeastOneItem: 'At least one item is required.',
    quantityRequired: 'Quantity is required.',
    quantityInteger: 'Quantity must be a whole number.',
    quantityRange: 'Quantity must be between 1 and 50.',
    amountRequired: 'Amount collected is required.',
    amountPositive: 'Amount collected must be greater than 0.',
    amountMax: 'Amount collected cannot exceed 1000.',
    totalMax: 'Total amount collected cannot exceed 2000.',
    notesMax: 'Notes cannot exceed 250 characters.',
    requiredDate: 'Date is required.',
    requiredTime: 'Time is required.',
    invalidCheckInType: 'Invalid check-in type.',
    fix_errors_below: 'Please fix the errors below.',
  },
  es: {
    room_number: 'Número de Habitación',
    receipt_number: 'Número de Recibo',
    date: 'Fecha',
    time: 'Hora',
    cost: 'Costo',
    payment_method: 'Método de Pago',
    cash: 'CASH',
    ath_mobil: 'ATH Móvil',
    venmo: 'Venmo',
    paypal: 'PayPal',
    cash_app: 'Cash App',
    car_plate: 'Placa',
    car_make: 'Marca de Carro',
    car_color: 'Color de Carro',
    staff_name: 'Nombre del Empleado',
    staff_select_placeholder: 'Seleccionar empleado',
    note: 'Nota',
    submit: 'Registrar',
    verify: 'Verificar Registro',
    confirm: 'Confirmar',
    back: 'Atrás',
    english: 'English',
    spanish: 'Español',
    new_checkin: 'Nuevo Registro',
    choose_type: 'Elija qué está registrando',
    room_checkin_title: 'Registro de Habitación',
    food_checkin_title: 'Registro de Comida y Bebida',
    beer_checkin_title: 'Registro de Cerveza',
    food_and_beverage: 'Comida y Bebida',
    beer: 'Cerveza',
    room: 'Habitación',
    items: 'Artículos',
    item: 'Artículo',
    quantity_sold: 'Cantidad Vendida',
    amount_collected: 'Cantidad Cobrada',
    add_another_item: 'Añadir otro artículo',
    notes: 'Notas',
    remove: 'Quitar',
    merged_with_existing: 'Combinado con artículo existente',
    item_select_placeholder: 'Seleccionar artículo',
    review: 'Revisar',
    cancel: 'Cancelar',
    total_amount_collected: 'Total Cobrado',
    total: 'Total',
    requiredStaff: 'El nombre del empleado es obligatorio.',
    requiredItem: 'El artículo es obligatorio.',
    atLeastOneItem: 'Se requiere al menos un artículo.',
    quantityRequired: 'La cantidad es obligatoria.',
    quantityInteger: 'La cantidad debe ser un número entero.',
    quantityRange: 'La cantidad debe estar entre 1 y 50.',
    amountRequired: 'El monto cobrado es obligatorio.',
    amountPositive: 'El monto cobrado debe ser mayor que 0.',
    amountMax: 'El monto cobrado no puede superar 1000.',
    totalMax: 'El monto total cobrado no puede superar 2000.',
    notesMax: 'Las notas no pueden superar 250 caracteres.',
    requiredDate: 'La fecha es obligatoria.',
    requiredTime: 'La hora es obligatoria.',
    invalidCheckInType: 'Tipo de registro no válido.',
    fix_errors_below: 'Corrija los errores a continuación.',
  },
};

export type TranslationKey = keyof typeof translations.en;

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  defaultLanguage,
}: {
  children: React.ReactNode;
  /** When 'es', initial language is Spanish and we do not restore from localStorage (e.g. employee default). */
  defaultLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (defaultLanguage) return defaultLanguage;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('preferredLanguage') as Language | null;
      if (saved) return saved;
    }
    return 'en';
  });

  useEffect(() => {
    if (defaultLanguage === 'es') {
      setLanguageState('es');
      return;
    }
    const saved = localStorage.getItem('preferredLanguage') as Language | null;
    if (saved) setLanguageState(saved);
  }, [defaultLanguage]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferredLanguage', lang);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <span style={{ fontWeight: language === 'en' ? 700 : 400 }}>{t('english')}</span>
      <button
        type="button"
        onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
        style={{
          width: 44,
          height: 22,
          borderRadius: 999,
          border: 'none',
          background: '#16a34a',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: language === 'es' ? 24 : 4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.15s ease',
          }}
        />
      </button>
      <span style={{ fontWeight: language === 'es' ? 700 : 400 }}>{t('spanish')}</span>
    </div>
  );
}
