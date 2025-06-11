"""
Fogify.ai Backend Server
AI 기반 비디오 얼굴 감지 및 모자이크 처리 서버

Requirements:
- FastAPI
- OpenCV
- Ultralytics YOLO
- Python-multipart
- Uvicorn
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from ultralytics import YOLO
import os
import tempfile
import uuid
import json
import asyncio
from typing import List, Dict
import logging
from pathlib import Path

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Fogify.ai API", description="AI 기반 비디오 모자이크 편집 API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 변수
model = None
active_connections: Dict[str, WebSocket] = {}
processing_tasks: Dict[str, Dict] = {}

class VideoProcessor:
    def __init__(self):
        self.model = None
        self.load_model()
    
    def load_model(self):
        """YOLO 모델 로드"""
        try:
            # YOLOv8 얼굴 감지 모델 로드 (또는 사용자 정의 모델)
            self.model = YOLO('yolov8n.pt')  # 경량 모델, 나중에 얼굴 전용 모델로 교체
            logger.info("YOLO 모델 로드 완료")
        except Exception as e:
            logger.error(f"모델 로드 실패: {e}")
            self.model = None
    
    async def analyze_video(self, video_path: str, task_id: str):
        """비디오 분석 및 얼굴 감지"""
        try:
            if not self.model:
                raise Exception("YOLO 모델이 로드되지 않았습니다")
            
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            detections = []
            frame_number = 0
            
            # 진행률 업데이트를 위한 WebSocket 연결 확인
            websocket = active_connections.get(task_id)
            
            logger.info(f"비디오 분석 시작: {total_frames} 프레임")
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # YOLO 추론 실행
                results = self.model(frame, classes=[0])  # class 0 = person
                
                frame_detections = []
                for result in results:
                    boxes = result.boxes
                    if boxes is not None:
                        for box in boxes:
                            # 바운딩 박스 좌표
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            confidence = box.conf[0].item()
                            
                            # 신뢰도 임계값
                            if confidence > 0.5:
                                frame_detections.append({
                                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                                    'confidence': confidence,
                                    'frame': frame_number
                                })
                
                if frame_detections:
                    detections.append({
                        'frame': frame_number,
                        'timestamp': frame_number / fps,
                        'detections': frame_detections
                    })
                
                frame_number += 1
                
                # 진행률 업데이트 (10프레임마다)
                if frame_number % 10 == 0 and websocket:
                    progress = (frame_number / total_frames) * 100
                    await self.send_progress_update(websocket, task_id, progress, frame_number, total_frames)
            
            cap.release()
            
            # 최종 결과
            result = {
                'task_id': task_id,
                'total_frames': total_frames,
                'fps': fps,
                'detections': detections,
                'detection_count': len(detections)
            }
            
            # 완료 메시지 전송
            if websocket:
                await self.send_completion_message(websocket, task_id, result)
            
            return result
            
        except Exception as e:
            logger.error(f"비디오 분석 오류: {e}")
            if websocket:
                await self.send_error_message(websocket, task_id, str(e))
            raise
    
    async def send_progress_update(self, websocket: WebSocket, task_id: str, progress: float, current_frame: int, total_frames: int):
        """진행률 업데이트 전송"""
        try:
            message = {
                'type': 'progress',
                'task_id': task_id,
                'progress': round(progress, 2),
                'current_frame': current_frame,
                'total_frames': total_frames,
                'message': f'프레임 {current_frame}/{total_frames} 분석 중... ({progress:.1f}%)'
            }
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"진행률 업데이트 전송 오류: {e}")
    
    async def send_completion_message(self, websocket: WebSocket, task_id: str, result: Dict):
        """완료 메시지 전송"""
        try:
            message = {
                'type': 'complete',
                'task_id': task_id,
                'result': result,
                'message': f'분석 완료! {result["detection_count"]}개 구간에서 얼굴을 감지했습니다.'
            }
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"완료 메시지 전송 오류: {e}")
    
    async def send_error_message(self, websocket: WebSocket, task_id: str, error: str):
        """에러 메시지 전송"""
        try:
            message = {
                'type': 'error',
                'task_id': task_id,
                'error': error,
                'message': f'분석 중 오류가 발생했습니다: {error}'
            }
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"에러 메시지 전송 오류: {e}")

# 비디오 프로세서 인스턴스
video_processor = VideoProcessor()

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 실행"""
    logger.info("Fogify.ai 서버 시작")
    
    # 업로드 디렉토리 생성
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("results", exist_ok=True)

@app.get("/")
async def root():
    """서버 상태 확인"""
    return {"message": "Fogify.ai API 서버가 실행 중입니다", "model_loaded": video_processor.model is not None}

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """비디오 파일 업로드"""
    try:
        # 파일 형식 검증
        allowed_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"지원되지 않는 파일 형식입니다. 지원 형식: {', '.join(allowed_extensions)}")
        
        # 파일 크기 검증 (500MB)
        max_size = 500 * 1024 * 1024
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if file_size > max_size:
            raise HTTPException(status_code=400, detail=f"파일 크기가 너무 큽니다. 최대 {max_size // (1024*1024)}MB까지 지원됩니다.")
        
        # 고유 작업 ID 생성
        task_id = str(uuid.uuid4())
        
        # 임시 파일로 저장
        temp_path = f"uploads/{task_id}{file_extension}"
        with open(temp_path, "wb") as buffer:
            buffer.write(content)
        
        # 비디오 메타데이터 추출
        cap = cv2.VideoCapture(temp_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        
        # 작업 정보 저장
        processing_tasks[task_id] = {
            'filename': file.filename,
            'path': temp_path,
            'status': 'uploaded',
            'metadata': {
                'fps': fps,
                'frame_count': frame_count,
                'width': width,
                'height': height,
                'duration': duration,
                'file_size': file_size
            }
        }
        
        logger.info(f"파일 업로드 완료: {file.filename} (Task ID: {task_id})")
        
        return {
            'task_id': task_id,
            'filename': file.filename,
            'metadata': processing_tasks[task_id]['metadata'],
            'message': '파일 업로드가 완료되었습니다. 분석을 시작하려면 /analyze 엔드포인트를 호출하세요.'
        }
        
    except Exception as e:
        logger.error(f"파일 업로드 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/{task_id}")
async def start_analysis(task_id: str):
    """비디오 분석 시작"""
    try:
        if task_id not in processing_tasks:
            raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
        
        task = processing_tasks[task_id]
        if task['status'] != 'uploaded':
            raise HTTPException(status_code=400, detail="이미 처리 중이거나 완료된 작업입니다")
        
        # 분석 상태로 변경
        processing_tasks[task_id]['status'] = 'analyzing'
        
        # 백그라운드에서 분석 시작
        asyncio.create_task(video_processor.analyze_video(task['path'], task_id))
        
        return {
            'task_id': task_id,
            'status': 'analyzing',
            'message': '비디오 분석이 시작되었습니다. WebSocket으로 진행률을 확인하세요.'
        }
        
    except Exception as e:
        logger.error(f"분석 시작 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    """WebSocket 연결 (실시간 진행률 업데이트)"""
    await websocket.accept()
    active_connections[task_id] = websocket
    
    try:
        logger.info(f"WebSocket 연결: {task_id}")
        
        while True:
            # 연결 유지를 위한 ping
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket 연결 해제: {task_id}")
        if task_id in active_connections:
            del active_connections[task_id]

@app.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """작업 상태 확인"""
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    
    return processing_tasks[task_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)