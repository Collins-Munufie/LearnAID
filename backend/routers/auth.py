import os
import re
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests
import secrets
from dotenv import load_dotenv

load_dotenv()

from database import get_db
import models

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "quantum_flashcard_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class UserCreate(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class GoogleToken(BaseModel):
    credential: str

def verify_password(plain_password, hashed_password):
    if not hashed_password:
        return False
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    plain_password = plain_password.encode('utf-8')
    try:
        return bcrypt.checkpw(plain_password, hashed_password)
    except ValueError:
        return False

def get_password_hash(password):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=Token)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    if not re.match(r"[^@]+@[^@]+\.[^@]+", user.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    if len(user.password) < 8 or not re.search(r"[A-Za-z]", user.password) or not re.search(r"\d", user.password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long and contain both letters and numbers")
        
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
def read_users_me(current_user: models.User = Depends(get_current_user)):
    stats = current_user.stats
    return {
        "user": {
            "name": current_user.email.split('@')[0],
            "email": current_user.email,
            "id": current_user.id
        },
        "stats": {
            "quiz_attempts": stats.quiz_attempts if stats else 0,
            "quizAccuracy": stats.quiz_accuracy if stats else 0,
            "trueFalseAccuracy": stats.true_false_accuracy if stats else 0,
            "fillBlankAccuracy": stats.fill_blank_accuracy if stats else 0,
            "total_flashcards_studied": stats.total_flashcards_studied if stats else 0,
        }
    }

@router.post("/google", response_model=Token)
def login_with_google(token_data: GoogleToken, db: Session = Depends(get_db)):
    try:
        # Verify the Google JWT token
        idinfo = id_token.verify_oauth2_token(
            token_data.credential, 
            requests.Request(), 
            os.environ.get("GOOGLE_CLIENT_ID"),
            clock_skew_in_seconds=60
        )
        
        email = idinfo.get("email")
        name = idinfo.get("name")
        picture = idinfo.get("picture")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
            
        user = db.query(models.User).filter(models.User.email == email).first()
        
        if not user:
            # Create new user
            # Generate a random password since they use Google Auth
            random_pwd = secrets.token_urlsafe(16)
            hashed_password = get_password_hash(random_pwd)
            
            user = models.User(
                email=email, 
                hashed_password=hashed_password,
                full_name=name,
                profile_picture=picture
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Update user info if it was missing
            if not user.full_name and name:
                user.full_name = name
            if not user.profile_picture and picture:
                user.profile_picture = picture
            db.commit()
            
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
        
    except ValueError as e:
        print(f"Google Token Verification Failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
