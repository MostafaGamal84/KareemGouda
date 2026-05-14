import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlayerService } from '../../core/services/player.service';
import { SignalrService } from '../../core/services/signalr.service';
import { GameSessionService } from '../../core/services/game-session.service';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SafeRichTextPipe } from '../../shared/safe-rich-text.pipe';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SafeRichTextPipe],
  template: `
    <div class="live-shell">
      <header class="hero-head">
        <div class="hero-badge">
          <span class="hero-value">{{ leaderboard.length }}</span>
          <span class="hero-label">Players</span>
        </div>
        <div class="hero-badge" [class.hero-badge-danger]="isTimedFlow() && isTimeUp">
          @if (isTimedFlow()) {
            <span class="hero-value">{{ timeRemainingSeconds }}s</span>
            <span class="hero-label">Time</span>
          } @else {
            <span class="hero-value">Host</span>
            <span class="hero-label">Flow</span>
          }
        </div>
      </header>

      <section class="hero-stage" aria-hidden="true">
        @if (quizCoverImageUrl) {
          <img class="hero-image" [src]="quizCoverImageUrl" alt="Quiz cover" />
        } @else {
          <div class="hero-cup">QUIZ</div>
        }
      </section>

      <section class="sheet">
        <nav class="sheet-tabs" aria-label="View switcher">
          <button type="button" [class.active]="activeTab === 'interactions'" (click)="setTab('interactions')">Interactions</button>
          <button type="button" [class.active]="activeTab === 'leaderboard'" (click)="setTab('leaderboard')">Leaderboard</button>
        </nav>

        @if (activeTab === 'interactions') {
          <div class="sheet-body">
            @if (question) {
              <h2 class="question-title">{{ question.title }}</h2>
              <div class="question-text rich-text-content" [innerHTML]="question.text | safeRichText"></div>

              @if (question.imageUrl) {
                <img class="question-inline-image" [src]="question.imageUrl" alt="Question illustration" />
              }

              @if (isTimedFlow()) {
                <div class="timer-track">
                  <div class="timer-fill" [class.timer-fill-danger]="isTimeUp" [style.width.%]="timeProgressPercent()"></div>
                </div>
                <p class="timer-label">Time left: {{ timeRemainingSeconds }}s</p>
              }

              <div class="voice-status" [class.voice-status-live]="isHostVoiceLive">
                <span>{{ isHostVoiceLive ? 'Host voice is live' : 'Host voice is off' }}</span>
                @if (voiceNeedsUserInteraction) {
                  <button type="button" class="voice-enable-btn" (click)="enableVoicePlayback()">Enable Audio</button>
                }
              </div>

              @if (question.type !== 3) {
                @if (isMultipleChoiceQuestion()) {
                  <div class="voice-status">
                    <span>Select every correct answer, then press submit.</span>
                  </div>
                }

                <div class="choices-wrap">
                  @for (c of question.choices; track c.id) {
                    <button
                      type="button"
                      class="choice-pill"
                      [class.choice-pill-selected]="isChoiceSelected(c.id)"
                      [class.choice-pill-locked]="submitted"
                      [class.choice-pill-correct]="isChoiceCorrect(c.id)"
                      [class.choice-pill-wrong]="isChoiceWrong(c.id)"
                      [attr.aria-pressed]="isChoiceSelected(c.id)"
                      [disabled]="isChoiceLocked()"
                      (click)="selectChoice(c.id)">
                      <span class="choice-icon">{{ isChoiceSelected(c.id) ? 'OK' : 'O' }}</span>
                      <span class="choice-body">
                        @if (c.choiceText) {
                          <span class="choice-text">{{ c.choiceText }}</span>
                        }
                        @if (c.imageUrl) {
                          <img class="choice-image" [src]="c.imageUrl" alt="Answer option" />
                        }
                      </span>
                    </button>
                  }
                </div>
              }

              @if (question.type === 3) {
                <div class="col" style="gap:4px;">
                  <label for="live-question-answer">Your answer</label>
                  <input id="live-question-answer" name="liveQuestionAnswer" [(ngModel)]="textAnswer" placeholder="Type your answer" />
                </div>
              }

              <div class="action-row" [class.action-row-choice]="question.type !== 3">
                @if (needsSubmitButton()) {
                  <button class="submit-btn" [disabled]="submitted || isPaused || isTimeUp || isSessionEnded || isSubmittingAnswer" (click)="submit()">
                    {{ submitted ? 'Submitted' : (isSubmittingAnswer ? 'Submitting...' : 'Submit Answer') }}
                  </button>
                }
                <button class="action-btn" (click)="refreshLeaderboard()">Refresh</button>
                <button class="action-btn" [disabled]="isSessionEnded || isLeaving" (click)="leaveSession()">Leave</button>
              </div>

              @if ((submitted || isRevealPhase) && question.explanation) {
                <div class="voice-status voice-status-live">
                  <span>{{ question.explanation }}</span>
                </div>
              }
            } @else {
              <div class="empty-state">Waiting for next question...</div>
            }
          </div>
        }

        @if (activeTab === 'leaderboard') {
          <div class="sheet-body">
            <h2 class="question-title">Live Leaderboard</h2>

            @if (leaderboard.length) {
              <div class="rank-list">
                @for (l of leaderboard; track l.participantId) {
                  <div class="rank-item">
                    <div class="rank-left">
                      <span class="rank-num">{{ l.rank }}</span>
                      <span class="rank-name">{{ l.displayName }}</span>
                    </div>
                    <span class="rank-score">{{ l.totalScore }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-state">No leaderboard data yet.</div>
            }

            <div class="action-row">
              <button class="action-btn" (click)="refreshLeaderboard()">Refresh Leaderboard</button>
              <button class="action-btn" [disabled]="isSessionEnded || isLeaving" (click)="leaveSession()">Leave Session</button>
            </div>
          </div>
        }

        @if (message) { <div class="notice success">{{ message }}</div> }
        @if (error) { <div class="notice alert">{{ error }}</div> }
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
    }

    .live-shell {
      width: min(100%, 980px);
      max-width: 100%;
      min-width: 0;
      margin: 0 auto;
      min-height: calc(100vh - 24px);
      border-radius: 22px;
      overflow: hidden;
      position: relative;
      border: 1px solid var(--border-strong);
      background:
        radial-gradient(72% 58% at 18% 18%, var(--ring-strong), transparent 78%),
        linear-gradient(180deg, var(--surface-elevated), var(--surface-strong));
      box-shadow: var(--shadow-panel);
      color: var(--text);
    }

    .hero-head {
      position: absolute;
      top: 12px;
      inset-inline: 12px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      z-index: 3;
      flex-wrap: wrap;
    }

    .hero-badge {
      flex: 1 1 120px;
      min-width: 0;
      border-radius: 13px;
      padding: 7px 10px;
      background: var(--surface);
      border: 1px solid var(--border-strong);
      display: grid;
      justify-items: center;
      line-height: 1.1;
      backdrop-filter: blur(10px);
    }

    .hero-badge-danger {
      border-color: var(--danger);
      box-shadow: 0 0 0 1px var(--danger-tint) inset;
    }

    .hero-value {
      font-size: 1.02rem;
      font-weight: 800;
      color: var(--text);
    }

    .hero-label {
      font-size: 0.73rem;
      letter-spacing: 0.02em;
      color: var(--muted-strong);
    }

    .hero-stage {
      min-height: clamp(260px, 55vh, 620px);
      display: grid;
      place-items: center;
      padding: 56px 16px 22px;
    }

    .hero-image {
      width: min(92%, 420px);
      max-width: 100%;
      aspect-ratio: 3 / 4;
      object-fit: cover;
      border-radius: 18px;
      border: 1px solid var(--border-strong);
      box-shadow: var(--shadow-soft);
      background: var(--surface);
    }

    .hero-cup {
      font-size: clamp(5rem, 16vw, 8.6rem);
      color: var(--muted-strong);
      text-shadow: 0 16px 18px var(--ring);
      transform: translateY(8px);
    }

    .sheet {
      border-top: 1px solid var(--border);
      border-radius: 24px 24px 0 0;
      padding: 10px 12px 14px;
      background: var(--surface-strong);
      backdrop-filter: blur(7px);
    }

    .sheet-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 10px;
      background: var(--surface-soft);
      border-radius: 16px;
      border: 1px solid var(--border);
      padding: 4px;
    }

    .sheet-tabs button {
      border: none;
      border-radius: 12px;
      background: transparent;
      color: var(--muted-strong);
      font-weight: 700;
      box-shadow: none;
      min-height: 38px;
      padding: 8px;
    }

    .sheet-tabs button.active {
      background: var(--primary-gradient);
      color: #ffffff;
      box-shadow: none;
    }

    .sheet-body {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .question-title {
      margin: 0;
      font-size: 1.22rem;
      color: var(--text);
      line-height: 1.35;
    }

    .question-text {
      margin: 0;
      font-size: 1.02rem;
      color: var(--text-soft);
      line-height: 1.55;
    }

    .question-inline-image {
      width: min(320px, 100%);
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface);
    }

    .timer-track {
      margin-top: 2px;
      height: 9px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      overflow: hidden;
    }

    .timer-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--primary));
    }

    .timer-fill.timer-fill-danger {
      background: linear-gradient(90deg, var(--danger), var(--warning));
    }

    .timer-label {
      margin: 0;
      font-size: 0.84rem;
      color: var(--muted-strong);
    }

    .voice-status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--text-soft);
      font-size: 0.86rem;
      line-height: 1.2;
    }

    .voice-status.voice-status-live {
      border-color: var(--success-border);
      background: var(--success-tint);
      color: var(--text);
    }

    .voice-enable-btn {
      min-height: 30px;
      padding: 5px 10px;
      border-radius: 8px;
      border: 1px solid var(--border-strong);
      background: var(--secondary-gradient);
      color: var(--text);
      font-size: 0.8rem;
      box-shadow: none;
      white-space: nowrap;
    }

    .choices-wrap {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .choice-pill {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 999px;
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--text);
      text-align: left;
      box-shadow: none;
    }

    .choice-pill:hover:not(:disabled) {
      border-color: var(--input-focus-border);
      background: var(--surface-soft);
      transform: translateY(-1px);
    }

    .choice-pill.choice-pill-selected {
      border-color: var(--accent);
      background: var(--success-tint);
      color: var(--text);
    }

    .choice-pill.choice-pill-locked {
      opacity: 0.92;
    }

    .choice-pill.choice-pill-correct {
      border-color: var(--success-border);
      background: var(--success-bg);
      box-shadow: 0 0 0 1px var(--success-border) inset;
      color: var(--success-text);
    }

    .choice-pill.choice-pill-wrong {
      border-color: var(--alert-border);
      background: var(--alert-bg);
      box-shadow: 0 0 0 1px var(--alert-border) inset;
      color: var(--alert-text);
    }

    .choice-icon {
      width: 24px;
      min-width: 24px;
      height: 24px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      color: var(--muted-strong);
      font-weight: 800;
    }

    .choice-text {
      font-size: 1.03rem;
      line-height: 1.4;
      word-break: break-word;
      min-width: 0;
    }

    .choice-body {
      display: grid;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }

    .choice-image {
      width: min(220px, 100%);
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .action-row {
      display: grid;
      grid-template-columns: 1.25fr 1fr 1fr;
      gap: 8px;
      margin-top: 2px;
    }

    .action-row.action-row-choice {
      grid-template-columns: 1fr 1fr;
    }

    .submit-btn {
      background: var(--primary-gradient);
      color: #ffffff;
      border: 1px solid var(--input-focus-border);
      border-radius: 11px;
      box-shadow: none;
      min-height: 42px;
    }

    .action-btn {
      background: var(--secondary-gradient);
      color: var(--text-soft);
      border: 1px solid var(--border-strong);
      border-radius: 11px;
      box-shadow: none;
      min-height: 42px;
    }

    .rank-list {
      display: grid;
      gap: 8px;
      max-height: 270px;
      overflow: auto;
      padding-right: 2px;
      min-width: 0;
    }

    .rank-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 12px;
      padding: 10px 12px;
      gap: 10px;
      min-width: 0;
    }

    .rank-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .rank-num {
      min-width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: var(--ring);
      border: 1px solid var(--border-strong);
      color: var(--text);
      font-weight: 800;
      font-size: 0.82rem;
    }

    .rank-name {
      color: var(--text);
      font-weight: 700;
      font-size: 0.98rem;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rank-score {
      color: var(--accent-strong);
      font-weight: 800;
      font-size: 1rem;
    }

    .empty-state {
      border: 1px dashed var(--border-strong);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      color: var(--muted-strong);
      background: var(--surface);
    }

    .notice {
      margin-top: 10px;
    }

    @media (max-width: 900px) {
      .live-shell {
        min-height: calc(100vh - 12px);
        border-radius: 18px;
      }
    }

    @media (max-width: 640px) {
      .hero-head {
        inset-inline: 10px;
      }

      .hero-stage {
        min-height: 42vh;
        padding-inline: 12px;
      }

      .sheet {
        border-radius: 22px 22px 0 0;
        padding: 10px 10px 14px;
      }

      .action-row,
      .action-row.action-row-choice {
        grid-template-columns: 1fr;
      }

      .choice-pill {
        align-items: flex-start;
        border-radius: 18px;
      }
    }
  `]
})
export class PlayerLiveQuestionComponent implements OnInit, OnDestroy {
  private readonly revealDurationMs = 4000;
  sessionId = 0;
  participantId = 0;
  participantToken = '';
  quizCoverImageUrl = '';
  questionFlowMode = 1;
  currentQuestionIndex = -1;
  currentQuestionEndsAtUtc: string | null = null;
  questionStartedAtMs = 0;
  questionDurationSeconds = 0;
  timeRemainingSeconds = 0;
  isTimeUp = false;
  timerDashOffset = 2 * Math.PI * 30;
  readonly timerCircumference = 2 * Math.PI * 30;
  question: any;
  selectedChoiceIds: number[] = [];
  textAnswer = '';
  activeTab: 'interactions' | 'leaderboard' = 'interactions';
  submitted = false;
  isSubmittingAnswer = false;
  isRevealPhase = false;
  submittedIsCorrect: boolean | null = null;
  correctChoiceIds: number[] = [];
  isPaused = false;
  isSessionEnded = false;
  isHostVoiceLive = false;
  voiceNeedsUserInteraction = false;
  leaderboard: any[] = [];
  message = '';
  error = '';
  isLeaving = false;
  private stateSyncId: ReturnType<typeof setInterval> | null = null;
  private questionTimerId: ReturnType<typeof setInterval> | null = null;
  private revealTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pendingNextQuestionState: any | null = null;
  private timeUpHandledForQuestion = false;
  private voicePeer: RTCPeerConnection | null = null;
  private voiceAudioElement: HTMLAudioElement | null = null;
  private pendingVoiceIceCandidates: RTCIceCandidateInit[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private playerService: PlayerService,
    private signalr: SignalrService,
    private gameSessionService: GameSessionService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  async ngOnInit(): Promise<void> {
    this.sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    if (isPlatformBrowser(this.platformId)) {
      this.participantId = Number(localStorage.getItem('participant_id') || 0);
      this.participantToken = localStorage.getItem('participant_token') || '';
    }

    if (!this.participantId || !this.participantToken) {
      this.navigateToJoin();
      return;
    }

    const canPlay = await this.ensureParticipantApproved();
    if (!canPlay) {
      return;
    }

    this.loadQuestionFromState();
    this.refreshLeaderboard();
    this.startStateSync();

    try {
      await this.signalr.connect();
      await this.signalr.joinSessionGroup(this.sessionId);
      this.loadQuestionFromState();
      this.refreshLeaderboard();

      this.signalr.on('sessionStarted', (payload) => {
        this.resetInteractionForNewQuestion();
        this.applySessionState(payload);
        this.cdr.detectChanges();
      });

      this.signalr.on('nextQuestion', (payload) => {
        this.handleIncomingNextQuestion(payload);
        this.cdr.detectChanges();
      });

      this.signalr.on('leaderboardUpdated', (payload) => {
        this.leaderboard = payload || [];
        this.cdr.detectChanges();
      });
      this.signalr.on('playerJoined', () => {
        this.refreshLeaderboard();
        this.cdr.detectChanges();
      });
      this.signalr.on('sessionPaused', () => {
        this.isPaused = true;
        this.message = 'Session paused by host';
        this.cdr.detectChanges();
      });
      this.signalr.on('sessionResumed', () => {
        this.isPaused = false;
        this.message = 'Session resumed';
        this.loadQuestionFromState();
        this.cdr.detectChanges();
      });
      this.signalr.on('sessionUpdated', (payload) => {
        const status = Number(payload?.status ?? payload?.Status ?? 0);
        const index = Number(payload?.currentQuestionIndex ?? payload?.CurrentQuestionIndex ?? -1);
        this.isSessionEnded = status === 5;
        if (status === 4) this.isPaused = true;
        if (status === 3) this.isPaused = false;
        if (status === 3 && (!this.question || (index >= 0 && index !== this.currentQuestionIndex))) {
          this.loadQuestionFromState();
        }
        this.cdr.detectChanges();
      });
      this.signalr.on('joinRequestRejected', (payload) => {
        if (Number(payload?.participantId ?? 0) !== this.participantId) return;
        this.navigateToJoin();
        this.cdr.detectChanges();
      });
      this.signalr.on('participantLeft', (payload) => {
        if (Number(payload?.participantId ?? 0) !== this.participantId) return;
        this.navigateToJoin();
        this.cdr.detectChanges();
      });
      this.signalr.on('sessionEnded', () => {
        this.isSessionEnded = true;
        this.closeVoiceConnection();
        this.router.navigate(['/player/session', this.sessionId, 'result', this.participantId]);
        this.cdr.detectChanges();
      });
      this.signalr.on('voiceOffer', (payload) => {
        void this.handleVoiceOffer(payload);
      });
      this.signalr.on('voiceIceCandidate', (payload) => {
        void this.handleVoiceIceCandidate(payload);
      });
      this.signalr.on('hostVoiceStopped', (payload) => {
        if (Number(payload?.sessionId ?? 0) !== this.sessionId) return;
        this.closeVoiceConnection();
        this.cdr.detectChanges();
      });

      await this.registerVoiceListener();
    } catch {
      this.error = 'Live updates unavailable. You can continue by refreshing manually.';
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.signalr.off('sessionStarted');
    this.signalr.off('nextQuestion');
    this.signalr.off('leaderboardUpdated');
    this.signalr.off('playerJoined');
    this.signalr.off('sessionPaused');
    this.signalr.off('sessionResumed');
    this.signalr.off('sessionUpdated');
    this.signalr.off('joinRequestRejected');
    this.signalr.off('participantLeft');
    this.signalr.off('sessionEnded');
    this.signalr.off('voiceOffer');
    this.signalr.off('voiceIceCandidate');
    this.signalr.off('hostVoiceStopped');
    this.stopStateSync();
    this.stopQuestionTimer();
    this.clearRevealTimeout();
    void this.unregisterVoiceListener();
    this.closeVoiceConnection();
    this.signalr.leaveSessionGroup(this.sessionId);
    this.signalr.disconnect();
  }

  submit(): void {
    if (!this.question || this.submitted || this.isSubmittingAnswer) return;
    if (this.isTimedFlow() && this.isTimeUp) {
      this.error = 'Time is up for this question';
      return;
    }

    if (Number(this.question?.type) !== 3 && this.selectedChoiceIds.length === 0) {
      this.error = 'Choose an option first.';
      return;
    }

    const responseTimeMs = this.questionStartedAtMs > 0
      ? Math.max(0, Date.now() - this.questionStartedAtMs)
      : 0;

    this.isSubmittingAnswer = true;
    this.error = '';

    this.playerService.submitAnswer(this.sessionId, {
      participantId: this.participantId,
      questionId: this.question.id,
      selectedChoiceId: this.selectedChoiceIds.length === 1 ? this.selectedChoiceIds[0] : null,
      selectedChoiceIds: this.selectedChoiceIds,
      textAnswer: this.textAnswer,
      responseTimeMs
    }).subscribe({
      next: (res: any) => {
        this.isSubmittingAnswer = false;
        const accepted = Boolean(res?.accepted ?? res?.Accepted ?? false);
        if (!accepted) {
          this.error = String(res?.message ?? res?.Message ?? 'Unable to submit answer');
          this.cdr.detectChanges();
          return;
        }

        this.submitted = true;
        const isCorrect = Boolean(res?.isCorrect ?? res?.IsCorrect ?? false);
        this.submittedIsCorrect = isCorrect;
        const correctChoiceIds = Array.isArray(res?.correctChoiceIds ?? res?.CorrectChoiceIds)
          ? (res?.correctChoiceIds ?? res?.CorrectChoiceIds).map((value: any) => Number(value)).filter((value: number) => value > 0)
          : [];
        const fallbackCorrectId = Number(res?.correctChoiceId ?? res?.CorrectChoiceId ?? 0);
        this.correctChoiceIds = correctChoiceIds.length
          ? correctChoiceIds
          : (fallbackCorrectId > 0 ? [fallbackCorrectId] : []);
        this.message = Number(this.question?.type) === 3 ? 'Answer submitted' : 'Choice locked';
        this.refreshLeaderboard();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSubmittingAnswer = false;
        this.error = err?.error?.message || 'Submit failed';
        this.cdr.detectChanges();
      }
    });
  }

  selectChoice(choiceId: number): void {
    if (Number(this.question?.type) === 3 || this.isChoiceLocked()) {
      return;
    }

    if (this.isMultipleChoiceQuestion()) {
      this.selectedChoiceIds = this.selectedChoiceIds.includes(choiceId)
        ? this.selectedChoiceIds.filter((id) => id !== choiceId)
        : [...this.selectedChoiceIds, choiceId];
    } else {
      this.selectedChoiceIds = [choiceId];
    }
    this.message = '';
    this.error = '';
    if (!this.isMultipleChoiceQuestion()) {
      this.submit();
    }
  }

  isChoiceLocked(): boolean {
    return this.submitted || this.isSubmittingAnswer || this.isPaused || this.isTimeUp || this.isSessionEnded;
  }

  isChoiceCorrect(choiceId: number): boolean {
    return this.isRevealPhase && this.correctChoiceIds.includes(Number(choiceId));
  }

  isChoiceWrong(choiceId: number): boolean {
    return this.isRevealPhase
      && this.selectedChoiceIds.includes(Number(choiceId))
      && !this.correctChoiceIds.includes(Number(choiceId));
  }

  setTab(tab: 'interactions' | 'leaderboard'): void {
    this.activeTab = tab;
  }

  timeProgressPercent(): number {
    const total = Math.max(0, Number(this.questionDurationSeconds || this.question?.answerSeconds || 0));
    if (total <= 0) {
      return 0;
    }

    const remaining = Math.max(0, Math.min(total, Number(this.timeRemainingSeconds || 0)));
    return (remaining / total) * 100;
  }

  refreshLeaderboard(): void {
    this.playerService.leaderboard(this.sessionId).subscribe({
      next: (res) => {
        this.leaderboard = res;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  leaveSession(): void {
    if (this.isSessionEnded) {
      return;
    }

    if (this.isLeaving) {
      return;
    }

    this.isLeaving = true;

    if (!this.participantId || !this.participantToken) {
      this.navigateToJoin();
      return;
    }

    this.playerService.leave(this.sessionId, {
      participantId: this.participantId,
      participantToken: this.participantToken
    }).subscribe({
      next: () => this.navigateToJoin(),
      error: () => this.navigateToJoin()
    });
  }

  private async ensureParticipantApproved(): Promise<boolean> {
    try {
      const status = await firstValueFrom(
        this.playerService.participantStatus(this.sessionId, this.participantId, this.participantToken)
      );

      const normalized = this.normalizeJoinStatus(status?.joinStatus ?? status?.JoinStatus);
      if (normalized === 'approved') {
        return true;
      }

      if (normalized === 'pending') {
        this.router.navigate(['/player/session', this.sessionId, 'waiting-room']);
        return false;
      }

      if (normalized === 'rejected' || normalized === 'left') {
        this.navigateToJoin();
        return false;
      }

      this.error = 'Unable to verify join status. Trying to load live question...';
      return true;
    } catch {
      this.error = 'Failed to verify join status. Trying to load live question...';
      return true;
    }
  }

  private normalizeJoinStatus(value: any): 'pending' | 'approved' | 'rejected' | 'left' | 'unknown' {
    if (value === null || value === undefined) return 'unknown';

    const asString = String(value).trim().toLowerCase();
    if (asString === '1' || asString === 'pending') return 'pending';
    if (asString === '2' || asString === 'approved') return 'approved';
    if (asString === '3' || asString === 'rejected') return 'rejected';
    if (asString === '4' || asString === 'left') return 'left';

    const asNumber = Number(value);
    if (asNumber === 1) return 'pending';
    if (asNumber === 2) return 'approved';
    if (asNumber === 3) return 'rejected';
    if (asNumber === 4) return 'left';

    return 'unknown';
  }

  private navigateToJoin(): void {
    this.clearParticipantStorage();
    this.router.navigate(['/player/join']);
  }

  private applySessionState(payload: any): void {
    if (!payload) {
      return;
    }

    const coverImageUrl =
      payload?.quizCoverImageUrl ??
      payload?.QuizCoverImageUrl ??
      payload?.coverImageUrl ??
      payload?.CoverImageUrl ??
      '';
    this.quizCoverImageUrl = this.resolveAssetUrl(coverImageUrl);

    const status = Number(payload?.status ?? payload?.Status ?? 0);
    const flowMode = Number(payload?.questionFlowMode ?? payload?.QuestionFlowMode ?? 1);
    const index = Number(payload?.currentQuestionIndex ?? payload?.CurrentQuestionIndex ?? -1);
    const endsAt =
      payload?.currentQuestionEndsAtUtc ??
      payload?.CurrentQuestionEndsAtUtc ??
      payload?.currentQuestionEndsAt ??
      payload?.CurrentQuestionEndsAt ??
      null;

    this.questionFlowMode = flowMode === 2 ? 2 : 1;
    const previousIndex = this.currentQuestionIndex;
    if (index >= 0) {
      this.currentQuestionIndex = index;
    }
    this.currentQuestionEndsAtUtc = endsAt ? String(endsAt) : null;

    if (status === 4) {
      this.isPaused = true;
    } else if (status === 3) {
      this.isPaused = false;
    } else if (status === 5) {
      this.isSessionEnded = true;
      this.router.navigate(['/player/session', this.sessionId, 'result', this.participantId]);
      return;
    }

    const currentQuestion = payload?.currentQuestion ?? payload?.CurrentQuestion ?? null;
    const durationFromState = Number(payload?.currentQuestionDurationSeconds ?? payload?.CurrentQuestionDurationSeconds ?? 0);
    if (currentQuestion) {
      const questionChanged =
        !this.question ||
        Number(this.question?.id ?? 0) !== Number(currentQuestion?.id ?? 0) ||
        (index >= 0 && index !== previousIndex);
      if (questionChanged) {
        this.resetInteractionForNewQuestion();
        this.questionStartedAtMs = Date.now();
        this.isTimeUp = false;
      }
      this.question = {
        ...currentQuestion,
        imageUrl: this.resolveAssetUrl(currentQuestion?.imageUrl ?? currentQuestion?.ImageUrl ?? ''),
        choices: Array.isArray(currentQuestion?.choices ?? currentQuestion?.Choices)
          ? (currentQuestion?.choices ?? currentQuestion?.Choices).map((choice: any) => ({
              ...choice,
              imageUrl: this.resolveAssetUrl(choice?.imageUrl ?? choice?.ImageUrl ?? '')
            }))
          : []
      };
      const fromQuestion = Number(currentQuestion?.answerSeconds ?? currentQuestion?.AnswerSeconds ?? 0);
      this.questionDurationSeconds = this.normalizeDurationSeconds(durationFromState || fromQuestion || this.questionDurationSeconds);
      this.error = '';
      if (this.isTimedFlow()) {
        this.startQuestionTimer(this.currentQuestionEndsAtUtc);
      } else {
        this.stopQuestionTimer();
      }
      return;
    }

    this.stopQuestionTimer();
    this.questionDurationSeconds = 0;
    this.timeRemainingSeconds = 0;
    this.isTimeUp = false;
    this.timerDashOffset = this.timerCircumference;
    this.timeUpHandledForQuestion = false;
    this.question = undefined;
  }

  private loadQuestionFromState(): void {
    this.gameSessionService.state(this.sessionId).subscribe({
      next: (state) => {
        const incomingIndex = Number(state?.currentQuestionIndex ?? state?.CurrentQuestionIndex ?? -1);
        if (
          this.isRevealPhase &&
          this.question &&
          incomingIndex >= 0 &&
          incomingIndex !== this.currentQuestionIndex
        ) {
          this.pendingNextQuestionState = state;
          this.cdr.detectChanges();
          return;
        }

        this.applySessionState(state);
        if (!this.question) {
          this.error = 'No active question right now';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load question';
        this.cdr.detectChanges();
      }
    });
  }

  private startStateSync(): void {
    this.stopStateSync();
    this.stateSyncId = setInterval(() => {
      if (this.isTimedFlow()) {
        this.loadQuestionFromState();
      } else if (!this.question) {
        this.loadQuestionFromState();
      }

      if (!this.leaderboard.length) {
        this.refreshLeaderboard();
      }
    }, 2500);
  }

  private stopStateSync(): void {
    if (!this.stateSyncId) return;
    clearInterval(this.stateSyncId);
    this.stateSyncId = null;
  }

  private handleIncomingNextQuestion(payload: any): void {
    if (this.isTimedFlow() && this.isRevealPhase) {
      this.pendingNextQuestionState = payload;
      return;
    }

    if (!this.isTimedFlow() && this.canRevealCurrentQuestion()) {
      this.pendingNextQuestionState = payload;
      this.showAnswerReveal(this.revealDurationMs);
      return;
    }

    this.resetInteractionForNewQuestion();
    this.applySessionState(payload);
  }

  private showAnswerReveal(durationMs: number): void {
    if (!this.canRevealCurrentQuestion()) {
      this.flushPendingNextQuestion();
      return;
    }

    this.isRevealPhase = true;
    this.clearRevealTimeout();
    this.revealTimeoutId = setTimeout(() => {
      this.isRevealPhase = false;
      this.revealTimeoutId = null;
      this.flushPendingNextQuestion();
      this.cdr.detectChanges();
    }, durationMs);
  }

  private canRevealCurrentQuestion(): boolean {
    if (!this.question || Number(this.question?.type) === 3) {
      return false;
    }

    return this.correctChoiceIds.length > 0;
  }

  private flushPendingNextQuestion(): void {
    if (!this.pendingNextQuestionState) {
      return;
    }

    const payload = this.pendingNextQuestionState;
    this.pendingNextQuestionState = null;
    this.resetInteractionForNewQuestion();
    this.applySessionState(payload);
  }

  private clearRevealTimeout(): void {
    if (!this.revealTimeoutId) {
      return;
    }

    clearTimeout(this.revealTimeoutId);
    this.revealTimeoutId = null;
  }

  private resetInteractionForNewQuestion(): void {
    this.clearRevealTimeout();
    this.pendingNextQuestionState = null;
    this.submitted = false;
    this.isSubmittingAnswer = false;
    this.isRevealPhase = false;
    this.submittedIsCorrect = null;
    this.correctChoiceIds = [];
    this.selectedChoiceIds = [];
    this.textAnswer = '';
    this.timeUpHandledForQuestion = false;
  }

  isChoiceSelected(choiceId: number): boolean {
    return this.selectedChoiceIds.includes(Number(choiceId));
  }

  isMultipleChoiceQuestion(): boolean {
    return Number(this.question?.type) !== 3 && Number(this.question?.selectionMode ?? 1) === 2;
  }

  needsSubmitButton(): boolean {
    return Number(this.question?.type) === 3 || this.isMultipleChoiceQuestion();
  }

  private startQuestionTimer(endsAtUtc: string | null): void {
    this.stopQuestionTimer();
    let endsAtMs = this.parseServerDateAsUtcMs(endsAtUtc);
    if (!Number.isFinite(endsAtMs) || endsAtMs <= 0) {
      const duration = this.normalizeDurationSeconds(this.questionDurationSeconds || this.question?.answerSeconds);
      if (duration <= 0) {
        this.timeRemainingSeconds = 0;
        this.isTimeUp = false;
        this.timerDashOffset = this.timerCircumference;
        return;
      }

      this.questionDurationSeconds = duration;
      endsAtMs = Date.now() + (duration * 1000);
    }

    const total = Math.max(1, this.normalizeDurationSeconds(this.questionDurationSeconds || this.question?.answerSeconds || 30));
    this.questionDurationSeconds = total;

    const refreshDashOffset = (remaining: number) => {
      const ratio = Math.max(0, Math.min(1, remaining / total));
      this.timerDashOffset = this.timerCircumference * (1 - ratio);
    };

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
      this.timeRemainingSeconds = remaining;
      this.isTimeUp = remaining <= 0;
      refreshDashOffset(remaining);

      if (this.isTimeUp && !this.timeUpHandledForQuestion) {
        this.timeUpHandledForQuestion = true;
        this.message = 'Time is up';
        this.showAnswerReveal(this.revealDurationMs);
      }

      this.cdr.detectChanges();
      if (remaining <= 0) {
        this.stopQuestionTimer();
      }
    };

    tick();
    this.questionTimerId = setInterval(tick, 250);
  }

  private parseServerDateAsUtcMs(value: string | null): number {
    if (!value) return Number.NaN;

    const text = String(value).trim();
    if (!text) return Number.NaN;

    const hasTimezone = /z$|[+-]\d{2}:\d{2}$/i.test(text);
    const normalized = hasTimezone ? text : `${text}Z`;
    return new Date(normalized).getTime();
  }

  private normalizeDurationSeconds(value: any): number {
    const raw = Number(value);
    if (!Number.isFinite(raw)) return 0;
    if (raw < 1) return 0;
    if (raw > 600) return 600;
    return Math.floor(raw);
  }

  private resolveAssetUrl(value: any): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    const apiRoot = environment.apiBaseUrl.replace(/\/api\/?$/i, '');
    return raw.startsWith('/') ? `${apiRoot}${raw}` : `${apiRoot}/${raw}`;
  }

  private async registerVoiceListener(): Promise<void> {
    if (!this.participantId || !this.participantToken) {
      return;
    }

    const ok = await this.signalr.registerParticipantConnection(
      this.sessionId,
      this.participantId,
      this.participantToken
    );

    if (!ok) {
      this.voiceNeedsUserInteraction = false;
      this.isHostVoiceLive = false;
    }
  }

  private async unregisterVoiceListener(): Promise<void> {
    await this.signalr.unregisterParticipantConnection(this.sessionId);
  }

  private async handleVoiceOffer(payload: any): Promise<void> {
    if (Number(payload?.sessionId ?? 0) !== this.sessionId) {
      return;
    }

    const offerSdp = String(payload?.offerSdp ?? '');
    if (!offerSdp) {
      return;
    }

    this.closeVoiceConnection();
    const peer = this.ensureVoicePeer();

    try {
      await peer.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
      await this.flushPendingVoiceIceCandidates(peer);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      const answerSdp = answer.sdp || '';
      if (answerSdp) {
        await this.signalr.sendVoiceAnswer(this.sessionId, answerSdp);
      }

      this.isHostVoiceLive = true;
      this.cdr.detectChanges();
    } catch {
      this.closeVoiceConnection();
    }
  }

  private async handleVoiceIceCandidate(payload: any): Promise<void> {
    if (Number(payload?.sessionId ?? 0) !== this.sessionId) {
      return;
    }

    const candidateJson = String(payload?.candidateJson ?? '');
    if (!candidateJson) {
      return;
    }

    let candidateInit: RTCIceCandidateInit;
    try {
      candidateInit = JSON.parse(candidateJson) as RTCIceCandidateInit;
    } catch {
      return;
    }

    const peer = this.voicePeer;
    if (!peer || peer.signalingState === 'closed') {
      return;
    }

    if (!peer.remoteDescription) {
      this.pendingVoiceIceCandidates.push(candidateInit);
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch {}
  }

  private async flushPendingVoiceIceCandidates(peer: RTCPeerConnection): Promise<void> {
    if (!this.pendingVoiceIceCandidates.length) {
      return;
    }

    const pending = [...this.pendingVoiceIceCandidates];
    this.pendingVoiceIceCandidates = [];
    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }
  }

  private ensureVoicePeer(): RTCPeerConnection {
    if (this.voicePeer && this.voicePeer.signalingState !== 'closed') {
      return this.voicePeer;
    }

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peer.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) {
        return;
      }

      this.attachVoiceStream(stream);
    };

    peer.onicecandidate = (event) => {
      const candidate = event.candidate?.toJSON();
      if (!candidate) {
        return;
      }

      void this.signalr.sendVoiceIceCandidateToHost(this.sessionId, JSON.stringify(candidate));
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === 'connected') {
        this.isHostVoiceLive = true;
        this.cdr.detectChanges();
        return;
      }

      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        this.closeVoiceConnection();
        this.cdr.detectChanges();
      }
    };

    this.voicePeer = peer;
    return peer;
  }

  private attachVoiceStream(stream: MediaStream): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.voiceAudioElement) {
      this.voiceAudioElement = new Audio();
      this.voiceAudioElement.autoplay = true;
      this.voiceAudioElement.setAttribute('playsinline', 'true');
      this.voiceAudioElement.preload = 'none';
    }

