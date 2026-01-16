package com.rushabh.Momento.listener;

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
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ChatRoomService chatRoomService;

    // Local in-memory session tracking per server instance
    private final Map<String, CopyOnWriteArraySet<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionRoomMap = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("WebSocket connected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        ChatMessage chatMessage = objectMapper.readValue(message.getPayload(), ChatMessage.class);
        String roomId = chatMessage.getRoomId();

        // Check if room exists
        if (!chatRoomService.roomExists(roomId)) {
            ChatMessage expired = new ChatMessage(
                    roomId,
                    "SYSTEM",
                    "Room expired or doesn't exist",
                    LocalDateTime.now(),
                    ChatMessage.MessageType.ROOM_EXPIRED
            );
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(expired)));
            session.close();
            return;
        }

        // Handle JOIN message
        if (chatMessage.getType() == ChatMessage.MessageType.JOIN) {
            // Add session to room tracking
            roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);
            sessionRoomMap.put(session.getId(), roomId);

            // Add user to Redis
            chatRoomService.addUserToRoom(roomId, session.getId());
        }

        // Broadcast message to all sessions in the room
        CopyOnWriteArraySet<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            String payload = objectMapper.writeValueAsString(chatMessage);
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    try {
                        s.sendMessage(new TextMessage(payload));
                    } catch (Exception e) {
                        log.error("Error sending message to session {}", s.getId(), e);
                    }
                }
            }
        }

        // Publish to Redis for other server instances (if in cluster)
        publishToRedis(roomId, chatMessage);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = sessionRoomMap.remove(session.getId());

        if (roomId != null) {
            // Remove from local tracking
            CopyOnWriteArraySet<WebSocketSession> sessions = roomSessions.get(roomId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    roomSessions.remove(roomId);
                }
            }

            // Remove user from Redis and check if room should be destroyed
            chatRoomService.removeUserFromRoom(roomId, session.getId());

            // Send LEAVE message
            try {
                ChatMessage leaveMessage = new ChatMessage(
                        roomId,
                        session.getId(),
                        "User left",
                        LocalDateTime.now(),
                        ChatMessage.MessageType.LEAVE
                );
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
    }

    private void broadcastToRoom(String roomId, ChatMessage message) {
        CopyOnWriteArraySet<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            try {
                String payload = objectMapper.writeValueAsString(message);
                for (WebSocketSession s : sessions) {
                    if (s.isOpen()) {
                        s.sendMessage(new TextMessage(payload));
                    }
                }
            } catch (Exception e) {
                log.error("Error broadcasting to room {}", roomId, e);
            }
        }
    }

    private void publishToRedis(String roomId, ChatMessage message) {
        // Publish message to Redis channel for other server instances
        try {
            String channel = "chat:room:" + roomId;
            redisTemplate.convertAndSend(channel, objectMapper.writeValueAsString(message));
        } catch (Exception e) {
            log.error("Error publishing to Redis", e);
        }
    }
}
