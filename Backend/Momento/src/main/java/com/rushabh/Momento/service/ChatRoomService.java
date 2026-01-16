package com.rushabh.Momento.service;


import com.rushabh.Momento.model.ChatRoom;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatRoomService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String ROOM_KEY_PREFIX = "room:";
    private static final String ACTIVE_USERS_KEY_PREFIX = "room:users:";
    private static final int DEFAULT_ROOM_EXPIRY_MINUTES = 10;
    private static final int MIN_EXPIRY_MINUTES = 1;
    private static final int MAX_EXPIRY_MINUTES = 60;

    public ChatRoom createRoom(Integer expiryMinutes) {
        int validatedExpiry = DEFAULT_ROOM_EXPIRY_MINUTES;
        if (expiryMinutes != null) {
            validatedExpiry = Math.max(MIN_EXPIRY_MINUTES, Math.min(MAX_EXPIRY_MINUTES, expiryMinutes));
        }

        String roomId = generateRoomId();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(validatedExpiry);

        ChatRoom room = new ChatRoom(roomId, now, expiresAt, 0);

        // Store in Redis with TTL - Redis auto-expires after TTL
        String key = ROOM_KEY_PREFIX + roomId;
        redisTemplate.opsForValue().set(key, room, validatedExpiry, TimeUnit.MINUTES);

        // Initialize active users set with same TTL
        String usersKey = ACTIVE_USERS_KEY_PREFIX + roomId;
        redisTemplate.expire(usersKey, validatedExpiry, TimeUnit.MINUTES);

        log.info("Created room: {} - Redis will auto-expire in {} minutes", roomId, validatedExpiry);
        return room;
    }

    public ChatRoom getRoom(String roomId) {
        String key = ROOM_KEY_PREFIX + roomId;
        ChatRoom room = (ChatRoom) redisTemplate.opsForValue().get(key);

        // If room doesn't exist in Redis, it was auto-expired by TTL
        if (room == null) {
            log.info("Room {} not found - likely expired by Redis TTL", roomId);
            return null;
        }

        return room;
    }

    public boolean roomExists(String roomId) {
        return getRoom(roomId) != null;
    }

    public void addUserToRoom(String roomId, String sessionId) {
        String usersKey = ACTIVE_USERS_KEY_PREFIX + roomId;
        redisTemplate.opsForSet().add(usersKey, sessionId);

        // Update active user count
        updateActiveUserCount(roomId);

        log.info("User {} joined room {}", sessionId, roomId);
    }

    public void removeUserFromRoom(String roomId, String sessionId) {
        String usersKey = ACTIVE_USERS_KEY_PREFIX + roomId;
        redisTemplate.opsForSet().remove(usersKey, sessionId);

        // Update active user count
        updateActiveUserCount(roomId);

        // Check if room should be destroyed (all users left)
        Long userCount = redisTemplate.opsForSet().size(usersKey);
        if (userCount != null && userCount == 0) {
            log.info("All users left room {}. Destroying room immediately.", roomId);
            deleteRoom(roomId);
        } else {
            log.info("User {} left room {}. {} users remaining", sessionId, roomId, userCount);
        }
    }

    private void updateActiveUserCount(String roomId) {
        ChatRoom room = getRoom(roomId);
        if (room != null) {
            String usersKey = ACTIVE_USERS_KEY_PREFIX + roomId;
            Long userCount = redisTemplate.opsForSet().size(usersKey);
            room.setActiveUsers(userCount != null ? userCount.intValue() : 0);

            // Update room in Redis while preserving TTL
            String key = ROOM_KEY_PREFIX + roomId;
            Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
            if (ttl != null && ttl > 0) {
                redisTemplate.opsForValue().set(key, room, ttl, TimeUnit.SECONDS);
            }
        }
    }

    public int getActiveUserCount(String roomId) {
        String usersKey = ACTIVE_USERS_KEY_PREFIX + roomId;
        Long count = redisTemplate.opsForSet().size(usersKey);
        return count != null ? count.intValue() : 0;
    }

    private void deleteRoom(String roomId) {
        String roomKey = ROOM_KEY_PREFIX + roomId;
        String usersKey = ACTIVE_USERS_KEY_PREFIX + roomId;

        redisTemplate.delete(roomKey);
        redisTemplate.delete(usersKey);

        log.info("Deleted room: {} (user-initiated cleanup)", roomId);
    }

    private String generateRoomId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
