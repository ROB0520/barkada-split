// one shared payment in pesos. shares are saved on the record,
// so old expenses keep their split even if members change.
export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  payerId: string;
  date: string;
  shares: Record<string, number>;
  receiptPath?: string;
  createdAt: string;
  updatedAt: string;
}
