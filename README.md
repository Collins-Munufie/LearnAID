# LearnAID 🧠

**LearnAID** is a full-stack, AI-powered learning platform designed to transform your raw study materials into highly interactive, comprehensive study modules. By simply uploading a document or providing a URL, LearnAID leverages advanced Large Language Models (via Groq) to instantly generate flashcards, multiple-choice quizzes, written tests, fill-in-the-blank exercises, AI audio podcasts, and personalized tutor lessons.

---

## 🚀 Key Features

* **AI-Driven Generation:** Automatically extract context from PDFs, PPTXs, DOCXs, TXTs, or web URLs to construct dynamic study sets.
* **Modular Study Modes:** Practice exactly how you want. Choose between standard flashcards, strict written evaluations, or casual AI podcasts.
* **Mastery Tracking & Analytics:** An intelligent dashboard monitors your success rates, study streaks, and flashcard mastery levels (from "Unfamiliar" to "Mastered").
* **Interactive AI Study Assistant:** Chat directly with an AI contextually aware of your specific uploaded source material.
* **Secure Authentication:** Features robust JWT-based session management, bcrypt password hashing, and seamless **Google OAuth** integration.
* **Modern UI/UX:** Built with React, TailwindCSS, and Framer Motion for a stunning, responsive, and glass-morphic visual aesthetic inspired by Brainscape.

---

## 🛠️ Technology Stack

### Frontend
* **Framework:** React 18 (built with Vite)
* **Styling:** TailwindCSS (v4) with custom global design tokens
* **Animations:** Framer Motion
* **Routing:** React Router DOM
* **Authentication:** Google OAuth (`@react-oauth/google`)
* **Icons:** Lucide React

### Backend
* **Framework:** FastAPI (Python)
* **Database:** SQLite with SQLAlchemy ORM
* **Security:** PyJWT, Passlib, Bcrypt, Google Auth Transport
* **AI Integration:** Groq API (utilizing `llama3-8b-8192` for high-speed generation)
* **Processing:** PyMuPDF (`fitz`), python-docx, pptx for rich document extraction

---

## 🏗️ System Architecture

```mermaid
graph TD
    %% User Inputs
    User([User]) -->|Uploads PDF, URL, etc.| Frontend
    User -->|Google Auth / Login| Frontend

    %% Frontend interactions
    subgraph Client [Frontend (React + Vite)]
        Frontend[UI / Generator]
        Study[Study Modes & Dashboard]
        Frontend <--> Study
    end

    %% Backend interactions
    subgraph Server [Backend (FastAPI)]
        API[API Endpoints]
        Auth[Auth & JWT Auth]
        Parser[Document Parsers]
        
        API <--> Auth
        API --> Parser
    end

    Frontend -->|POST /api/extract-document| API
    Frontend -->|POST /api/generate-selected| API

    %% External APIs
    subgraph External [External Services]
        Groq((Groq AI Engine))
        GoogleAuth((Google OAuth))
    end

    %% Storage
    subgraph DB [Database]
        SQLite[(SQLite DB)]
    end

    %% Relationships
    Parser -->|Raw Text| Groq
    Groq -->|Generated Modules JSON| API
    Auth <--> GoogleAuth
    API <-->|Save/Load Flashcards & Users| SQLite
    API -->|Sends Study Material| Study
```

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd LearnAID
```

### 2. Backend Setup
Navigate to the backend directory and set up your Python environment:
```bash
cd backend
python -m venv venv

# Activate the virtual environment:
# On Windows:
.\\venv\\Scripts\\activate
# On Mac/Linux:
# source venv/bin/activate

pip install fastapi uvicorn sqlalchemy passlib[bcrypt] python-jose python-multipart python-dotenv groq google-auth PyMuPDF python-docx python-pptx
```

Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEY=your_groq_api_key
JWT_SECRET_KEY=your_jwt_secret_key
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Start the FastAPI server:
```bash
uvicorn main:app --reload
```
*(The backend runs on `http://127.0.0.1:8000`)*

### 3. Frontend Setup
Open a new terminal, navigate to the frontend directory, and install the Node dependencies:
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory:
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Start the Vite development server:
```bash
npm run dev
```
*(The frontend runs on `http://localhost:5173`)*

---

## 🎨 Design System
LearnAID utilizes a customized "quantum" and "brand" design system defined in `index.css`. The application extensively uses `brand-primary` (deep vibrant accents), `brand-surface` (glass-morphic panels), and `brand-bg` (dark/navy backdrops) to ensure a high-contrast, premium educational experience.

---

## 🔒 Security Notes
* **Never commit your `.env` files.** They are explicitly included in the `.gitignore`.
* Google OAuth relies on strict Audience verification on the backend to prevent token spoofing. Ensure your `GOOGLE_CLIENT_ID` exactly matches between the frontend and backend.

---

*Built with ❤️ for accelerated learning.*
