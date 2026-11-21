# Hybrid Parking AI

**Hybrid IoT and Vision-Based System for Real-Time Empty Parking Slot Detection**

Hybrid Parking AI is a prototype smart-parking dashboard designed to demonstrate how IoT sensor telemetry and computer-vision-based vehicle detection can work together to monitor parking-space occupancy.

The website presents a parking facility testbed, individual parking bays, sensor and camera information, and an arbitration concept for handling cases where sensor and vision readings disagree.

> **Project status:** College project prototype / interactive testbed. The screen recording shows simulated vehicle and camera events. Do not assume that physical ESP32 devices, real CCTV streams, or production-grade YOLO inference are connected unless they have been separately configured and tested.

## Contents

- [Project Overview](#project-overview)
- [Main Features](#main-features)
- [Dashboard Layout](#dashboard-layout)
- [How the Prototype Works](#how-the-prototype-works)
- [Technology and Architecture](#technology-and-architecture)
- [Getting Started](#getting-started)
- [How to Use the Dashboard](#how-to-use-the-dashboard)
- [Current Scope and Limitations](#current-scope-and-limitations)
- [Future Enhancements](#future-enhancements)
- [Project Information](#project-information)

## Project Overview

Finding an empty parking space can take time, especially in busy campuses and commercial parking areas. This project explores a hybrid approach in which:

1. **IoT sensors** provide distance or presence readings for individual parking bays.
2. **Computer vision** can analyze camera footage to identify vehicles and estimate whether parking spaces are occupied.
3. **An arbitration layer** compares the available inputs and represents the resulting parking status.

The prototype demonstrates this concept through an interactive parking dashboard for **Medicaps Campus – Bay Level 1, Entry Gate A**.

## Main Features

- **Live Parking Dashboard:** A grid of 12 parking bays across Zones A, B and C.
- **Slot Status Indicators:** Visual states for Available, Occupied and Discrepancy/uncertain conditions.
- **Slot Telemetry Inspector:** Select a bay to inspect its displayed information.
- **ESP32 Sensor Telemetry Panel:** Demonstrates distance, threshold, battery and sensor status information.
- **CCTV / OpenCV + YOLO Panel:** Displays the computer-vision detection concept, including vehicle bounding-box and confidence information.
- **Arbitration Rationale:** Shows an example of how sensor and vision evidence can be considered together.
- **Interactive Test Controls:** Simulate vehicle entry/exit and camera blindspot or glare conditions.
- **Architecture and Workflow Sections:** Explain the proposed system components and how information moves through the system.
- **Parking Simulator:** Provides an interactive environment for demonstrating occupancy-state changes.

## Dashboard Layout

The testbed shown in the prototype contains these parking bays:

| Zone A | Zone B | Zone C |
|---|---|---|
| A-01 | B-01 | C-01 |
| A-02 | B-02 | C-02 |
| A-03 | B-03 | C-03 |
| A-04 | B-04 | C-04 |

The dashboard uses visual indicators to distinguish parking states. Select a slot to view its telemetry and detection details in the inspector panel.

## How the Prototype Works

The intended hybrid workflow is:

1. A vehicle enters or leaves a parking bay.
2. The IoT sensor measures the distance to an object and compares it with a configured threshold.
3. The camera/computer-vision component can identify a vehicle in the corresponding parking-space region.
4. The arbitration layer considers the available sensor and vision evidence.
5. The parking bay is represented as available, occupied, or uncertain/discrepant on the dashboard.

**Example:** If the sensor reports that a bay is occupied and the vision system also detects a vehicle with sufficient confidence, the system can show an occupied state with supporting evidence. If the inputs disagree or camera visibility is poor, the bay should be flagged for review rather than silently treated as confirmed.

## Technology and Architecture

The project concept is based on the following components:

| Component | Intended role |
|---|---|
| Web dashboard | Displays parking bays, telemetry, detection information and statistics |
| ESP32 / IoT sensor | Provides parking-space distance or presence readings |
| Camera / CCTV | Supplies images or video frames of the parking area |
| OpenCV | Supports image and video processing |
| YOLO | Supports vehicle detection in camera frames |
| Arbitration logic | Combines sensor and vision evidence to determine a parking state |

The exact frontend framework, backend framework, database and dependency versions should be documented from the source code repository. They are not identifiable from the website screen recording alone.

## Getting Started

### Prerequisites

- A computer with a modern web browser.
- The project source code.
- The runtime and dependencies required by the project's actual frontend/backend stack.

### Run locally

1. Clone or download the project repository.
2. Open the project folder in your code editor.
3. Check the project files for its package manager and run scripts (for example, `package.json`, `requirements.txt`, or equivalent).
4. Install the dependencies listed by the project.
5. Start the frontend and backend using the commands defined in the repository.
6. Open the local development URL shown in the terminal.

> **Note:** Exact installation and run commands are intentionally not guessed here because the source-code repository and its dependency files were not provided with the screen recording. Add the verified commands for your project before publishing this README.

## How to Use the Dashboard

1. Open the website and navigate to **Live Dashboard**.
2. Review the parking-bay grid and the status legend.
3. Select any parking bay to open its telemetry inspector.
4. Review the displayed ESP32 sensor telemetry and CCTV / OpenCV + YOLO information.
5. Use the interactive test controls to simulate vehicle or camera events.
6. Observe how the selected bay's displayed state and arbitration information respond.
7. Use **Reset Testbed** to restore the demonstration to its initial state, if available.

## Current Scope and Limitations

This repository is intended to demonstrate a working prototype and the proposed system workflow.

- Values shown during simulator actions may be demonstration data rather than readings from physical devices.
- Actual ESP32 communication requires compatible hardware, firmware, network configuration and a backend connection.
- Actual CCTV analysis requires a supported camera source and a configured video-processing service.
- Real parking-space-level detection requires parking-space calibration and a tested detection pipeline.
- Do not use simulated occupancy values as real-world parking availability.

## Future Enhancements

- Upload a parking-lot image and analyze individual parking spaces.
- Connect a live webcam for continuous frame analysis.
- Add support for external CCTV / RTSP streams through a backend streaming service.
- Calibrate parking-space polygons and map them to existing bay IDs.
- Synchronize verified camera detections with IoT sensor readings.
- Add detection history, timestamps and parking alerts.
- Add occupancy analytics and trends over time.
- Add user authentication and role-based admin controls.
- Test the system with real parking-lot footage and physical IoT devices.

## Project Information

**Project Title:** Hybrid IoT and Vision-Based System for Real-Time Empty Parking Slot Detection  
**Project Type:** Academic project / working prototype  
**Demonstration Location:** Medicaps Campus – Bay Level 1, Entry Gate A

---

*Update this README whenever the implementation changes. In particular, document the verified technology stack, environment variables, setup commands, API endpoints and hardware wiring once those details are available.*
