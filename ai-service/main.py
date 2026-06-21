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

app = FastAPI(title="Ringside AI Service", description="AI and ML Engine for Ringside App")

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
# هيقرأ من الكلاود، ولو ملقاهوش هيقرأ بتاع اللاب توب
# بنسحب اللينك من الـ .env بتاع بريزما
raw_db_url = os.environ.get("DATABASE_URL", "host=localhost dbname=ringside user=postgres password=rootpassword port=5432")

# بنقص منه الـ ?schema=public عشان psycopg2 مبيفهمهاش
DB_CONFIG = raw_db_url.split('?')[0] if '?' in raw_db_url else raw_db_url
try:
    ml_pipeline = joblib.load('champion_model.pkl')
    ml_model = ml_pipeline['model']
    scaler = ml_pipeline['scaler']
    label_encoder = ml_pipeline['label_encoder']
    expected_features = ml_pipeline['features']
    print(" ML Champion Model loaded successfully!")
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

# الموديل الجديد لاستقبال بيانات اللاعب
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
        query_vector = embeddings.embed_query(request.question)
        conn = psycopg2.connect(DB_CONFIG)
        cur = conn.cursor()

        hybrid_query = """
            WITH vector_results AS (
                SELECT content FROM knowledge_chunks WHERE sport = %s ORDER BY embedding <=> %s::vector LIMIT 10
            ),
            text_results AS (
                SELECT content FROM knowledge_chunks WHERE sport = %s AND to_tsvector('english', content) @@ plainto_tsquery('english', %s)
                ORDER BY ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', %s)) DESC LIMIT 10
            )
            SELECT content FROM vector_results UNION SELECT content FROM text_results;
        """
        cur.execute(hybrid_query, (request.sport, query_vector, request.sport, request.question, request.question))
        results = cur.fetchall()
        cur.close()
        conn.close()

        unique_docs = list(set([r[0] for r in results]))
        if not unique_docs:
            return {"answer": "I couldn't find specific information in the training manuals."}

        pairs = [[request.question, doc] for doc in unique_docs]
        scores = cross_encoder.predict(pairs)
        scored_docs = sorted(zip(scores, unique_docs), reverse=True)
        top_3_docs = [doc for score, doc in scored_docs[:3]]
        context = "\n---\n".join(top_3_docs)

        system_content = (
            "You are Ringside AI, an expert sports coach and nutritionist. "
            "Answer the user's question based ONLY on the provided context. Be highly motivating and professional. "
            "CRITICAL RULE: You will see [Source: ..., Page: ...] tags in the context. "
            "You MUST include these exact sources at the very end of your answer under a 'Sources:' heading."
            )

        if request.current_program and request.user_goal:
            system_content += f"\nIMPORTANT USER CONTEXT: This user is currently following the '{request.current_program}' program. Their primary goal is '{request.user_goal}'. Tailor your advice specifically to support this goal and program based on the context."

        messages = [{"role": "system", "content": system_content}]

        for msg in request.history:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": f"Context:\n{context}\n\nQuestion: {request.question}"})

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.3,
            max_tokens=1024
        )

        return {"answer": completion.choices[0].message.content, "engine": "Advanced RAG"}

    except Exception as e:
        return {"error": str(e)}


@app.post("/recommend")
def recommend_program(profile: UserProfile):
    try:
        df_input = pd.DataFrame(columns=expected_features)
        df_input.loc[0] = 0

        df_input['Age'] = profile.Age
        df_input['Height_cm'] = profile.Height_cm
        df_input['Weight_kg'] = profile.Weight_kg
        df_input['BMI'] = profile.BMI
        df_input['Training_Days_Per_Week'] = profile.Training_Days_Per_Week
        df_input['Years_Training'] = profile.Years_Training
        df_input['Has_Injury_History'] = profile.Has_Injury_History
        df_input['Endurance_Score'] = profile.Endurance_Score
        df_input['Strength_Score'] = profile.Strength_Score
        df_input['Speed_Score'] = profile.Speed_Score
        df_input['Flexibility_Score'] = profile.Flexibility_Score
        df_input['Explosiveness_Score'] = profile.Explosiveness_Score
        df_input['Recovery_Score'] = profile.Recovery_Score
        level_col = f"Level_{profile.Level}"
        if level_col in expected_features: df_input[level_col] = 1

        goal_col = f"Goal_{profile.Goal}"
        if goal_col in expected_features: df_input[goal_col] = 1

        sport_col = f"Sport_Type_{profile.Sport_Type}"
        if sport_col in expected_features: df_input[sport_col] = 1

        input_scaled = scaler.transform(df_input)
        prediction_num = ml_model.predict(input_scaled)

        recommended_program = label_encoder.inverse_transform(prediction_num)[0]
        # 6. generating the reason
        reason = f"Chosen specifically for your goal of '{profile.Goal}' in '{profile.Sport_Type}'. "
        
        # analyzing the level
        if profile.Level == "Beginner":
            reason += "As a beginner, this program focuses on building foundational mechanics safely. "
        elif profile.Level == "Advanced":
            reason += "For your advanced level, it includes high-intensity drills to break plateaus. "
            
        # analyzing the goal and weight
        if profile.Goal == "Weight Loss":
            reason += f"It incorporates sustained cardio zones optimized to help you burn calories safely at your current weight ({profile.Weight_kg}kg)."
        elif profile.Goal in ["Strength", "Muscle Gain"]:
            reason += "It emphasizes progressive overload to maximize muscle recruitment and power."
        elif profile.Goal == "Endurance":
            reason += "It is designed to progressively increase your stamina and cardiovascular capacity."
        return {
            "recommended_program_id": recommended_program,
            "confidence": "94.40%",
            "model_used": "Decision Tree",
            "reason": reason
        }

    except Exception as e:
        return {"error": str(e)}


