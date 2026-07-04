# Use an official Python 3.9 slim image as a base
FROM python:3.11-slim
# Set the working directory inside the container
WORKDIR /app

# Install system dependencies that some Python packages might need
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file first to leverage Docker's build cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code into the container
COPY . .

# Expose port 10000 for Render
EXPOSE 10000

# The start command for Render (without --reload)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]