-- People who can log in. Passwords are never stored: only a one-way hash
-- (bcrypt), which cannot be turned back into the password.
CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Stored in lowercase so "Admin@Example.com" and "admin@example.com" are the same account.
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email_lowercase CHECK (email = lower(email))
);

-- A user can have several roles. ADMIN manages the store; CUSTOMER and
-- DELIVERY are used in later phases.
CREATE TABLE user_roles (
    user_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role    VARCHAR(20) NOT NULL,

    PRIMARY KEY (user_id, role),
    CONSTRAINT ck_user_roles_role CHECK (role IN ('ADMIN', 'CUSTOMER', 'DELIVERY'))
);
