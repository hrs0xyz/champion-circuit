"""
Group stage tournament logic:
- Generate groups with balanced participant distribution
- Create round-robin matches within groups
- Calculate group standings
- Advance top performers to knockout
"""
import random
import json
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.match import (
    Tournament, TournamentGroup, TournamentGroupMember,
    Match, MatchParticipant, TournamentRegistration
)
from app.models.user import User


def generate_groups(
    db: Session,
    tournament: Tournament,
    num_groups: int,
    advance_per_group: int = 2,
    points_win: int = 3,
    points_draw: int = 1,
    points_loss: int = 0,
) -> tuple[list[TournamentGroup], int]:
    """
    Generate groups for a tournament and create round-robin matches.
    
    Args:
        db: Database session
        tournament: Tournament object
        num_groups: Number of groups to create (2, 3, 4, etc.)
        advance_per_group: How many from each group advance to knockout
        points_win: Points awarded for a win
        points_draw: Points awarded for a draw
        points_loss: Points awarded for a loss
    
    Returns:
        (list of TournamentGroup, total_matches_created)
    
    Raises:
        ValueError: If validation fails
    """
    if tournament.status not in ["registration", "draft", "pending_approval"]:
        raise ValueError(f"Cannot generate groups for tournament in '{tournament.status}' status")
    
    # Check format supports groups (check both format and format_type for compatibility)
    format_val = getattr(tournament, 'format_type', None) or tournament.format
    if format_val == "knockout":
        raise ValueError("This tournament format doesn't use groups")
    
    # Check if groups already exist
    existing = db.query(TournamentGroup).filter(
        TournamentGroup.tournament_id == tournament.id
    ).count()
    if existing > 0:
        raise ValueError("Groups already generated for this tournament")
    
    # Get paid participants
    registrations = (
        db.query(TournamentRegistration)
        .filter(
            TournamentRegistration.tournament_id == tournament.id,
            TournamentRegistration.payment_status == "paid"
        )
        .order_by(TournamentRegistration.registered_at.asc())
        .all()
    )
    
    participant_count = len(registrations)
    if participant_count < 2:
        raise ValueError("Need at least 2 participants to generate groups")
    
    if num_groups < 1 or num_groups > participant_count:
        raise ValueError(f"Invalid number of groups: {num_groups} (need 1-{participant_count})")
    
    if advance_per_group < 1:
        raise ValueError("At least 1 participant must advance from each group")
    
    players_per_group = participant_count // num_groups
    if players_per_group < 2:
        raise ValueError(f"Not enough players for {num_groups} groups (need at least 2 per group)")
    
    # Store configuration
    tournament.group_config = json.dumps({
        "num_groups": num_groups,
        "advance_per_group": advance_per_group,
        "points_win": points_win,
        "points_draw": points_draw,
        "points_loss": points_loss,
    })
    tournament.current_phase = "group_stage"
    
    # Separate seeded and unseeded participants
    seeded = sorted([r for r in registrations if r.seed_number > 0], key=lambda r: r.seed_number)
    unseeded = [r for r in registrations if r.seed_number <= 0]
    random.shuffle(unseeded)
    
    # Combine: seeded first, then unseeded
    all_participants = seeded + unseeded
    
    # Create groups
    group_names = ["A", "B", "C", "D", "E", "F", "G", "H"][:num_groups]
    groups = []
    
    for i, name in enumerate(group_names):
        group = TournamentGroup(
            tournament_id=tournament.id,
            group_name=name,
            group_order=i + 1
        )
        db.add(group)
        groups.append(group)
    
    db.flush()  # Get group IDs
    
    # Distribute participants using snake draft (balanced distribution)
    # Example for 3 groups: A, B, C, C, B, A, A, B, C, C, B, A...
    group_assignments = []
    forward = True
    
    for i, reg in enumerate(all_participants):
        if forward:
            group_idx = i % num_groups
        else:
            group_idx = num_groups - 1 - (i % num_groups)
        
        # Switch direction at end of each round
        if (i + 1) % num_groups == 0:
            forward = not forward
        
        group_assignments.append((groups[group_idx], reg.user_id))
    
    # Create group members
    for group, user_id in group_assignments:
        member = TournamentGroupMember(
            group_id=group.id,
            user_id=user_id,
            points=0,
            wins=0,
            draws=0,
            losses=0,
            goals_for=0,
            goals_against=0,
            goal_difference=0,
            matches_played=0,
        )
        db.add(member)
    
    db.flush()
    
    # Generate round-robin matches for each group
    total_matches = 0
    stage = tournament.stages[0] if tournament.stages else None
    
    for group in groups:
        # Get all members in this group
        members = (
            db.query(TournamentGroupMember)
            .filter(TournamentGroupMember.group_id == group.id)
            .all()
        )
        user_ids = [m.user_id for m in members]
        
        # Generate all possible pairings (round-robin)
        matches_created = _create_round_robin_matches(
            db, tournament, group, user_ids, stage
        )
        total_matches += matches_created
    
    db.commit()
    
    return groups, total_matches


