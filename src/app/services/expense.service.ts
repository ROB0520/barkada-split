import { computed, inject, Injectable, signal } from '@angular/core';

import { compareExpenseDatesDesc, isFutureDate, isValidExpenseDate } from '../models/date-util';
import type { Expense } from '../models/expense';
import type { Member } from '../models/member';

import { MAX_AMOUNT } from './money';
import { ReceiptService } from './receipt.service';
import { isExpense, isGroup, isMember, StorageService } from './storage.service';

// Sorts members by when they were added, so the split order is stable.
export function orderMembers(members: readonly Member[]): Member[] {
  return [...members].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function orderMemberIds(members: readonly Member[]): string[] {
  return orderMembers(members).map((m) => m.id);
}

// splits equally down to the centavo. whole-peso totals stay in whole
// pesos when they divide evenly; leftover centavos go to members added
// first, and the shares always add up exactly to the total.
export function computeShares(total: number, memberIdsOrdered: readonly string[]): Record<string, number> {
  if (memberIdsOrdered.length === 0) {
    throw new Error('Cannot split among zero members');
  }
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Total must be a positive peso amount');
  }
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / memberIdsOrdered.length);
  const remainder = totalCents - base * memberIdsOrdered.length;
  const shares: Record<string, number> = {};
  memberIdsOrdered.forEach((id: string, i: number) => {
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') {
      throw new Error('Member id is not a valid share key');
    }
    shares[id] = (base + (i < remainder ? 1 : 0)) / 100;
  });
  return shares;
}

export interface CreateExpenseInput {
  groupId: string;
  description: string;
  amount: number;
  payerId: string;
  date: string;
  receiptPath?: string;
}

export interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  payerId?: string;
  date?: string;
  // missing leaves the photo as is, a path replaces it, null removes it.
  receiptPath?: string | null;
}

export interface MemberInvolvement {
  count: number;
  asPayer: boolean;
}

