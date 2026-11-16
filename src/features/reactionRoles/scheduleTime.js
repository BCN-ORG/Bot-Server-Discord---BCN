const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function getNextScheduledRevokeAt(every, after = new Date()) {
  const match = every.match(/^(\d{2}):(\d{2})$/);
  if (!match) throw new Error('Scheduled revoke time must use HH:mm format.');

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error('Scheduled revoke time is outside the valid day range.');
  }

  const parts = Object.fromEntries(
    vietnamDateFormatter.formatToParts(after).map(part => [part.type, part.value])
  );
  const scheduledToday = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${every}:00+07:00`
  );

  return scheduledToday > after
    ? scheduledToday
    : new Date(scheduledToday.getTime() + 24 * 60 * 60 * 1000);
}

export function isScheduledRevokeDue(claim, now = new Date()) {
  return claim.nextRevokeAt != null
    && new Date(claim.nextRevokeAt).getTime() <= now.getTime();
}