def _create_round_robin_matches(
    db: Session,
    tournament: Tournament,
    group: TournamentGroup,
    user_ids: list[int],
    stage=None,
) -> int:
    """
    Create round-robin matches for a group (everyone plays everyone once).
    
    Returns:
        Number of matches created
    """
    matches_created = 0
    n = len(user_ids)
    
    # Generate all unique pairings
    for i in range(n):
        for j in range(i + 1, n):
            match = Match(
                tournament_id=tournament.id,
                venue_id=(stage.venue_id if stage and stage.venue_id else tournament.venue_id) or None,
                match_type="tournament",
                game_mode="solo" if tournament.mode == "solo" else "team_vs_team",
                status="scheduled",
                match_phase="group_stage",
                group_id=group.id,
                stage_id=stage.id if stage else None,
                scheduled_at=tournament.starts_at or "",
                round_number=0,  # Group matches don't have round numbers
                bracket_position=0,
            )
            db.add(match)
            db.flush()
            
            # Add participants (side A and B)
            db.add(MatchParticipant(
                match_id=match.id,
                user_id=user_ids[i],
                team="A",
                role="player",
            ))
            db.add(MatchParticipant(
                match_id=match.id,
                user_id=user_ids[j],
                team="B",
                role="player",
            ))
            
            matches_created += 1
    
    return matches_created


def get_group_standings(db: Session, tournament_id: int) -> list[dict]:
    """
    Get standings for all groups in a tournament.
    
    Returns:
        [
            {
                "group_name": "A",
                "group_id": 1,
                "standings": [
                    {
                        "user_id": 4,
                        "username": "player1",
                        "name": "John Doe",
                        "points": 6,
                        "wins": 2,
                        "draws": 0,
                        "losses": 0,
                        "goals_for": 5,
                        "goals_against": 1,
                        "goal_difference": 4,
                        "matches_played": 2,
                        "position": 1,
                    },
                    ...
                ]
            },
            ...
        ]
    """
    groups = (
        db.query(TournamentGroup)
        .filter(TournamentGroup.tournament_id == tournament_id)
        .order_by(TournamentGroup.group_order)
        .all()
    )
    
    result = []
    for group in groups:
        members = (
            db.query(TournamentGroupMember, User)
            .join(User, TournamentGroupMember.user_id == User.id)
            .filter(TournamentGroupMember.group_id == group.id)
            .order_by(
                TournamentGroupMember.points.desc(),
                TournamentGroupMember.goal_difference.desc(),
                TournamentGroupMember.goals_for.desc(),
            )
            .all()
        )
        
        standings = []
        for pos, (member, user) in enumerate(members, 1):
            standings.append({
                "user_id": member.user_id,
                "username": user.username,
                "name": user.name or user.username,
                "points": member.points,
                "wins": member.wins,
                "draws": member.draws,
                "losses": member.losses,
                "goals_for": member.goals_for,
                "goals_against": member.goals_against,
                "goal_difference": member.goal_difference,
                "matches_played": member.matches_played,
                "position": pos,
                "advanced_to_knockout": member.advanced_to_knockout,
            })
        
        result.append({
            "group_name": group.group_name,
            "group_id": group.id,
            "standings": standings,
        })
    
    return result


