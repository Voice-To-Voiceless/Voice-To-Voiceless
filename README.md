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
`unknown` prediction. For word-level ASL, WLASL provides an academic dataset
and pretrained I3D checkpoints:

* WLASL repository: https://github.com/dxli94/WLASL
* WLASL pretrained I3D weights: https://drive.google.com/file/d/1jALimVOB69ifYkeT0Pe297S1z4U3jC48/view

The adapter also supports the ASL2000 checkpoint mirrored in the public
`rakeshutekar/Sign-Language-to-Speech-Translation-Real-time-` repository. The
application detects `models/wlasl/asl2000.pt` and
`models/wlasl/wlasl_class_list.txt` automatically when those files exist.
Review the WLASL C-UDA terms before using its data or weights in a production
or commercial deployment.

To enable the WLASL adapter after downloading the checkpoint, clone the
official repository and set these PowerShell variables from the repository
root:

	git clone --depth 1 https://github.com/dxli94/WLASL.git .tmp-wlasl
	$env:WLASL_CHECKPOINT = "models/wlasl/asl2000_model.pt"
	$env:WLASL_LABELS = ".tmp-wlasl/code/I3D/preprocess/wlasl_class_list.txt"
	$env:WLASL_SOURCE_PATH = ".tmp-wlasl/code/I3D"
	py -m uvicorn app.backend.main:app --reload

An alternative checkpoint can be downloaded from the public GitHub mirror:

	Invoke-WebRequest -Uri "https://raw.githubusercontent.com/rakeshutekar/Sign-Language-to-Speech-Translation-Real-time-/main/weights/asl2000/FINAL_nslt_2000_iters=5104_top1=32.48_top5=57.31_top10=66.31.pt" -OutFile "models/wlasl/asl2000.pt"
	Invoke-WebRequest -Uri "https://raw.githubusercontent.com/rakeshutekar/Sign-Language-to-Speech-Translation-Real-time-/main/wlasl_class_list.txt" -OutFile "models/wlasl/wlasl_class_list.txt"

After these files are present, the API auto-loads the real WLASL model without
environment variables.

Install the optional ML dependencies separately:

	uv pip install --python .venv\Scripts\python.exe -r requirements-ml.txt

If the three WLASL variables are missing, the API intentionally uses the
safe `unknown` fallback instead of starting with an incorrectly configured
model.

Custom webcam vocabulary
------------------------

For reliable recognition in the target camera conditions, record a small
vocabulary instead of fine-tuning all 2,000 WLASL classes. The recorder uses
30 clips per label and creates a validation split automatically:

	.\.venv\Scripts\python.exe tools\record_custom_asl.py --labels "hello,thank you,help,yes,no,please,sorry,goodbye"

Press Enter before each clip and perform the complete sign for three seconds.
After recording, train the custom head:

	.\.venv\Scripts\python.exe tools\train_wlasl_subset.py --data data\custom_asl --output models\wlasl\custom_asl.pt --epochs 12

Then start the API with the custom checkpoint and its generated labels:

	$env:WLASL_CHECKPOINT = "models/wlasl/custom_asl.pt"
	$env:WLASL_LABELS = "models/wlasl/custom_asl.labels.txt"
	$env:WLASL_CLASS_COUNT = "8"
	.\.venv\Scripts\python.exe -m uvicorn app.backend.main:app --host 127.0.0.1 --port 8000