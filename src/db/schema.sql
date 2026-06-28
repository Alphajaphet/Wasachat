-- WasaChat Database Schema
-- Run this via: npm run migrate

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    about TEXT DEFAULT 'Hey there! I am using WasaChat.',
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, contact_id)
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_one_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_two_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_one_id, user_two_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(20),
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(20) DEFAULT 'text',
    background_color VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE TABLE IF NOT EXISTS status_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_id UUID NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(status_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_statuses_user_expiry ON statuses(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);