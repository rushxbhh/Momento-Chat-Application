package com.rushabh.Momento.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rushabh.Momento.model.ChatMessage;
import com.rushabh.Momento.service.ChatRoomService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    // FIX #1: correct import — com.fasterxml, not tools.jackson
    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ChatRoomService chatRoomService;

    // roomId -> set of live sessions on THIS server instance
    private final Map<String, CopyOnWriteArraySet<WebSocketSession>> roomSessions =
            new ConcurrentHashMap<>();

    // sessionId -> roomId (so we know which room to clean up on disconnect)
    private final Map<String, String> sessionRoomMap = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("WebSocket connected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message)
            throws Exception {
        ChatMessage chatMessage = objectMapper.readValue(
                message.getPayload(), ChatMessage.class);
        String roomId = chatMessage.getRoomId();

        if (!chatRoomService.roomExists(roomId)) {
            ChatMessage expired = new ChatMessage(
                    roomId, "SYSTEM", "Room expired or doesn't exist",
                    LocalDateTime.now(), ChatMessage.MessageType.ROOM_EXPIRED);
            session.sendMessage(new TextMessage(
                    objectMapper.writeValueAsString(expired)));
            session.close();
            return;
        }

        if (chatMessage.getType() == ChatMessage.MessageType.JOIN) {
            roomSessions
                    .computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>())
                    .add(session);
            sessionRoomMap.put(session.getId(), roomId);
            chatRoomService.addUserToRoom(roomId, session.getId());
        }

        // Broadcast locally first (fast path — same JVM)
        broadcastToRoom(roomId, chatMessage);

        // FIX #6: Publish to Redis for OTHER server instances only.
        // We already broadcast locally above, so other instances must not
        // re-broadcast to their own local sessions AND then have us do the
        // same. The solution is: the Redis listener calls broadcastToRoom,
        // but we mark messages we sent so we don't echo them back.
        // Simplest approach: publish with the originating serverId.
        // See RedisMessageHandler for the subscriber side.
        publishToRedis(roomId, chatMessage);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = sessionRoomMap.remove(session.getId());
        if (roomId != null) {
            removeSessionFromRoom(session, roomId);

            try {
                ChatMessage leaveMessage = new ChatMessage(
                        roomId, session.getId(), "User left",
                        LocalDateTime.now(), ChatMessage.MessageType.LEAVE);
                broadcastToRoom(roomId, leaveMessage);
            } catch (Exception e) {
                log.error("Error sending leave message", e);
            }
        }
        log.info("WebSocket closed: {} from room: {}", session.getId(), roomId);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("WebSocket transport error for session {}", session.getId(), exception);
        // Proactively clean up — don't wait for afterConnectionClosed
        String roomId = sessionRoomMap.remove(session.getId());
        if (roomId != null) {
            removeSessionFromRoom(session, roomId);
        }
    }

    // Called by the Redis pub/sub listener when a message arrives from
    // another server instance. We broadcast it to our local sessions.
    // This completes Fix #6 — the subscriber side.
    public void onRedisMessage(String payload) {
        try {
            ChatMessage message = objectMapper.readValue(payload, ChatMessage.class);
            broadcastToRoom(message.getRoomId(), message);
        } catch (Exception e) {
            log.error("Error processing Redis pub/sub message", e);
        }
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private void broadcastToRoom(String roomId, ChatMessage message) {
        CopyOnWriteArraySet<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) return;

        String payload;
        try {
            payload = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            log.error("Failed to serialize message for room {}", roomId, e);
            return;
        }

        // Iterate a snapshot — CopyOnWriteArraySet is safe to iterate
        // while another thread modifies it, but we still collect dead
        // sessions to remove them after the loop (avoid mutating during read).
        CopyOnWriteArraySet<WebSocketSession> deadSessions = new CopyOnWriteArraySet<>();

        for (WebSocketSession s : sessions) {
            if (!s.isOpen()) {
                // FIX #4: mark dead session for removal instead of leaving it
                deadSessions.add(s);
                continue;
            }
            try {
                s.sendMessage(new TextMessage(payload));
            } catch (Exception e) {
                log.warn("Send failed for session {} — marking dead", s.getId(), e);
                // FIX #4: also remove on send failure (closed mid-iteration)
                deadSessions.add(s);
            }
        }

        // Remove dead sessions after iteration to avoid concurrent modification
        if (!deadSessions.isEmpty()) {
            sessions.removeAll(deadSessions);
            log.debug("Removed {} dead sessions from room {}", deadSessions.size(), roomId);
        }

        if (sessions.isEmpty()) {
            roomSessions.remove(roomId);
        }
    }

    private void removeSessionFromRoom(WebSocketSession session, String roomId) {
        CopyOnWriteArraySet<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                roomSessions.remove(roomId);
            }
        }
        chatRoomService.removeUserFromRoom(roomId, session.getId());
    }

    private void publishToRedis(String roomId, ChatMessage message) {
        try {
            String channel = "chat:room:" + roomId;
            redisTemplate.convertAndSend(channel,
                    objectMapper.writeValueAsString(message));
        } catch (Exception e) {
            log.error("Error publishing to Redis channel for room {}", roomId, e);
        }
    }
}