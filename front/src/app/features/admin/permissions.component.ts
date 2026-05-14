import { Component } from '@angular/core';
import { StudentApprovalComponent } from '../students/student-approval.component';

@Component({
  standalone: true,
  imports: [StudentApprovalComponent],
  template: `<app-student-approval></app-student-approval>`
})
export class PermissionsComponent {}
