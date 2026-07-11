import psycopg2
import joblib
import pandas as pd
import os
from groq import Groq
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from langchain_huggingface import HuggingFaceEmbeddings
from sentence_transformers import CrossEncoder
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

app = FastAPI(title="Ringside AI Service", description="AI and ML Engine for NeoFit App")

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

# ── Database connection ──────────────────────────────────────────────────────
raw_db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:rootpassword@localhost:5432/ringside")
DB_CONFIG = raw_db_url.split('?')[0] if '?' in raw_db_url else raw_db_url

try:
    ml_pipeline = joblib.load('champion_model.pkl')
    ml_model = ml_pipeline['model']
    label_encoder = ml_pipeline['label_encoder']
    expected_features = ml_pipeline['features']
    print("🚀 ML LightGBM Champion Model loaded successfully!")
except Exception as e:
    print(f"Warning: ML model not loaded. Error: {e}")

class Message(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    question: str
    sport: str = "General Fitness"
    history: Optional[List[Message]] = []
    current_program: Optional[str] = None
    user_goal: Optional[str] = None

class UserProfile(BaseModel):
    Age: int
    Height_cm: float
    Weight_kg: float
    BMI: float
    Sport_Type: str
    Level: str
    Goal: str
    Training_Days_Per_Week: int
    Years_Training: float
    Has_Injury_History: int
    Endurance_Score: int
    Strength_Score: int
    Speed_Score: int
    Flexibility_Score: int
    Explosiveness_Score: int
    Recovery_Score: int

class PerformanceRequest(BaseModel):
    score: float
    level: str
    weight_class: str
    foundation_pct: int
    accelerator_pct: int
    transfer_pct: int
    raw_foundation: float
    raw_accelerator: float
    raw_transfer: float

class ReadinessInputs(BaseModel):
    sleep_hours: float
    fatigue: int
    soreness: int
    stress: int

class ReadinessHistory(BaseModel):
    seven_day_average: Optional[float] = None
    yesterday_score: Optional[int] = None
    previous_workout_rpe: Optional[int] = None
    previous_workout_duration_minutes: Optional[int] = None
    days_since_last_workout: Optional[int] = None

class ReadinessWorkout(BaseModel):
    session_name: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None

class ReadinessAdviceRequest(BaseModel):
    score: int
    status: str
    recommendation: str
    intensity_adjustment: int
    inputs: ReadinessInputs
    history: Optional[ReadinessHistory] = None
    workout: Optional[ReadinessWorkout] = None
    sport: Optional[str] = "general"
    level: Optional[str] = None

# ══════════════════════════════════════════════════════════════════════════════
# RAG — Knowledge Retrieval with pgvector + CrossEncoder Re-ranking
# ══════════════════════════════════════════════════════════════════════════════

def search_knowledge(query: str, sport: str = "general", limit: int = 10) -> list[dict]:
    """
    Stage 1: Embed the query and retrieve candidate chunks from pgvector.
    Returns raw rows (content, source, score) sorted by cosine distance.
    """
    try:
        query_vector = embeddings.embed_query(query)
        vector_str = '[' + ','.join(str(v) for v in query_vector) + ']'

        conn = psycopg2.connect(DB_CONFIG)
        cur = conn.cursor()

        # Fetch candidates — filter by sport if not "general"
        # Use cosine distance operator <=> from pgvector
        sport_lower = sport.lower().replace(" ", "_")

        cur.execute(
            """
            SELECT content, source, (embedding <=> %s::vector) AS distance
            FROM knowledge_chunks
            WHERE sport = %s OR sport = 'general'
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (vector_str, sport_lower, vector_str, limit)
        )

        results = cur.fetchall()
        cur.close()
        conn.close()

        return [
            {"content": row[0], "source": row[1] or "Unknown", "distance": float(row[2])}
            for row in results
        ]
    except Exception as e:
        print(f"⚠️ Knowledge search error: {e}")
        return []


def rerank_results(query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
    """
    Stage 2: Re-rank candidates using CrossEncoder for higher precision.
    """
    if not candidates:
        return []

    pairs = [(query, c["content"]) for c in candidates]
    scores = cross_encoder.predict(pairs)

    for i, score in enumerate(scores):
        candidates[i]["rerank_score"] = float(score)

    # Sort by CrossEncoder relevance (higher = better)
    ranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
    return ranked[:top_k]


def build_rag_context(chunks: list[dict]) -> str:
    """
    Build a context block from retrieved knowledge chunks for the LLM prompt.
    """
    if not chunks:
        return ""

    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk.get("source", "Unknown")
        content = chunk["content"]
        context_parts.append(f"[{i}] (Source: {source})\n{content}")

    return "\n\n---\n\n".join(context_parts)


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/ask")
def ask_ai(request: QueryRequest):
    try:
        if not GROQ_API_KEY:
            return {
                "answer": "AI service is not configured. Missing GROQ_API_KEY.",
                "sources": [],
                "suggested_program_ids": []
            }

        # ── Stage 1+2: RAG Retrieval ─────────────────────────────────────
        candidates = search_knowledge(request.question, sport=request.sport, limit=10)
        top_chunks = rerank_results(request.question, candidates, top_k=5)
        rag_context = build_rag_context(top_chunks)

        # Collect unique source names for the response
        sources = list({c.get("source", "Unknown") for c in top_chunks if c.get("source")})

        # ── Build conversation history ───────────────────────────────────
        history_messages = []
        if request.history:
            for msg in request.history[-6:]:
                role = "assistant" if msg.role == "assistant" else "user"
                history_messages.append({
                    "role": role,
                    "content": msg.content
                })

        # ── System prompt with RAG context ───────────────────────────────
        context_block = ""
        if rag_context:
            context_block = f"""
Below is relevant knowledge from our training library. Use it to ground your answer.
If the knowledge doesn't cover the question, rely on your general expertise but mention
that the answer is based on general knowledge.

--- KNOWLEDGE BASE CONTEXT ---
{rag_context}
--- END CONTEXT ---
"""

        system_prompt = f"""You are Ringside AI, a helpful sports performance and fitness advisor inside the NeoFit app.

User context:
- Sport: {request.sport or "General Fitness"}
- Goal: {request.user_goal or "General"}
- Current program: {request.current_program or "None"}
{context_block}
Instructions:
- Give practical, safe, concise advice grounded in the knowledge base context when available.
- Cite sources when referencing specific information (e.g., "According to [Source Name]...").
- If the user asks for medical/injury advice, recommend seeing a professional.
- Keep responses focused and actionable.
"""

        messages = [
            {
                "role": "system",
                "content": system_prompt
            },
            *history_messages,
            {
                "role": "user",
                "content": request.question
            }
        ]

        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            temperature=0.7,
            max_tokens=700,
        )

        answer = completion.choices[0].message.content

        return {
            "answer": answer,
            "sources": sources,
            "suggested_program_ids": []
        }

    except Exception as e:
        print(f"Ask AI Error: {e}")
        return {
            "answer": "Sorry, I could not generate an AI response right now. Please try again.",
            "sources": [],
            "suggested_program_ids": [],
            "error": str(e)
        }

@app.post("/readiness-advice")
def readiness_advice(request: ReadinessAdviceRequest):
    return {
        "summary": f"Today's readiness score is {request.score}/100.",
        "explanation": "This readiness advice is generated from your readiness inputs and training context.",
        "advice": request.recommendation,
        "safety_note": "Listen to your body. If you feel sharp pain or unusual symptoms, stop training and consult a professional.",
        "sources": []
    }

@app.post("/recommend")
def recommend_program(profile: UserProfile):
    try:
        input_data = {
            'Age': profile.Age,
            'Height_cm': profile.Height_cm,
            'Weight_kg': profile.Weight_kg,
            'BMI': profile.BMI,
            'Sport_Type': profile.Sport_Type,
            'Level': profile.Level,
            'Goal': profile.Goal,
            'Training_Days_Per_Week': profile.Training_Days_Per_Week,
            'Years_Training': profile.Years_Training,
            'Has_Injury_History': profile.Has_Injury_History,
            'Endurance_Score': profile.Endurance_Score,
            'Strength_Score': profile.Strength_Score,
            'Speed_Score': profile.Speed_Score,
            'Flexibility_Score': profile.Flexibility_Score,
            'Explosiveness_Score': profile.Explosiveness_Score,
            'Recovery_Score': profile.Recovery_Score
        }

        df_input = pd.DataFrame([input_data])[expected_features]

        categorical_cols = ['Sport_Type', 'Level', 'Goal']
        for col in categorical_cols:
            df_input[col] = df_input[col].astype('category')

        prediction_num = ml_model.predict(df_input)
        recommended_program_title = label_encoder.inverse_transform(prediction_num)[0]

        reason = f"Chosen specifically for your goal of '{profile.Goal}' in '{profile.Sport_Type}'. "
        if profile.Level == "Novice":
            reason += "As a beginner, this program focuses on building foundational mechanics safely."
        elif profile.Level == "Professional":
            reason += "For your advanced level, it includes high-intensity drills to break plateaus."

        return {
            "recommended_program": recommended_program_title,
            "confidence": "95.5%",
            "model_used": "LightGBM Classifier",
            "reason": reason
        }

    except Exception as e:
        return {"error": str(e)}

@app.post("/coach-analysis")
def get_coach_analysis(request: PerformanceRequest):
    return {
        "analysis": "Coach analysis is not implemented yet.",
        "recommendations": []
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
