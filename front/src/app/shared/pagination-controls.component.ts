import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export const PAGE_SIZE_OPTIONS = [10, 20, 100, 1000, 10000] as const;

@Component({
  standalone: true,
  selector: 'app-pagination-controls',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pagination-shell">
      <label class="page-size-control">
        <span>Rows per page</span>
        <select [ngModel]="pageSize" (ngModelChange)="onPageSizeChange($event)">
          @for (option of sizeOptions; track option) {
            <option [ngValue]="option">{{ option }}</option>
          }
        </select>
      </label>

      <div class="pagination-actions">
        <button type="button" class="secondary" [disabled]="currentPage <= 1" (click)="changePage(currentPage - 1)">
          Previous
        </button>
        <span class="page-info">Page {{ currentPage }} of {{ currentTotalPages }}</span>
        <button
          type="button"
          class="secondary"
          [disabled]="currentPage >= currentTotalPages"
          (click)="changePage(currentPage + 1)">
          Next
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pagination-shell {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding-top: 4px;
    }

    .page-size-control {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted-strong, var(--muted));
      font-size: 0.9rem;
      font-weight: 600;
    }

    .page-size-control select {
      min-width: 92px;
      min-height: 40px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.9rem;
    }

    .pagination-actions {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .page-info {
      color: var(--muted-strong, var(--muted));
      font-size: 0.9rem;
      font-weight: 600;
      text-align: center;
    }

    @media (max-width: 640px) {
      .pagination-shell,
      .pagination-actions {
        align-items: stretch;
      }

      .page-size-control {
        width: 100%;
        justify-content: space-between;
      }

      .page-size-control select,
      .pagination-actions button,
      .page-info {
        width: 100%;
      }
    }
  `]
})
export class PaginationControlsComponent {
  @Input() page = 1;
  @Input() totalPages = 1;
  @Input() pageSize = 10;
  @Input() sizeOptions: readonly number[] = PAGE_SIZE_OPTIONS;

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get currentTotalPages(): number {
    return Math.max(1, Math.floor(Number(this.totalPages) || 1));
  }

  get currentPage(): number {
    const page = Math.floor(Number(this.page) || 1);
    return Math.min(Math.max(page, 1), this.currentTotalPages);
  }

  changePage(page: number): void {
    if (page === this.currentPage || page < 1 || page > this.currentTotalPages) {
      return;
    }

    this.pageChange.emit(page);
  }

  onPageSizeChange(value: number | string): void {
    const pageSize = Math.floor(Number(value));
    if (!Number.isFinite(pageSize) || pageSize <= 0 || pageSize === this.pageSize) {
      return;
    }

    this.pageSizeChange.emit(pageSize);
  }
}
