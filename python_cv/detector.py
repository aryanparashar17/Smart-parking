#!/usr/bin/env python3
"""
Hybrid IoT & Vision-Based Smart Parking Detection
Python + OpenCV + Ultralytics YOLOv8 Vehicle Detection Worker

Detects cars (class 2), motorcycles (class 3), buses (class 5), and trucks (class 7)
from either a local image path (--image) or an RTSP/HTTP camera stream (--rtsp).
Outputs structured JSON to stdout for the Node/Express API layer.
"""

import argparse
import json
import sys
import time
from pathlib import Path

try:
    import cv2
    from ultralytics import YOLO
except ImportError as exc:
    print(
        json.dumps(
            {
                "error": "PYTHON_CV_DEPENDENCY_MISSING",
                "message": f"Required Python CV library missing: {exc}. Run: pip install -r python_cv/requirements.txt",
            }
        )
    )
    sys.exit(2)

# Standard COCO vehicle class IDs
VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}


def load_frame(image_path: str | None, rtsp_url: str | None):
    if image_path:
        frame = cv2.imread(image_path)
        if frame is None:
            raise RuntimeError(f"OpenCV failed to decode image at path: {image_path}")
        return frame

    if rtsp_url:
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            raise RuntimeError("Unable to open camera stream via OpenCV VideoCapture.")
        try:
            ok, frame = cap.read()
            if not ok or frame is None:
                raise RuntimeError("Camera stream opened but no video frame could be decoded.")
            return frame
        finally:
            cap.release()

    raise ValueError("Either --image or --rtsp must be provided.")


def main():
    parser = argparse.ArgumentParser(description="YOLOv8 + OpenCV Parking Vehicle Detector")
    parser.add_argument("--image", type=str, default=None, help="Path to input image file")
    parser.add_argument("--rtsp", type=str, default=None, help="RTSP or stream URL")
    parser.add_argument(
        "--model",
        type=str,
        default=str(Path(__file__).resolve().parent.parent / "models" / "yolov8n.pt"),
        help="Path to Ultralytics YOLOv8 model weights (.pt or .onnx)",
    )
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    args = parser.parse_args()

    started = time.perf_counter()

    try:
        frame = load_frame(args.image, args.rtsp)
        height, width = frame.shape[:2]

        model_path = args.model
        if not Path(model_path).exists():
            # Ultralytics will load standard yolov8n.pt if cached locally or downloadable
            onnx_alt = Path(__file__).resolve().parent.parent / "models" / "yolov8n.onnx"
            model_path = str(onnx_alt) if onnx_alt.exists() else "yolov8n.pt"

        model = YOLO(model_path)
        results = model.predict(
            source=frame,
            conf=args.conf,
            classes=list(VEHICLE_CLASSES.keys()),
            verbose=False,
        )

        vehicles = []
        if results and len(results) > 0:
            boxes = results[0].boxes
            if boxes is not None:
                for idx, box in enumerate(boxes):
                    cls_id = int(box.cls[0].item())
                    if cls_id not in VEHICLE_CLASSES:
                        continue
                    conf = float(box.conf[0].item())
                    x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]

                    nx1 = max(0.0, min(1.0, x1 / width))
                    ny1 = max(0.0, min(1.0, y1 / height))
                    nx2 = max(0.0, min(1.0, x2 / width))
                    ny2 = max(0.0, min(1.0, y2 / height))

                    vehicles.append(
                        {
                            "id": f"veh-{idx + 1}",
                            "label": VEHICLE_CLASSES[cls_id],
                            "confidence": round(conf, 4),
                            "bbox": {
                                "x1": round(nx1, 4),
                                "y1": round(ny1, 4),
                                "x2": round(nx2, 4),
                                "y2": round(ny2, 4),
                            },
                            "center": {
                                "x": round((nx1 + nx2) / 2.0, 4),
                                "y": round((ny1 + ny2) / 2.0, 4),
                            },
                        }
                    )

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        print(
            json.dumps(
                {
                    "engine": "python-ultralytics-yolo",
                    "imageWidth": int(width),
                    "imageHeight": int(height),
                    "inferenceMs": elapsed_ms,
                    "vehicles": vehicles,
                }
            )
        )
    except Exception as exc:
        print(
            json.dumps(
                {
                    "error": "PYTHON_CV_EXECUTION_FAILED",
                    "message": str(exc),
                }
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
