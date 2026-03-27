package com.rushabh.Momento.config;

import com.rushabh.Momento.listener.ChatWebSocketHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

// FIX #6: This was the missing half of pub/sub.
//
// How Redis pub/sub works:
//   Publisher calls PUBLISH channel message  → Redis receives it
//   Subscriber registered to that channel   → Redis pushes it to them
//
// Your old code only had the publisher (convertAndSend).
// Without a subscriber, the messages were published into the void.
//
// This config wires up:
//   RedisMessageListenerContainer — a background thread that stays connected
//     to Redis and listens for incoming messages on subscribed channels.
//   MessageListenerAdapter — bridges the Redis message to a plain Java method
//     call on ChatWebSocketHandler.onRedisMessage(String payload).
//   PatternTopic("chat:room:*") — subscribes to ALL room channels at once
//     using a Redis glob pattern, so you don't need one subscription per room.
@Configuration
public class RedisMessageConfig {

    @Bean
    public MessageListenerAdapter messageListenerAdapter(ChatWebSocketHandler handler) {
        // "onRedisMessage" is the method name on ChatWebSocketHandler that
        // will be called when a message arrives at any matching channel.
        // The adapter automatically extracts the message body (String) and
        // passes it as the first argument.
        return new MessageListenerAdapter(handler, "onRedisMessage");
    }

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            MessageListenerAdapter messageListenerAdapter
    ) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);

        // PatternTopic uses Redis PSUBSCRIBE (pattern subscribe).
        // "chat:room:*" matches chat:room:abc123, chat:room:xyz789, etc.
        // This means one subscription covers all rooms — no need to
        // subscribe/unsubscribe per room creation/deletion.
        container.addMessageListener(
                messageListenerAdapter,
                new PatternTopic("chat:room:*")
        );

        return container;
    }
}