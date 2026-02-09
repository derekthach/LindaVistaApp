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
    cash: 'Cash',
    ath_mobil: 'ATH Móvil',
    car_plate: 'License Plate',
    car_make: 'Car Make',
    car_color: 'Car Color',
    staff_name: 'Staff Name',
    note: 'Note',
    submit: 'Check In',
    verify: 'Verify Check-In',
    confirm: 'Confirm',
    back: 'Back',
    english: 'English',
    spanish: 'Español',
  },
  es: {
    room_number: 'Número de Habitación',
    receipt_number: 'Número de Recibo',
    date: 'Fecha',
    time: 'Hora',
    cost: 'Costo',
    payment_method: 'Método de Pago',
    cash: 'Efectivo',
    ath_mobil: 'ATH Móvil',
    car_plate: 'Placa',
    car_make: 'Marca de Carro',
    car_color: 'Color de Carro',
    staff_name: 'Nombre del Empleado',
    note: 'Nota',
    submit: 'Registrar',
    verify: 'Verificar Registro',
    confirm: 'Confirmar',
    back: 'Atrás',
    english: 'English',
    spanish: 'Español',
  },
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('preferredLanguage') as Language | null;
    if (saved) {
      setLanguageState(saved);
    }
  }, []);

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
