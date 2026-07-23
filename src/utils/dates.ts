import { addDays, subDays } from 'date-fns';

/**
 * Checks if a DD/MM birthday is today, within the next 3 days, or passed in the last 7 days.
 * Ignores the year.
 */
export const checkBirthday = (ddmm: string | undefined | null): { isBirthday: boolean; daysAway: number; dateStr: string } | null => {
  if (!ddmm) return null;
  
  let day: number, month: number;

  if (typeof ddmm === 'string') {
    if (ddmm.includes('T')) {
      // Looks like an ISO date string
      const date = new Date(ddmm);
      if (!isNaN(date.getTime())) {
        day = date.getDate();
        month = date.getMonth() + 1;
      } else {
        return null;
      }
    } else if (ddmm.includes('/')) {
      const parts = ddmm.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    } else {
      return null;
    }
  } else {
    return null; // Not a recognized format
  }

  if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize today
  
  // Create a date object for the birthday THIS year
  // Cap the day to the maximum days in the month to avoid overflow (e.g., Feb 29 on non-leap year)
  const maxDays = new Date(today.getFullYear(), month, 0).getDate();
  const validDay = Math.min(day, maxDays);
  let bdayThisYear = new Date(today.getFullYear(), month - 1, validDay);
  
  // If the birthday is far in the past this year, it might be relevant for next year (forward looking)
  // But wait, we want to look back up to 7 days, and forward up to 3 days.
  const timeDiff = bdayThisYear.getTime() - today.getTime();
  const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff >= -7 && daysDiff <= 3) {
    let dateStr = 'Hoje';
    if (daysDiff === 0) dateStr = 'Hoje';
    else if (daysDiff === 1) dateStr = 'Amanhã';
    else if (daysDiff > 1) dateStr = `Em ${daysDiff} dias`;
    else if (daysDiff === -1) dateStr = 'Ontem';
    else if (daysDiff < -1) dateStr = `${Math.abs(daysDiff)} dias atrás`;
    
    return { isBirthday: true, daysAway: daysDiff, dateStr };
  }

  // Also check if the date was at the very end of last year or beginning of next year
  let bdayNextYear = new Date(today.getFullYear() + 1, month - 1, validDay);
  let timeDiffNext = bdayNextYear.getTime() - today.getTime();
  let daysDiffNext = Math.round(timeDiffNext / (1000 * 3600 * 24));
  if (daysDiffNext >= -7 && daysDiffNext <= 3) {
    return { isBirthday: true, daysAway: daysDiffNext, dateStr: daysDiffNext === 1 ? 'Amanhã' : (daysDiffNext > 1 ? `Em ${daysDiffNext} dias` : 'Hoje') };
  }

  let bdayLastYear = new Date(today.getFullYear() - 1, month - 1, validDay);
  let timeDiffLast = bdayLastYear.getTime() - today.getTime();
  let daysDiffLast = Math.round(timeDiffLast / (1000 * 3600 * 24));
  if (daysDiffLast >= -7 && daysDiffLast <= 3) {
    return { isBirthday: true, daysAway: daysDiffLast, dateStr: daysDiffLast === -1 ? 'Ontem' : `${Math.abs(daysDiffLast)} dias atrás` };
  }

  return null;
};

/**
 * Checks if a billing day (e.g., 15) is 5 days away, 1 day away, today, or was missed recently.
 * We'll return 'atrasado' if it was in the past 7 days (and not today).
 */
export type BoletoWarningType = '5_dias' | '1_dia' | 'hoje' | 'atrasado';

export const checkBoletoWarning = (diaVencimento: number | string | undefined | null): BoletoWarningType | null => {
  const dia = Number(diaVencimento);
  if (!dia || isNaN(dia) || dia < 1 || dia > 31) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Helper to check a specific year/month
  const checkMonth = (year: number, month: number): BoletoWarningType | null => {
    // Cap to the last day of the month
    const maxDays = new Date(year, month + 1, 0).getDate();
    const cappedDia = Math.min(dia, maxDays);
    
    const d = new Date(year, month, cappedDia);
    
    const timeDiff = d.getTime() - today.getTime();
    const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));

    if (daysDiff === 0) return 'hoje';
    if (daysDiff === 1) return '1_dia';
    if (daysDiff === 5) return '5_dias';
    if (daysDiff < 0 && daysDiff >= -7) return 'atrasado';
    
    return null;
  };

  const resThisMonth = checkMonth(today.getFullYear(), today.getMonth());
  if (resThisMonth) return resThisMonth;

  // Check next month in case we are at the end of the month
  const resNextMonth = checkMonth(today.getFullYear(), today.getMonth() + 1);
  if (resNextMonth) return resNextMonth;
  
  // Check last month in case we are at the beginning of the month and looking backwards
  const resLastMonth = checkMonth(today.getFullYear(), today.getMonth() - 1);
  return resLastMonth;
};

export const getWhatsappLink = (phone: string | number | undefined | null, text: string) => {
  const phoneStr = phone != null ? String(phone) : '';
  const cleanPhone = phoneStr.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/55${cleanPhone}?text=${encodedText}`;
};
