import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    validate_password,
    verify_password,
)
from app.database import get_db
from app.deps import get_current_user
from app.models import AuditLog, Org, RevokedToken, User
from app.schemas import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    validate_password(body.password)

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    org = Org(name=body.org_name)
    db.add(org)
    db.flush()

    user = User(
        org_id=org.id,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()

    db.add(AuditLog(
        org_id=org.id,
        user_id=user.id,
        event_type="USER_REGISTERED",
        entity_type="user",
        entity_id=user.id,
        meta={"email": body.email},
    ))

    db.commit()
    db.refresh(user)

    token_data = {"sub": str(user.id), "org_id": str(user.org_id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="USER_LOGIN",
        entity_type="user",
        entity_id=user.id,
    ))
    db.commit()

    token_data = {"sub": str(user.id), "org_id": str(user.org_id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Revoke the old refresh token so it can't be reused (rotation)
    jti = payload.get("jti")
    if jti:
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        db.add(RevokedToken(
            jti=jti,
            user_id=user.id,
            token_type="refresh",
            expires_at=exp,
        ))
        db.commit()

    token_data = {"sub": str(user.id), "org_id": str(user.org_id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/logout")
def logout(
    body: LogoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Revoke the refresh token
    payload = decode_token(body.refresh_token)
    if payload and payload.get("type") == "refresh":
        jti = payload.get("jti")
        if jti:
            existing = db.query(RevokedToken).filter(RevokedToken.jti == jti).first()
            if not existing:
                exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
                db.add(RevokedToken(
                    jti=jti,
                    user_id=user.id,
                    token_type="refresh",
                    expires_at=exp,
                ))

    db.add(AuditLog(
        org_id=user.org_id,
        user_id=user.id,
        event_type="USER_LOGOUT",
        entity_type="user",
        entity_id=user.id,
    ))
    db.commit()

    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
