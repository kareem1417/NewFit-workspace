-- ============================================================================
-- RINGSIDE — FINAL DATABASE SCHEMA v2.0
-- Incorporates all architectural review changes from implementation plan
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE user_role AS ENUM ('athlete', 'coach', 'admin');
CREATE TYPE competitive_level AS ENUM ('novice', 'amateur', 'professional');
CREATE TYPE weight_class AS ENUM (
    'flyweight', 'bantamweight', 'featherweight', 'lightweight',
    'light_welterweight', 'welterweight', 'light_middleweight', 'middleweight',
    'super_middleweight', 'light_heavyweight', 'cruiserweight', 'heavyweight'
);
CREATE TYPE snapshot_type AS ENUM ('initial_onboarding', 'program_baseline', 'program_posttest', 'manual_update');
CREATE TYPE program_goal AS ENUM ('strength', 'explosiveness', 'endurance', 'power', 'general');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE chat_role AS ENUM ('user', 'assistant');

-- ============================================================================
-- SHARED TRIGGER: updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- REFERENCE TABLES
-- ============================================================================

-- Age groups reference table
CREATE TABLE age_groups (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50)  NOT NULL,
    min_age INTEGER   NOT NULL,
    max_age INTEGER   NOT NULL,
    description TEXT,
    CONSTRAINT valid_age_range CHECK (min_age < max_age)
);

INSERT INTO age_groups (name, min_age, max_age, description) VALUES
    ('Under-18', 13, 17, 'Youth athletes under 18 years old'),
    ('18-35',    18, 35, 'Adult athletes aged 18–35'),
    ('Over-35',  36, 99, 'Masters athletes over 35 years old');

-- Sports catalog table
CREATE TABLE sports (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon        VARCHAR(255),
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO sports (name, description) VALUES
    ('Boxing', 'The Sweet Science — Olympic and professional boxing');

-- Sport attributes (Radar axes per sport)
CREATE TABLE sport_attributes (
    id            SERIAL PRIMARY KEY,
    sport_id      INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL,
    description   TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sport_id, name)
);

INSERT INTO sport_attributes (sport_id, name, display_order, description) VALUES
    (1, 'Strength',           1, 'Maximal force production capability'),
    (1, 'Explosiveness',      2, 'Rate of force development and power output'),
    (1, 'Aerobic Endurance',  3, 'Sustained oxygen-dependent energy production'),
    (1, 'Muscular Endurance', 4, 'Repeated submaximal force production'),
    (1, 'Anaerobic Capacity', 5, 'High-intensity work capacity and lactate tolerance');

-- Attribute tests: maps specific tests to radar axes with weighting
CREATE TABLE attribute_tests (
    id                  SERIAL PRIMARY KEY,
    sport_attribute_id  INTEGER NOT NULL REFERENCES sport_attributes(id) ON DELETE CASCADE,
    test_name           VARCHAR(100) NOT NULL,
    weight              DECIMAL(5,4) NOT NULL,   -- weight within parent attribute (all weights for same attribute should sum to 1.0)
    unit                VARCHAR(20)  NOT NULL,
    higher_is_better    BOOLEAN DEFAULT true,
    description         TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO attribute_tests (sport_attribute_id, test_name, weight, unit, higher_is_better, description) VALUES
    ((SELECT id FROM sport_attributes WHERE name = 'Strength'),           'Trap Bar Deadlift',             1.0, 'kg',      true,  'Maximum single-rep deadlift with trap bar'),
    ((SELECT id FROM sport_attributes WHERE name = 'Explosiveness'),      'Power Clean',                   0.5, 'kg',      true,  'Maximum single-rep power clean from floor'),
    ((SELECT id FROM sport_attributes WHERE name = 'Explosiveness'),      'Box Jump Height',               0.5, 'cm',      true,  'Maximum box jump height from standing position'),
    ((SELECT id FROM sport_attributes WHERE name = 'Aerobic Endurance'),  '1 Mile Run Time',               1.0, 'seconds', false, 'Timed 1-mile run — lower is better'),
    ((SELECT id FROM sport_attributes WHERE name = 'Muscular Endurance'), 'Burpee Max Reps (3 min)',       1.0, 'reps',    true,  'Maximum burpees completed in 3 minutes'),
    ((SELECT id FROM sport_attributes WHERE name = 'Anaerobic Capacity'), 'Burpee Max Reps (3 min)',       0.5, 'reps',    true,  'Shared with Muscular Endurance, reflects lactate tolerance'),
    ((SELECT id FROM sport_attributes WHERE name = 'Anaerobic Capacity'), 'Medicine Ball Rotational Throw', 0.5, 'meters',  true,  'Rotational power transfer through kinetic chain');

-- Normative data: mean/stddev per test per cohort
-- References attribute_test_id instead of raw test_name string to prevent silent mismatches
CREATE TABLE normative_data (
    id                SERIAL PRIMARY KEY,
    sport_id          INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    attribute_test_id INTEGER NOT NULL REFERENCES attribute_tests(id) ON DELETE CASCADE,
    weight_class      weight_class      NOT NULL,
    level             competitive_level NOT NULL,
    age_group_id      INTEGER NOT NULL REFERENCES age_groups(id),
    mean_value        DECIMAL(10,2) NOT NULL,
    std_dev           DECIMAL(10,2) NOT NULL,
    sample_size       INTEGER,
    source            VARCHAR(255),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sport_id, attribute_test_id, weight_class, level, age_group_id)
);

