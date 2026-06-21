import os
import psycopg2
from langchain_community.document_loaders import TextLoader # التعديل هنا
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

DB_CONFIG = os.environ.get("DATABASE_URL", "host=localhost dbname=ringside user=postgres password=rootpassword port=5432")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def ingest_text(file_name, sport="general"):
    # الفايلات هتبقى في نفس فولدر books بس بامتداد .txt
    file_path = os.path.join("books", file_name)
    print(f"🚀 Starting ingestion for text file: {file_path}")
    
    try:
        # التعديل هنا: استخدام TextLoader مع دعم اللغة العربية أو الرموز الغريبة بـ utf-8
        try:
            loader = TextLoader(file_path, encoding='utf-8')
            docs = loader.load()
        except RuntimeError:
            # لو فشل، بنجبره يقرأ الملف ويتجاهل الحروف اللي مش فاهمها عشان السكريبت ميقفش
            loader = TextLoader(file_path, autodetect_encoding=True)
            try:
                docs = loader.load()
            except Exception:
                # كحل أخير، بنفتحه يدوياً ونتجاهل أي إيرور في الحروف
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    text = f.read()
                from langchain_core.documents import Document
                docs = [Document(page_content=text, metadata={"source": file_path})]
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = text_splitter.split_documents(docs)
        
        if not chunks:
            print(f"⚠️ Warning: '{file_path}' is empty. Skipping...")
            return  
        
        source_file = os.path.basename(chunks[0].metadata.get('source', 'Unknown Book'))

        conn = psycopg2.connect(DB_CONFIG)
        cur = conn.cursor()

        for chunk in chunks:
            # ملفات الـ Text مفيهاش صفحات، فهنثبتها أو نشيلها براحتك
            original_text = chunk.page_content
            
            # append citation to chunk
            enriched_content = f"[Source: {source_file}]\n{original_text}"
            
            vector = embeddings.embed_query(enriched_content)
            
            cur.execute(
                """
                INSERT INTO knowledge_chunks (id, sport, topic, content, embedding, "created_at")
                VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                """,
                (sport, "training_knowledge", enriched_content, vector)
            )
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ Successfully ingested {len(chunks)} chunks from {source_file}!")
        
    except Exception as e:
        print(f"❌ Error processing '{file_path}': {e}. Skipping...")

if __name__ == "__main__":
    # === General Fitness, Physiology & Conditioning ===
    #ingest_text("2264_Essentials_of_Strength_Training_and_Conditioning_4th_Edition-sport.ta4a.us.txt", sport="general")
    #ingest_text("ACSM’s Exercise for Older Adults (Wojtek J. Chodzko-Zajko) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="general")
    #ingest_text("ACSMs Guidelines for Exercise Testing and Prescription, 9e ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="general")
    #ingest_text("Developing better athletes, better people  a leaders guide to transforming high school and youth sports into a development… (Thompson, Jim, 1949- author, Rivers, Glenn etc.) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="general")
    #ingest_text("Effects of Plyometric Training on Sports Performance in Team Sports: A Literature Review.txt", sport="general")
    #ingest_text("Foundations-of-Exercise-Science-1748368647._print.txt", sport="general")
    #ingest_text("NSCA_Developing_Agility_and_Quickness.txt", sport="general")
    #ingest_text("NSCA_Developing_Endurance.txt", sport="general")
    #ingest_text("NSCAS Essentials of Personal Training - 2nd Edition ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="general")
    #ingest_text("NSCAs guide to tests and assessments ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="general")
    #ingest_text("Stretching Anatomy (Arnold G. Nelson, Jouko Kokkonen) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="general")
    #ingest_text("The-Physiology-of-Exercise-1774446321._print.txt", sport="general")
    #ingest_text("tudor_bompa_carlo_buzzichelli-periodization_training_for_sports-human_kinetics__2015_.txt", sport="general")
    #ingest_text("Workout_guide.txt", sport="general")

    # === Strength Training & Biomechanics ===
    #ingest_text("basics_of_strength_and_conditioning_manual.txt", sport="strength")
    #ingest_text("Kettlebell training for athletes  develop explosive power and strength for martial arts, football, basketball, and other… (Bellomo, Dave) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="strength")
    #ingest_text("NSCA_Developing_Power.txt", sport="strength")
    #ingest_text("NSCAS Essentials of Tactical Strength and Conditioning ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="strength")
    #ingest_text("Reciprocal Forearm Flexion-Extension Resistance Training Elicits Comparable Increases in Muscle Strength and Size With and Without Blood Flow Restriction.txt", sport="strength")

    # === Boxing & Combat Sports ===
    #ingest_text("Biomechanics of Punching—The Impact of Effective Mass and Force Transfer on Strike Performance.txt", sport="boxing")
    #ingest_text("Biomechanics of the lead straight punch of different level boxers.txt", sport="boxing")
    #ingest_text("boxing_manual.txt", sport="boxing")
    #ingest_text("Special-Issue-Strength-and-conditioning-for-combat-sports-athletes-Revista-de-Artes-Marciales-Asiaticas.pdf.txt", sport="combat_fitness")
    #ingest_text("strength-and-conditioning-for-combat-sports-9781785004063_compress.txt", sport="combat_fitness")
    #ingest_text("strength_and_conditioning_for_grappling_sports.4.txt", sport="combat_fitness")

    # === Football (Soccer) ===
    #ingest_text("Strength_and_Conditioning_for_Football.txt", sport="football")
    #ingest_text("Strength_and_Conditioning_for_Soccer_Players.1.txt", sport="football")
    #ingest_text("Strength training for soccer Ralf Meier z-library.sk, 1lib.sk, z-lib.sk.txt", sport="football")

    # === Nutrition ===
    #ingest_text("NSCAs guide to sport and exercise nutrition ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).txt", sport="nutrition")
    #ingest_text("Sport Nutrition.txt", sport="nutrition")
    
    # === Physical Therapy / Rehab ===
    #ingest_text("exercicios-terapeuticos-kisner.txt", sport="rehab")