# Badges Database Schema

## Tables Required for Badge System

### 1. badges (Master Badge Definitions)

```sql
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon_emoji VARCHAR(10) NOT NULL,
    icon_url TEXT,
    category VARCHAR(50) DEFAULT 'general',
    rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
    points_value INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2. user_badges (User Badge Achievements)

```sql
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    progress DECIMAL(5,2) DEFAULT 100.00, -- percentage completion (0-100)
    metadata JSONB, -- store additional data like event details, scores, etc.

    UNIQUE(user_id, badge_id), -- Prevent duplicate badges per user

    CONSTRAINT fk_user_badges_user_id
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_badges_badge_id
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
);
```

### 3. badge_requirements (Optional: For Complex Badge Logic)

```sql
CREATE TABLE badge_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    requirement_type VARCHAR(50) NOT NULL, -- 'experience_years', 'events_won', 'profile_complete', etc.
    requirement_value JSONB NOT NULL, -- flexible storage for requirement details
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Sample Data Insertion

### Insert Sample Badges

```sql
INSERT INTO badges (name, description, icon_emoji, category, rarity, points_value) VALUES
('Champion', 'Won first place in a major competition', '🏆', 'competition', 'legendary', 500),
('First Place', 'Achieved first place in any event', '⭐', 'competition', 'rare', 200),
('Veteran', 'Member for over 5 years', '🎖️', 'experience', 'epic', 300),
('Gold Medal', 'Won a gold medal in competition', '🥇', 'competition', 'rare', 250),
('Trainer', 'Completed training certification', '🏅', 'education', 'common', 100),
('Precision', 'Achieved perfect score in precision event', '🎯', 'skill', 'epic', 350),
('Newcomer', 'Completed profile setup', '👋', 'onboarding', 'common', 50),
('Social Butterfly', 'Connected with 10 other riders', '🦋', 'social', 'common', 75),
('Event Organizer', 'Organized a successful event', '📅', 'leadership', 'rare', 200),
('Safety First', 'Completed safety training course', '🛡️', 'safety', 'common', 100);
```

### Assign Sample Badges to User

```sql
-- Example: Give user some badges (replace USER_ID with actual user ID)
INSERT INTO user_badges (user_id, badge_id, earned_at, metadata)
SELECT
    '550e8400-e29b-41d4-a716-446655440000'::uuid, -- Your demo USER_ID
    id,
    CURRENT_TIMESTAMP,
    '{"auto_awarded": true}'::jsonb
FROM badges
WHERE name IN ('Newcomer', 'Trainer', 'Veteran', 'Champion');
```

## Indexes for Performance

```sql
-- Index for user badge lookups
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX idx_user_badges_earned_at ON user_badges(earned_at);

-- Index for badge categories and rarity
CREATE INDEX idx_badges_category ON badges(category);
CREATE INDEX idx_badges_rarity ON badges(rarity);
CREATE INDEX idx_badges_active ON badges(is_active);
```

## SQL Views for Common Queries

### User Badge Summary View

```sql
CREATE VIEW user_badge_summary AS
SELECT
    ub.user_id,
    p.name as user_name,
    COUNT(ub.badge_id) as total_badges,
    SUM(b.points_value) as total_points,
    COUNT(CASE WHEN b.rarity = 'legendary' THEN 1 END) as legendary_badges,
    COUNT(CASE WHEN b.rarity = 'epic' THEN 1 END) as epic_badges,
    COUNT(CASE WHEN b.rarity = 'rare' THEN 1 END) as rare_badges,
    COUNT(CASE WHEN b.rarity = 'common' THEN 1 END) as common_badges
FROM user_badges ub
JOIN badges b ON ub.badge_id = b.id
JOIN profiles p ON ub.user_id = p.id
WHERE b.is_active = true
GROUP BY ub.user_id, p.name;
```

### User Badges with Details View

```sql
CREATE VIEW user_badges_detailed AS
SELECT
    ub.user_id,
    ub.badge_id,
    b.name as badge_name,
    b.description,
    b.icon_emoji,
    b.category,
    b.rarity,
    b.points_value,
    ub.earned_at,
    ub.progress,
    ub.metadata
FROM user_badges ub
JOIN badges b ON ub.badge_id = b.id
WHERE b.is_active = true
ORDER BY ub.earned_at DESC;
```

## API Functions Needed

You'll need to create these functions in your `profileAPIBase64.ts`:

1. `getUserBadges(userId: string)` - Get all badges for a user
2. `awardBadge(userId: string, badgeId: string, metadata?: object)` - Award a badge to user
3. `getBadgeDefinitions()` - Get all available badges
4. `checkBadgeEligibility(userId: string)` - Check if user qualifies for any new badges
5. `getUserBadgeStats(userId: string)` - Get user's badge statistics

## Badge Categories Suggested:

- **competition**: Tournament and competition achievements
- **experience**: Time-based and experience achievements
- **education**: Training and learning achievements
- **social**: Community and social achievements
- **skill**: Skill-based achievements
- **safety**: Safety and certification achievements
- **leadership**: Leadership and organizing achievements
- **onboarding**: Welcome and setup achievements

## Badge Rarity System:

- **common**: Easy to achieve, basic accomplishments
- **rare**: Moderate difficulty, notable achievements
- **epic**: High difficulty, significant accomplishments
- **legendary**: Extremely rare, exceptional achievements

This schema provides a flexible, scalable badge system that can grow with your application!