CREATE TRIGGER update_normative_data_updated_at BEFORE UPDATE ON normative_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- USER TABLES
-- ============================================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50)  UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'athlete',
    refreshToken    VARCHAR(255) UNIQUE NOT NULL,
    profile_photo   VARCHAR(500),
    bio             TEXT,
    date_of_birth   DATE NOT NULL,                             -- derived: age_group computed from this
    social_links    JSONB DEFAULT '{}',
    role_models     TEXT[] DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),    
    search_vector   tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(username, '') || ' ' || coalesce(bio, ''))
    ) STORED
);

CREATE INDEX users_search_idx ON users USING GIN (search_vector);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- User_tokens table

CREATE TYPE token_type_enum AS ENUM ('REFRESH', 'VERIFICATION', 'FORGOT_PASSWORD');

CREATE TABLE user_tokens (
    user_token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- تم التعديل هنا (id بدل user_id)
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    token_type token_type_enum NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- تم مسح الفاصلة من هنا
);

CREATE TRIGGER update_user_tokens_updated_at BEFORE UPDATE ON user_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User sport profiles: links athlete to sport with cohort data
-- age_group_id is NOT stored here — derived dynamically from users.date_of_birth
CREATE TABLE user_sport_profiles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport_id     INTEGER NOT NULL REFERENCES sports(id),
    level        competitive_level NOT NULL,
    weight_class weight_class      NOT NULL,
    is_primary   BOOLEAN DEFAULT true,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, sport_id)
);

CREATE TRIGGER update_user_sport_profiles_updated_at BEFORE UPDATE ON user_sport_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Convenience view: user with their current age group (computed dynamically)
CREATE OR REPLACE VIEW user_age_groups AS
SELECT
    u.id AS user_id,
    u.date_of_birth,
    EXTRACT(YEAR FROM AGE(u.date_of_birth))::INTEGER AS current_age,
    ag.id   AS age_group_id,
    ag.name AS age_group_name
FROM users u
JOIN age_groups ag
    ON EXTRACT(YEAR FROM AGE(u.date_of_birth))::INTEGER BETWEEN ag.min_age AND ag.max_age
WHERE u.date_of_birth IS NOT NULL;

-- ============================================================================
-- PHYSICAL SNAPSHOT TABLES (normalized — no hard-coded sport columns)
-- ============================================================================

