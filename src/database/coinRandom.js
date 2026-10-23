import { ObjectId } from 'mongodb';
import { getDatabase } from './mongodb.js';

const EVENTS_COLLECTION = 'coin_random_events';
const RESULTS_COLLECTION = 'coin_random_results';
let indexesPromise;

function getEvents() {
  return getDatabase().collection(EVENTS_COLLECTION);
}

function getResults() {
  return getDatabase().collection(RESULTS_COLLECTION);
}

async function ensureIndexes() {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      getEvents().createIndex({ guildId: 1, createdAt: -1 }),
      getEvents().createIndex({ status: 1, expiresAt: 1 }),
      getResults().createIndex({ eventId: 1, userId: 1 }, { unique: true }),
      getResults().createIndex({ guildId: 1, userId: 1, receivedAt: -1 })
    ]).catch(error => {
      indexesPromise = null;
      throw error;
    });
  }
  await indexesPromise;
}

export async function createCoinRandomEvent({
  guildId,
  channelId,
  createdBy,
  maxCoins,
  durationDays
}) {
  await ensureIndexes();
  const event = {
    guildId,
    channelId,
    createdBy,
    maxCoins,
    durationDays,
    expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
    status: 'ACTIVE',
    createdAt: new Date(),
    messageId: null
  };
  const result = await getEvents().insertOne(event);
  return { ...event, _id: result.insertedId };
}

export async function setCoinRandomEventMessage(eventId, messageId) {
  await ensureIndexes();
  await getEvents().updateOne(
    { _id: eventId },
    { $set: { messageId, updatedAt: new Date() } }
  );
}

export async function failCoinRandomEvent(eventId, errorMessage) {
  await ensureIndexes();
  await getEvents().updateOne(
    { _id: eventId },
    {
      $set: {
        status: 'FAILED',
        failureReason: errorMessage,
        updatedAt: new Date()
      }
    }
  );
}

export async function getCoinRandomEvent(guildId, eventId) {
  await ensureIndexes();
  if (!ObjectId.isValid(eventId)) {
    return null;
  }
  return getEvents().findOne({
    _id: new ObjectId(eventId),
    guildId,
    status: 'ACTIVE',
    expiresAt: { $gt: new Date() }
  });
}

function isEventExpired(event, now = new Date()) {
  return !event.expiresAt || event.expiresAt <= now;
}

export async function disableCoinRandomEvent(guildId, eventId, disabledBy) {
  await ensureIndexes();
  if (!ObjectId.isValid(eventId)) {
    return { event: null, alreadyDisabled: false };
  }

  const id = new ObjectId(eventId);
  const event = await getEvents().findOneAndUpdate(
    {
      _id: id,
      guildId,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        status: 'DISABLED',
        disabledBy,
        disabledAt: new Date(),
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  if (event) {
    return { event, alreadyDisabled: false };
  }

  const existingEvent = await getEvents().findOne({ _id: id, guildId });
  if (existingEvent && isEventExpired(existingEvent)) {
    await getEvents().updateOne(
      { _id: id, guildId, status: { $in: ['ACTIVE', 'DISABLED'] } },
      {
        $set: {
          status: 'EXPIRED',
          expiredAt: existingEvent.expiresAt || new Date(),
          updatedAt: new Date()
        }
      }
    );
    return {
      event: { ...existingEvent, status: 'EXPIRED' },
      alreadyDisabled: false
    };
  }
  return {
    event: existingEvent,
    alreadyDisabled: existingEvent?.status === 'DISABLED'
  };
}

export async function enableCoinRandomEvent(guildId, eventId, enabledBy) {
  await ensureIndexes();
  if (!ObjectId.isValid(eventId)) {
    return { event: null, outcome: 'NOT_FOUND' };
  }

  const id = new ObjectId(eventId);
  const existingEvent = await getEvents().findOne({ _id: id, guildId });
  if (!existingEvent) {
    return { event: null, outcome: 'NOT_FOUND' };
  }
  if (isEventExpired(existingEvent)) {
    if (existingEvent.status !== 'EXPIRED') {
      await getEvents().updateOne(
        { _id: id, guildId, status: { $in: ['ACTIVE', 'DISABLED'] } },
        {
          $set: {
            status: 'EXPIRED',
            expiredAt: existingEvent.expiresAt || new Date(),
            updatedAt: new Date()
          }
        }
      );
    }
    return {
      event: { ...existingEvent, status: 'EXPIRED' },
      outcome: 'EXPIRED'
    };
  }
  if (existingEvent.status === 'ACTIVE') {
    return { event: existingEvent, outcome: 'ALREADY_ACTIVE' };
  }
  if (existingEvent.status !== 'DISABLED') {
    return { event: existingEvent, outcome: 'NOT_ENABLEABLE' };
  }

  const event = await getEvents().findOneAndUpdate(
    {
      _id: id,
      guildId,
      status: 'DISABLED',
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        status: 'ACTIVE',
        enabledBy,
        enabledAt: new Date(),
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  if (event) {
    return { event, outcome: 'ENABLED' };
  }

  const latestEvent = await getEvents().findOne({ _id: id, guildId });
  return {
    event: latestEvent,
    outcome: latestEvent && isEventExpired(latestEvent) ? 'EXPIRED' : 'NOT_ENABLEABLE'
  };
}

export async function expireCoinRandomEvents(now = new Date()) {
  await ensureIndexes();
  const expiredEvents = await getEvents().find({
    status: { $in: ['ACTIVE', 'DISABLED'] },
    $or: [
      { expiresAt: { $lte: now } },
      { expiresAt: { $exists: false } }
    ]
  }).toArray();

  const updatedEvents = [];
  for (const event of expiredEvents) {
    const result = await getEvents().updateOne(
      {
        _id: event._id,
        status: event.status,
        $or: [
          { expiresAt: { $lte: now } },
          { expiresAt: { $exists: false } }
        ]
      },
      { $set: { status: 'EXPIRED', expiredAt: event.expiresAt || now, updatedAt: now } }
    );
    if (result.modifiedCount) {
      updatedEvents.push({ ...event, status: 'EXPIRED', expiredAt: now });
    }
  }
  return updatedEvents;
}

export async function recordCoinRandomResult({
  event,
  userId,
  coins
}) {
  await ensureIndexes();
  const result = {
    eventId: event._id,
    guildId: event.guildId,
    userId,
    coins,
    receivedAt: new Date()
  };

  try {
    await getResults().insertOne(result);
    return { result, alreadyReceived: false };
  } catch (error) {
    if (error.code === 11000) {
      return { result: null, alreadyReceived: true };
    }
    throw error;
  }
}
