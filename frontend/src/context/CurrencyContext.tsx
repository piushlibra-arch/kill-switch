import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../api/client';

export interface CurrencyConfig {
  currencyCode: string;   // 'INR', 'USD', 'USDT'
  currencySymbol: string; // '₹', '$', 'USDT'
  locale: string;         // 'en-IN', 'en-US'
  brokerName: string;
}

interface FormatOptions {
  showSign?: boolean;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  compact?: boolean;
}

interface CurrencyContextType {
  currencyCode: string;
  currencySymbol: string;
  locale: string;
  brokerName: string;
  formatCurrency: (amount: number, options?: FormatOptions) => string;
  formatNumber: (amount: number, options?: FormatOptions) => string;
  updateCurrencyConfig: (config: Partial<CurrencyConfig>) => void;
  refreshCurrencyConfig: () => Promise<void>;
}

const DEFAULT_CONFIG: CurrencyConfig = {
  currencyCode: 'INR',
  currencySymbol: '₹',
  locale: 'en-IN',
  brokerName: 'dhan',
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: ReactNode; traderId?: string }> = ({ 
  children, 
  traderId = 'trader_alpha' 
}) => {
  const [config, setConfig] = useState<CurrencyConfig>(DEFAULT_CONFIG);

  const refreshCurrencyConfig = useCallback(async () => {
    try {
      const active = await api.getActiveBrokerConfig(traderId);
      if (active) {
        setConfig({
          currencyCode: active.currency_code || 'INR',
          currencySymbol: active.currency_symbol || '₹',
          locale: active.locale || 'en-IN',
          brokerName: active.broker_name || 'dhan',
        });
      }
    } catch (err) {
      console.warn('Using default currency config (₹ en-IN):', err);
    }
  }, [traderId]);

  useEffect(() => {
    refreshCurrencyConfig();

    const handleUpdate = (e: any) => {
      const detail = e.detail;
      if (detail) {
        setConfig((prev) => ({
          ...prev,
          currencyCode: detail.currency_code || prev.currencyCode,
          currencySymbol: detail.currency_symbol || prev.currencySymbol,
          locale: detail.locale || prev.locale,
          brokerName: detail.broker_name || prev.brokerName,
        }));
      }
    };

    window.addEventListener('currency_config_updated', handleUpdate);
    return () => window.removeEventListener('currency_config_updated', handleUpdate);
  }, [refreshCurrencyConfig]);

  const updateCurrencyConfig = useCallback((newConf: Partial<CurrencyConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...newConf,
    }));
  }, []);

  /**
   * Formats a monetary amount dynamically based on the connected broker:
   * - Indian brokers (Dhan, Zerodha, Fyers, Upstox, AngelOne, Breeze): ₹ with en-IN numbering (e.g. +₹1,50,000)
   * - US brokers: $ with en-US numbering (e.g. +$150,000)
   * - Crypto brokers: USDT with en-US numbering (e.g. +150,000 USDT)
   */
  const formatCurrency = useCallback((amount: number, options?: FormatOptions): string => {
    const val = Number.isNaN(amount) ? 0 : amount;
    const isNegative = val < 0;
    const absVal = Math.abs(val);

    const maxDigits = options?.maximumFractionDigits ?? (absVal % 1 === 0 ? 0 : 2);
    const minDigits = options?.minimumFractionDigits ?? 0;

    let formattedNum: string;
    try {
      formattedNum = new Intl.NumberFormat(config.locale, {
        maximumFractionDigits: maxDigits,
        minimumFractionDigits: minDigits,
        notation: options?.compact ? 'compact' : 'standard',
      }).format(absVal);
    } catch {
      formattedNum = absVal.toLocaleString();
    }

    let symbolPrefix = config.currencySymbol;
    let symbolSuffix = '';

    if (config.currencyCode === 'USDT') {
      symbolPrefix = '';
      symbolSuffix = ' USDT';
    }

    if (isNegative) {
      return `-${symbolPrefix}${formattedNum}${symbolSuffix}`;
    }

    if (options?.showSign && val > 0) {
      return `+${symbolPrefix}${formattedNum}${symbolSuffix}`;
    }

    return `${symbolPrefix}${formattedNum}${symbolSuffix}`;
  }, [config]);

  const formatNumber = useCallback((amount: number, options?: FormatOptions): string => {
    const val = Number.isNaN(amount) ? 0 : amount;
    const absVal = Math.abs(val);
    const maxDigits = options?.maximumFractionDigits ?? (absVal % 1 === 0 ? 0 : 2);

    try {
      const formatted = new Intl.NumberFormat(config.locale, {
        maximumFractionDigits: maxDigits,
      }).format(absVal);
      return val < 0 ? `-${formatted}` : formatted;
    } catch {
      return val.toLocaleString();
    }
  }, [config.locale]);

  return (
    <CurrencyContext.Provider
      value={{
        currencyCode: config.currencyCode,
        currencySymbol: config.currencySymbol,
        locale: config.locale,
        brokerName: config.brokerName,
        formatCurrency,
        formatNumber,
        updateCurrencyConfig,
        refreshCurrencyConfig,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