CREATE TABLE physical_snapshots (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport_id              INTEGER NOT NULL REFERENCES sports(id),
    snapshot_type         snapshot_type NOT NULL,
    program_enrollment_id UUID, -- It's nullable so not every enrollment is associated to a program
    notes                 TEXT,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Actual test values: one row per test per snapshot
CREATE TABLE snapshot_test_values (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id       UUID    NOT NULL REFERENCES physical_snapshots(id) ON DELETE CASCADE,
    attribute_test_id INTEGER NOT NULL REFERENCES attribute_tests(id),
    value             DECIMAL(10,2) NOT NULL,
    unit              VARCHAR(20) NOT NULL,  -- denormalized from attribute_tests
    UNIQUE(snapshot_id, attribute_test_id)
);

CREATE INDEX snapshot_values_snapshot_idx ON snapshot_test_values(snapshot_id);
CREATE INDEX snapshot_values_test_idx     ON snapshot_test_values(attribute_test_id);

-- ============================================================================
-- PROGRAM TABLES
-- ============================================================================

CREATE TABLE programs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id         UUID    NOT NULL REFERENCES users(id),
    sport_id         INTEGER NOT NULL REFERENCES sports(id),
    title            VARCHAR(255) NOT NULL,
    description      TEXT         NOT NULL,
    goal_primary     program_goal      NOT NULL,
    level_target     competitive_level NOT NULL,
    duration_weeks   INTEGER NOT NULL,
    sessions_per_week INTEGER NOT NULL,
    cover_image      VARCHAR(500),
    rating_avg       DECIMAL(4,2) DEFAULT 0.0,   -- DECIMAL(4,2): supports up to 9.99; safe for 1-5 scale
    rating_count     INTEGER DEFAULT 0,
    enrollment_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    is_published     BOOLEAN DEFAULT false,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    search_vector    tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
    ) STORED
);

CREATE INDEX programs_search_idx ON programs USING GIN (search_vector);
CREATE INDEX programs_coach_idx  ON programs(coach_id);
CREATE INDEX programs_sport_idx  ON programs(sport_id);
CREATE INDEX programs_goal_idx   ON programs(goal_primary);

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE program_blocks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    week_start  INTEGER NOT NULL,
    week_end    INTEGER NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(program_id, order_index)
);

CREATE TABLE program_sessions (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id                    UUID NOT NULL REFERENCES program_blocks(id) ON DELETE CASCADE,
    name                        VARCHAR(255) NOT NULL,
    description                 TEXT,
    day_offset                  INTEGER NOT NULL,  -- day number from program start (0-based)
    estimated_duration_minutes  INTEGER,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE session_exercises (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id    UUID NOT NULL REFERENCES program_sessions(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    sets          INTEGER NOT NULL,
    reps          VARCHAR(50) NOT NULL,   -- flexible: "5", "8-12", "AMRAP"
    rest_seconds  INTEGER NOT NULL,
    intensity_note VARCHAR(100),          -- e.g. "80% 1RM", "RPE 8"
    notes         TEXT,
    order_index   INTEGER NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE enrollments (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id            UUID NOT NULL REFERENCES programs(id),
    start_date            DATE NOT NULL,
    preferred_days        TEXT[] NOT NULL DEFAULT '{}',  -- ['Monday','Wednesday','Friday']
    preferred_time        TIME,    -- stored for future notification use
    status                enrollment_status DEFAULT 'active',
    completed_date        DATE,
    baseline_snapshot_id  UUID REFERENCES physical_snapshots(id) NOT NULL,
    posttest_snapshot_id  UUID REFERENCES physical_snapshots(id) NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, program_id, start_date)
);

CREATE INDEX enrollments_user_idx    ON enrollments(user_id);
CREATE INDEX enrollments_program_idx ON enrollments(program_id);

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- Program ratings: raw ratings data (rating_avg computed from this table)
CREATE TABLE program_ratings (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    program_id    UUID NOT NULL REFERENCES programs(id)   ON DELETE CASCADE,
    rating        SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review        TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, program_id)  -- one rating per user per program
);

CREATE INDEX ratings_program_idx ON program_ratings(program_id);

-- ============================================================================
-- SOCIAL TABLES
-- ============================================================================

-- Follows: composite PK — no surrogate UUID needed (never referenced elsewhere)
CREATE TABLE follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id),
    CONSTRAINT no_self_follow CHECK (follower_id != followee_id)
);

CREATE INDEX follows_follower_idx ON follows(follower_id);
CREATE INDEX follows_followee_idx ON follows(followee_id);

CREATE TABLE posts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content             TEXT NOT NULL,
    image_path          VARCHAR(500),
    is_system_generated BOOLEAN DEFAULT false,
    program_id          UUID REFERENCES programs(id) ON DELETE SET NULL,
    like_count          INTEGER DEFAULT 0,     -- denormalized counter for fast feed queries
    comment_count       INTEGER DEFAULT 0,     -- denormalized counter for fast feed queries
    metadata            JSONB DEFAULT '{}',    -- stores system-post structured data (deltas, etc.)
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    search_vector       tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(content, ''))
    ) STORED
);

