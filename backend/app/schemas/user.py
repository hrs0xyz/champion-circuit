from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    name: str
    display_name: str
    gender: str
    date_of_birth: str
    phone: str
    city: str
    state: str
    postal_code: str
    interests: list[str]
    ranked_interests: list[str]
    bio: str
    avatar_url: str
    photo_url: str
    auth_provider: str
    is_admin: bool
    is_verified: bool
    is_venue_owner: bool
    created_at: datetime
    profile_edit_date: str
    profile_edits_today: int
