import { Injectable } from '@angular/core';
import { PlayerService } from './player.service';

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  constructor(private playerService: PlayerService) {}

  bySession(sessionId: number) {
    return this.playerService.leaderboard(sessionId);
  }
}
