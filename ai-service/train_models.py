import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import lightgbm as lgb
import joblib

print("🚀 Starting PRODUCTION-READY LightGBM Pipeline...\n")

# 1. Load Data
df = pd.read_csv('fitness_dataset.csv')
X = df.drop('Recommended_Program_ID', axis=1)
y = df['Recommended_Program_ID']

# 2. Preprocessing (Native Categorical Handling)
categorical_cols = ['Sport_Type', 'Level', 'Goal']
for col in categorical_cols:
    X[col] = X[col].astype('category')

expected_features = list(X.columns)

# Split 80/20
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# Encode Target Labels
label_encoder = LabelEncoder()
y_train_encoded = label_encoder.fit_transform(y_train)
y_test_encoded = label_encoder.transform(y_test)

# 3. Train & Tune LightGBM
print("⚙️ Training and Tuning LightGBM Classifier...")
param_grid = {
    'n_estimators': [100, 200],
    'max_depth': [8, 12, -1],
    'learning_rate': [0.05, 0.1]
}

# class_weight='balanced' prevents bias towards the most common workout programs
lgb_model = lgb.LGBMClassifier(class_weight='balanced', random_state=42, n_jobs=-1)
grid_search = GridSearchCV(estimator=lgb_model, param_grid=param_grid, cv=3, scoring='f1_macro')
grid_search.fit(X_train, y_train_encoded)

final_model = grid_search.best_estimator_

# 4. Evaluation on Unseen Data
print("\n🧪 Evaluating Final Model on Unseen Test Data (20%)...")
y_pred = final_model.predict(X_test)
test_accuracy = accuracy_score(y_test_encoded, y_pred)

print(f"Final Unseen Test Accuracy: {test_accuracy * 100:.2f}%\n")
print(classification_report(y_test_encoded, y_pred, target_names=label_encoder.classes_, zero_division=0))

# 5. Save the robust pipeline
pipeline = {
    'model': final_model,
    'label_encoder': label_encoder,
    'features': expected_features
}
joblib.dump(pipeline, 'champion_model.pkl')

print("✅ LightGBM Pipeline Saved successfully! 🚀")