CREATE INDEX posts_user_created_idx ON posts(user_id, created_at DESC);
CREATE INDEX posts_search_idx       ON posts USING GIN (search_vector);

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE comments (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id    UUID NOT NULL REFERENCES posts(id)  ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX comments_post_idx ON comments(post_id, created_at ASC);

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Likes: composite PK — never referenced externally
CREATE TABLE likes (
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

-- ============================================================================
-- AI CHATBOT TABLES (RAG)
-- ============================================================================

CREATE TABLE knowledge_chunks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content      TEXT NOT NULL,
    source       VARCHAR(255),
    content_type VARCHAR(50) DEFAULT 'general',
    embedding    vector(384),     -- all-MiniLM-L6-v2 outputs 384 dimensions
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HNSW index: better recall than IVFFlat on small datasets (<500 chunks), no training needed
CREATE INDEX knowledge_embedding_idx ON knowledge_chunks
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE chat_sessions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX chat_sessions_user_idx ON chat_sessions(user_id, updated_at DESC);

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE chat_messages (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id            UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role                  chat_role NOT NULL,
    content               TEXT NOT NULL,
    suggested_program_ids UUID[] DEFAULT '{}',
    metadata              JSONB DEFAULT '{}',
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX chat_messages_session_idx ON chat_messages(session_id, created_at ASC);

-- ============================================================================
-- TRIGGERS: DENORMALIZED COUNTERS
-- ============================================================================

-- Program enrollment + completion counts
CREATE OR REPLACE FUNCTION update_program_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE programs SET enrollment_count = enrollment_count + 1 WHERE id = NEW.program_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE programs SET completion_count = completion_count + 1 WHERE id = NEW.program_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER program_enrollment_trigger
    AFTER INSERT OR UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_program_counts();

-- Post like counter
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER likes_counter_trigger
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW EXECUTE FUNCTION update_like_count();

-- Post comment counter
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_counter_trigger
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- Program rating average update
CREATE OR REPLACE FUNCTION update_program_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_program_id UUID;
BEGIN
    v_program_id := COALESCE(NEW.program_id, OLD.program_id);
    UPDATE programs
    SET
        rating_avg   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM program_ratings WHERE program_id = v_program_id),
        rating_count = (SELECT COUNT(*)                        FROM program_ratings WHERE program_id = v_program_id)
    WHERE id = v_program_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER program_rating_trigger
    AFTER INSERT OR UPDATE OR DELETE ON program_ratings
    FOR EACH ROW EXECUTE FUNCTION update_program_rating();

    ALTER TABLE physical_snapshots 
ADD CONSTRAINT fk_snapshot_enrollment 
FOREIGN KEY (program_enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL;
model completed_sessions {
  id                 String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  user_id            String   @db.Uuid
  enrollment_id      String   @db.Uuid
  program_session_id String   @db.Uuid
  rpe                Int?     // معدل الإجهاد من 1 لـ 10
  duration_minutes   Int?     // التمرين أخد وقت قد إيه
  notes              String?
  created_at         DateTime @default(now()) @db.Timestamptz(6)

  // العلاقات
  users              users               @relation(fields: [user_id], references: [id], onDelete: Cascade)
  enrollments        enrollments         @relation(fields: [enrollment_id], references: [id], onDelete: Cascade)
  program_sessions   program_sessions    @relation(fields: [program_session_id], references: [id], onDelete: Cascade)
  completed_exercises completed_exercises[]
}

model completed_exercises {
  id                   String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  completed_session_id String   @db.Uuid
  session_exercise_id  String   @db.Uuid
  sets_data            Json     // الداتا الفعلية زي: [{set: 1, reps: 8, weight: 50}]
  notes                String?
  created_at           DateTime @default(now()) @db.Timestamptz(6)

  // العلاقات
  completed_sessions   completed_sessions @relation(fields: [completed_session_id], references: [id], onDelete: Cascade)
  session_exercises    session_exercises  @relation(fields: [session_exercise_id], references: [id], onDelete: Cascade)
}