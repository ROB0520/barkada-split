// one payback between members. never changes what anyone owes,
// it only moves the balance.
export interface Payment {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  createdAt: string;
}
