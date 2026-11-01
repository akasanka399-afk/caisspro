// Helper utilities for ISO calendar weeks (Strict Monday to Sunday - Lundi à Dimanche)

export interface DayOfWeekInfo {
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  dayName: string; // "Lundi", "Mardi", ...
  shortDayName: string; // "Lun", "Mar", ...
  formattedDate: string; // "26 oct."
  dayNumber: number; // 1 (Lundi) à 7 (Dimanche)
  isToday: boolean;
}

export interface WeekRange {
  monday: Date;
  sunday: Date;
  mondayStr: string; // "YYYY-MM-DD"
  sundayStr: string; // "YYYY-MM-DD"
  label: string; // "Du Lun. 26 Oct au Dim. 01 Nov 2026"
  shortLabel: string; // "26 Oct. - 01 Nov."
  weekNumber: number;
  year: number;
  days: DayOfWeekInfo[];
}

const FRENCH_DAY_NAMES = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

const FRENCH_SHORT_DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const FRENCH_MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * Calculates ISO-8601 week number (where week starts on Monday)
 */
export function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Formats a Date to YYYY-MM-DD
 */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes the strict Monday to Sunday range for a given date and week offset.
 * offsetWeeks = 0: current week
 * offsetWeeks = -1: previous week
 * offsetWeeks = +1: next week
 */
export function getMondayToSundayWeek(referenceDate: Date = new Date(), offsetWeeks: number = 0): WeekRange {
  // Target date shifted by offsetWeeks
  const base = new Date(referenceDate);
  base.setDate(base.getDate() + offsetWeeks * 7);

  const dayOfWeek = base.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // In Monday-Sunday cycle:
  // Lundi (1) -> 0 diff
  // Mardi (2) -> -1 diff
  // ...
  // Dimanche (0) -> -6 diff
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMonday, 0, 0, 0, 0);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

  const todayStr = toDateString(new Date());

  const days: DayOfWeekInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = toDateString(cur);
    const jsDay = cur.getDay(); // 0-6

    days.push({
      date: cur,
      dateStr,
      dayName: FRENCH_DAY_NAMES[jsDay],
      shortDayName: FRENCH_SHORT_DAY_NAMES[jsDay],
      formattedDate: `${cur.getDate()} ${FRENCH_MONTH_NAMES[cur.getMonth()].slice(0, 4)}.`,
      dayNumber: i + 1, // 1 to 7
      isToday: dateStr === todayStr,
    });
  }

  const mondayStr = toDateString(monday);
  const sundayStr = toDateString(sunday);
  const weekNumber = getISOWeekNumber(monday);
  const year = monday.getFullYear();

  const mDay = monday.getDate();
  const mMonth = FRENCH_MONTH_NAMES[monday.getMonth()].slice(0, 3);
  const sDay = sunday.getDate();
  const sMonth = FRENCH_MONTH_NAMES[sunday.getMonth()].slice(0, 3);
  const sYear = sunday.getFullYear();

  const label = `Du Lun. ${mDay} ${mMonth}. au Dim. ${sDay} ${sMonth}. ${sYear}`;
  const shortLabel = `${mDay} ${mMonth}. - ${sDay} ${sMonth}.`;

  return {
    monday,
    sunday,
    mondayStr,
    sundayStr,
    label,
    shortLabel,
    weekNumber,
    year,
    days,
  };
}
