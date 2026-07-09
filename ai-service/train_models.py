import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import lightgbm as lgb
import joblib

print("🚀 Starting PRODUCTION-READY LightGBM Pipeline...\n")

EXPECTED_FEATURES = [
    'Age', 'Height_cm', 'Weight_kg', 'BMI', 'Sport_Type', 'Level', 'Goal',
    'Training_Days_Per_Week', 'Years_Training', 'Has_Injury_History',
    'Endurance_Score', 'Strength_Score', 'Speed_Score', 'Flexibility_Score',
    'Explosiveness_Score', 'Recovery_Score'
]
TARGET_COLUMN = 'Recommended_Program'

try:
    df = pd.read_csv('fitness_dataset.csv')
    print(f"✅ Dataset loaded successfully with {len(df)} records.")
except FileNotFoundError:
    print("❌ Error: 'fitness_dataset.csv' not found.")
    exit()

X = df[EXPECTED_FEATURES].copy()
y = df[TARGET_COLUMN]

# Handle Categorical Columns for LightGBM
categorical_cols = ['Sport_Type', 'Level', 'Goal']
for col in categorical_cols:
    X[col] = X[col].astype('category')

X['Has_Injury_History'] = X['Has_Injury_History'].astype(int)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

label_encoder = LabelEncoder()
y_train_encoded = label_encoder.fit_transform(y_train)
y_test_encoded = label_encoder.transform(y_test)

print("⚙️ Training and Tuning LightGBM Classifier...")
param_grid = {
    'n_estimators': [100, 200],
    'max_depth': [8, 12, -1],
    'learning_rate': [0.05, 0.1]
}

lgb_model = lgb.LGBMClassifier(class_weight='balanced', random_state=42, n_jobs=-1, verbose=-1)
grid_search = GridSearchCV(estimator=lgb_model, param_grid=param_grid, cv=3, scoring='f1_macro')
grid_search.fit(X_train, y_train_encoded)

final_model = grid_search.best_estimator_

print("\n🧪 Evaluating Final Model on Unseen Test Data (20%)...")
y_pred = final_model.predict(X_test)
test_accuracy = accuracy_score(y_test_encoded, y_pred)

print(f"Final Unseen Test Accuracy: {test_accuracy * 100:.2f}%\n")

pipeline = {
    'model': final_model,
    'label_encoder': label_encoder,
    'features': EXPECTED_FEATURES
}
joblib.dump(pipeline, 'champion_model.pkl')
print("✅ LightGBM Pipeline Saved successfully as 'champion_model.pkl'! 🚀")