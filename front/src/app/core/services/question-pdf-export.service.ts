import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfQuizQuestionBlock {
  index: number;
  title: string;
  typeLabel: string;
  bodyText: string;
  points: number;
  answerSeconds: number;
  choices: { letter: string; text: string; correct: boolean }[];
}

@Injectable({ providedIn: 'root' })
export class QuestionPdfExportService {
  escapeHtml(text: string): string {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  stripHtml(html: string): string {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  slug(name: string, fallback: string): string {
    const s = String(name || fallback || 'export')
      .replace(/[^\w\u0600-\u06FF\- ]+/g, '_')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 72);
    return s || fallback;
  }

  /** Full question content (stem + choices), same layout as test PDF — not a summary table only. */
  async exportQuestionsDetailPdf(title: string, fileSlug: string, questions: any[]): Promise<void> {
    const blocks = this.buildBlocksFromStandaloneQuestions(questions);
    await this.renderHtmlToPdf(fileSlug, this.buildQuizPaperHtml(title, blocks, 'questions'));
  }

  async exportQuizPaperPdf(quizTitle: string, fileSlug: string, blocks: PdfQuizQuestionBlock[]): Promise<void> {
    await this.renderHtmlToPdf(fileSlug, this.buildQuizPaperHtml(quizTitle, blocks, 'exam'));
  }

  /** One PDF document containing several tests (each with its own title and questions). */
  async exportMultipleQuizPapersPdf(
    fileSlug: string,
    sections: { title: string; blocks: PdfQuizQuestionBlock[] }[]
  ): Promise<void> {
    const nonEmpty = sections.filter((s) => s.blocks.length > 0);
    if (!nonEmpty.length) return;
    const merged = nonEmpty
      .map((s, i) => {
        const sep =
          i > 0
            ? '<div style="height:12px"></div><hr style="margin:24px 0;border:none;border-top:2px solid #333"/>'
            : '';
        return `${sep}${this.buildQuizPaperHtml(s.title, s.blocks, 'exam')}`;
      })
      .join('');
    await this.renderHtmlToPdf(fileSlug, merged);
  }

  private buildQuizPaperHtml(
    quizTitle: string,
    blocks: PdfQuizQuestionBlock[],
    docKind: 'exam' | 'questions' = 'exam'
  ): string {
    const metaLine =
      docKind === 'questions'
        ? `Question bank / list · ${new Date().toLocaleString()}`
        : `Test / Exam paper · ${new Date().toLocaleString()}`;
    const parts = blocks.map((b) => {
      const choices =
        b.choices.length > 0
          ? `<ol style="margin:8px 0 0 18px;padding:0">
            ${b.choices
              .map(
                (c) => `<li style="margin:4px 0">
              <strong>${this.escapeHtml(c.letter)}.</strong> ${this.escapeHtml(c.text)}
              ${c.correct ? ' <em>(correct)</em>' : ''}
            </li>`
              )
              .join('')}
          </ol>`
          : '';
      return `<section style="margin-bottom:22px;border-bottom:1px solid #eee;padding-bottom:14px">
        <h2 style="font-size:15px;margin:0 0 6px">Q${b.index}. ${this.escapeHtml(b.title)}</h2>
        <p style="font-size:11px;color:#666;margin:0 0 8px">${this.escapeHtml(b.typeLabel)} · Points: ${b.points} · Time: ${b.answerSeconds}s</p>
        ${b.bodyText ? `<p style="margin:8px 0;line-height:1.45;white-space:pre-wrap">${this.escapeHtml(b.bodyText)}</p>` : ''}
        ${choices}
      </section>`;
    });
    return `<h1 style="font-size:22px;margin:0 0 8px">${this.escapeHtml(quizTitle)}</h1>
      <p style="font-size:11px;color:#666;margin:0 0 18px">${metaLine}</p>
      ${parts.join('')}`;
  }

  /** Maps quiz API question rows to PDF blocks (uses nested `question` when present). */
  buildQuizBlocksFromApi(questions: any[]): PdfQuizQuestionBlock[] {
    const sorted = [...questions].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
    return sorted.map((row: any, idx: number) => {
      const q = row?.question ?? row;
      const type = Number(q?.type ?? 1);
      const selectionMode = Number(q?.selectionMode ?? 1);
      const typeLabel = this.typeLabelForQuestion(type, selectionMode);
      const choices = this.mapChoicesToPdfRows(q?.choices || []);
      const points = Number(row?.pointsOverride ?? q?.points ?? 0) || 0;
      const answerSeconds = Number(row?.answerSeconds ?? q?.answerSeconds ?? 30) || 30;
      return {
        index: idx + 1,
        title: String(q?.title ?? row?.questionTitle ?? `Question ${idx + 1}`),
        typeLabel,
        bodyText: this.stripHtml(String(q?.text ?? '')),
        points,
        answerSeconds,
        choices
      };
    });
  }

  /** Bank / list: each item is a `Question` (or API-shaped object). */
  buildBlocksFromStandaloneQuestions(questions: any[]): PdfQuizQuestionBlock[] {
    return (questions || []).map((q: any, idx: number) => {
      const type = Number(q?.type ?? 1);
      const selectionMode = Number(q?.selectionMode ?? 1);
      const typeLabel = this.typeLabelForQuestion(type, selectionMode);
      const choices = this.mapChoicesToPdfRows(q?.choices || []);
      return {
        index: idx + 1,
        title: String(q?.title ?? `Question ${idx + 1}`),
        typeLabel,
        bodyText: this.stripHtml(String(q?.text ?? '')),
        points: Number(q?.points ?? 0) || 0,
        answerSeconds: Number(q?.answerSeconds ?? 30) || 30,
        choices
      };
    });
  }

  private mapChoicesToPdfRows(choices: any[]): { letter: string; text: string; correct: boolean }[] {
    return [...(choices || [])]
      .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
      .map((c: any, i: number) => ({
        letter: String.fromCharCode(65 + i),
        text: this.stripHtml(String(c?.choiceText ?? c?.ChoiceText ?? '')),
        correct: Boolean(c?.isCorrect ?? c?.IsCorrect)
      }));
  }

  private typeLabelForQuestion(type: number, selectionMode: number): string {
    if (type === 3) return 'Short Answer';
    if (type === 2) return 'True / False';
    if (type === 1) return selectionMode === 2 ? 'Multiple Choice' : 'Single Choice';
    return this.typeName(type);
  }

  private typeName(type: number): string {
    const types: Record<number, string> = { 1: 'Multiple Choice', 2: 'True/False', 3: 'Short Answer' };
    return types[type] || 'Question';
  }

  /**
   * html2canvas cannot parse modern CSS color functions (e.g. color(srgb ...)) from the host app theme.
   * Render inside an isolated iframe + sanitize cloned tree so export works reliably.
   */
  private async renderHtmlToPdf(fileSlug: string, innerHtml: string): Promise<void> {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'pdf-export');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;left:-12000px;top:0;width:820px;height:auto;min-height:0;border:0;margin:0;padding:0;opacity:0;pointer-events:none;visibility:hidden';
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument!;
    idoc.open();
    idoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>
        html, body { margin: 0; background: #ffffff !important; }
        body {
          box-sizing: border-box;
          padding: 28px 32px;
          width: 800px;
          font: 14px Tahoma, "Segoe UI", Arial, sans-serif;
          line-height: 1.45;
          color: #111111 !important;
        }
        *, *::before, *::after { box-sizing: border-box; }
        table { border-collapse: collapse; }
        th, td { border-color: #cccccc !important; }
      </style></head><body dir="auto"></body></html>`);
    idoc.close();
    idoc.body.innerHTML = innerHtml;

    const target = idoc.body;

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const contentHeight = Math.ceil(
        Math.max(target.scrollHeight, idoc.documentElement.scrollHeight, target.offsetHeight || 0)
      );
      iframe.style.height = `${Math.min(Math.max(contentHeight + 40, 80), 50000)}px`;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const canvas = await html2canvas(target, {
        scale: 1.25,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        windowHeight: Math.min(Math.max(contentHeight + 40, 200), 50000),
        scrollX: 0,
        scrollY: 0,
        foreignObjectRendering: false,
        onclone: (clonedDoc, cloned) => {
          this.sanitizeColorsForHtml2Canvas(clonedDoc, cloned as HTMLElement);
        }
      });

      const imgMime = 'image/jpeg';
      const quality = 0.88;
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentW = pageWidth - margin * 2;
      const contentH = pageHeight - margin * 2;

      const sliceHeightPx = Math.ceil((contentH * canvas.width) / contentW);
      let yPx = 0;
      let first = true;

      while (yPx < canvas.height) {
        const hPx = Math.min(sliceHeightPx, canvas.height - yPx);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = hPx;
        const ctx = slice.getContext('2d');
        if (!ctx) break;
        ctx.drawImage(canvas, 0, yPx, canvas.width, hPx, 0, 0, canvas.width, hPx);
        const data = slice.toDataURL(imgMime, quality);
        const sliceMmH = (hPx * contentW) / canvas.width;
        if (!first) doc.addPage();
        doc.addImage(data, 'JPEG', margin, margin, contentW, sliceMmH);
        first = false;
        yPx += hPx;
      }

      doc.save(`${fileSlug}.pdf`);
    } finally {
      iframe.remove();
    }
  }

  /** Replace color values that html2canvas cannot parse (color(), oklch(), etc.). */
  private sanitizeColorsForHtml2Canvas(doc: Document, root: HTMLElement): void {
    const win = doc.defaultView;
    if (!win) return;

    const bad = (v: string) =>
      /\bcolor\s*\(/i.test(v) || /\boklch\s*\(/i.test(v) || /\blab\s*\(/i.test(v) || /\blch\s*\(/i.test(v);

    const nodes: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
    for (const el of nodes) {
      try {
        const cs = win.getComputedStyle(el);
        if (bad(cs.color)) {
          el.style.setProperty('color', '#111111', 'important');
        }
        if (bad(cs.backgroundColor)) {
          el.style.setProperty('background-color', '#ffffff', 'important');
        }
        if (bad(cs.borderColor)) {
          el.style.setProperty('border-color', '#cccccc', 'important');
        }
      } catch {
        /* ignore single node */
      }
    }
  }
}
