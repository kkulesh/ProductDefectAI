# video_routes.py
#
# This module is intentionally a stub.
#
# The frontend handles video entirely in the browser:
#   - DetectionMonitoring.tsx uses navigator.mediaDevices.getUserMedia()
#     to access the camera as a MediaStream.
#   - Each second it draws the current frame onto an HTML <canvas>,
#     converts it to base64 JPEG, and POSTs it to /api/v1/detection/detect-base64.
#   - Dashboard.tsx does the same for uploaded video files via <video> + <canvas>.
#
# A server-side video streaming or processing endpoint would duplicate
# this work and add unnecessary latency.  If you later need server-side
# video processing (e.g. batch analysis of recorded footage), implement it
# as a background task using a Celery worker, not as a synchronous HTTP route.
