import { Component, inject, Input } from '@angular/core';
import { IonItem, IonLabel, IonList, IonNote } from '@ionic/angular';

import { BalanceService, type MemberBalance } from '../../../services/balance.service';
import { MemberService } from '../../../services/member.service';
import { formatAmount } from '../../../services/money';

@Component({
  selector: 'app-balance-summary',
  templateUrl: './balance-summary.component.html',
  styleUrls: ['./balance-summary.component.scss'],
  imports: [IonItem, IonLabel, IonList, IonNote],
})
export class BalanceSummaryComponent {
  private readonly balances = inject(BalanceService);
  private readonly members = inject(MemberService);

  @Input() groupId?: string;

  readonly formatAmount = formatAmount;

  rows(): { name: string; balance: MemberBalance }[] {
    if (this.groupId === undefined) {
      return [];
    }
    const names = new Map(this.members.membersForGroup(this.groupId).map((m) => [m.id, m.name]));
    return this.balances
      .balancesForGroup(this.groupId)
      .map((balance: MemberBalance) => ({ name: names.get(balance.memberId) ?? 'Unknown member', balance }));
  }

  netsTotal(): number {
    return this.rows().reduce((sum: number, row) => sum + row.balance.net, 0);
  }
}