def update_group_standings(
    db: Session,
    match: Match,
    group_config: dict,
) -> None:
    """
    Update group standings after a match is verified.
    Call this after verifying a group-stage match.
    
    Args:
        db: Database session
        match: The verified match
        group_config: Tournament group configuration (points_win, etc.)
    """
    if match.match_phase != "group_stage" or not match.group_id:
        return  # Not a group match
    
    participants = match.participants
    if len(participants) != 2:
        return  # Invalid match
    
    p1, p2 = participants[0], participants[1]
    
    # Get group members
    member1 = db.query(TournamentGroupMember).filter(
        TournamentGroupMember.group_id == match.group_id,
        TournamentGroupMember.user_id == p1.user_id,
    ).first()
    
    member2 = db.query(TournamentGroupMember).filter(
        TournamentGroupMember.group_id == match.group_id,
        TournamentGroupMember.user_id == p2.user_id,
    ).first()
    
    if not member1 or not member2:
        return
    
    # Determine result
    if p1.result == "win" and p2.result == "loss":
        # Player 1 wins
        member1.wins += 1
        member1.points += group_config.get("points_win", 3)
        member2.losses += 1
        member2.points += group_config.get("points_loss", 0)
    elif p2.result == "win" and p1.result == "loss":
        # Player 2 wins
        member2.wins += 1
        member2.points += group_config.get("points_win", 3)
        member1.losses += 1
        member1.points += group_config.get("points_loss", 0)
    elif p1.result == "draw" and p2.result == "draw":
        # Draw
        member1.draws += 1
        member2.draws += 1
        points_draw = group_config.get("points_draw", 1)
        member1.points += points_draw
        member2.points += points_draw
    
    # Update goals/scores
    member1.goals_for += p1.score
    member1.goals_against += p2.score
    member1.goal_difference = member1.goals_for - member1.goals_against
    member1.matches_played += 1
    
    member2.goals_for += p2.score
    member2.goals_against += p1.score
    member2.goal_difference = member2.goals_for - member2.goals_against
    member2.matches_played += 1
    
    db.commit()


def complete_group_stage(
    db: Session,
    tournament: Tournament,
    admin_user_id: int,
) -> Tournament:
    """
    Complete the group stage and generate knockout bracket with group winners.
    
    - Verifies all group matches are complete
    - Calculates final standings
    - Marks top N from each group as advancing
    - Generates knockout bracket
    - Sets tournament phase to 'knockout'
    
    Returns:
        Updated tournament
    
    Raises:
        ValueError: If group stage is incomplete
    """
    if tournament.current_phase != "group_stage":
        raise ValueError("Tournament is not in group stage")
    
    # Check all group matches are completed
    incomplete = db.query(Match).filter(
        Match.tournament_id == tournament.id,
        Match.match_phase == "group_stage",
        Match.status != "completed",
    ).count()
    
    if incomplete > 0:
        raise ValueError(f"{incomplete} group stage match(es) still pending")
    
    # Get group configuration
    config = json.loads(tournament.group_config or "{}")
    advance_per_group = config.get("advance_per_group", 2)
    
    # Get all groups and finalize standings
    groups = (
        db.query(TournamentGroup)
        .filter(TournamentGroup.tournament_id == tournament.id)
        .order_by(TournamentGroup.group_order)
        .all()
    )
    
    advancing_user_ids = []
    
    for group in groups:
        # Get final standings (sorted by points, goal diff, goals for)
        members = (
            db.query(TournamentGroupMember)
            .filter(TournamentGroupMember.group_id == group.id)
            .order_by(
                TournamentGroupMember.points.desc(),
                TournamentGroupMember.goal_difference.desc(),
                TournamentGroupMember.goals_for.desc(),
                TournamentGroupMember.user_id.asc(),  # Tie-breaker
            )
            .all()
        )
        
        # Assign final positions
        for pos, member in enumerate(members, 1):
            member.position = pos
            if pos <= advance_per_group:
                member.advanced_to_knockout = True
                advancing_user_ids.append(member.user_id)
    
    db.commit()
    
    # Generate knockout bracket with advancing players
    if len(advancing_user_ids) >= 2:
        _generate_knockout_bracket_from_group_winners(
            db, tournament, admin_user_id, advancing_user_ids
        )
    
    # Update tournament phase
    tournament.current_phase = "knockout"
    db.commit()
    
    return tournament


