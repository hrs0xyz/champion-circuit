# Group Stage + Knockout Tournament System ✅ IMPLEMENTED

**Status:** COMPLETE - All 4 core sprints done!

## Overview
Add flexible tournament formats with group stages, round-robin, and customizable knockout phases.

## Current State
- **Format:** Single-elimination knockout only
- **Issue:** With odd participant counts, creates byes
- **Limitation:** Can't do group stages or round-robin

## Target State
Match admins can choose tournament format and customize:
- Number of groups
- Group stage rules
- How many advance to knockout
- Point scoring system

---

## Phase 1: Database Schema (FOUNDATION)

### New Fields on `tournaments` table:
```sql
-- Tournament format type
format_type VARCHAR(50) DEFAULT 'knockout'
  -- Options: 'knockout', 'groups_knockout', 'round_robin', 'round_robin_knockout'

-- Group stage configuration (JSON)
group_config JSONB DEFAULT NULL
  -- Example: {"num_groups": 2, "advance_per_group": 2, "points_win": 3, "points_draw": 1}

-- Current phase
current_phase VARCHAR(50) DEFAULT 'registration'
  -- Options: 'registration', 'group_stage', 'knockout', 'completed'
```

### New Table: `tournament_groups`
```sql
CREATE TABLE tournament_groups (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    group_name VARCHAR(10) NOT NULL,  -- 'A', 'B', 'C', 'D'
    group_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### New Table: `tournament_group_members`
```sql
CREATE TABLE tournament_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0,
    goals_against INTEGER DEFAULT 0,
    goal_difference INTEGER DEFAULT 0,
    matches_played INTEGER DEFAULT 0,
    position INTEGER,  -- Final standing in group
    advanced_to_knockout BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);
```

### Update `matches` table:
```sql
ALTER TABLE matches ADD COLUMN match_phase VARCHAR(50) DEFAULT 'knockout';
  -- Options: 'group_stage', 'knockout'
  
ALTER TABLE matches ADD COLUMN group_id INTEGER REFERENCES tournament_groups(id);
  -- NULL for knockout matches, set for group matches
```

---

## Phase 2: Backend - Group Generation Logic

### API Endpoint: Generate Groups
```
POST /api/admin/tournaments/{id}/generate-groups
Body: {
  "num_groups": 2,
  "advance_per_group": 2,
  "points_win": 3,
  "points_draw": 1,
  "points_loss": 0
}
```

**Logic:**
1. Validate: tournament in "registration" status, has paid participants
2. Create N groups (A, B, C, D...)
3. Distribute participants evenly (seeded first, rest shuffled)
4. Generate round-robin matches within each group
5. Set tournament phase to "group_stage"
6. Notify all participants

### API Endpoint: Complete Group Stage
```
POST /api/admin/tournaments/{id}/complete-group-stage
```

**Logic:**
1. Verify all group matches are completed
2. Calculate final standings per group
3. Select top N from each group
4. Generate knockout bracket with group winners
5. Set tournament phase to "knockout"
6. Notify advancing participants

---

## Phase 3: Backend - Group Match Recording

### Update Match Verification:
- When verifying a group stage match:
  - Update both players' group standings
  - Add points based on result (Win=3, Draw=1, Loss=0)
  - Update W/D/L counters
  - Update goals for/against (if applicable)
  - Recalculate group positions

### API Endpoint: Group Standings
```
GET /api/tournaments/{id}/groups
Response: [
  {
    "group_name": "A",
    "standings": [
      {
        "user_id": 4,
        "username": "player1",
        "points": 6,
        "wins": 2,
        "draws": 0,
        "losses": 0,
        "goal_difference": 4,
        "position": 1
      },
      ...
    ]
  },
  ...
]
```

---

## Phase 4: Frontend - Tournament Creation

### Update Tournament Creation Wizard:
**Step 1: Details** (existing)
- Add format selection:
```tsx
<select name="format_type">
  <option value="knockout">Knockout Only</option>
  <option value="groups_knockout">Group Stage → Knockout</option>
  <option value="round_robin">Round Robin</option>
  <option value="round_robin_knockout">Round Robin → Knockout</option>
