import os
import psycopg2
from langchain_huggingface import HuggingFaceEmbeddings

# توحيد بيانات الاتصال بقاعدة البيانات
DB_CONFIG = os.environ.get("DATABASE_URL", "host=localhost dbname=ringside user=postgres password=rootpassword port=5432")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def search_knowledge(query, sport="boxing", limit=3):
    query_vector = embeddings.embed_query(query)

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
        (sport, query_vector, limit)
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