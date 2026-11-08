import { inject, Injectable } from '@angular/core';

import type { Expense } from '../models/expense';
import type { Member } from '../models/member';
import type { Payment } from '../models/payment';

import { orderMembers, ExpenseService } from './expense.service';
import { GroupService } from './group.service';
import { MemberService } from './member.service';
import { PaymentService } from './payment.service';

export interface MemberBalance {
  memberId: string;
  paid: number;
  share: number;
  net: number;
}

export interface Settlement {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

// adds up paid vs share, payments shift the balance.
// members missing from an old expense owe nothing on it.
export function computeBalances(
  memberIdsOrdered: readonly string[],
  expenses: readonly Expense[],
  payments: readonly Payment[] = [],
): MemberBalance[] {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  const sent = new Map<string, number>();
  const received = new Map<string, number>();
  for (const id of memberIdsOrdered) {
    paid.set(id, 0);
    share.set(id, 0);
    sent.set(id, 0);
    received.set(id, 0);
  }
  for (const expense of expenses) {
    if (paid.has(expense.payerId)) {
      paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.amount);
    }
    for (const id of memberIdsOrdered) {
      if (Object.prototype.hasOwnProperty.call(expense.shares, id)) {
        share.set(id, (share.get(id) ?? 0) + expense.shares[id]);
      }
    }
  }
  for (const payment of payments) {
    if (sent.has(payment.fromMemberId)) {
      sent.set(payment.fromMemberId, (sent.get(payment.fromMemberId) ?? 0) + payment.amount);
    }
    if (received.has(payment.toMemberId)) {
      received.set(payment.toMemberId, (received.get(payment.toMemberId) ?? 0) + payment.amount);
    }
  }
  return memberIdsOrdered.map((id: string) => {
    const paidAmount: number = Math.round((paid.get(id) ?? 0) * 100) / 100;
    const shareAmount: number = Math.round((share.get(id) ?? 0) * 100) / 100;
    const net: number =
      Math.round(((paid.get(id) ?? 0) - (share.get(id) ?? 0) + (sent.get(id) ?? 0) - (received.get(id) ?? 0)) * 100) /
      100;
    return { memberId: id, paid: paidAmount, share: shareAmount, net };
  });
}

// pairs debtors with creditors, biggest first. display only, it changes nothing.
export function computeSettlePlan(balances: readonly MemberBalance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ id: b.memberId, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ id: b.memberId, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);
  const plan: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    plan.push({ fromMemberId: debtors[i].id, toMemberId: creditors[j].id, amount: payment });
    debtors[i].amount -= payment;
    creditors[j].amount -= payment;
    if (debtors[i].amount === 0) {
      i++;
    }
    if (creditors[j].amount === 0) {
      j++;
    }
  }
  return plan;
}

// nothing is saved here, numbers refresh after every add, edit, or delete.
@Injectable({ providedIn: 'root' })
export class BalanceService {
  private readonly members = inject(MemberService);
  private readonly expenses = inject(ExpenseService);
  private readonly payments = inject(PaymentService);
  private readonly groups = inject(GroupService);

  balancesForGroup(groupId: string): MemberBalance[] {
    const roster: Member[] = this.members.membersForGroup(groupId);
    const ordered: string[] = orderMembers(roster).map((m) => m.id);
    const groupExpenses: Expense[] = this.expenses.expensesForGroup(groupId);
    const groupPayments: Payment[] = this.payments.paymentsForGroup(groupId);
    return computeBalances(ordered, groupExpenses, groupPayments);
  }

  settlePlanForGroup(groupId: string): Settlement[] {
    return computeSettlePlan(this.balancesForGroup(groupId));
  }

  // used for the headline on home.
  totalAmount(): number {
    return this.expenses.expensesNewestFirst().reduce((sum: number, e: Expense) => sum + e.amount, 0);
  }
}
