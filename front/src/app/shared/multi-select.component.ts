import { Component, ElementRef, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface MultiSelectOption {
  value: any;
  label: string;
}

@Component({
  standalone: true,
  selector: 'app-multi-select',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="multi-select-wrapper">
      <button type="button" class="multi-select-trigger" [attr.aria-expanded]="isOpen()" aria-haspopup="listbox" (click)="toggleDropdown()">
        <span class="multi-select-label">
          @if (selectedValues().length === 0) {
            {{ placeholder }}
          } @else if (selectedValues().length === 1) {
            {{ getLabel(selectedValues()[0]) }}
          } @else {
            {{ selectedValues().length }} selected
          }
        </span>
        <svg class="dropdown-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      
      @if (isOpen()) {
        <div class="multi-select-dropdown" role="listbox" aria-multiselectable="true">
          <div class="multi-select-search">
            <input
              type="search"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              [placeholder]="searchPlaceholder"
              aria-label="Search options"
              (click)="$event.stopPropagation()"
              (keydown.enter)="addCustomOption($event)" />
          </div>
          @for (option of filteredOptions(); track option.value) {
            <label class="multi-select-option" [class.selected]="isSelected(option.value)">
              <input
                type="checkbox"
                [checked]="isSelected(option.value)"
                (change)="toggleOption(option.value)"
              />
              <span class="option-label">{{ option.label }}</span>
            </label>
          } @empty {
            <div class="multi-select-empty">
              {{ allowCustom && searchTerm().trim() ? 'Press Enter to add this value' : 'No matching options' }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .multi-select-wrapper {
      position: relative;
      display: inline-block;
      width: 100%;
    }

    .multi-select-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 44px;
      padding: 10px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      font-size: 0.95rem;
      cursor: pointer;
      text-align: left;
    }

    .multi-select-trigger:hover {
      border-color: var(--border-strong);
    }

    .dropdown-arrow {
      flex-shrink: 0;
      color: var(--muted);
    }

    .multi-select-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 240px;
      overflow: hidden auto;
      margin-top: 4px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: var(--shadow-panel);
      z-index: 100;
    }

    .multi-select-search {
      position: sticky;
      top: 0;
      padding: 8px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      z-index: 1;
    }

    .multi-select-search input {
      width: 100%;
      min-height: 38px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-soft);
      color: var(--text);
    }

    .multi-select-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
    }

    .multi-select-option:hover {
      background: var(--surface-soft);
    }

    .multi-select-option.selected {
      background: var(--primary-tint);
    }

    .multi-select-option input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
    }

    .option-label {
      color: var(--text);
      font-size: 0.95rem;
    }

    .multi-select-empty {
      padding: 14px;
      color: var(--muted);
      text-align: center;
      font-size: 0.9rem;
    }

    @media (max-width: 520px) {
      .multi-select-trigger {
        min-height: 40px;
        padding: 8px 12px;
        font-size: 0.9rem;
      }

      .multi-select-dropdown {
        max-height: 200px;
      }

      .multi-select-option {
        padding: 8px 12px;
      }

      .multi-select-option input[type="checkbox"] {
        width: 16px;
        height: 16px;
      }

      .option-label {
        font-size: 0.55rem;
      }
    }
  `]
})
export class MultiSelectComponent {
  @Input() options: MultiSelectOption[] = [];
  @Input() placeholder = 'Select...';
  @Input() searchPlaceholder = 'Search...';
  @Input() allowCustom = false;
  @Input() set initialValues(values: any[]) {
    this.selectedValues.set(Array.isArray(values) ? [...values] : []);
  }
  @Output() selectionChange = new EventEmitter<any[]>();

  isOpen = signal(false);
  searchTerm = signal('');
  selectedValues = signal<any[]>([]);

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  toggleDropdown(): void {
    this.isOpen.update(v => !v);
    if (!this.isOpen()) {
      this.searchTerm.set('');
    }
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
      this.searchTerm.set('');
    }
  }

  filteredOptions(): MultiSelectOption[] {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    const allOptions = [...this.options];
    for (const value of this.selectedValues()) {
      if (!allOptions.some(option => option.value === value)) {
        allOptions.push({ value, label: String(value) });
      }
    }
    return term
      ? allOptions.filter(option => option.label.toLocaleLowerCase().includes(term))
      : allOptions;
  }

  addCustomOption(event: Event): void {
    if (!this.allowCustom) {
      return;
    }

    event.preventDefault();
    const value = this.searchTerm().trim();
    if (!value) {
      return;
    }

    const existing = this.options.find(option => option.label.toLocaleLowerCase() === value.toLocaleLowerCase());
    const selectedValue = existing?.value ?? value;
    if (!this.isSelected(selectedValue)) {
      const updated = [...this.selectedValues(), selectedValue];
      this.selectedValues.set(updated);
      this.selectionChange.emit(updated);
    }
    this.searchTerm.set('');
  }

  isSelected(value: any): boolean {
    return this.selectedValues().includes(value);
  }

  getLabel(value: any): string {
    const option = this.options.find(o => o.value === value);
    return option?.label || String(value);
  }

  toggleOption(value: any): void {
    const current = this.selectedValues();
    let updated: any[];

    if (current.includes(value)) {
      updated = current.filter(v => v !== value);
    } else {
      updated = [...current, value];
    }

    this.selectedValues.set(updated);
    this.selectionChange.emit(updated);
  }
}
