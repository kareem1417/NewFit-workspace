import os
import psycopg2
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

# توحيد بيانات الاتصال بقاعدة البيانات
raw_db_url = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:rootpassword@localhost:5432/ringside"
)
DB_CONFIG = raw_db_url.split('?')[0] if '?' in raw_db_url else raw_db_url

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def search_knowledge(query, sport="boxing", limit=3):
    query_vector = embeddings.embed_query(query)
    vector_str = '[' + ','.join(str(v) for v in query_vector) + ']'

    conn = psycopg2.connect(DB_CONFIG)
    cur = conn.cursor()

    # التعديل هنا: استخدام knowledge_chunks
    cur.execute(
        """
        SELECT content FROM knowledge_chunks 
        WHERE sport = %s 
        ORDER BY embedding <=> %s::vector 
        LIMIT %s
        """,
        (sport, vector_str, limit)
    )

    results = cur.fetchall()
    cur.close()
    conn.close()

    return [r[0] for r in results]

if __name__ == "__main__":
    user_query = input("Ask Ringside AI: ")
    context_chunks = search_knowledge(user_query)

    print("\n🔍 Relevant info found in your PDF:")
    for i, chunk in enumerate(context_chunks):
        print(f"--- Chunk {i+1} ---")
        print(chunk)