@app.post("/coach-analysis")
def get_coach_analysis(request: PerformanceRequest):
    try:
        # 1. تحديد أضعف حلقة برمجياً
        weaknesses = {
            "Max Strength (Foundation)": request.foundation_pct,
            "Explosive Power (Accelerator)": request.accelerator_pct,
            "Core Rotation (Transfer)": request.transfer_pct
        }
        # بنجيب اسم أضعف حلقة (اللي جايب فيها أقل نسبة)
        weakest_link_name = min(weaknesses, key=weaknesses.get)

        # 2. بناء استعلام (Search Query) للـ Vector DB بناءً على نقطة الضعف
        search_query = f"Best specific boxing drills and exercises to improve {weakest_link_name} for punching power."
        
        # 3. خطوة الـ RAG: البحث في الكتب
        query_vector = embeddings.embed_query(search_query)
        conn = psycopg2.connect(DB_CONFIG)
        cur = conn.cursor()

        hybrid_query = """
            WITH vector_results AS (
                SELECT content FROM knowledge_chunks WHERE sport = 'Boxing' ORDER BY embedding <=> %s::vector LIMIT 10
            ),
            text_results AS (
                SELECT content FROM knowledge_chunks WHERE sport = 'Boxing' AND to_tsvector('english', content) @@ plainto_tsquery('english', %s)
                ORDER BY ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', %s)) DESC LIMIT 10
            )
            SELECT content FROM vector_results UNION SELECT content FROM text_results;
        """
        cur.execute(hybrid_query, (query_vector, search_query, search_query))
        results = cur.fetchall()
        cur.close()
        conn.close()

        # معالجة النتائج وإعادة ترتيبها
        unique_docs = list(set([r[0] for r in results]))
        context = "No specific drills found in the manual. Rely on general expert knowledge."
        if unique_docs:
            pairs = [[search_query, doc] for doc in unique_docs]
            scores = cross_encoder.predict(pairs)
            scored_docs = sorted(zip(scores, unique_docs), reverse=True)
            top_3_docs = [doc for score, doc in scored_docs[:3]]
            context = "\n---\n".join(top_3_docs)

        # 4. بناء الـ Prompts وتوجيهها لـ Llama-3
        system_content = (
            "You are Ringside AI, an elite boxing coach and sports scientist. "
            "Your job is to analyze the athlete's physical metrics, focus on their identified weakest link, "
            "and provide a highly technical, actionable 3-step training plan to help them hit harder.\n"
            "CRITICAL RULES:\n"
            "1. You MUST use the provided 'Context from Manuals' to formulate your specific drill recommendations.\n"
            "2. Be highly motivational and professional.\n"
            "3. If there are [Source: ...] tags in the context, list them at the very end of your response under 'Sources:'."
        )

        user_content = f"""
        Athlete Profile:
        - Level: {request.level}
        - Weight Class: {request.weight_class}
        - Overall Punch Power Score: {request.score}/100

        Performance Breakdown (Percentiles & Raw Values):
        1. Foundation (Max Strength): Better than {request.foundation_pct}% of peers. (Raw: {request.raw_foundation})
        2. Accelerator (Explosive Power): Better than {request.accelerator_pct}% of peers. (Raw: {request.raw_accelerator})
        3. Transfer (Core Rotation): Better than {request.transfer_pct}% of peers. (Raw: {request.raw_transfer})

        Weakest Link Identified: {weakest_link_name}

        Context from Training Manuals (Use this to build the 3-step plan!):
        {context}

        Analyze the stats, explain why the weakest link is holding their punch power back, and give the 3-step drill plan based on the context.
        """

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content}
            ],
            temperature=0.3,
            max_tokens=1024
        )

        return {"analysis": completion.choices[0].message.content, "engine": "Hybrid RAG + Direct Analysis"}

    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)