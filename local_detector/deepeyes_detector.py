# STEP 6: Real-time detection with MediaPipe
# Clean professional UI: EAR-driven detection + optional CNN support

RUN_REALTIME_DETECTION = True

if RUN_REALTIME_DETECTION:
    import time
    import shutil
    import subprocess
    from pathlib import Path

    import cv2
    import mediapipe as mp
    import numpy as np
    import tensorflow as tf

    MODEL_LOAD_PATH = Path("models") / "deep_eyes_cnn_v1.keras"
    ALARM_SOUND_PATH = Path("sounds") / "beep.wav"

    model_available = False

    if "model" in globals():
        model_available = True
    elif MODEL_LOAD_PATH.exists():
        try:
            model = tf.keras.models.load_model(MODEL_LOAD_PATH)
            model_available = True
            print(f"Loaded saved model from: {MODEL_LOAD_PATH.resolve()}")
        except Exception as e:
            print(f"Could not load model: {e}")

    if not model_available:
        print("CNN model not available. Running in EAR-only mode.")

    img_size = int(globals().get("IMG_SIZE", 80))
    cnn_threshold = float(globals().get("decision_threshold", 0.915))
    cnn_threshold = float(np.clip(cnn_threshold, 0.05, 0.99))

    CALIBRATION_SECONDS = 3.0
    DEFAULT_OPEN_EAR = 0.32
    DEFAULT_CLOSED_EAR = 0.21

    open_ear_baseline = DEFAULT_OPEN_EAR
    closed_ear_threshold = DEFAULT_CLOSED_EAR

    EAR_SMOOTHING_ALPHA = 0.35
    smoothed_ear = None

    sleepy_frame_streak = 0
    min_sleepy_frames = 5

    alarm_delay_seconds = 0.8
    eyes_closed_start_time = None
    closed_duration = 0.0

    total_alerts = 0
    in_alert = False
    frames_awake = 0
    min_awake_frames = 10
    active_alarm_process = None

    sleep_score_history = []
    max_graph_points = 180

    calibration_values = []
    calibration_start_time = None
    calibration_complete = False

    window_name = "DeepEyes - Drowsiness Detector"

    print("\nSTARTING REAL-TIME DETECTION...")
    print("Keep eyes OPEN during first 3 seconds for calibration.")
    print("Press 'c' while eyes are CLOSED to calibrate closed-eye threshold.")
    print("Press 'o' while eyes are OPEN to reset open-eye baseline.")
    print("Press '[' or ']' to adjust threshold.")
    print("Press 'q' to exit.\n")

    def start_alarm():
        if not ALARM_SOUND_PATH.exists():
            return None

        if shutil.which("afplay"):
            return subprocess.Popen(
                ["afplay", str(ALARM_SOUND_PATH)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

        if shutil.which("ffplay"):
            return subprocess.Popen(
                ["ffplay", "-nodisp", "-autoexit", str(ALARM_SOUND_PATH)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

        return None

    def stop_alarm(process):
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                process.kill()
        return None

    def landmark_point(landmarks, idx, img_w, img_h):
        return np.array(
            [landmarks[idx].x * img_w, landmarks[idx].y * img_h],
            dtype=np.float32
        )

    def compute_ear(landmarks, eye_points, img_w, img_h):
        p1 = landmark_point(landmarks, eye_points[0], img_w, img_h)
        p2 = landmark_point(landmarks, eye_points[1], img_w, img_h)
        p3 = landmark_point(landmarks, eye_points[2], img_w, img_h)
        p4 = landmark_point(landmarks, eye_points[3], img_w, img_h)
        p5 = landmark_point(landmarks, eye_points[4], img_w, img_h)
        p6 = landmark_point(landmarks, eye_points[5], img_w, img_h)

        vertical_1 = np.linalg.norm(p2 - p6)
        vertical_2 = np.linalg.norm(p3 - p5)
        horizontal = np.linalg.norm(p1 - p4)

        return float((vertical_1 + vertical_2) / (2.0 * horizontal + 1e-6))

    def get_eye_bbox(landmarks, indices, img_w, img_h, padding=8):
        xs = [int(landmarks[i].x * img_w) for i in indices]
        ys = [int(landmarks[i].y * img_h) for i in indices]

        x_min = max(0, min(xs) - padding)
        x_max = min(img_w, max(xs) + padding)
        y_min = max(0, min(ys) - padding)
        y_max = min(img_h, max(ys) + padding)

        return x_min, y_min, x_max - x_min, y_max - y_min

    def ear_to_sleep_score(current_ear, open_baseline, closed_threshold):
        if current_ear is None:
            return 0.0

        denominator = max(open_baseline - closed_threshold, 1e-6)
        score = (open_baseline - current_ear) / denominator
        return float(np.clip(score, 0.0, 1.0))

    def draw_panel(frame, status, sleep_score, ear_value, threshold_value, closed_duration, total_alerts, fps):
        panel_x, panel_y = frame.shape[1] - 316, 16
        panel_w, panel_h = 300, 128

        overlay = frame.copy()
        cv2.rectangle(
            overlay,
            (panel_x, panel_y),
            (panel_x + panel_w, panel_y + panel_h),
            (18, 24, 30),
            -1
        )
        cv2.addWeighted(overlay, 0.72, frame, 0.28, 0, frame)

        status_color = {
            "ALERT": (0, 0, 255),
            "SLEEPY": (0, 165, 255),
            "AWAKE": (0, 220, 80),
            "NO FACE": (170, 170, 170),
            "CALIBRATING": (0, 220, 255),
        }.get(status, (220, 220, 220))

        cv2.putText(
            frame,
            "DeepEyes",
            (panel_x + 14, panel_y + 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.72,
            (240, 245, 248),
            2
        )

        cv2.putText(
            frame,
            status,
            (panel_x + 14, panel_y + 62),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.78,
            status_color,
            2
        )

        cv2.putText(
            frame,
            f"Sleep Score: {sleep_score:.2f}",
            (panel_x + 14, panel_y + 88),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (225, 232, 236),
            1
        )

        cv2.putText(
            frame,
            f"Timer: {closed_duration:.1f}s   Alerts: {total_alerts}",
            (panel_x + 14, panel_y + 111),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.44,
            (190, 205, 215),
            1
        )

        cv2.putText(
            frame,
            f"EAR {ear_value:.3f} / {threshold_value:.3f}   FPS {fps:.1f}",
            (frame.shape[1] - 316, frame.shape[0] - 16),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.46,
            (220, 230, 235),
            1
        )

    def draw_sleep_bar(frame, sleep_score):
        h, w, _ = frame.shape

        bar_x, bar_y = frame.shape[1] - 316, 158
        bar_w, bar_h = 300, 18

        score = float(np.clip(sleep_score, 0.0, 1.0))
        fill_w = int(score * bar_w)

        if score < 0.5:
            color = (0, 220, 80)
        elif score < 0.8:
            color = (0, 200, 255)
        else:
            color = (0, 0, 255)

        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (50, 55, 60), -1)
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), color, -1)
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (150, 160, 165), 1)

    def draw_mini_graph(frame, history):
        if len(history) < 2:
            return

        h, w, _ = frame.shape

        graph_w = 220
        graph_h = 82
        margin = 16

        x0 = w - graph_w - margin
        y0 = h - graph_h - margin
        x1 = x0 + graph_w
        y1 = y0 + graph_h

        overlay = frame.copy()
        cv2.rectangle(overlay, (x0, y0), (x1, y1), (18, 24, 30), -1)
        cv2.addWeighted(overlay, 0.72, frame, 0.28, 0, frame)

        cv2.rectangle(frame, (x0, y0), (x1, y1), (120, 135, 145), 1)
        cv2.line(frame, (x0, y0 + graph_h // 2), (x1, y0 + graph_h // 2), (70, 85, 92), 1)

        cv2.putText(
            frame,
            "Sleep Trend",
            (x0 + 8, y0 + 18),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (225, 232, 236),
            1
        )

        values = np.array(history[-graph_w:], dtype=np.float32)
        values = np.clip(values, 0.0, 1.0)

        points = []
        for i, value in enumerate(values):
            x = x0 + int(i * (graph_w - 1) / max(len(values) - 1, 1))
            y = y1 - int(value * graph_h)
            y = max(y0, min(y1, y))
            points.append((x, y))

        color = (0, 0, 255) if values[-1] >= 0.5 else (0, 220, 80)
        cv2.polylines(frame, [np.array(points, dtype=np.int32)], False, color, 2)
        cv2.circle(frame, points[-1], 3, color, -1)

    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    right_eye_box = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
    left_eye_box = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]

    right_ear_points = [33, 160, 158, 133, 153, 144]
    left_ear_points = [362, 385, 387, 263, 373, 380]

    cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)

    if not cap.isOpened():
        cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        raise RuntimeError("Cannot access webcam")

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 30)

    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 1400, 850)
    cv2.waitKey(1)

    frame_count = 0
    prev_time = time.time()
    running = True

    try:
        while running:
            ret, frame = cap.read()

            if not ret or frame is None:
                break

            frame_count += 1
            img_h, img_w, _ = frame.shape

            current_time = time.time()
            fps = 1.0 / max(current_time - prev_time, 1e-6)
            prev_time = current_time

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb_frame)

            if calibration_start_time is None:
                calibration_start_time = time.time()

            face_found = False
            status = "NO FACE"

            current_ear = None
            sleep_score = 0.0

            eye_boxes = []
            cnn_eye_probs = []

            if results.multi_face_landmarks:
                face_found = True
                face_landmarks = results.multi_face_landmarks[0]

                right_ear = compute_ear(face_landmarks.landmark, right_ear_points, img_w, img_h)
                left_ear = compute_ear(face_landmarks.landmark, left_ear_points, img_w, img_h)
                current_ear = float((right_ear + left_ear) / 2.0)

                if smoothed_ear is None:
                    smoothed_ear = current_ear
                else:
                    smoothed_ear = (
                        EAR_SMOOTHING_ALPHA * current_ear
                        + (1.0 - EAR_SMOOTHING_ALPHA) * smoothed_ear
                    )

                eye_inputs = []

                for eye_indices in [left_eye_box, right_eye_box]:
                    ex, ey, ew, eh = get_eye_bbox(face_landmarks.landmark, eye_indices, img_w, img_h)

                    if ew <= 0 or eh <= 0:
                        continue

                    eye_crop = frame[ey:ey + eh, ex:ex + ew]

                    if eye_crop.size == 0:
                        continue

                    eye_boxes.append((ex, ey, ew, eh))

                    if model_available:
                        eye_input = cv2.resize(eye_crop, (img_size, img_size))
                        eye_input = cv2.cvtColor(eye_input, cv2.COLOR_BGR2RGB).astype(np.float32)
                        eye_inputs.append(eye_input)

                if eye_inputs and model_available:
                    eye_batch = np.stack(eye_inputs, axis=0).astype(np.float32)
                    cnn_eye_probs = model(
                        eye_batch,
                        training=False
                    ).numpy().reshape(-1).astype(float).tolist()

                if not calibration_complete:
                    calibration_values.append(smoothed_ear)
                    elapsed = time.time() - calibration_start_time
                    status = "CALIBRATING"

                    if elapsed >= CALIBRATION_SECONDS and len(calibration_values) >= 10:
                        open_ear_baseline = float(np.median(calibration_values))
                        closed_ear_threshold = float(open_ear_baseline * 0.72)
                        calibration_complete = True

                        print(
                            f"EAR calibration complete. "
                            f"Open EAR baseline={open_ear_baseline:.3f}, "
                            f"closed threshold={closed_ear_threshold:.3f}"
                        )

                    is_sleepy_now = False

                else:
                    sleep_score = ear_to_sleep_score(
                        current_ear=max(right_ear, left_ear),
                        open_baseline=open_ear_baseline,
                        closed_threshold=closed_ear_threshold
                        )

                    right_eye_closed = right_ear <= closed_ear_threshold
                    left_eye_closed = left_ear <= closed_ear_threshold
                    is_sleepy_now = right_eye_closed and left_eye_closed

                    if is_sleepy_now:
                        sleepy_frame_streak += 1
                        frames_awake = 0

                        if sleepy_frame_streak >= min_sleepy_frames:
                            if eyes_closed_start_time is None:
                                eyes_closed_start_time = time.time()

                            closed_duration = time.time() - eyes_closed_start_time
                            status = "SLEEPY"
                        else:
                            status = "AWAKE"

                    else:
                        sleepy_frame_streak = 0
                        eyes_closed_start_time = None
                        closed_duration = 0.0
                        frames_awake += 1
                        status = "AWAKE"

                eye_color = (0, 0, 255) if status in ["SLEEPY", "ALERT"] else (0, 220, 80)

                for ex, ey, ew, eh in eye_boxes:
                    cv2.rectangle(frame, (ex, ey), (ex + ew, ey + eh), eye_color, 1)

            else:
                smoothed_ear = None
                sleepy_frame_streak = 0
                eyes_closed_start_time = None
                closed_duration = 0.0
                sleep_score = 0.0
                frames_awake = 0
                status = "NO FACE"

            alarm_ready = (
                calibration_complete
                and eyes_closed_start_time is not None
                and closed_duration >= alarm_delay_seconds
            )

            if alarm_ready:
                status = "ALERT"

                if not in_alert:
                    total_alerts += 1
                    print(f"ALERT #{total_alerts} TRIGGERED")
                    in_alert = True

                if active_alarm_process is None or active_alarm_process.poll() is not None:
                    active_alarm_process = start_alarm()

            elif frames_awake >= min_awake_frames:
                in_alert = False
                frames_awake = 0
                active_alarm_process = stop_alarm(active_alarm_process)

            sleep_score_history.append(sleep_score)
            sleep_score_history = sleep_score_history[-max_graph_points:]

            display_ear = smoothed_ear if smoothed_ear is not None else 0.0

            draw_panel(
                frame=frame,
                status=status,
                sleep_score=sleep_score,
                ear_value=display_ear,
                threshold_value=closed_ear_threshold,
                closed_duration=closed_duration,
                total_alerts=total_alerts,
                fps=fps,
            )

            draw_sleep_bar(frame, sleep_score)
            draw_mini_graph(frame, sleep_score_history)

            if in_alert and (frame_count % 10) < 5:
                cv2.rectangle(frame, (0, 0), (img_w - 1, img_h - 1), (0, 0, 255), 12)
                cv2.putText(
                    frame,
                    "WAKE UP!",
                    (max(20, img_w // 2 - 145), img_h // 2),
                    cv2.FONT_HERSHEY_DUPLEX,
                    2.0,
                    (0, 0, 255),
                    4
                )

            cv2.imshow(window_name, frame)

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                running = False

            elif key == ord("c") and smoothed_ear is not None:
                closed_sample = float(smoothed_ear)
                closed_ear_threshold = float((open_ear_baseline + closed_sample) / 2.0)
                print(
                    f"Closed-eye calibration captured. "
                    f"Closed EAR sample={closed_sample:.3f}, "
                    f"new closed threshold={closed_ear_threshold:.3f}"
                )

            elif key == ord("o") and smoothed_ear is not None:
                open_ear_baseline = float(smoothed_ear)
                closed_ear_threshold = float(open_ear_baseline * 0.72)
                print(
                    f"Open-eye baseline reset. "
                    f"Open EAR baseline={open_ear_baseline:.3f}, "
                    f"closed threshold={closed_ear_threshold:.3f}"
                )

            elif key == ord("["):
                closed_ear_threshold = max(0.05, closed_ear_threshold - 0.005)
                print(f"Closed EAR threshold lowered to {closed_ear_threshold:.3f}")

            elif key == ord("]"):
                closed_ear_threshold = min(0.50, closed_ear_threshold + 0.005)
                print(f"Closed EAR threshold raised to {closed_ear_threshold:.3f}")

            try:
                window_visible = cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) >= 1
            except cv2.error:
                window_visible = False

            if not window_visible:
                running = False

    finally:
        active_alarm_process = stop_alarm(active_alarm_process)

        try:
            if cap is not None and cap.isOpened():
                cap.release()
        except Exception:
            pass

        try:
            face_mesh.close()
        except Exception:
            pass

        try:
            cv2.destroyWindow(window_name)
        except cv2.error:
            pass

        for _ in range(20):
            cv2.destroyAllWindows()
            cv2.waitKey(1)
            time.sleep(0.03)

        print("\nDetection stopped. Webcam, alarm, and OpenCV windows released.")

else:
    print("Real-time detection is disabled. Set RUN_REALTIME_DETECTION = True to use the webcam.")