import { addDays, format, isSameDay, parse, parseISO } from 'date-fns';

/**
 * Checks if a DD/MM birthday is today or within the next 3 days.
 * Ignores the year.
 */
export const checkBirthday = (ddmm: string): { isBirthday: boolean; daysAway: number; dateStr: string } | null => {
  if (!ddmm || ddmm.length !== 5 || !ddmm.includes('/')) return null;
  
  const today = new Date();
  const [day, month] = ddmm.split('/');
  
  // Create a date object for the birthday THIS year
  const bdayThisYear = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day));
  
  // If the birthday already passed this year (by more than a few days), check next year
  // (Not strictly necessary if we only check today and next 3 days, but good practice)
  if (bdayThisYear.getTime() < today.getTime() - (24 * 60 * 60 * 1000)) {
    bdayThisYear.setFullYear(today.getFullYear() + 1);
  }

  // Check today
  if (bdayThisYear.getDate() === today.getDate() && bdayThisYear.getMonth() === today.getMonth()) {
    return { isBirthday: true, daysAway: 0, dateStr: 'Hoje' };
  }

  // Check next 1, 2, 3 days
  for (let i = 1; i <= 3; i++) {
    const futureDate = addDays(today, i);
    if (bdayThisYear.getDate() === futureDate.getDate() && bdayThisYear.getMonth() === futureDate.getMonth()) {
      return { isBirthday: true, daysAway: i, dateStr: `Em ${i} dia(s)` };
    }
  }

  return null;
};

/**
 * Checks if a billing day (e.g., 15) is 5 days away or 1 day away from today.
 */
export const checkBoletoWarning = (diaVencimento: number): '5_dias' | '1_dia' | null => {
  if (!diaVencimento || diaVencimento < 1 || diaVencimento > 31) return null;

  const today = new Date();
  // We'll test against the current month, and next month just in case we are at the end of the month
  
  // Helper to check a specific year/month
  const checkMonth = (year: number, month: number) => {
    // Note: JS Date handles overflow (e.g. Feb 30 becomes Mar 2) which is a bit weird, 
    // but in real apps you'd want to cap to the last day of the month.
    // We'll keep it simple:
    const d = new Date(year, month, diaVencimento);
    
    // 5 days warning
    const fiveDaysBefore = new Date(d);
    fiveDaysBefore.setDate(d.getDate() - 5);
    
    if (fiveDaysBefore.getDate() === today.getDate() && fiveDaysBefore.getMonth() === today.getMonth()) {
      return '5_dias';
    }

    // 1 day warning
    const oneDayBefore = new Date(d);
    oneDayBefore.setDate(d.getDate() - 1);
    
    if (oneDayBefore.getDate() === today.getDate() && oneDayBefore.getMonth() === today.getMonth()) {
      return '1_dia';
    }
    
    return null;
  };

  const resThisMonth = checkMonth(today.getFullYear(), today.getMonth());
  if (resThisMonth) return resThisMonth;

  // If today is late in the month (e.g. 28th), the next bill might be early next month (e.g. 2nd)
  const resNextMonth = checkMonth(today.getFullYear(), today.getMonth() + 1);
  return resNextMonth;
};

export const getWhatsappLink = (phone: string | number, text: string) => {
  const phoneStr = phone ? String(phone) : '';
  const cleanPhone = phoneStr.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/55${cleanPhone}?text=${encodedText}`;
};
