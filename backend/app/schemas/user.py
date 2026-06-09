from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    name: str
    city: str
    postal_code: str
    interests: list[str]
    ranked_interests: list[str]
    bio: str
    avatar_url: str
    photo_url: str
    auth_provider: str
    is_admin: bool
    created_at: datetime
    profile_edit_date: str
    profile_edits_today: int
