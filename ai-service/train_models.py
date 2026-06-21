import pandas as pd
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import joblib

print("🚀 Starting PRODUCTION-READY Random Forest Pipeline...\n")

# 1. Load Data
df = pd.read_csv('fitness_dataset.csv')
X = df.drop('Recommended_Program_ID', axis=1)
y = df['Recommended_Program_ID']

# 2. Preprocessing (One-Hot Encoding)
categorical_cols = ['Sport_Type', 'Level', 'Goal']
X_encoded = pd.get_dummies(X, columns=categorical_cols)
expected_features = list(X_encoded.columns)

# Split 80/20
X_train, X_test, y_train, y_test = train_test_split(X_encoded, y, test_size=0.2, random_state=42, stratify=y)

# Scale & Encode
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

label_encoder = LabelEncoder()
y_train_encoded = label_encoder.fit_transform(y_train)
y_test_encoded = label_encoder.transform(y_test)

# 3. Train & Tune Random Forest
print("⚙️ Training and Tuning Random Forest Classifier...")
# حطينا قيم منطقية تمنع الـ Overfitting وتخليه سريع
param_grid = {
    'n_estimators': [100, 150],
    'max_depth': [8, 10, 12],
    'min_samples_split': [5, 10]
}

rf = RandomForestClassifier(class_weight='balanced', random_state=42)
grid_search = GridSearchCV(estimator=rf, param_grid=param_grid, cv=3, scoring='f1_macro', n_jobs=-1)
grid_search.fit(X_train_scaled, y_train_encoded)

final_model = grid_search.best_estimator_

# 4. Evaluation on Unseen Data
print("\n🧪 Evaluating Final Model on Unseen Test Data (20%)...")
y_pred = final_model.predict(X_test_scaled)
test_accuracy = accuracy_score(y_test_encoded, y_pred)

print(f"Final Unseen Test Accuracy: {test_accuracy * 100:.2f}%\n")
print(classification_report(y_test_encoded, y_pred, target_names=label_encoder.classes_, zero_division=0))

# 5. Save the robust pipeline
pipeline = {
    'model': final_model,
    'scaler': scaler,
    'label_encoder': label_encoder,
    'features': expected_features
}
joblib.dump(pipeline, 'champion_model.pkl')

print("✅ Random Forest Pipeline Saved successfully! 🚀")