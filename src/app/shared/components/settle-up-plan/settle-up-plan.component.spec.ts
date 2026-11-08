import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';

import { SettleUpPlanComponent } from './settle-up-plan.component';

describe('SettleUpPlanComponent', () => {
  let component: SettleUpPlanComponent;
  let fixture: ComponentFixture<SettleUpPlanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AlertController, useValue: {} },
        { provide: ToastController, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettleUpPlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
