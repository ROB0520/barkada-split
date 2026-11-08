import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActionSheetController, AlertController, ModalController } from '@ionic/angular';

import { ExpenseDetailPage } from './expense-detail.page';

describe('ExpenseDetailPage', () => {
  let component: ExpenseDetailPage;
  let fixture: ComponentFixture<ExpenseDetailPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ModalController, useValue: {} },
        { provide: ActionSheetController, useValue: {} },
        { provide: AlertController, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
