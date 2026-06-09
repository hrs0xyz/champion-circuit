from pydantic import BaseModel, EmailStr, Field, HttpUrl, field_validator


INTERESTS = [
    "Cricket",
    "Badminton",
    "Football",
    "Basketball",
    "Table Tennis",
    "PUBG",
    "BGMI",
    "Valorant",
    "Free Fire",
    "FIFA",
    "Content Creation",
    "Fitness",
]


class ProfilePayload(BaseModel):
    name: str = Field(default="", max_length=120)
    city: str = Field(default="", max_length=120)
    postal_code: str = Field(default="", max_length=20)
    interests: list[str] = Field(default_factory=list, max_length=12)
    ranked_interests: list[str] = Field(default_factory=list, max_length=12)
    bio: str = Field(default="", max_length=600)
    avatar_url: HttpUrl | None = None
    photo_url: HttpUrl | None = None


class SignupStartRequest(BaseModel):
    username: str = Field(min_length=4, max_length=16)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def clean_username(cls, value: str) -> str:
        username = value.strip().lower()
        if not username.replace("_", "").isalnum():
            raise ValueError("Username can use letters, numbers, and underscore only")
        return username


class SignupStartResponse(BaseModel):
    message: str
    dev_otp: str | None = None


class SignupVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class UsernameAvailability(BaseModel):
    username: str
    available: bool


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)
    password: str


class ForgotPasswordStartRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)


class ForgotPasswordVerifyRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)
    otp: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordOtpResponse(BaseModel):
    message: str
    dev_otp: str | None = None


class ProfileUpdateRequest(ProfilePayload):
    current_password: str = Field(min_length=1, max_length=128)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=20)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