</select>
```

**New Step 1.5: Group Configuration** (conditional - only if groups selected)
```tsx
<label>Number of Groups</label>
<select name="num_groups">
  <option value="2">2 Groups</option>
  <option value="3">3 Groups</option>
  <option value="4">4 Groups</option>
</select>

<label>Top N advance per group</label>
<input type="number" name="advance_per_group" min="1" max="4" />

<label>Points for Win</label>
<input type="number" name="points_win" value="3" />

<label>Points for Draw</label>
<input type="number" name="points_draw" value="1" />
```

---

## Phase 5: Frontend - Match Admin UI

### New "Groups" Tab
Show all groups with standings tables:
```
Group A                Group B
Pos | Player | Pts     Pos | Player | Pts
1   | P1     | 6       1   | P5     | 6
2   | P2     | 3       2   | P6     | 3
3   | P3     | 0       3   | P7     | 0
```

### Update "Matches" Tab
- Filter by phase: [All] [Group Stage] [Knockout]
- Show group name for group matches
- Display current tournament phase clearly

### New Action Buttons:
**During registration:**
- "⚔ Generate Groups" (if format has groups)
- "⚔ Generate Bracket" (if knockout only)

**During group stage:**
- "✅ Complete Group Stage" (generates knockout bracket)

---

## Phase 6: UI Polish

### Tournament Detail Page (Public)
- Show current phase: "Group Stage" / "Knockout"
- If groups exist, show standings tables
- If knockout, show bracket

### Bracket Display
- Show "Advanced from Group X" labels
- Highlight group winners in bracket

---

## Implementation Order

### Sprint 1: Foundation (Now)
1. ✅ Database migrations (add columns, create tables)
2. ✅ Backend models (TournamentGroup, GroupMember)
3. ✅ Basic group generation logic

### Sprint 2: Group Stage Matches
4. ✅ Round-robin match generation
5. ✅ Group standings calculation
6. ✅ Match verification updates points

### Sprint 3: Phase Transition
7. ✅ Complete group stage endpoint
8. ✅ Auto-generate knockout from group winners
9. ✅ Notifications

### Sprint 4: Frontend - Creation
10. ✅ Format selection in wizard
11. ✅ Group configuration UI
12. ✅ Update tournament creation flow

### Sprint 5: Frontend - Display
13. ✅ Groups tab with standings
14. ✅ Match filtering by phase
15. ✅ Public bracket with group labels

### Sprint 6: Testing & Polish
16. ✅ Test all format combinations
17. ✅ Edge cases (tie-breakers, etc.)
18. ✅ UI polish and error handling

---

## Technical Decisions

### Tie-Breaking Rules (if points equal):
1. Goal difference
2. Goals scored
3. Head-to-head result
4. Random (seeded by user_id)

### Group Distribution:
- Snake draft: A, B, C, D, D, C, B, A, A, B...
- Ensures even distribution

### Match Scheduling:
- Group matches: all scheduled for same time window
- Knockout: staggered by round

---

## Example User Flow

### Tournament Organizer:
1. Creates tournament, selects "Group Stage → Knockout"
2. Sets: 2 groups, top 2 advance, 16 max participants
3. 12 people register
4. Clicks "⚔ Generate Groups"
   - System creates Group A (6 players), Group B (6 players)
   - Generates 15 round-robin matches per group (30 total)
5. Match admin records all group matches
6. Clicks "✅ Complete Group Stage"
   - Top 2 from each group (4 players) advance
   - System generates 2-round knockout (Semi + Final)
7. Verifies knockout matches, tournament completes

### Player:
1. Registers for tournament
2. Sees "You're in Group A"
3. Receives fixture notifications for group matches
4. Plays 5 group matches
5. Finishes 1st in group
6. Advances to knockout (notified)
7. Plays Semi Final, then Final

---

## Next Steps

**RIGHT NOW:** Start with database migrations and basic group generation logic.

Ready to begin? 🚀
