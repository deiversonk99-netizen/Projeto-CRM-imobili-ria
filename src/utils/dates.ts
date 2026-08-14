import { addDays, isSameDay, parseISO, startOfDay, differenceInDays } from 'date-fns';

export function getDaysUntilBirthday(birthDateStr: string): number {
  if (!birthDateStr) return -1;
  const today = startOfDay(new Date());
  
  let day: number, month: number;
  
  if (birthDateStr.includes('/')) {
    const parts = birthDateStr.split('/');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (birthDateStr.includes('-')) {
    const parts = birthDateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      }
    } else {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
    }
  } else {
    return -1;
  }
  
  if (isNaN(day) || isNaN(month)) return -1;

  const birthDateThisYear = new Date(today.getFullYear(), month - 1, day);
  
  if (birthDateThisYear < today) {
    birthDateThisYear.setFullYear(today.getFullYear() + 1);
  }
  
  return differenceInDays(birthDateThisYear, today);
}

export const BIRTHDAY_WINDOW_DAYS = 3;

export function checkBirthday(birthDateStr: string): { dateStr: string; daysAway: number } | false {
  if (!birthDateStr) return false;
  
  const days = getDaysUntilBirthday(birthDateStr);
  
  if (days >= 0 && days <= BIRTHDAY_WINDOW_DAYS) {
    return {
      dateStr: birthDateStr,
      daysAway: days
    };
  }
  return false;
}

export function getDaysUntil(dateStr: string): number {
  if (!dateStr) return -1;
  const today = startOfDay(new Date());
  let targetDate: Date;

  if (dateStr.includes('-')) {
    targetDate = startOfDay(parseISO(dateStr));
  } else if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    targetDate = startOfDay(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
  } else {
    return -1;
  }

  return differenceInDays(targetDate, today);
}

export function checkBoletoWarning(vencimentoStr: string | number): 'atrasado' | 'hoje' | '1_dia' | '2_dias' | '3_dias' | false {
  if (!vencimentoStr) return false;
  
  const today = startOfDay(new Date());
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const day = typeof vencimentoStr === 'string' ? parseInt(vencimentoStr) : vencimentoStr;
  
  // Try current month's vencimento
  let vencimentoDate = new Date(currentYear, currentMonth, day);
  
  // If vencimento passed by more than 15 days, check next month's vencimento
  let diffTime = vencimentoDate.getTime() - today.getTime();
  let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < -15) {
    vencimentoDate = new Date(currentYear, currentMonth + 1, day);
    diffTime = vencimentoDate.getTime() - today.getTime();
    diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else if (diffDays > 20) {
    // If it's more than 20 days in the future, it might be looking at next month when it shouldn't,
    // but typically diffDays > 20 means it's far away.
  }
  
  if (diffDays < 0) return 'atrasado';
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return '1_dia';
  if (diffDays === 2) return '2_dias';
  if (diffDays === 3) return '3_dias';
  
  return false;
}

export function checkCobrancaWarning(vencimentoDateStr: string): 'atrasado' | 'hoje' | '1_dia' | '2_dias' | false {
  if (!vencimentoDateStr) return false;
  
  const today = startOfDay(new Date());
  const targetDate = startOfDay(parseISO(vencimentoDateStr));
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'atrasado';
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return '1_dia';
  if (diffDays === 2) return '2_dias';
  
  return false;
}

export const getWhatsappLink = (phone: string | number | undefined | null, text: string) => {
  const phoneStr = phone != null ? String(phone) : '';
  const cleanPhone = phoneStr.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodedText}`;
};
