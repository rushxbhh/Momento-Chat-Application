package com.rushabh.Momento.service;

import com.rushabh.Momento.model.ChatRoom;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatRoomService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String ROOM_KEY_PREFIX  = "room:";
    private static final String USERS_KEY_PREFIX = "room:users:";
    private static final int DEFAULT_EXPIRY_MINUTES = 10;
    private static final int MIN_EXPIRY_MINUTES     = 1;
    private static final int MAX_EXPIRY_MINUTES     = 60;

    public ChatRoom createRoom(Integer expiryMinutes) {
        int validated = DEFAULT_EXPIRY_MINUTES;
        if (expiryMinutes != null) {
            validated = Math.max(MIN_EXPIRY_MINUTES,
                    Math.min(MAX_EXPIRY_MINUTES, expiryMinutes));
        }

        String roomId  = generateRoomId();
        LocalDateTime now       = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(validated);

        ChatRoom room = new ChatRoom(roomId, now, expiresAt, 0);

        String roomKey  = ROOM_KEY_PREFIX  + roomId;
        String usersKey = USERS_KEY_PREFIX + roomId;

        redisTemplate.opsForValue().set(roomKey, room, validated, TimeUnit.MINUTES);
        // Initialize the users set with the same TTL so it also auto-expires.
        // We can't set TTL on a key that doesn't exist yet, so we add a
        // sentinel value and immediately set the expiry.
        redisTemplate.opsForSet().add(usersKey, "__init__");
        redisTemplate.expire(usersKey, validated, TimeUnit.MINUTES);
        // Remove the sentinel — we just needed to create the key
        redisTemplate.opsForSet().remove(usersKey, "__init__");

        log.info("Created room {} — expires at {}", roomId, expiresAt);
        return room;
    }

    public ChatRoom getRoom(String roomId) {
        Object raw = redisTemplate.opsForValue().get(ROOM_KEY_PREFIX + roomId);
        if (raw == null) {
            log.info("Room {} not found (expired or never existed)", roomId);
            return null;
        }

        // With GenericJackson2JsonRedisSerializer + DefaultTyping configured
        // in RedisConfig, this cast is now safe — the serializer embeds the
        // @class hint and reconstructs the correct type on read.
        // If for any reason it still returns a non-ChatRoom (e.g. old data
        // in Redis from before the fix), we log and treat it as missing.
        if (raw instanceof ChatRoom room) {
            return room;
        }

        log.warn("Room {} had unexpected type {} in Redis — treating as missing",
                roomId, raw.getClass().getName());
        return null;
    }

    public boolean roomExists(String roomId) {
        return getRoom(roomId) != null;
    }

    public void addUserToRoom(String roomId, String sessionId) {
        redisTemplate.opsForSet().add(USERS_KEY_PREFIX + roomId, sessionId);
        updateActiveUserCount(roomId);
        log.info("User {} joined room {}", sessionId, roomId);
    }

    public void removeUserFromRoom(String roomId, String sessionId) {
        redisTemplate.opsForSet().remove(USERS_KEY_PREFIX + roomId, sessionId);
        updateActiveUserCount(roomId);

        Long remaining = redisTemplate.opsForSet().size(USERS_KEY_PREFIX + roomId);
        if (remaining != null && remaining == 0) {
            log.info("All users left room {} — destroying immediately", roomId);
            deleteRoom(roomId);
        }
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private void updateActiveUserCount(String roomId) {
        ChatRoom room = getRoom(roomId);
        if (room == null) return;

        Long count = redisTemplate.opsForSet().size(USERS_KEY_PREFIX + roomId);
        room.setActiveUsers(count != null ? count.intValue() : 0);

        // FIX #8: compute TTL from expiresAt, not from getExpire().
        //
        // Old code: Long ttl = redisTemplate.getExpire(key, SECONDS);
        //   → returns REMAINING seconds, e.g. 543 if 57s have elapsed.
        //   → every update sets a NEW TTL of 543s, then 540s, then 537s…
        //   → the room slowly loses time on every join/leave event.
        //
        // New code: compute seconds between NOW and the stored expiresAt.
        //   → always anchored to the original expiry — no drift.
        long ttlSeconds = Duration.between(LocalDateTime.now(), room.getExpiresAt())
                .getSeconds();

        if (ttlSeconds > 0) {
            redisTemplate.opsForValue().set(
                    ROOM_KEY_PREFIX + roomId, room, ttlSeconds, TimeUnit.SECONDS);
        }
        // If ttlSeconds <= 0, the room has already expired — don't re-store it.
        // Redis will clean it up on its own.
    }

    private void deleteRoom(String roomId) {
        redisTemplate.delete(ROOM_KEY_PREFIX  + roomId);
        redisTemplate.delete(USERS_KEY_PREFIX + roomId);
        log.info("Deleted room {} (all users left)", roomId);
    }

    private String generateRoomId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }
}