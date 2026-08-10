import datetime
from typing import Dict, Any
from fsrs import FSRS, Card, Rating, State

fsrs_engine = FSRS()

def calculate_next_review(current_state: Dict[str, Any], rating_value: int) -> Dict[str, Any]:
    """
    Calculates the next review parameters for a flashcard using the FSRS algorithm.
    
    current_state expects:
    - due: datetime
    - stability: float
    - difficulty: float
    - elapsed_days: int
    - scheduled_days: int
    - reps: int
    - lapses: int
    - state: int (0=New, 1=Learning, 2=Review, 3=Relearning)
    - last_review: datetime (nullable)
    
    rating_value: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
    """
    card = Card()
    # Map dictionary to Card object
    card.due = current_state.get('due', datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc))
    card.stability = current_state.get('stability', 0.0)
    card.difficulty = current_state.get('difficulty', 0.0)
    card.elapsed_days = current_state.get('elapsed_days', 0)
    card.scheduled_days = current_state.get('scheduled_days', 0)
    card.reps = current_state.get('reps', 0)
    card.lapses = current_state.get('lapses', 0)
    
    # State enum mapping
    state_val = current_state.get('state', 0)
    if state_val == 0:
        card.state = State.New
    elif state_val == 1:
        card.state = State.Learning
    elif state_val == 2:
        card.state = State.Review
    else:
        card.state = State.Relearning
        
    last_rev = current_state.get('last_review')
    if last_rev:
        # FSRS expects timezone-aware datetime
        if last_rev.tzinfo is None:
            last_rev = last_rev.replace(tzinfo=datetime.timezone.utc)
        card.last_review = last_rev

    if card.due.tzinfo is None:
        card.due = card.due.replace(tzinfo=datetime.timezone.utc)

    # Calculate
    now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    scheduling_cards = fsrs_engine.repeat(card, now)
    
    # Match rating
    if rating_value == 1:
        next_card = scheduling_cards[Rating.Again].card
    elif rating_value == 2:
        next_card = scheduling_cards[Rating.Hard].card
    elif rating_value == 3:
        next_card = scheduling_cards[Rating.Good].card
    else:
        next_card = scheduling_cards[Rating.Easy].card
        
    # Strip tzinfo for database compatibility if necessary (SQLAlchemy sqlite handles naive utc well)
    due_naive = next_card.due.replace(tzinfo=None)
    now_naive = now.replace(tzinfo=None)

    return {
        "due": due_naive,
        "stability": next_card.stability,
        "difficulty": next_card.difficulty,
        "elapsed_days": next_card.elapsed_days,
        "scheduled_days": next_card.scheduled_days,
        "reps": next_card.reps,
        "lapses": next_card.lapses,
        "state": next_card.state.value,
        "last_review": now_naive
    }
