package com.rushabh.Momento.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Duration;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoom {
    private String id;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private int activeUsers;

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public long getRemainingSeconds() {
        return Math.max(0,
                Duration.between(LocalDateTime.now(), expiresAt).getSeconds()
        );
    }

}