// shares are worked out once and saved on the record.
@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly storage = inject(StorageService);
  private readonly receipts = inject(ReceiptService);

  private readonly _expenses = signal<Expense[]>([]);
  readonly expenses = this._expenses.asReadonly();
  readonly expenseCount = computed(() => this._expenses().length);
  readonly expensesNewestFirst = computed(() =>
    [...this._expenses()].sort((a: Expense, b: Expense) => compareExpenseDatesDesc(a.date, b.date)),
  );

  expensesForGroup(groupId: string): Expense[] {
    return this.expensesNewestFirst().filter((expense: Expense) => expense.groupId === groupId);
  }

  // Drops one group's expenses from memory after the group is deleted.
  evictGroup(groupId: string): void {
    this._expenses.update((current: Expense[]) => current.filter((expense: Expense) => expense.groupId !== groupId));
  }

  // Clears all expenses from memory after a full wipe.
  clearAll(): void {
    this._expenses.set([]);
  }

  // used to block removing a member who already has expenses.
  async countMemberInvolvement(groupId: string, memberId: string): Promise<MemberInvolvement> {
    const ids: string[] = await this.storage.readIds(this.storage.groupExpensesKey(groupId));
    let count = 0;
    let asPayer = false;
    for (const id of ids) {
      const expense = await this.storage.readRecord(this.storage.expenseKey(id), isExpense);
      if (expense === null || expense.groupId !== groupId) {
        continue;
      }
      const inSplit: boolean = Object.prototype.hasOwnProperty.call(expense.shares, memberId);
      if (expense.payerId === memberId || inSplit) {
        count += 1;
        if (expense.payerId === memberId) {
          asPayer = true;
        }
      }
    }
    return { count, asPayer };
  }

  async loadGroup(groupId: string): Promise<void> {
    const ids: string[] = await this.storage.readIds(this.storage.groupExpensesKey(groupId));
    const found: Expense[] = [];
    for (const id of ids) {
      const expense = await this.storage.readRecord(this.storage.expenseKey(id), isExpense);
      if (expense !== null && expense.groupId === groupId) {
        found.push(expense);
      }
    }
    this._expenses.update((current: Expense[]) => [
      ...current.filter((expense: Expense) => expense.groupId !== groupId),
      ...found,
    ]);
  }

  async loadAll(): Promise<void> {
    const groupIds: string[] = await this.storage.readIds(this.storage.GROUP_IDS_KEY);
    for (const groupId of groupIds) {
      await this.loadGroup(groupId);
    }
  }

  async create(input: CreateExpenseInput): Promise<Expense> {
    const group = await this.storage.readRecord(this.storage.groupKey(input.groupId), isGroup);
    if (group === null) {
      throw new Error('Group not found');
    }
    const description: string = input.description.trim();
    if (description === '') {
      throw new Error('Expense description is required');
    }
    ExpenseService.validateAmount(input.amount);
    ExpenseService.validateDate(input.date);
    if (input.receiptPath !== undefined && input.receiptPath.length === 0) {
      throw new Error('Receipt path must be a non-empty relative path');
    }
    const members: Member[] = await this.loadGroupMembers(input.groupId);
    if (!members.some((member: Member) => member.id === input.payerId)) {
      throw new Error('Payer must be a group member');
    }
    const orderedIds = orderMembers(members).map((m) => m.id);
    const shares: Record<string, number> = computeShares(input.amount, orderedIds);
    const now: string = new Date().toISOString();
    const expense: Expense = {
      id: crypto.randomUUID(),
      groupId: input.groupId,
      description,
      amount: Math.round(input.amount * 100) / 100,
      payerId: input.payerId,
      date: input.date,
      shares,
      ...(input.receiptPath !== undefined ? { receiptPath: input.receiptPath } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.storage.writeRecord(this.storage.expenseKey(expense.id), expense);
    await this.storage.addIdToIndex(this.storage.groupExpensesKey(input.groupId), expense.id);
    this._expenses.update((current: Expense[]) => [...current, expense]);
    return expense;
  }

  async update(id: string, patch: UpdateExpenseInput): Promise<Expense> {
    const existing = await this.storage.readRecord(this.storage.expenseKey(id), isExpense);
    if (existing === null) {
      throw new Error('Expense not found');
    }
    const description: string = patch.description === undefined ? existing.description : patch.description.trim();
    if (description === '') {
      throw new Error('Expense description is required');
    }
    const amount: number = patch.amount ?? existing.amount;
    ExpenseService.validateAmount(amount);
    const date: string = patch.date ?? existing.date;
    ExpenseService.validateDate(date);
    const payerId: string = patch.payerId ?? existing.payerId;
    const members: Member[] = await this.loadGroupMembers(existing.groupId);
    if (!members.some((member: Member) => member.id === payerId)) {
      throw new Error('Payer must be a group member');
    }
    if (patch.receiptPath !== undefined && patch.receiptPath !== null && patch.receiptPath.length === 0) {
      throw new Error('Receipt path must be a non-empty relative path');
    }
    const orderedIds = orderMembers(members).map((m) => m.id);
    const shares: Record<string, number> = computeShares(amount, orderedIds);
    const updated: Expense = {
      ...existing,
      description,
      amount: Math.round(amount * 100) / 100,
      date,
      payerId,
      shares,
      updatedAt: new Date().toISOString(),
    };
    if (patch.receiptPath !== undefined) {
      if (patch.receiptPath === null) {
        delete updated.receiptPath;
      } else {
        updated.receiptPath = patch.receiptPath;
      }
    }
    await this.storage.writeRecord(this.storage.expenseKey(id), updated);
    this._expenses.update((current: Expense[]) =>
      current.map((expense: Expense) => (expense.id === id ? updated : expense)),
    );
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.storage.readRecord(this.storage.expenseKey(id), isExpense);
    if (existing === null) {
      throw new Error('Expense not found');
    }
    const receiptPath = existing.receiptPath;
    await this.storage.removeRecord(this.storage.expenseKey(id));
    await this.storage.removeIdFromIndex(this.storage.groupExpensesKey(existing.groupId), id);
    this._expenses.update((current: Expense[]) => current.filter((expense: Expense) => expense.id !== id));
    if (receiptPath !== undefined) {
      try {
        await this.receipts.deleteFile(receiptPath);
      } catch {
        console.warn(`[receipt] file delete skipped: ${receiptPath}`);
      }
    }
  }

  private async loadGroupMembers(groupId: string): Promise<Member[]> {
    const ids: string[] = await this.storage.readIds(this.storage.groupMembersKey(groupId));
    const found: Member[] = [];
    for (const id of ids) {
      const member = await this.storage.readRecord(this.storage.memberKey(id), isMember);
      if (member !== null && member.groupId === groupId) {
        found.push(member);
      }
    }
    return found;
  }

  private static validateAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      throw new Error('Amount must be a positive peso amount within range');
    }
  }

  private static validateDate(date: string): void {
    if (!isValidExpenseDate(date) || isFutureDate(date)) {
      throw new Error('Date must be a real day, today or earlier');
    }
  }
}