    this.voiceAudioElement.srcObject = stream;
    this.voiceAudioElement.play()
      .then(() => {
        this.voiceNeedsUserInteraction = false;
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.voiceNeedsUserInteraction = true;
        this.cdr.detectChanges();
      });
  }

  enableVoicePlayback(): void {
    if (!this.voiceAudioElement) {
      return;
    }

    this.voiceAudioElement.play()
      .then(() => {
        this.voiceNeedsUserInteraction = false;
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.voiceNeedsUserInteraction = true;
        this.cdr.detectChanges();
      });
  }

  private closeVoiceConnection(): void {
    if (this.voicePeer) {
      try {
        this.voicePeer.ontrack = null;
        this.voicePeer.onicecandidate = null;
        this.voicePeer.onconnectionstatechange = null;
        this.voicePeer.close();
      } catch {}
      this.voicePeer = null;
    }

    this.pendingVoiceIceCandidates = [];
    if (this.voiceAudioElement) {
      try {
        this.voiceAudioElement.pause();
        this.voiceAudioElement.srcObject = null;
      } catch {}
    }

    this.isHostVoiceLive = false;
    this.voiceNeedsUserInteraction = false;
  }

  private stopQuestionTimer(): void {
    if (!this.questionTimerId) return;
    clearInterval(this.questionTimerId);
    this.questionTimerId = null;
  }

  isTimedFlow(): boolean {
    return Number(this.questionFlowMode) === 2;
  }

  private clearParticipantStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem('participant_id');
    localStorage.removeItem('participant_token');
    localStorage.removeItem('participant_join_status');
    localStorage.removeItem('participant_display_name');
  }
}



