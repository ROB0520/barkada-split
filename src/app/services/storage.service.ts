import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { isValidExpenseDate } from '../models/date-util';
import type { Expense } from '../models/expense';
import type { Group } from '../models/group';
import type { Member } from '../models/member';
import type { Payment } from '../models/payment';
import { ENVELOPE_VERSION, envelope } from '../models/storage-envelope';

// saves and loads one record per key.
function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isGroup(data: unknown): data is Group {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  if (
    !hasOwn(record, 'id') ||
    !hasOwn(record, 'name') ||
    !hasOwn(record, 'description') ||
    !hasOwn(record, 'createdAt') ||
    !hasOwn(record, 'updatedAt') ||
    typeof record['id'] !== 'string' ||
    !isNonEmptyString(record['name']) ||
    typeof record['description'] !== 'string' ||
    !isIsoString(record['createdAt']) ||
    !isIsoString(record['updatedAt'])
  ) {
    return false;
  }
  return true;
}

export function isMember(data: unknown): data is Member {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  return (
    hasOwn(record, 'id') &&
    hasOwn(record, 'groupId') &&
    hasOwn(record, 'name') &&
    hasOwn(record, 'createdAt') &&
    typeof record['id'] === 'string' &&
    typeof record['groupId'] === 'string' &&
    isNonEmptyString(record['name']) &&
    isIsoString(record['createdAt'])
  );
}

function isShareMap(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return false;
  }
  return entries.every(
    ([key, share]: [string, unknown]) =>
      key !== '__proto__' &&
      typeof share === 'number' &&
      Number.isFinite(share) &&
      (share as number) >= 0 &&
      Math.abs((share as number) * 100 - Math.round((share as number) * 100)) < 1e-9,
  );
}

// compares in centavos so float dust doesn't fail it.
function sharesSumTo(shares: Record<string, number>, total: number): boolean {
  let sumCents = 0;
  for (const share of Object.values(shares)) {
    sumCents += Math.round(share * 100);
  }
  return sumCents === Math.round(total * 100);
}

export function isPayment(data: unknown): data is Payment {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  if (
    !hasOwn(record, 'id') ||
    !hasOwn(record, 'groupId') ||
    !hasOwn(record, 'fromMemberId') ||
    !hasOwn(record, 'toMemberId') ||
    !hasOwn(record, 'amount') ||
    !hasOwn(record, 'date') ||
    !hasOwn(record, 'createdAt')
  ) {
    return false;
  }
  if (
    typeof record['id'] !== 'string' ||
    typeof record['groupId'] !== 'string' ||
    typeof record['fromMemberId'] !== 'string' ||
    typeof record['toMemberId'] !== 'string' ||
    typeof record['amount'] !== 'number' ||
    !Number.isFinite(record['amount'] as number) ||
    (record['amount'] as number) <= 0 ||
    Math.abs((record['amount'] as number) * 100 - Math.round((record['amount'] as number) * 100)) > 1e-9 ||
    typeof record['date'] !== 'string' ||
    !isValidExpenseDate(record['date'] as string) ||
    !isIsoString(record['createdAt'])
  ) {
    return false;
  }
  return true;
}

export function isExpense(data: unknown): data is Expense {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  if (
    !hasOwn(record, 'id') ||
    !hasOwn(record, 'groupId') ||
    !hasOwn(record, 'description') ||
    !hasOwn(record, 'amount') ||
    !hasOwn(record, 'payerId') ||
    !hasOwn(record, 'date') ||
    !hasOwn(record, 'shares') ||
    !hasOwn(record, 'createdAt') ||
    !hasOwn(record, 'updatedAt')
  ) {
    return false;
  }
  if (
    typeof record['id'] !== 'string' ||
    typeof record['groupId'] !== 'string' ||
    typeof record['description'] === 'undefined' ||
    typeof record['description'] !== 'string' ||
    typeof record['amount'] !== 'number' ||
    !Number.isFinite(record['amount'] as number) ||
    (record['amount'] as number) < 0 ||
    Math.abs((record['amount'] as number) * 100 - Math.round((record['amount'] as number) * 100)) > 1e-9 ||
    typeof record['payerId'] !== 'string' ||
    typeof record['date'] !== 'string' ||
    !isValidExpenseDate(record['date'] as string) ||
    !isShareMap(record['shares']) ||
    !isIsoString(record['createdAt']) ||
    !isIsoString(record['updatedAt'])
  ) {
    return false;
  }
  if (hasOwn(record, 'receiptPath') && typeof record['receiptPath'] !== 'undefined') {
    // Only a short path is stored here, never the photo itself.
    if (typeof record['receiptPath'] !== 'string' || (record['receiptPath'] as string).length === 0) {
      return false;
    }
  }
  // throws out records whose shares don't add up to the total.
  if (!sharesSumTo(record['shares'] as Record<string, number>, record['amount'] as number)) {
    return false;
  }
  return true;
}

