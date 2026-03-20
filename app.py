# ================================================
# app.py — Python Flask Server for QuizBattle AI
#
# This replaces api.php when hosted on Render
# Flask is Python's web framework (like PHP but Python)
#
# HOW IT WORKS:
# 1. JavaScript sends topic + count to /api endpoint
# 2. Flask calls Groq AI API
# 3. Flask sends questions back to JavaScript
# ================================================

# Import libraries
# flask = web framework (like XAMPP for Python)
# request = reads data sent from JavaScript
# jsonify = converts Python dict to JSON response
# CORS = fixes CORS error (allows browser to call this)
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import json
import os

# Create Flask app
app = Flask(__name__, static_folder='.')
CORS(app)  # Allow all origins — fixes CORS error

# ── YOUR GROQ API KEY ─────────────────────────────
# We read it from environment variable (more secure!)
# You'll set this in Render dashboard
# For local testing you can put your key directly:
# GROQ_API_KEY = 'gsk_xxxxxxxxxx'
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', 'your_groq_key_here')

# ── SERVE index.html ──────────────────────────────
# This serves your game when someone visits the URL
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Serve static files (style.css, script.js)
@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

# ── API ENDPOINT ──────────────────────────────────
# JavaScript calls this URL: /api
# Like api.php but in Python!
@app.route('/api', methods=['POST'])
def generate_questions():

    # Step 1: Get data from JavaScript
    # Like $_POST['topic'] in PHP
    topic = request.form.get('topic', '').strip()
    count = int(request.form.get('count', 10))

    # Validate
    if not topic:
        return jsonify({'error': 'Topic is required'}), 400

    # Step 2: Build the prompt
    prompt = f"""Generate exactly {count} multiple choice quiz questions about "{topic}".

Return ONLY a valid JSON array. No explanation, no markdown, no backticks. Just the raw JSON array.

Format:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }}
]

Rules:
- correct is the 0-based index of the correct answer (0, 1, 2, or 3)
- Make questions interesting and varied in difficulty
- Mix easy medium and hard questions
- Exactly {count} questions
- No markdown, no explanation, just the JSON array"""

    # Step 3: Call Groq AI API
    # Like cURL in PHP but using Python's requests library
    try:
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [
                    {'role': 'user', 'content': prompt}
                ],
                'max_tokens': 3000,
                'temperature': 0.7
            }
        )

        # Step 4: Check for errors
        if response.status_code != 200:
            error_msg = response.json().get('error', {}).get('message', 'Groq API error')
            return jsonify({'error': error_msg}), 500

        # Step 5: Parse the response
        # Like json_decode in PHP
        ai_response = response.json()
        raw_text    = ai_response['choices'][0]['message']['content']

        # Remove accidental markdown fences
        clean_text = raw_text.replace('```json', '').replace('```', '').strip()

        # Parse JSON string into Python list
        questions = json.loads(clean_text)

        if not isinstance(questions, list) or len(questions) == 0:
            return jsonify({'error': 'AI returned invalid format'}), 500

        # Step 6: Send questions back to JavaScript
        return jsonify({'success': True, 'questions': questions})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── RUN THE APP ───────────────────────────────────
# This starts the Flask server
# On Render, PORT is set automatically
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
