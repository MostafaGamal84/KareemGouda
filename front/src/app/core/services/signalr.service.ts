import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private hubConnection?: HubConnection;
  private joinedSessionGroups = new Set<number>();
  private joinedGlobalSessionsGroup = false;
  private connectLeases = 0;
  private voiceHostSessionIds = new Set<number>();
  private voiceParticipantRegistrations = new Map<number, { participantId: number; participantToken: string }>();

  constructor(private auth: AuthService) {}

  async connect(): Promise<void> {
    this.connectLeases += 1;

    if (!this.hubConnection) {
      this.hubConnection = new HubConnectionBuilder()
        .withUrl(environment.hubUrl, {
          withCredentials: false,
          accessTokenFactory: () => this.auth.token() || ''
        })
        .withAutomaticReconnect()
        .build();

      this.hubConnection.onreconnected(async () => {
        if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
          return;
        }

        if (this.joinedGlobalSessionsGroup) {
          try {
            await this.hubConnection.invoke('JoinGlobalSessionsGroup');
          } catch {}
        }

        for (const sessionId of this.joinedSessionGroups) {
          try {
            await this.hubConnection.invoke('JoinSessionGroup', sessionId);
          } catch {}
        }

        for (const sessionId of this.voiceHostSessionIds) {
          try {
            await this.hubConnection.invoke('RegisterHostConnection', sessionId);
          } catch {}
        }

        for (const [sessionId, registration] of this.voiceParticipantRegistrations.entries()) {
          try {
            await this.hubConnection.invoke(
              'RegisterParticipantConnection',
              sessionId,
              registration.participantId,
              registration.participantToken
            );
          } catch {}
        }
      });
    }

    if (
      this.hubConnection.state === HubConnectionState.Connected ||
      this.hubConnection.state === HubConnectionState.Connecting ||
      this.hubConnection.state === HubConnectionState.Reconnecting
    ) {
      return;
    }

    try {
      await this.hubConnection.start();
    } catch (error) {
      this.connectLeases = Math.max(0, this.connectLeases - 1);
      throw error;
    }
  }

  joinSessionGroup(sessionId: number): Promise<void> {
    this.joinedSessionGroups.add(sessionId);
    return this.safeInvoke('JoinSessionGroup', sessionId);
  }

  leaveSessionGroup(sessionId: number): Promise<void> {
    this.joinedSessionGroups.delete(sessionId);
    return this.safeInvoke('LeaveSessionGroup', sessionId);
  }

  joinGlobalSessionsGroup(): Promise<void> {
    this.joinedGlobalSessionsGroup = true;
    return this.safeInvoke('JoinGlobalSessionsGroup');
  }

  leaveGlobalSessionsGroup(): Promise<void> {
    this.joinedGlobalSessionsGroup = false;
    return this.safeInvoke('LeaveGlobalSessionsGroup');
  }

  on(eventName: string, callback: (...args: any[]) => void): void {
    this.hubConnection?.on(eventName, callback);
  }

  off(eventName: string): void {
    this.hubConnection?.off(eventName);
  }

  async disconnect(): Promise<void> {
    this.connectLeases = Math.max(0, this.connectLeases - 1);
    if (this.connectLeases > 0) {
      return;
    }

    this.joinedSessionGroups.clear();
    this.joinedGlobalSessionsGroup = false;
    this.voiceHostSessionIds.clear();
    this.voiceParticipantRegistrations.clear();

    if (!this.hubConnection) {
      return;
    }

    if (
      this.hubConnection.state === HubConnectionState.Disconnected ||
      this.hubConnection.state === HubConnectionState.Disconnecting
    ) {
      return;
    }

    try {
      await this.hubConnection.stop();
    } catch {}
  }

  async registerHostConnection(sessionId: number): Promise<boolean> {
    const res = await this.invokeWithResult<boolean>('RegisterHostConnection', sessionId);
    if (res) {
      this.voiceHostSessionIds.add(sessionId);
    }
    return Boolean(res);
  }

  async unregisterHostConnection(sessionId: number): Promise<void> {
    this.voiceHostSessionIds.delete(sessionId);
    await this.safeInvoke('UnregisterHostConnection', sessionId);
  }

  async registerParticipantConnection(sessionId: number, participantId: number, participantToken: string): Promise<boolean> {
    const res = await this.invokeWithResult<boolean>('RegisterParticipantConnection', sessionId, participantId, participantToken);
    if (res) {
      this.voiceParticipantRegistrations.set(sessionId, { participantId, participantToken });
    }
    return Boolean(res);
  }

  async unregisterParticipantConnection(sessionId: number): Promise<void> {
    this.voiceParticipantRegistrations.delete(sessionId);
    await this.safeInvoke('UnregisterParticipantConnection', sessionId);
  }

  async getConnectedVoiceParticipantIds(sessionId: number): Promise<number[]> {
    const res = await this.invokeWithResult<any>('GetConnectedVoiceParticipantIds', sessionId);
    if (!Array.isArray(res)) {
      return [];
    }

    return res.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x > 0);
  }

  async sendVoiceOffer(sessionId: number, targetParticipantId: number, offerSdp: string): Promise<void> {
    await this.safeInvoke('SendVoiceOffer', sessionId, targetParticipantId, offerSdp);
  }

  async sendVoiceAnswer(sessionId: number, answerSdp: string): Promise<void> {
    await this.safeInvoke('SendVoiceAnswer', sessionId, answerSdp);
  }

  async sendVoiceIceCandidateToParticipant(sessionId: number, targetParticipantId: number, candidateJson: string): Promise<void> {
    await this.safeInvoke('SendVoiceIceCandidateToParticipant', sessionId, targetParticipantId, candidateJson);
  }

  async sendVoiceIceCandidateToHost(sessionId: number, candidateJson: string): Promise<void> {
    await this.safeInvoke('SendVoiceIceCandidateToHost', sessionId, candidateJson);
  }

  async notifyHostVoiceStopped(sessionId: number): Promise<void> {
    await this.safeInvoke('NotifyHostVoiceStopped', sessionId);
  }

  private async safeInvoke(methodName: string, ...args: any[]): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return;
    }

    try {
      await this.hubConnection.invoke(methodName, ...args);
    } catch {}
  }

  private async invokeWithResult<T>(methodName: string, ...args: any[]): Promise<T | null> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return null;
    }

    try {
      return await this.hubConnection.invoke<T>(methodName, ...args);
    } catch {
      return null;
    }
  }
}
