# ================================================
# app.py — Python Flask Server for QuizBattle AI
#
# Runs on Render with gunicorn (start command: gunicorn app:app)
#
# HOW IT WORKS:
# 1. JavaScript sends topic + count to the /api endpoint
# 2. Flask calls the Groq AI API
# 3. Flask sends the questions back to JavaScript
# ================================================

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import json
import os

app = Flask(__name__, static_folder=None)
CORS(app)

# ── SETTINGS (read from Render > Environment) ─────
# GROQ_API_KEY : your key (starts with gsk_). Never hardcode it here!
# GROQ_MODEL   : optional. Lets you change the model without editing code.
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_MODEL   = os.environ.get('GROQ_MODEL', 'openai/gpt-oss-20b')

# Only these files can be downloaded from the site.
# (So nobody can open yoursite.com/app.py)
ALLOWED_FILES = {'index.html', 'style.css', 'script.js'}


# ── SERVE THE WEBSITE ─────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    if filename not in ALLOWED_FILES:
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory('.', filename)


# ── API ENDPOINT ──────────────────────────────────
@app.route('/api', methods=['POST'])
def generate_questions():

    # Step 1: Get data from JavaScript
    topic = request.form.get('topic', '').strip()

    try:
        count = int(request.form.get('count', 10))
    except ValueError:
        count = 10
    count = max(1, min(count, 30))  # keep between 1 and 30

    if not topic:
        return jsonify({'error': 'Topic is required'}), 400

    if not GROQ_API_KEY:
        return jsonify({'error': 'GROQ_API_KEY is not set on the server.'}), 500

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
- Each question has exactly 4 options
- Make questions interesting and varied in difficulty
- Mix easy, medium and hard questions
- Exactly {count} questions
- No markdown, no explanation, just the JSON array"""

    # Step 3: Call the Groq API
    try:
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': GROQ_MODEL,
                'messages': [
                    {'role': 'user', 'content': prompt}
                ],
                # Reasoning models use part of this budget for "thinking",
                # so keep it generous or the JSON gets cut off.
                'max_tokens': 6000,
                'temperature': 0.7
            },
            timeout=60
        )

        # Step 4: Check for errors from Groq
        if response.status_code != 200:
            try:
                error_msg = response.json().get('error', {}).get('message', 'Groq API error')
            except ValueError:
                error_msg = f'Groq API error ({response.status_code})'
            return jsonify({'error': error_msg}), 500

        # Step 5: Parse the response
        ai_response = response.json()
        raw_text = ai_response['choices'][0]['message'].get('content') or ''

        # Cut out just the JSON array, ignoring any text around it
        start = raw_text.find('[')
        end = raw_text.rfind(']') + 1
        if start == -1 or end == 0:
            return jsonify({'error': 'AI returned invalid format. Please try again.'}), 500

        questions = json.loads(raw_text[start:end])

        if not isinstance(questions, list) or len(questions) == 0:
            return jsonify({'error': 'AI returned invalid format. Please try again.'}), 500

        # Keep only well-formed questions
        valid = []
        for q in questions:
            if (isinstance(q, dict)
                    and 'question' in q
                    and isinstance(q.get('options'), list)
                    and len(q['options']) == 4
                    and q.get('correct') in (0, 1, 2, 3)):
                valid.append(q)

        if not valid:
            return jsonify({'error': 'AI returned invalid questions. Please try again.'}), 500

        # Step 6: Send questions back to JavaScript
        return jsonify({'success': True, 'questions': valid})

    except requests.exceptions.Timeout:
        return jsonify({'error': 'The AI took too long to respond. Please try again.'}), 500
    except json.JSONDecodeError:
        return jsonify({'error': 'AI returned broken JSON. Please try again.'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── RUN LOCALLY ───────────────────────────────────
# On Render, gunicorn runs the app and ignores this block.
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)