package com.rushabh.Momento.model;


import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class RoomResponse {
    private String roomId;
    private String status;
    private LocalDateTime expiresAt;
    private long remainingSeconds;
}
