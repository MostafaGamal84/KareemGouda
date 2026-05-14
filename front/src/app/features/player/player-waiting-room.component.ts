import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PlayerService } from '../../core/services/player.service';
import { SignalrService } from '../../core/services/signalr.service';
import { Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" style="max-width:720px;margin:auto;">
      <h2>Waiting Room</h2>
      <p>Join Status: <b>{{ participantStatus }}</b></p>
      @if (decisionNote) { <p>{{ decisionNote }}</p> }

      @if (room) {
        <p>Quiz: <b>{{ room.quizTitle }}</b></p>
        <p>Status: {{ room.sessionStatus }}</p>
        <p>Players joined: {{ room.participantsCount }}</p>

        <h3>Players</h3>
        <ul>
          @for (p of waitingPlayers(); track $index) {
            <li>{{ p.displayName }}@if (p.email) { <span class="muted"> — {{ p.email }}</span> }</li>
          }
        </ul>
      }

      <div class="row" style="margin-top:12px;">
        <button class="secondary" [disabled]="isSessionEnded" (click)="leaveSession()">Leave Session</button>
      </div>

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>
  `,
  styles: [`
    .muted { color: var(--muted); font-size: 0.88em; }
  `]
})
export class PlayerWaitingRoomComponent implements OnInit, OnDestroy {
  sessionId = 0;
  participantId = 0;
  participantToken = '';
  participantStatus = 'Pending';
  decisionNote = '';
  room: any;
  isSessionEnded = false;
  error = '';
  private statusPollId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private playerService: PlayerService,
    private signalr: SignalrService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  async ngOnInit(): Promise<void> {
    this.sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    if (isPlatformBrowser(this.platformId)) {
      this.participantId = Number(localStorage.getItem('participant_id') || 0);
      this.participantToken = localStorage.getItem('participant_token') || '';
      this.participantStatus = this.joinStatusLabel(localStorage.getItem('participant_join_status') || 'Pending');
    }

    this.loadParticipantStatus();
    this.load();
    this.startStatusPolling();

    try {
      await this.signalr.connect();
      await this.signalr.joinSessionGroup(this.sessionId);

      this.signalr.on('playerJoined', () => this.load());
      this.signalr.on('joinRequestApproved', (payload) => {
        if (Number(payload?.participantId ?? 0) !== this.participantId) return;
        this.participantStatus = 'Approved';
        this.decisionNote = '';
        this.persistJoinStatus(2);
        this.loadParticipantStatus();
        this.load();
        this.cdr.detectChanges();
      });
      this.signalr.on('joinRequestRejected', (payload) => {
        if (Number(payload?.participantId ?? 0) !== this.participantId) return;
        this.participantStatus = 'Rejected';
        this.decisionNote = payload?.decisionNote || 'Your join request was rejected by host';
        this.persistJoinStatus(3);
        this.cdr.detectChanges();
      });
      this.signalr.on('participantLeft', (payload) => {
        if (Number(payload?.participantId ?? 0) !== this.participantId) return;
        this.participantStatus = 'Left';
        this.persistJoinStatus(4);
        this.decisionNote = 'You left the session';
        this.cdr.detectChanges();
      });
      this.signalr.on('waitingRoomUpdated', (payload) => {
        if (Number(payload?.sessionId ?? 0) !== this.sessionId) return;
        this.room = payload;
        this.isSessionEnded = this.isEndedStatus(payload?.sessionStatus);
        this.checkNavigationByStatus(payload?.sessionStatus);
        this.cdr.detectChanges();
      });
      this.signalr.on('sessionUpdated', (payload) => {
        const id = Number(payload?.id ?? payload?.sessionId ?? 0);
        if (id !== this.sessionId || !this.room) return;
        this.room = {
          ...this.room,
          participantsCount: payload?.participantsCount ?? this.room.participantsCount,
          sessionStatus: this.sessionStatusLabel(payload?.status)
        };
        this.isSessionEnded = this.isEndedStatus(payload?.status ?? this.room.sessionStatus);
        this.checkNavigationByStatus(this.room.sessionStatus);
        this.cdr.detectChanges();
      });
      this.signalr.on('sessionStarted', () => this.checkNavigationByStatus('Live'));
      this.signalr.on('sessionEnded', () => {
        this.isSessionEnded = true;
        this.load();
      });
    } catch {
      this.error = 'Live updates unavailable. Refresh manually.';
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.signalr.off('playerJoined');
    this.signalr.off('joinRequestApproved');
    this.signalr.off('joinRequestRejected');
    this.signalr.off('participantLeft');
    this.signalr.off('waitingRoomUpdated');
    this.signalr.off('sessionUpdated');
    this.signalr.off('sessionStarted');
    this.signalr.off('sessionEnded');
    this.signalr.leaveSessionGroup(this.sessionId);
    this.signalr.disconnect();
    this.stopStatusPolling();
  }

  load(): void {
    this.playerService.waitingRoom(this.sessionId).subscribe({
      next: (res) => {
        this.room = res;
        this.isSessionEnded = this.isEndedStatus(res?.sessionStatus);
        this.checkNavigationByStatus(res?.sessionStatus);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load waiting room';
        this.cdr.detectChanges();
      }
    });
  }

  waitingPlayers(): { displayName: string; email?: string }[] {
    const room = this.room;
    if (!room) return [];
    const raw = room.players ?? room.Players;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((p: any) => ({
        displayName: String(p?.displayName ?? p?.DisplayName ?? ''),
        email: (p?.email ?? p?.Email) ? String(p.email ?? p.Email) : undefined
      }));
    }
    const legacy = room.participants ?? room.Participants;
    if (!Array.isArray(legacy)) return [];
    return legacy.map((x: any) => (typeof x === 'string' ? { displayName: x } : {
      displayName: String(x?.displayName ?? x?.DisplayName ?? ''),
      email: (x?.email ?? x?.Email) ? String(x.email ?? x.Email) : undefined
    }));
  }

  loadParticipantStatus(): void {
    if (!this.participantId) return;

    this.playerService.participantStatus(this.sessionId, this.participantId, this.participantToken).subscribe({
      next: (res) => {
        this.participantStatus = this.joinStatusLabel(res?.joinStatus);
        this.decisionNote = res?.decisionNote || '';
        this.persistJoinStatus(res?.joinStatus);
        this.checkNavigationByStatus(this.room?.sessionStatus);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  leaveSession(): void {
    if (this.isSessionEnded) {
      return;
    }

    if (!this.participantId || !this.participantToken) {
      this.clearParticipantStorage();
      this.router.navigate(['/player/join']);
      return;
    }

    this.playerService.leave(this.sessionId, {
      participantId: this.participantId,
      participantToken: this.participantToken
    }).subscribe({
      next: () => {
        this.clearParticipantStorage();
        this.router.navigate(['/player/join']);
      },
      error: () => {
        this.clearParticipantStorage();
        this.router.navigate(['/player/join']);
      }
    });
  }

  private checkNavigationByStatus(status?: string): void {
    if (status === 'Live' && this.participantStatus === 'Approved') {
      this.router.navigate(['/player/session', this.sessionId, 'live']);
    }
  }

  private joinStatusLabel(status: any): string {
    if (status === null || status === undefined) return 'Pending';
    if (typeof status === 'string') {
      if (status === '1') return 'Pending';
      if (status === '2') return 'Approved';
      if (status === '3') return 'Rejected';
      if (status === '4') return 'Left';
      return status;
    }

    const value = Number(status);
    return ['Pending', 'Approved', 'Rejected', 'Left'][value - 1] || 'Pending';
  }

  private sessionStatusLabel(status: any): string {
    if (typeof status === 'string') return status;
    return ['Draft', 'Waiting', 'Live', 'Paused', 'Ended'][Number(status) - 1] || 'Waiting';
  }

  private isEndedStatus(status: any): boolean {
    if (status === null || status === undefined) return false;
    if (typeof status === 'string') {
      const normalized = status.trim().toLowerCase();
      if (normalized === 'ended' || normalized === '5') return true;
    }

    return Number(status) === 5;
  }

  private persistJoinStatus(status: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (status === null || status === undefined) return;
    localStorage.setItem('participant_join_status', String(status));
  }

  private startStatusPolling(): void {
    if (!isPlatformBrowser(this.platformId) || !this.participantId) return;
    this.stopStatusPolling();
    this.statusPollId = setInterval(() => {
      if (this.participantStatus === 'Pending') {
        this.loadParticipantStatus();
      }
    }, 3000);
  }

  private stopStatusPolling(): void {
    if (!this.statusPollId) return;
    clearInterval(this.statusPollId);
    this.statusPollId = null;
  }

  private clearParticipantStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem('participant_id');
    localStorage.removeItem('participant_token');
    localStorage.removeItem('participant_join_status');
    localStorage.removeItem('participant_display_name');
    localStorage.removeItem('participant_session_id');
    localStorage.removeItem('participant_session_access_type');
  }
}
