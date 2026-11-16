import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNextScheduledRevokeAt,
  isScheduledRevokeDue
} from '../src/features/reactionRoles/scheduleTime.js';

test('a claim made before the daily revoke is due at that same revoke', () => {
  const claimedAt = new Date('2026-11-15T16:59:59.000Z');
  const nextRevokeAt = getNextScheduledRevokeAt('00:00', claimedAt);

  assert.equal(nextRevokeAt.toISOString(), '2026-11-15T17:00:00.000Z');
  assert.equal(isScheduledRevokeDue({ nextRevokeAt }, nextRevokeAt), true);
});

test('a claim made after midnight waits for the following daily revoke', () => {
  const claimedAt = new Date('2026-11-15T17:00:05.000Z');
  const nextRevokeAt = getNextScheduledRevokeAt('00:00', claimedAt);

  assert.equal(nextRevokeAt.toISOString(), '2026-11-16T17:00:00.000Z');
  assert.equal(
    isScheduledRevokeDue({ nextRevokeAt }, new Date('2026-11-15T17:01:00.000Z')),
    false
  );
  assert.equal(
    isScheduledRevokeDue({ nextRevokeAt }, new Date('2026-11-16T17:00:00.000Z')),
    true
  );
});

test('a claim made exactly at the scheduled time waits until the next day', () => {
  const claimedAt = new Date('2026-11-15T17:00:00.000Z');

  assert.equal(
    getNextScheduledRevokeAt('00:00', claimedAt).toISOString(),
    '2026-11-16T17:00:00.000Z'
  );
});

test('invalid schedule times are rejected', () => {
  assert.throws(() => getNextScheduledRevokeAt('24:00', new Date()));
  assert.throws(() => getNextScheduledRevokeAt('0:00', new Date()));
});
