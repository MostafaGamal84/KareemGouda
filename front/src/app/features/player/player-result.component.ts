import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlayerService } from '../../core/services/player.service';
import { SafeRichTextPipe } from '../../shared/safe-rich-text.pipe';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, SafeRichTextPipe],
  template: `
    <div class="card" style="max-width:700px;margin:auto;">
      <h2>Final Result</h2>
      @if (result) {
        <p><b>{{ result.displayName }}</b></p>
        <p>Total Score: {{ result.totalScore }}</p>
        <p>Correct: {{ result.correctAnswers }} | Wrong: {{ result.wrongAnswers }}</p>
        <p>Average Response: {{ result.averageResponseTimeMs | number:'1.0-0' }} ms</p>
        @for (item of result.reviewQuestions ?? []; track item.questionId) {
          @if (item.explanation) {
            <section class="card">
              <h3>{{ item.questionIndex + 1 }}. {{ item.questionTitle }}</h3>
              <div [innerHTML]="item.questionText | safeRichText"></div>
              <strong>Answer explanation</strong>
              <div class="rich-text-content" style="white-space: pre-wrap" [innerHTML]="item.explanation"></div>
            </section>
          }
        }
      }
      @if (error) { <div class="alert">{{ error }}</div> }
      <a [routerLink]="['/player/session', sessionId, 'waiting-room']"><button class="secondary">Back</button></a>
    </div>
  `
})
export class PlayerResultComponent implements OnInit {
  sessionId = 0;
  participantId = 0;
  result: any;
  error = '';

  constructor(private route: ActivatedRoute, private playerService: PlayerService) {}

  ngOnInit(): void {
    this.sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    this.participantId = Number(this.route.snapshot.paramMap.get('participantId'));

    this.playerService.result(this.sessionId, this.participantId).subscribe({
      next: (res) => this.result = res,
      error: (err) => this.error = err?.error?.message || 'Failed to load result'
    });
  }
}
