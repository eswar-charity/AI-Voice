import uuid

from fastapi import HTTPException, status

from app.repositories.user_repository import UserRepository
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    token_expires_in_seconds,
)
from app.schemas.auth import LoginRequest, RegisterRequest


class AuthService:
    def __init__(self):
        self.repo = UserRepository()

    def register(self, req: RegisterRequest) -> dict:
        if self.repo.find_by_email(req.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )

        user = self.repo.create(
            {
                "id": str(uuid.uuid4()),
                "email": req.email,
                "password_hash": hash_password(req.password),
                "full_name": req.full_name,
                "role": req.role,
            }
        )

        token = create_access_token({"sub": user["id"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": token_expires_in_seconds(),
        }

    def login(self, req: LoginRequest) -> dict:
        user = self.repo.find_by_email(req.email)
        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        token = create_access_token({"sub": user["id"]})
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": token_expires_in_seconds(),
        }

    def refresh(self, token: str) -> dict:
        """Issue a new access token while the current one is still valid."""
        user = self.get_current_user(token)
        new_token = create_access_token({"sub": user["id"]})
        return {
            "access_token": new_token,
            "token_type": "bearer",
            "expires_in": token_expires_in_seconds(),
        }

    def get_current_user(self, token: str) -> dict:
        payload = decode_access_token(token)
        user = self.repo.find_by_id(payload["sub"])
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        return user
