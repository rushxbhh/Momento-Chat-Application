package com.rushabh.Momento.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.databind.jsontype.PolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    // This ObjectMapper is shared across the whole app (injected into
    // ChatWebSocketHandler, used here for Redis). One source of truth for
    // date/time formatting and type handling.
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // Required to serialize/deserialize LocalDateTime, Instant, etc.
        mapper.registerModule(new JavaTimeModule());

        // Store dates as "2026-03-23T10:00:00" strings, not numeric arrays.
        // Without this, LocalDateTime serializes as [2026, 3, 23, 10, 0, 0]
        // which is hard to read and breaks some deserializers.
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // This is the key addition: activates the @class type hint in JSON.
        // Without it, Redis stores plain JSON with no type info, so on read
        // it can only return a LinkedHashMap — it doesn't know what class
        // to reconstruct. With it, JSON looks like:
        //   {"@class":"com.rushabh.Momento.model.ChatRoom", "id":"abc", ...}
        // and deserialization reconstructs the correct Java object.
        //
        // The validator is a security measure — it restricts which classes
        // can be deserialized to your own package, preventing "gadget chain"
        // attacks where an attacker stores malicious JSON in Redis.
        PolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator
                .builder()
                .allowIfBaseType(Object.class)  // allow all — fine for a private Redis
                .build();
      //  mapper.activateDefaultTyping(ptv, ObjectMapper.DefaultTyping.NON_FINAL);

        return mapper;
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(
            RedisConnectionFactory connectionFactory,
            ObjectMapper objectMapper           // injected — same bean as above
    ) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);

        // GenericJackson2JsonRedisSerializer uses the ObjectMapper you pass in,
        // so it respects JavaTimeModule and the DefaultTyping config above.
        // The old RedisSerializer.json() created its own internal mapper with
        // none of your customizations — that's what caused the cast failure.
        RedisSerializer<Object> jsonSerializer = RedisSerializer.json();


        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }
}