def _generate_knockout_bracket_from_group_winners(
    db: Session,
    tournament: Tournament,
    admin_user_id: int,
    advancing_user_ids: list[int],
) -> None:
    """
    Generate knockout bracket matches for group stage winners.
    Similar to generate_bracket() but uses specific participant list.
    """
    import random
    from app.models.match import Match, MatchParticipant, TournamentStage
    
    participant_count = len(advancing_user_ids)
    if participant_count < 2:
        return
    
    # Determine bracket size (next power of 2)
    bracket_size = 1 << (participant_count - 1).bit_length()
    total_rounds = bracket_size.bit_length() - 1
    
    # Get stages for venue assignment
    stages = list(tournament.stages)
    
    def stage_for_round(r: int) -> TournamentStage | None:
        if not stages:
            return None
        # Proportional: early rounds → early stages, final → last stage
        idx = min((r - 1) * len(stages) // total_rounds, len(stages) - 1)
        return stages[idx]
    
    # Slot order for seeding (classic single-elimination order)
    def _slot_order(size: int) -> list[int]:
        if size == 1:
            return [1]
        half = _slot_order(size // 2)
        return [h for h in half] + [size + 1 - h for h in half]
    
    order = _slot_order(bracket_size)
    
    # Create matches from final to round 1 (so next_match_id exists)
    matches_by_round: dict[int, list[Match]] = {}
    
    for r in range(total_rounds, 0, -1):
        stage = stage_for_round(r)
        next_round = matches_by_round.get(r + 1)
        row: list[Match] = []
        
        for i in range(bracket_size >> r):
            next_match = next_round[i // 2] if next_round else None
            m = Match(
                tournament_id=tournament.id,
                venue_id=(stage.venue_id if stage and stage.venue_id else tournament.venue_id) or None,
                match_type="tournament",
                game_mode="team_vs_team" if tournament.mode == "team" else tournament.mode,
                status="scheduled",
                match_phase="knockout",
                round_number=r,
                bracket_position=i,
                stage_id=stage.id if stage else None,
                next_match_id=next_match.id if next_match else None,
                next_match_slot=("A" if i % 2 == 0 else "B") if next_match else "",
                scheduled_at=(stage.starts_at if stage else "") or tournament.starts_at or "",
                created_by_user_id=admin_user_id,
            )
            db.add(m)
            row.append(m)
        
        db.flush()
        matches_by_round[r] = row
    
    # Fill round 1 with group winners
    round1 = matches_by_round[1]
    
    for k in range(bracket_size):
        slot_seed = order[k]
        if slot_seed > participant_count:
            continue  # Bye slot
        
        user_id = advancing_user_ids[slot_seed - 1]
        m = round1[k // 2]
        side = "A" if k % 2 == 0 else "B"
        
        db.add(MatchParticipant(
            match_id=m.id,
            user_id=user_id,
            team=side,
            role="player",
        ))
    
    db.flush()
    
    # Handle byes (matches with only one participant)
    for m in round1:
        parts = db.query(MatchParticipant).filter(
            MatchParticipant.match_id == m.id
        ).all()
        
        sides_present = {p.team for p in parts}
        
        if len(sides_present) == 2:
            continue  # Both sides present, no bye
        
        if not sides_present:
            continue  # Empty match (shouldn't happen)
        
        # Bye match: auto-complete and advance
        m.is_bye = True
        m.status = "completed"
        
        for p in parts:
            db.add(MatchParticipant(
                match_id=m.next_match_id,
                user_id=p.user_id,
                team=m.next_match_slot,
                role=p.role,
            ))
    
    db.flush()
