import pandas as pd
import numpy as np
import random

print("⚙️ Generating Synthetic Dataset for NeoFit...")

SPORTS = ['Boxing', 'Football', 'Basketball', 'Running', 'Weightlifting']
LEVELS = ['Novice', 'Amateur', 'Professional']
GOALS = ['Weight_Loss', 'Muscle_Gain', 'Endurance', 'Strength', 'Agility', 'Speed', 'Flexibility', 'Recovery', 'Power', 'General']

# All programs that exist in the seed (7 total)
PROGRAMS = {
    'Boxing_Power':     'Explosive Punch Power',
    'Boxing_Endurance': 'Iron Endurance Boxing',
    'Football_Speed':   'Speed Academy',
    'Football_Power':   'Football Power Builder',
    'Basketball_Jump':  'Vertical Jump Pro',
    'General_Fit':      'General Fitness Foundation',
    'Running_Endurance':'Running Endurance Builder',
}

data = []
NUM_SAMPLES = 3000

for _ in range(NUM_SAMPLES):
    age = random.randint(16, 50)
    height = round(random.uniform(160.0, 195.0), 1)
    weight = round(random.uniform(60.0, 120.0), 1)
    bmi = round(weight / ((height / 100) ** 2), 1)

    sport = random.choice(SPORTS)
    level = random.choice(LEVELS)
    goal = random.choice(GOALS)

    training_days = random.randint(2, 6)
    years_training = round(random.uniform(0.0, 10.0), 1)
    has_injury = random.choice([0, 1])

    scores = [random.randint(3, 10) for _ in range(6)]
    endurance, strength, speed, flexibility, explosiveness, recovery = scores

    # --- Recommendation logic ---
    if sport == 'Boxing' and goal in ['Power', 'Strength', 'Muscle_Gain']:
        recommended = PROGRAMS['Boxing_Power']
    elif sport == 'Boxing' and goal in ['Endurance', 'Recovery']:
        recommended = PROGRAMS['Boxing_Endurance']
    elif sport == 'Football' and goal in ['Speed', 'Agility']:
        recommended = PROGRAMS['Football_Speed']
    elif sport == 'Football' and goal in ['Strength', 'Power', 'Muscle_Gain']:
        recommended = PROGRAMS['Football_Power']
    elif sport == 'Basketball' and (goal in ['Power', 'Strength'] or explosiveness < 6):
        recommended = PROGRAMS['Basketball_Jump']
    elif sport in ['Running', 'Weightlifting'] and goal in ['Endurance', 'Recovery']:
        recommended = PROGRAMS['Running_Endurance']
    elif level == 'Novice' or goal in ['General', 'Weight_Loss', 'Flexibility']:
        recommended = PROGRAMS['General_Fit']
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
        'Endurance_Score': endurance,
        'Strength_Score': strength,
        'Speed_Score': speed,
        'Flexibility_Score': flexibility,
        'Explosiveness_Score': explosiveness,
        'Recovery_Score': recovery,
        'Recommended_Program': recommended,
    }
    data.append(row)

df = pd.DataFrame(data)
df.to_csv('fitness_dataset.csv', index=False)
print(f"✅ Generated 'fitness_dataset.csv' with {NUM_SAMPLES} rows successfully!")
print(f"   Programs distribution:\n{df['Recommended_Program'].value_counts().to_string()}")