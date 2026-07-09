import pandas as pd
import numpy as np
import random

print("⚙️ Generating Synthetic Dataset for NeoFit...")

# المتغيرات متطابقة 100% مع الـ Prisma Schema والـ Node.js Backend
SPORTS = ['Boxing', 'Football', 'Basketball', 'Running', 'Weightlifting']
LEVELS = ['Novice', 'Amateur', 'Professional']
GOALS = ['Weight Loss', 'Muscle Gain', 'Endurance', 'Strength', 'Agility', 'Speed', 'Flexibility', 'Recovery', 'Power', 'General']

# البرامج اللي موجودة في الـ Seed
PROGRAMS = {
    'Boxing_Power': 'Explosive Punch Power',
    'Football_Speed': 'Speed Academy',
    'Basketball_Power': 'Vertical Jump Pro',
    'General_Fit': 'General Fitness Foundation'
}

data = []
NUM_SAMPLES = 2000

for _ in range(NUM_SAMPLES):
    age = random.randint(16, 50)
    height = round(random.uniform(160.0, 195.0), 1)
    weight = round(random.uniform(60.0, 120.0), 1)
    bmi = round(weight / ((height/100)**2), 1)
    
    sport = random.choice(SPORTS)
    level = random.choice(LEVELS)
    goal = random.choice(GOALS)
    
    training_days = random.randint(2, 6)
    years_training = round(random.uniform(0.0, 10.0), 1)
    has_injury = random.choice([0, 1])
    
    # Random Scores (1-10)
    scores = [random.randint(3, 10) for _ in range(6)]
    
    # 🎯 بناء منطق الترشيح عشان الموديل يتعلم صح
    if sport == 'Boxing' and goal in ['Power', 'Strength', 'Explosiveness']:
        recommended = PROGRAMS['Boxing_Power']
    elif sport == 'Football' and goal in ['Speed', 'Agility']:
        recommended = PROGRAMS['Football_Speed']
    elif sport == 'Basketball' and (goal in ['Power', 'Explosiveness'] or scores[4] < 6):
        recommended = PROGRAMS['Basketball_Power']
    else:
        recommended = PROGRAMS['General_Fit']

    row = {
        'Age': age,
        'Height_cm': height,
        'Weight_kg': weight,
        'BMI': bmi,
        'Sport_Type': sport,
        'Level': level,
        'Goal': goal,
        'Training_Days_Per_Week': training_days,
        'Years_Training': years_training,
        'Has_Injury_History': has_injury,
        'Endurance_Score': scores[0],
        'Strength_Score': scores[1],
        'Speed_Score': scores[2],
        'Flexibility_Score': scores[3],
        'Explosiveness_Score': scores[4],
        'Recovery_Score': scores[5],
        'Recommended_Program': recommended
    }
    data.append(row)

df = pd.DataFrame(data)
df.to_csv('fitness_dataset.csv', index=False)
print(f"✅ Generated 'fitness_dataset.csv' with {NUM_SAMPLES} rows successfully!")