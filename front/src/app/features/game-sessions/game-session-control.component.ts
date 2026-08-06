import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GameSessionService } from '../../core/services/game-session.service';
import { SignalrService } from '../../core/services/signalr.service';
import { ChangeDetectorRef } from '@angular/core';
import { PlayerService } from '../../core/services/player.service';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SafeRichTextPipe } from '../../shared/safe-rich-text.pipe';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SafeRichTextPipe],
  template: `
    <div class="card">
      @if (loading) { <p>Loading session...</p> }

      @if (session) {
        <div class="header-row">
          <div class="session-info">
            <h2>{{ session.quizTitle }}</h2>
            <p>Join Code: <b>{{ session.joinCode }}</b></p>
            <p>Join Link: <a [href]="session.joinLink" target="_blank">{{ session.joinLink }}</a></p>
          </div>
          <div class="control-buttons">
            <button [disabled]="!canStart()" (click)="start()">Start</button>
            <button class="secondary" [disabled]="!canPause()" (click)="pause()">Pause</button>
            <button class="secondary" [disabled]="!canResume()" (click)="resume()">Resume</button>
            <button [disabled]="!canNextQuestion()" (click)="nextQuestion()">Next Question</button>
            <button class="secondary" [disabled]="isVoiceBusy || deleting || actionLoading" (click)="toggleVoiceBroadcast()">
              {{
                isVoiceBroadcasting
                  ? (isVoiceBusy ? 'Stopping Mic...' : 'Stop Mic')
                  : (isVoiceBusy ? 'Starting Mic...' : 'Host Mic')
              }}
            </button>
            <button class="danger" [disabled]="!canEnd()" (click)="end()">End</button>
            <button class="danger" [disabled]="deleting || actionLoading" (click)="deleteSession()">
              {{ deleting ? 'Deleting...' : 'Delete Session' }}
            </button>
          </div>
        </div>

        <div class="tab-nav">
          <button type="button" [class.active]="activeTab === 'live'" (click)="activeTab = 'live'">Live State</button>
          <button type="button" [class.active]="activeTab === 'leaderboard'" (click)="activeTab = 'leaderboard'">Leaderboard</button>
        </div>

        <div class="control-layout">
          @if (activeTab === 'live') {
            <div class="card live-state-card">
              <h3>Live State</h3>
              <p>Status: {{ statusLabel(state?.status || session.status) }}</p>
              <p>Access: {{ accessLabel(session?.accessType) }}</p>
              <p>Flow: {{ flowModeLabel(state?.questionFlowMode ?? session.questionFlowMode) }}</p>
              <p>Schedule: {{ scheduleLabel(session) }}</p>
              <p>Host Voice: <b>{{ isVoiceBroadcasting ? 'Live' : 'Off' }}</b></p>
              @if (voiceStatus) {
                <p class="text-success" style="margin:4px 0 0;">{{ voiceStatus }}</p>
              }
              @if (voiceError) {
                <p class="text-danger" style="margin:4px 0 0;">{{ voiceError }}</p>
              }
              @if (isTimedFlow()) {
                <p class="text-accent">Questions auto-advance by configured answer time.</p>
              }
              <p>Current Index: {{ state?.currentQuestionIndex ?? session.currentQuestionIndex }}</p>
              <p>Participants: {{ state?.participantsCount ?? session.participantsCount }}</p>
              @if (state?.currentQuestion) {
                <p>Current Question: <b>{{ state?.currentQuestion.title }}</b></p>
                <div class="rich-text-content" style="margin:4px 0 0;" [innerHTML]="state?.currentQuestion.text | safeRichText"></div>
              } @else {
                <p>Current Question: <b>-</b></p>
              }
              @if (state?.nextQuestion) {
                <p style="margin-top:8px;">Next Question: <b>{{ state?.nextQuestion.title }}</b></p>
                <div class="rich-text-content" style="margin:4px 0 0;" [innerHTML]="state?.nextQuestion.text | safeRichText"></div>
              } @else {
                <p style="margin-top:8px;">Next Question: <b>-</b></p>
              }

              <h4 style="margin:12px 0 6px;">Players</h4>
              @if (participants.length) {
                <ul style="margin:0;padding-inline-start:18px;">
                  @for (p of participants; track $index) {
                    <li>{{ p.displayName }}@if (p.email) { <span class="muted-inline"> — {{ p.email }}</span> }</li>
                  }
                </ul>
              } @else {
                <p style="margin:0;">No players joined yet.</p>
              }

              <h4 style="margin:14px 0 6px;">Pending Join Requests</h4>
              @if ((session?.accessType ?? 2) === 1) {
                <p style="margin:0;">Public session. Participants are approved automatically.</p>
              } @else if (hasSessionAllowlist()) {
                <p style="margin:0;">Private with allow list: listed students join automatically. There is no approval queue for this session.</p>
              } @else if (pendingRequests.length) {
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Player</th><th>Email</th><th>Requested</th><th>Note (optional)</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      @for (request of pendingRequests; track request.participantId) {
                        <tr>
                          <td>{{ request.displayName }}</td>
                          <td>{{ request.email || '—' }}</td>
                          <td>{{ request.requestedAt | date:'short' }}</td>
                          <td>
                            <input
                              [(ngModel)]="rejectNotes[request.participantId]"
                              [disabled]="isControlDisabled()"
                              placeholder="Reject note"
                              class="reject-input"
                            />
                          </td>
                          <td class="row actions-cell">
                            <button [disabled]="isControlDisabled()" (click)="approveRequest(request.participantId)">Approve</button>
                            <button class="danger" [disabled]="isControlDisabled()" (click)="rejectRequest(request.participantId)">Reject</button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p style="margin:0;">No pending requests.</p>
              }
            </div>
          }

          @if (activeTab === 'leaderboard') {
            <div class="card leaderboard-card">
              <h3>Leaderboard</h3>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead>
                  <tbody>
                    @for (l of leaderboard; track l.participantId) {
                      <tr><td>{{ l.rank }}</td><td>{{ l.displayName }}</td><td>{{ l.totalScore }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      }

      @if (!loading && !session && !error) {
        <div class="alert" style="margin-top:10px;">No session data returned for this id.</div>
      }

      @if (message) { <div class="success" style="margin-top:10px;">{{ message }}</div> }
      @if (error) { <div class="alert" style="margin-top:10px;">{{ error }}</div> }
    </div>
  `,
  styles: [`
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .session-info {
      min-width: 0;
    }

    .session-info h2 {
      margin: 0 0 8px;
      word-wrap: break-word;
    }

    .session-info p {
      margin: 4px 0;
      font-size: 0.9rem;
    }

    .session-info a {
      word-break: break-all;
    }

    .control-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .control-buttons button {
      padding: 8px 12px;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .control-layout {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 16px;
    }

    .tab-nav {
      display: flex;
      gap: 4px;
      border-bottom: 2px solid var(--border);
      margin-bottom: 16px;
    }

    .tab-nav button {
      padding: 12px 20px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--muted);
      border-radius: 8px 8px 0 0;
      transition: all 0.2s;
    }

    .tab-nav button:hover {
      color: var(--text);
      background: var(--surface-soft);
    }

    .tab-nav button.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
      background: var(--primary-tint);
    }

    .live-state-card {
      width: 100%;
      min-width: 0;
    }

    .leaderboard-card {
      width: 100%;
      min-width: 0;
      overflow: hidden;
    }

    .leaderboard-card .table-wrap {
      overflow-x: hidden;
      border-radius: 12px;
    }

    .leaderboard-card table {
      min-width: auto;
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
    }

    .leaderboard-card th,
    .leaderboard-card td {
      padding: 10px 8px;
      font-size: 0.85rem;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 33%;
    }

    .reject-input {
      width: 100%;
      min-width: 120px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--input-bg);
      font-size: 0.85rem;
    }

    .actions-cell {
      gap: 6px;
    }

    .actions-cell button {
      padding: 6px 10px;
      font-size: 0.8rem;
    }

    .muted-inline {
      color: var(--muted);
      font-size: 0.88em;
    }

    @media (max-width: 900px) {
      .control-layout {
        flex-direction: column;
      }

      .live-state-card,
      .leaderboard-card {
        min-width: 0;
        max-width: 100%;
        width: 100%;
      }
    }

    @media (max-width: 600px) {
      .header-row {
        flex-direction: column;
        align-items: stretch;
      }

      .control-buttons {
        justify-content: flex-start;
      }

      .control-buttons button {
        flex: 1;
        min-width: calc(50% - 4px);
        max-width: calc(50% - 4px);
        padding: 10px 8px;
        font-size: 0.8rem;
      }

      .live-state-card {
        min-width: 0;
      }

      .leaderboard-card th,
      .leaderboard-card td {
        padding: 8px 4px;
        font-size: 0.75rem;
      }

      .reject-input {
        min-width: 100px;
      }
    }
  `]
})
export class GameSessionControlComponent implements OnInit, OnDestroy {
  sessionId = 0;
  session: any;
  state: any;
  leaderboard: any[] = [];
  participants: { displayName: string; email?: string }[] = [];
  pendingRequests: any[] = [];
  rejectNotes: Record<number, string> = {};
  loading = false;
  actionLoading = false;
  deleting = false;
  isVoiceBroadcasting = false;
  isVoiceBusy = false;
  voiceStatus = '';
  voiceError = '';
  message = '';
  error = '';
  activeTab: 'live' | 'leaderboard' = 'live';
  private hostVoiceStream: MediaStream | null = null;
  private hostVoicePeers = new Map<number, RTCPeerConnection>();
  private pendingHostIceCandidates = new Map<number, RTCIceCandidateInit[]>();

