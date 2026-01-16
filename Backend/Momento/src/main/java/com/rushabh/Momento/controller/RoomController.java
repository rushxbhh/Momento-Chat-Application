package com.rushabh.Momento.controller;

import com.rushabh.Momento.model.ChatRoom;
import com.rushabh.Momento.model.CreateRoomRequest;
import com.rushabh.Momento.model.RoomResponse;
import com.rushabh.Momento.service.ChatRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RoomController {

    private final ChatRoomService chatRoomService;

    @PostMapping("/create")
    public ResponseEntity<RoomResponse> createRoom(@RequestBody(required = false) CreateRoomRequest request) {
        Integer expiryMinutes = (request != null) ? request.getExpiryMinutes() : null;
        ChatRoom room = chatRoomService.createRoom(expiryMinutes);
        RoomResponse response = new RoomResponse(
                room.getId(),
                "active",
                room.getExpiresAt(),
                room.getRemainingSeconds()
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<RoomResponse> getRoom(@PathVariable String roomId) {
        ChatRoom room = chatRoomService.getRoom(roomId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }

        RoomResponse response = new RoomResponse(
                room.getId(),
                "active",
                room.getExpiresAt(),
                room.getRemainingSeconds()
        );

        return ResponseEntity.ok(response);
    }
}

