I want to build an AI-powered ATS and Interview platform.

Tech Stack:
- React + TypeScript + Tailwind
- FastAPI backend
- LangGraph multi-agent orchestration
- OpenAI GPT-4o-mini
- OpenAI File Storage
- Supabase
- WebRTC
- Whisper STT
- ElevenLabs TTS
- WebSockets
- JWT Authentication

Features:

1. Resume upload and storage in OpenAI File API.
2. Recruiter creates Job Descriptions.
3. LangGraph agents match resumes against JDs.
4. Recruiter dashboard shows ranked candidates.
5. Candidate enters a fullscreen interview room.
6. Track candidate activity:
   - tab switching
   - fullscreen exits
   - copy/paste
   - right click
   - devtools
7. Conduct AI voice interview using:
   WebRTC → Whisper → LangGraph → OpenAI → ElevenLabs → Browser
8. Generate final evaluation report.
9. Use clean architecture:
   controllers/
   services/
   repositories/
   agents/
   schemas/
   models/


Generate the project incrementally feature by feature.
Do not generate everything at once.
Wait for my approval after completing each phase.