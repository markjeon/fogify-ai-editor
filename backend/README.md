# Fogify.ai 서버 실행 가이드

## 1. 환경 설정

### Python 가상환경 생성
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 의존성 설치
```bash
pip install -r requirements.txt
```

## 2. 서버 실행

### 개발 서버 실행
```bash
python main.py
```

또는

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 프로덕션 서버 실행
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 3. API 테스트

서버가 실행되면 다음 URL에서 API 문서를 확인할 수 있습니다:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 4. 주요 엔드포인트

### 서버 상태 확인
```
GET /
```

### 파일 업로드
```
POST /upload
Content-Type: multipart/form-data
Body: file (video file)
```

### 분석 시작
```
POST /analyze/{task_id}
```

### 작업 상태 확인
```
GET /status/{task_id}
```

### WebSocket 연결 (실시간 진행률)
```
WS /ws/{task_id}
```

## 5. 주의사항

1. **YOLO 모델 다운로드**: 첫 실행 시 YOLO 모델이 자동으로 다운로드됩니다
2. **메모리 사용량**: 대용량 비디오 처리 시 충분한 RAM이 필요합니다
3. **GPU 지원**: CUDA가 설치된 환경에서 더 빠른 처리가 가능합니다
4. **포트 설정**: 기본 포트 8000을 사용합니다 (변경 가능)

## 6. 개발 환경 설정

### VS Code 설정 (권장)
```json
{
    "python.defaultInterpreterPath": "./venv/bin/python",
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true
}
```

### 환경 변수 설정
```bash
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

## 7. 트러블슈팅

### 포트 충돌
```bash
# 다른 포트 사용
uvicorn main:app --port 8001
```

### CUDA 메모리 부족
```python
# main.py에서 배치 크기 조정
results = self.model(frame, batch_size=1)
```

### 모델 로드 실패
```bash
# 모델 재다운로드
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```