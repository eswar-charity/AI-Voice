from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserSchema
from app.services.auth_service import AuthService

router = APIRouter()
security = HTTPBearer()


def get_auth_service() -> AuthService:
    return AuthService()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(req: RegisterRequest, svc: AuthService = Depends(get_auth_service)):
    return svc.register(req)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, svc: AuthService = Depends(get_auth_service)):
    return svc.login(req)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    creds: HTTPAuthorizationCredentials = Depends(security),
    svc: AuthService = Depends(get_auth_service),
):
    return svc.refresh(creds.credentials)


@router.get("/me", response_model=UserSchema)
def me(
    creds: HTTPAuthorizationCredentials = Depends(security),
    svc: AuthService = Depends(get_auth_service),
):
    return svc.get_current_user(creds.credentials)
