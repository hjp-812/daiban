from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TodoCreate(BaseModel):
    title: str
    content: Optional[str] = None
    user_id: int


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_completed: Optional[bool] = None


class TodoResponse(BaseModel):
    id: int
    user_id: int
    title: str
    content: Optional[str]
    is_completed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserAuth(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
