V2VL project
===========

Project source is organized under app/.

Communication barrier API
-------------------------

The backend accepts image frames from an English sign-language client and
returns the model prediction together with its English translation.

Install dependencies and start the API from the repository root:

		py -m pip install -r requirements.txt
		py -m uvicorn app.backend.main:app --reload

Endpoints:

* `GET /health` checks that the API is running.
* `POST /api/v1/sign-language/interpret` accepts an `image` multipart file
	and returns `prediction` and `english`.
* `WS /api/v1/translation/live` accepts binary image frames. It buffers 64
	frames, then sends one ASL word prediction and English translation. Before
	that, it reports the buffer status.
* `POST /api/v1/notifications` accepts a shared notification payload with
	`source`, `type`, `severity`, `message`, and `patient_metadata`.
* `POST /api/v1/nurse/alerts` sends an alert from a nurse to a patient. The
	payload contains `message`, `severity`, `patient_metadata`, and
	`nurse_metadata`.
* `GET /api/v1/notifications` returns notifications; use `recipient=patient`
	or `recipient=nurse` to filter the target.
* `POST /api/v1/notifications/{id}/read` marks one notification as read.

The browser patient screen sends eye-tracking selections and face-recognition
risk transitions to the notification API. The `Nurse desk` button opens the
live notification page, which polls the API and displays patient metadata.
Notifications are currently stored in memory and are cleared when the API
restarts; replace `NotificationService` storage when persistence is needed.

The default model is `UnconfiguredSignLanguageModel`, which safely returns an
`unknown` prediction until another model implementation is injected.

Custom webcam vocabulary
------------------------

For reliable recognition in the target camera conditions, record a small
vocabulary. The recorder uses 30 clips per label and creates a validation
split automatically:

	.\.venv\Scripts\python.exe tools\record_custom_asl.py --labels "hello,thank you,help,yes,no,please,sorry,goodbye"

Press Enter before each clip and perform the complete sign for three seconds.