  hasSessionAllowlist(): boolean {
    const ids = this.session?.allowedUserIds;
    return Array.isArray(ids) && ids.length > 0;
  }

  private mapWaitingRoomPlayers(payload: any): { displayName: string; email?: string }[] {
    const rawPlayers = payload?.players ?? payload?.Players;
    if (Array.isArray(rawPlayers) && rawPlayers.length) {
      return rawPlayers.map((p: any) => ({
        displayName: String(p?.displayName ?? p?.DisplayName ?? ''),
        email: (p?.email ?? p?.Email) ? String(p.email ?? p.Email) : undefined
      }));
    }
    const legacy = payload?.participants ?? payload?.Participants;
    if (!Array.isArray(legacy)) {
      return [];
    }
    return legacy.map((x: any) =>
      typeof x === 'string'
        ? { displayName: x }
        : {
            displayName: String(x?.displayName ?? x?.DisplayName ?? ''),
            email: (x?.email ?? x?.Email) ? String(x.email ?? x.Email) : undefined
          }
    );
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: GameSessionService,
    private signalr: SignalrService,
    private playerService: PlayerService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.sessionId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();

    try {
      await this.signalr.connect();
      await this.signalr.joinSessionGroup(this.sessionId);

      this.signalr.on('sessionStarted', (payload) => { this.state = payload; this.message = 'Session started'; this.cdr.detectChanges(); });
      this.signalr.on('sessionPaused', (payload) => { this.state = payload; this.message = 'Session paused'; this.cdr.detectChanges(); });
      this.signalr.on('sessionResumed', (payload) => { this.state = payload; this.message = 'Session resumed'; this.cdr.detectChanges(); });
      this.signalr.on('nextQuestion', (payload) => { this.state = payload; this.message = 'Moved to next question'; this.cdr.detectChanges(); });
      this.signalr.on('leaderboardUpdated', (payload) => { this.leaderboard = payload || []; this.cdr.detectChanges(); });
      this.signalr.on('sessionEnded', (payload) => {
        this.state = payload;
        this.message = 'Session ended';
        void this.stopVoiceBroadcast(false);
        this.cdr.detectChanges();
      });
      this.signalr.on('sessionDeleted', (payload) => {
        const deletedId = Number(payload?.id ?? payload?.sessionId ?? 0);
        if (deletedId !== this.sessionId) return;
        void this.stopVoiceBroadcast(false);
        this.router.navigate(['/game-sessions']);
      });
      this.signalr.on('playerJoined', () => {
        this.loadWaitingRoom();
        this.loadLeaderboard();
        this.loadJoinRequests();
      });
      this.signalr.on('joinRequestCreated', () => {
        this.message = 'New join request received';
        this.loadJoinRequests();
      });
      this.signalr.on('joinRequestApproved', () => {
        this.loadJoinRequests();
        this.loadWaitingRoom();
        this.loadLeaderboard();
      });
      this.signalr.on('joinRequestRejected', () => {
        this.loadJoinRequests();
      });
      this.signalr.on('participantLeft', (payload) => {
        const leftParticipantId = Number(payload?.participantId ?? 0);
        if (leftParticipantId) {
          this.pendingRequests = this.pendingRequests.filter((x) => Number(x?.participantId) !== leftParticipantId);
          delete this.rejectNotes[leftParticipantId];
          this.closeVoicePeer(leftParticipantId);
        }
        this.loadWaitingRoom();
        this.loadLeaderboard();
        this.loadJoinRequests();
      });
      this.signalr.on('waitingRoomUpdated', (payload) => {
        if (Number(payload?.sessionId ?? 0) !== this.sessionId) return;
        this.participants = this.mapWaitingRoomPlayers(payload);
        if (this.session) this.session.participantsCount = payload?.participantsCount ?? this.session.participantsCount;
        if (this.state) this.state.participantsCount = payload?.participantsCount ?? this.state.participantsCount;
        this.cdr.detectChanges();
      });
      this.signalr.on('sessionUpdated', (payload) => {
        if (Number(payload?.id ?? 0) !== this.sessionId) return;
        this.session = { ...this.session, ...payload };
        if (this.state) {
          this.state = { ...this.state, status: payload?.status, participantsCount: payload?.participantsCount };
        }
        this.cdr.detectChanges();
      });
      this.signalr.on('voiceAnswer', (payload) => {
        void this.handleVoiceAnswer(payload);
      });
      this.signalr.on('voiceIceCandidate', (payload) => {
        void this.handleVoiceIceCandidate(payload);
      });
      this.signalr.on('voiceParticipantReady', (payload) => {
        void this.handleVoiceParticipantReady(payload);
      });
      this.signalr.on('voiceParticipantLeft', (payload) => {
        this.handleVoiceParticipantLeft(payload);
      });
      this.signalr.on('hostVoiceStopped', (payload) => {
        if (Number(payload?.sessionId ?? 0) !== this.sessionId) return;
        if (this.isVoiceBroadcasting) {
          void this.stopVoiceBroadcast(false);
        }
      });
    } catch {
      this.error = 'Live connection failed. Session controls still work with manual refresh.';
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.signalr.off('sessionStarted');
    this.signalr.off('sessionPaused');
    this.signalr.off('sessionResumed');
    this.signalr.off('nextQuestion');
    this.signalr.off('leaderboardUpdated');
    this.signalr.off('sessionEnded');
    this.signalr.off('sessionDeleted');
    this.signalr.off('playerJoined');
    this.signalr.off('joinRequestCreated');
    this.signalr.off('joinRequestApproved');
    this.signalr.off('joinRequestRejected');
    this.signalr.off('participantLeft');
    this.signalr.off('waitingRoomUpdated');
    this.signalr.off('sessionUpdated');
    this.signalr.off('voiceAnswer');
    this.signalr.off('voiceIceCandidate');
    this.signalr.off('voiceParticipantReady');
    this.signalr.off('voiceParticipantLeft');
    this.signalr.off('hostVoiceStopped');
    void this.stopVoiceBroadcast(false, true);
    this.signalr.leaveSessionGroup(this.sessionId);
    this.signalr.disconnect();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.service.getById(this.sessionId).subscribe({
      next: (res) => {
        this.session = res;
        this.loading = false;
        this.loadWaitingRoom();
        this.loadJoinRequests();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load session';
        this.cdr.detectChanges();
      }
    });
    this.loadState();
    this.loadLeaderboard();
    this.loadJoinRequests();
  }

  loadState(): void {
    this.service.state(this.sessionId).subscribe({
      next: (res) => {
        this.state = res;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadLeaderboard(): void {
    this.service.leaderboard(this.sessionId).subscribe({
      next: (res) => {
        this.leaderboard = res;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadWaitingRoom(): void {
    this.playerService.waitingRoom(this.sessionId).subscribe({
      next: (res) => {
        this.participants = this.mapWaitingRoomPlayers(res);
        if (this.session) this.session.participantsCount = res?.participantsCount ?? this.session.participantsCount;
        if (this.state) this.state.participantsCount = res?.participantsCount ?? this.state.participantsCount;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadJoinRequests(): void {
    this.service.joinRequests(this.sessionId).subscribe({
      next: (res) => {
        this.pendingRequests = res || [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  start(): void { this.act(() => this.service.start(this.sessionId), 'Session started'); }
  pause(): void { this.act(() => this.service.pause(this.sessionId), 'Session paused'); }
  resume(): void { this.act(() => this.service.resume(this.sessionId), 'Session resumed'); }
  nextQuestion(): void { this.act(() => this.service.nextQuestion(this.sessionId), 'Next question'); }
  end(): void { this.act(() => this.service.end(this.sessionId), 'Session ended'); }

  async deleteSession(): Promise<void> {
    if (this.deleting || this.actionLoading) {
      return;
    }

    const ok = await this.confirmDialog.open({
      title: 'Delete session?',
      message: 'This live session and its active flow will be removed permanently. This action cannot be undone.',
      confirmText: 'Delete session',
      cancelText: 'Keep session',
      tone: 'danger'
    });

    if (!ok) {
      return;
    }

    this.error = '';
    this.deleting = true;
    this.service.delete(this.sessionId).subscribe({
      next: () => {
        this.deleting = false;
        this.router.navigate(['/game-sessions']);
      },
      error: (err: any) => {
        this.deleting = false;
        this.error = err?.error?.message || 'Unable to delete session';
        this.cdr.detectChanges();
      }
    });
  }

  async toggleVoiceBroadcast(): Promise<void> {
    if (this.isVoiceBusy) {
      return;
    }

    if (this.isVoiceBroadcasting) {
      await this.stopVoiceBroadcast();
      return;
    }

    await this.startVoiceBroadcast();
  }

  private async startVoiceBroadcast(): Promise<void> {
    this.voiceError = '';
    this.voiceStatus = '';
    this.isVoiceBusy = true;

    try {
      const status = this.getCurrentStatus();
      if (status === 5) {
        this.voiceError = 'Session already ended.';
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        this.voiceError = 'Microphone is not supported in this browser.';
        return;
      }

      const isHostRegistered = await this.signalr.registerHostConnection(this.sessionId);
      if (!isHostRegistered) {
        this.voiceError = 'Only the host can start voice broadcast for this session.';
        return;
      }

      if (!this.hostVoiceStream) {
        this.hostVoiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        for (const track of this.hostVoiceStream.getAudioTracks()) {
          track.onended = () => {
            if (this.isVoiceBroadcasting) {
              void this.stopVoiceBroadcast();
            }
          };
        }
      }

      this.isVoiceBroadcasting = true;
      const participantIds = await this.signalr.getConnectedVoiceParticipantIds(this.sessionId);
      for (const participantId of participantIds) {
        await this.ensureVoicePeerForParticipant(participantId);
      }

      this.voiceStatus = 'Live voice is on.';
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.toLowerCase().includes('permission')) {
        this.voiceError = 'Microphone permission denied.';
      } else {
        this.voiceError = 'Unable to start voice broadcast.';
      }
      await this.stopVoiceBroadcast(false);
    } finally {
      this.isVoiceBusy = false;
      this.cdr.detectChanges();
    }
  }

  private async stopVoiceBroadcast(notifyHub = true, silentUi = false): Promise<void> {
    this.isVoiceBusy = true;

    this.closeAllVoicePeers();
    this.pendingHostIceCandidates.clear();

    if (this.hostVoiceStream) {
      for (const track of this.hostVoiceStream.getTracks()) {
        track.stop();
      }
      this.hostVoiceStream = null;
    }

    if (notifyHub) {
      await this.signalr.notifyHostVoiceStopped(this.sessionId);
    }
    await this.signalr.unregisterHostConnection(this.sessionId);

    this.isVoiceBroadcasting = false;
    if (!this.voiceError && !silentUi) {
      this.voiceStatus = 'Voice broadcast stopped.';
    }
    this.isVoiceBusy = false;
    if (!silentUi) {
      this.cdr.detectChanges();
    }
  }

  private async ensureVoicePeerForParticipant(participantId: number): Promise<void> {
    if (!this.isVoiceBroadcasting || !this.hostVoiceStream || participantId <= 0) {
      return;
    }

    this.closeVoicePeer(participantId);

    const peer = this.createHostPeerConnection(participantId);
    this.hostVoicePeers.set(participantId, peer);

    try {
      const offer = await peer.createOffer({ offerToReceiveAudio: true });
      await peer.setLocalDescription(offer);
      const offerSdp = offer.sdp || '';
      if (!offerSdp) {
        throw new Error('Missing offer SDP');
      }
      await this.signalr.sendVoiceOffer(this.sessionId, participantId, offerSdp);
    } catch {
      this.closeVoicePeer(participantId);
    }
  }

  private createHostPeerConnection(participantId: number): RTCPeerConnection {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    if (this.hostVoiceStream) {
      for (const track of this.hostVoiceStream.getAudioTracks()) {
        peer.addTrack(track, this.hostVoiceStream);
      }
    }

    peer.onicecandidate = (event) => {
      const candidate = event.candidate?.toJSON();
      if (!candidate) {
        return;
      }

      void this.signalr.sendVoiceIceCandidateToParticipant(
        this.sessionId,
        participantId,
        JSON.stringify(candidate)
      );
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        this.closeVoicePeer(participantId);
      }
    };

    return peer;
  }

  private async handleVoiceAnswer(payload: any): Promise<void> {
    if (!this.isVoiceBroadcasting || Number(payload?.sessionId ?? 0) !== this.sessionId) {
      return;
    }

    const participantId = Number(payload?.participantId ?? 0);
    const answerSdp = String(payload?.answerSdp ?? '');
    if (participantId <= 0 || !answerSdp) {
      return;
    }

    const peer = this.hostVoicePeers.get(participantId);
    if (!peer || peer.signalingState === 'closed') {
      return;
    }

    try {
      await peer.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
      await this.flushPendingIceCandidates(participantId, peer);
    } catch {}
  }

  private async handleVoiceIceCandidate(payload: any): Promise<void> {
    if (!this.isVoiceBroadcasting || Number(payload?.sessionId ?? 0) !== this.sessionId) {
      return;
    }

    const participantId = Number(payload?.participantId ?? 0);
    const candidateJson = String(payload?.candidateJson ?? '');
    if (participantId <= 0 || !candidateJson) {
      return;
    }

    let candidateInit: RTCIceCandidateInit;
    try {
      candidateInit = JSON.parse(candidateJson) as RTCIceCandidateInit;
    } catch {
      return;
    }

    const peer = this.hostVoicePeers.get(participantId);
    if (!peer || peer.signalingState === 'closed') {
      return;
    }

    if (!peer.remoteDescription) {
      const pending = this.pendingHostIceCandidates.get(participantId) || [];
      pending.push(candidateInit);
      this.pendingHostIceCandidates.set(participantId, pending);
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch {}
  }

  private async flushPendingIceCandidates(participantId: number, peer: RTCPeerConnection): Promise<void> {
    const pending = this.pendingHostIceCandidates.get(participantId) || [];
    if (!pending.length) {
      return;
    }

    this.pendingHostIceCandidates.delete(participantId);
    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }
  }

  private async handleVoiceParticipantReady(payload: any): Promise<void> {
    if (!this.isVoiceBroadcasting || Number(payload?.sessionId ?? 0) !== this.sessionId) {
      return;
    }

    const participantId = Number(payload?.participantId ?? 0);
    if (participantId <= 0) {
      return;
    }

    await this.ensureVoicePeerForParticipant(participantId);
    this.cdr.detectChanges();
  }

  private handleVoiceParticipantLeft(payload: any): void {
    if (Number(payload?.sessionId ?? 0) !== this.sessionId) {
      return;
    }

    const participantId = Number(payload?.participantId ?? 0);
    if (participantId <= 0) {
      return;
    }

    this.closeVoicePeer(participantId);
    this.cdr.detectChanges();
  }

  private closeAllVoicePeers(): void {
    for (const participantId of this.hostVoicePeers.keys()) {
      this.closeVoicePeer(participantId);
    }
  }

  private closeVoicePeer(participantId: number): void {
    const peer = this.hostVoicePeers.get(participantId);
    if (peer) {
      try {
        peer.onicecandidate = null;
        peer.onconnectionstatechange = null;
        peer.close();
      } catch {}
    }

    this.hostVoicePeers.delete(participantId);
    this.pendingHostIceCandidates.delete(participantId);
  }

  approveRequest(participantId: number): void {
    this.error = '';
    this.service.approveJoinRequest(this.sessionId, participantId).subscribe({
      next: () => {
        this.message = 'Join request approved';
        this.pendingRequests = this.pendingRequests.filter((x) => Number(x?.participantId) !== participantId);
        delete this.rejectNotes[participantId];
        this.loadWaitingRoom();
        this.loadLeaderboard();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Unable to approve join request';
        this.cdr.detectChanges();
      }
    });
  }

  rejectRequest(participantId: number): void {
    this.error = '';
    const note = (this.rejectNotes[participantId] || '').trim();
    this.service.rejectJoinRequest(this.sessionId, participantId, note || undefined).subscribe({
      next: () => {
        this.message = 'Join request rejected';
        this.pendingRequests = this.pendingRequests.filter((x) => Number(x?.participantId) !== participantId);
        delete this.rejectNotes[participantId];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Unable to reject join request';
        this.cdr.detectChanges();
      }
    });
  }

  act(call: () => any, msg: string): void {
    if (this.actionLoading || this.deleting) {
      return;
    }

    this.error = '';
    this.actionLoading = true;
    call().subscribe({
      next: (res: any) => {
        this.actionLoading = false;
        this.state = res;
        this.message = msg;
        this.loadLeaderboard();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.actionLoading = false;
        this.error = err?.error?.message || 'Action failed';
        this.cdr.detectChanges();
      }
    });
  }

  statusLabel(v: number): string {
    return ['','Draft','Waiting','Live','Paused','Ended'][v] || 'Unknown';
  }

  canStart(): boolean {
    return !this.actionLoading && !this.deleting && [1, 2].includes(this.getCurrentStatus());
  }

  canPause(): boolean {
    return !this.actionLoading && !this.deleting && this.getCurrentStatus() === 3;
  }

  canResume(): boolean {
    return !this.actionLoading && !this.deleting && this.getCurrentStatus() === 4;
  }

  canNextQuestion(): boolean {
    return !this.actionLoading && !this.deleting && this.getCurrentStatus() === 3 && !this.isTimedFlow();
  }

  canEnd(): boolean {
    const status = this.getCurrentStatus();
    return !this.actionLoading && !this.deleting && [2, 3, 4].includes(status);
  }

  isControlDisabled(): boolean {
    return this.actionLoading || this.deleting || this.getCurrentStatus() === 5;
  }

  private getCurrentStatus(): number {
    return Number(this.state?.status ?? this.state?.Status ?? this.session?.status ?? this.session?.Status ?? 0);
  }

  isTimedFlow(): boolean {
    const flow = Number(
      this.state?.questionFlowMode ??
      this.state?.QuestionFlowMode ??
      this.session?.questionFlowMode ??
      this.session?.QuestionFlowMode ??
      1
    );
    return flow === 2 || flow === 3;
  }

  flowModeLabel(v: any): string {
    const mode = Number(v);
    if (mode === 2) return 'Timed by question';
    if (mode === 3) return 'Timed by test';
    return 'Host controlled';
  }

  accessLabel(v: any): string {
    return Number(v) === 1 ? 'Public' : 'Private';
  }

  scheduleLabel(session: any): string {
    const start = session?.scheduledStartAt ? new Date(session.scheduledStartAt) : null;
    const end = session?.scheduledEndAt ? new Date(session.scheduledEndAt) : null;

    if (start && end) {
      return `${start.toLocaleString()} to ${end.toLocaleString()}`;
    }

    if (start) {
      return `Starts ${start.toLocaleString()}`;
    }

    if (session?.durationMinutes) {
      return `${session.durationMinutes} min`;
    }

    return 'On demand';
  }
}






