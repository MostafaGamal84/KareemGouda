using API.Data;
using API.Entities.QuizGame;
using API.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace API.SignalR;

[AllowAnonymous]
public class LiveGameHub : Hub
{
    private static readonly ConcurrentDictionary<string, int> HostByConnection = new();
    private static readonly ConcurrentDictionary<string, (int SessionId, int ParticipantId)> ParticipantByConnection = new();
    private readonly DataContext _context;

    public LiveGameHub(DataContext context)
    {
        _context = context;
    }

    public async Task JoinGlobalSessionsGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, GetGlobalGroupName());
    }

    public async Task LeaveGlobalSessionsGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetGlobalGroupName());
    }

    public async Task JoinSessionGroup(int sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, GetGroupName(sessionId));
    }

    public async Task LeaveSessionGroup(int sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetGroupName(sessionId));
    }

    public async Task<bool> RegisterHostConnection(int sessionId)
    {
        var session = await _context.Set<GameSession>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == sessionId && !x.IsDeleted);

        if (session is null)
        {
            return false;
        }

        var userId = Context.User?.GetUserId() ?? 0;
        var isAdmin = Context.User?.IsInRole("Admin") == true;
        if (!isAdmin && (userId <= 0 || session.HostId != userId))
        {
            return false;
        }

        HostByConnection[Context.ConnectionId] = sessionId;
        ParticipantByConnection.TryRemove(Context.ConnectionId, out _);
        return true;
    }

    public Task UnregisterHostConnection(int sessionId)
    {
        if (HostByConnection.TryGetValue(Context.ConnectionId, out var registeredSessionId) &&
            registeredSessionId == sessionId)
        {
            HostByConnection.TryRemove(Context.ConnectionId, out _);
        }

        return Task.CompletedTask;
    }

    public async Task<bool> RegisterParticipantConnection(int sessionId, int participantId, string participantToken)
    {
        if (string.IsNullOrWhiteSpace(participantToken))
        {
            return false;
        }

        var participant = await _context.Set<GameParticipant>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.GameSessionId == sessionId &&
                x.Id == participantId &&
                !x.IsDeleted);

        if (participant is null)
        {
            return false;
        }

        if (!string.Equals(participant.ParticipantToken, participantToken, StringComparison.Ordinal))
        {
            return false;
        }

        if (participant.JoinStatus != ParticipantJoinStatus.Approved)
        {
            return false;
        }

        ParticipantByConnection[Context.ConnectionId] = (sessionId, participantId);
        HostByConnection.TryRemove(Context.ConnectionId, out _);

        await NotifyHostParticipantReadyAsync(sessionId, participantId);
        return true;
    }

    public async Task UnregisterParticipantConnection(int sessionId)
    {
        if (!ParticipantByConnection.TryGetValue(Context.ConnectionId, out var info))
        {
            return;
        }

        if (info.SessionId != sessionId)
        {
            return;
        }

        ParticipantByConnection.TryRemove(Context.ConnectionId, out _);
        await NotifyHostParticipantLeftAsync(sessionId, info.ParticipantId);
    }

    public Task<List<int>> GetConnectedVoiceParticipantIds(int sessionId)
    {
        if (!IsRegisteredHost(sessionId, Context.ConnectionId))
        {
            return Task.FromResult(new List<int>());
        }

        var ids = ParticipantByConnection
            .Where(x => x.Value.SessionId == sessionId)
            .Select(x => x.Value.ParticipantId)
            .Distinct()
            .OrderBy(x => x)
            .ToList();

        return Task.FromResult(ids);
    }

    public async Task SendVoiceOffer(int sessionId, int targetParticipantId, string offerSdp)
    {
        if (!IsRegisteredHost(sessionId, Context.ConnectionId) || string.IsNullOrWhiteSpace(offerSdp))
        {
            return;
        }

        var participantConnectionIds = GetParticipantConnectionIds(sessionId, targetParticipantId);
        foreach (var connectionId in participantConnectionIds)
        {
            await Clients.Client(connectionId).SendAsync("voiceOffer", new
            {
                sessionId,
                offerSdp
            });
        }
    }

    public async Task SendVoiceAnswer(int sessionId, string answerSdp)
    {
        if (!TryGetParticipantForSession(sessionId, Context.ConnectionId, out var participantId) ||
            string.IsNullOrWhiteSpace(answerSdp))
        {
            return;
        }

        var hostConnectionIds = GetHostConnectionIds(sessionId);
        foreach (var connectionId in hostConnectionIds)
        {
            await Clients.Client(connectionId).SendAsync("voiceAnswer", new
            {
                sessionId,
                participantId,
                answerSdp
            });
        }
    }

    public async Task SendVoiceIceCandidateToParticipant(int sessionId, int targetParticipantId, string candidateJson)
    {
        if (!IsRegisteredHost(sessionId, Context.ConnectionId) || string.IsNullOrWhiteSpace(candidateJson))
        {
            return;
        }

        var participantConnectionIds = GetParticipantConnectionIds(sessionId, targetParticipantId);
        foreach (var connectionId in participantConnectionIds)
        {
            await Clients.Client(connectionId).SendAsync("voiceIceCandidate", new
            {
                sessionId,
                participantId = targetParticipantId,
                candidateJson
            });
        }
    }

    public async Task SendVoiceIceCandidateToHost(int sessionId, string candidateJson)
    {
        if (!TryGetParticipantForSession(sessionId, Context.ConnectionId, out var participantId) ||
            string.IsNullOrWhiteSpace(candidateJson))
        {
            return;
        }

        var hostConnectionIds = GetHostConnectionIds(sessionId);
        foreach (var connectionId in hostConnectionIds)
        {
            await Clients.Client(connectionId).SendAsync("voiceIceCandidate", new
            {
                sessionId,
                participantId,
                candidateJson
            });
        }
    }

    public async Task NotifyHostVoiceStopped(int sessionId)
    {
        if (!IsRegisteredHost(sessionId, Context.ConnectionId))
        {
            return;
        }

        await Clients.Group(GetGroupName(sessionId)).SendAsync("hostVoiceStopped", new { sessionId });
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (HostByConnection.TryRemove(Context.ConnectionId, out var hostSessionId))
        {
            if (!HasAnyHostConnection(hostSessionId))
            {
                await Clients.Group(GetGroupName(hostSessionId)).SendAsync("hostVoiceStopped", new { sessionId = hostSessionId });
            }
        }

        if (ParticipantByConnection.TryRemove(Context.ConnectionId, out var participantInfo))
        {
            await NotifyHostParticipantLeftAsync(participantInfo.SessionId, participantInfo.ParticipantId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private async Task NotifyHostParticipantReadyAsync(int sessionId, int participantId)
    {
        var hostConnectionIds = GetHostConnectionIds(sessionId);
        foreach (var connectionId in hostConnectionIds)
        {
            await Clients.Client(connectionId).SendAsync("voiceParticipantReady", new
            {
                sessionId,
                participantId
            });
        }
    }

    private async Task NotifyHostParticipantLeftAsync(int sessionId, int participantId)
    {
        var hostConnectionIds = GetHostConnectionIds(sessionId);
        foreach (var connectionId in hostConnectionIds)
        {
            await Clients.Client(connectionId).SendAsync("voiceParticipantLeft", new
            {
                sessionId,
                participantId
            });
        }
    }

    private static bool IsRegisteredHost(int sessionId, string connectionId)
    {
        return HostByConnection.TryGetValue(connectionId, out var registeredSessionId)
            && registeredSessionId == sessionId;
    }

    private static bool TryGetParticipantForSession(int sessionId, string connectionId, out int participantId)
    {
        participantId = 0;
        if (!ParticipantByConnection.TryGetValue(connectionId, out var info))
        {
            return false;
        }

        if (info.SessionId != sessionId)
        {
            return false;
        }

        participantId = info.ParticipantId;
        return true;
    }

    private static List<string> GetHostConnectionIds(int sessionId)
    {
        return HostByConnection
            .Where(x => x.Value == sessionId)
            .Select(x => x.Key)
            .ToList();
    }

    private static List<string> GetParticipantConnectionIds(int sessionId, int participantId)
    {
        return ParticipantByConnection
            .Where(x => x.Value.SessionId == sessionId && x.Value.ParticipantId == participantId)
            .Select(x => x.Key)
            .ToList();
    }

    private static bool HasAnyHostConnection(int sessionId)
    {
        return HostByConnection.Any(x => x.Value == sessionId);
    }

    private static string GetGlobalGroupName() => "sessions";
    private static string GetGroupName(int sessionId) => $"session-{sessionId}";
}