export const WARN_VALUE_BYTES = 100 * 1024;

function acceptUnknown(_data: unknown): _data is unknown {
  return true;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  readonly GROUP_IDS_KEY = 'group-ids';

  groupKey(id: string): string {
    return `group:${id}`;
  }

  memberKey(id: string): string {
    return `member:${id}`;
  }

  expenseKey(id: string): string {
    return `expense:${id}`;
  }

  paymentKey(id: string): string {
    return `payment:${id}`;
  }

  groupMembersKey(groupId: string): string {
    return `group:${groupId}:members`;
  }

  groupExpensesKey(groupId: string): string {
    return `group:${groupId}:expenses`;
  }

  groupPaymentsKey(groupId: string): string {
    return `group:${groupId}:payments`;
  }

  // null when missing or broken, so one bad record never crashes the app.
  async readRecord<T>(key: string, isValid: (data: unknown) => data is T): Promise<T | null> {
    const { value } = await Preferences.get({ key });
    if (value === null) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      console.warn(`[storage] corrupt JSON skipped at key "${key}"`);
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn(`[storage] bad envelope skipped at key "${key}"`);
      return null;
    }
    const candidate = parsed as { version?: unknown; data?: unknown };
    if (candidate.version !== ENVELOPE_VERSION) {
      console.warn(`[storage] unknown envelope version skipped at key "${key}"`);
      return null;
    }
    if (!hasOwn(candidate as object, 'data') || !isValid(candidate.data)) {
      console.warn(`[storage] bad record shape skipped at key "${key}"`);
      return null;
    }
    return candidate.data;
  }

  async writeRecord<T>(key: string, data: T): Promise<void> {
    const value: string = JSON.stringify(envelope(data));
    if (value.length > WARN_VALUE_BYTES) {
      console.warn(`[storage] oversized value (${value.length} chars) at key "${key}"`);
    }
    await Preferences.set({ key, value });
  }

  async removeRecord(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  // used by the settings wipe option.
  async clearAllRecords(): Promise<void> {
    const { keys } = await Preferences.keys();
    const owned = keys.filter(
      (key) =>
        key === this.GROUP_IDS_KEY ||
        key.startsWith('group:') ||
        key.startsWith('member:') ||
        key.startsWith('expense:') ||
        key.startsWith('payment:'),
    );
    const outcomes = await Promise.allSettled(owned.map((key) => Preferences.remove({ key })));
    const failed = outcomes.filter((outcome) => outcome.status === 'rejected').length;
    if (failed > 0) {
      throw new Error(`${failed} record(s) could not be removed. Please try again.`);
    }
  }

  // missing or broken list just gives [].
  async readIds(indexKey: string): Promise<string[]> {
    const ids = await this.readRecord<unknown>(indexKey, acceptUnknown);
    if (ids === null) {
      return [];
    }
    if (!Array.isArray(ids) || !ids.every((entry: unknown) => typeof entry === 'string')) {
      console.warn(`[storage] bad index shape skipped at key "${indexKey}"`);
      return [];
    }
    return ids as string[];
  }

  async writeIds(indexKey: string, ids: string[]): Promise<void> {
    await this.writeRecord<unknown>(indexKey, ids);
  }

  async addIdToIndex(indexKey: string, id: string): Promise<void> {
    const ids: string[] = await this.readIds(indexKey);
    if (!ids.includes(id)) {
      await this.writeIds(indexKey, [...ids, id]);
    }
  }

  async removeIdFromIndex(indexKey: string, id: string): Promise<void> {
    const ids: string[] = await this.readIds(indexKey);
    if (ids.includes(id)) {
      await this.writeIds(
        indexKey,
        ids.filter((entry: string) => entry !== id),
      );
    }
  }
}
