import pandas as pd
import numpy as np
import random

np.random.seed(42)
random.seed(42)

n_samples = 5000

sports_list = [
    'Boxing', 'MMA', 'Football', 'Basketball',
    'Swimming', 'Tennis', 'Track & Field', 'General Fitness'
]

data = []
for _ in range(n_samples):
    sport = np.random.choice(sports_list)
    level = np.random.choice(['Beginner', 'Intermediate', 'Advanced'], p=[0.5, 0.35, 0.15])
    goal = np.random.choice(['Weight Loss', 'Muscle Gain', 'Endurance', 'Strength', 'Agility', 'Speed'])
    
    # 1. منطق المستوى (الخبرة والتقييمات مرتبطة بالمستوى)
    if level == 'Beginner':
        endurance = np.random.randint(1, 4)
        strength = np.random.randint(1, 4)
        speed = np.random.randint(1, 4)
        years_training = round(np.random.uniform(0.1, 1.0), 1)
        training_days = np.random.randint(2, 4)
    elif level == 'Intermediate':
        endurance = np.random.randint(4, 7)
        strength = np.random.randint(4, 7)
        speed = np.random.randint(4, 7)
        years_training = round(np.random.uniform(1.0, 4.0), 1)
        training_days = np.random.randint(3, 5)
    else: # Advanced
        endurance = np.random.randint(7, 11)
        strength = np.random.randint(7, 11)
        speed = np.random.randint(7, 11)
        years_training = round(np.random.uniform(4.0, 10.0), 1)
        training_days = np.random.randint(4, 7)

    # 2. منطق الجسم (الوزن مرتبط بالهدف تقريباً)
    height = round(np.random.uniform(160, 195), 1)
    if goal == 'Weight Loss':
        weight = np.random.randint(90, 130)
    elif goal in ['Speed', 'Agility', 'Endurance']:
        weight = np.random.randint(60, 85)
    else:
        weight = np.random.randint(70, 100)
        
    bmi = round(weight / ((height / 100) ** 2), 1)

    data.append({
        'Age': np.random.randint(16, 45),
        'Height_cm': height,
        'Weight_kg': weight,
        'BMI': bmi,
        'Level': level,
        'Goal': goal,
        'Sport_Type': sport,
        'Training_Days_Per_Week': training_days,
        'Years_Training': years_training,
        'Has_Injury_History': np.random.choice([0, 1], p=[0.8, 0.2]),
        'Endurance_Score': endurance,
        'Strength_Score': strength,
        'Speed_Score': speed,
        'Flexibility_Score': np.random.randint(1, 11),
        'Explosiveness_Score': np.random.randint(1, 11),
        'Recovery_Score': np.random.randint(1, 11)
    })

df = pd.DataFrame(data)

def assign_program(row):
    sport = row['Sport_Type']
    goal = row['Goal']
    level = row['Level']
    endurance = row['Endurance_Score']
    strength = row['Strength_Score']

    if sport == 'Boxing':
        if level == 'Beginner': return 'PRG_BOX_BEGINNER'
        if goal in ['Endurance', 'Weight Loss']: return 'PRG_BOX_CARDIO'
        return 'PRG_BOX_POWER'

    elif sport == 'MMA':
        if strength < 5: return 'PRG_MMA_STRENGTH'
        if endurance < 5: return 'PRG_MMA_CONDITIONING'
        return 'PRG_MMA_TECHNIQUE'

    elif sport == 'Football':
        if goal == 'Speed': return 'PRG_FB_SPRINT'
        if endurance < 6: return 'PRG_FB_STAMINA'
        return 'PRG_FB_STRENGTH'

    elif sport == 'Basketball':
        if goal == 'Strength': return 'PRG_BB_POST'
        if level == 'Advanced': return 'PRG_BB_PLYO'
        return 'PRG_BB_AGILITY'

    elif sport == 'Swimming':
        if goal == 'Endurance': return 'PRG_SW_DISTANCE'
        return 'PRG_SW_SPRINT'

    elif sport == 'Tennis':
        if goal == 'Agility': return 'PRG_TN_FOOTWORK'
        return 'PRG_TN_CORE_POWER'

    elif sport == 'Track & Field':
        if goal == 'Speed' or level == 'Beginner': return 'PRG_TF_SPRINT'
        return 'PRG_TF_MARATHON'

    else:
        if goal == 'Weight Loss': return 'PRG_FIT_FAT_BURN'
        elif goal == 'Muscle Gain': return 'PRG_FIT_HYPERTROPHY'
        elif goal == 'Strength': return 'PRG_FIT_POWERLIFTING'
        else: return 'PRG_FIT_HIIT'

df['Recommended_Program_ID'] = df.apply(assign_program, axis=1)

# قللنا نسبة التشويش (Noise) جداً عشان الموديل يتعلم صح
noise_indices = df.sample(frac=0.01).index
all_programs = df['Recommended_Program_ID'].unique()
df.loc[noise_indices, 'Recommended_Program_ID'] = np.random.choice(all_programs, len(noise_indices))

df.to_csv('fitness_dataset.csv', index=False)
print(f"✅ Logical Dataset generated successfully: fitness_dataset.csv ({n_samples} rows)")