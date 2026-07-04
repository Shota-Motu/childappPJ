/** 端末ローカルタイムゾーンでの 'YYYY-MM-DD'（entries の主キー形式） */
export function toDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}
