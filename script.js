// Fogify.ai 비디오 모자이크 편집기 (API 연동 버전)
// 파일 업로드 및 AI 분석 기능

class FogifyEditor {
    constructor() {
        this.currentFile = null;
        this.supportedFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
        this.maxFileSize = 500 * 1024 * 1024; // 500MB
        this.apiBaseUrl = 'http://localhost:8000'; // 백엔드 서버 URL
        this.currentTaskId = null;
        this.websocket = null;
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // DOM 요소 참조
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.errorMessage = document.getElementById('errorMessage');
        this.uploadSection = document.getElementById('uploadSection');
        this.videoSection = document.getElementById('videoSection');
        this.videoPlayer = document.getElementById('videoPlayer');
        this.videoInfo = document.getElementById('videoInfo');
    }

    bindEvents() {
        // 파일 입력 이벤트
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // 드래그 앤 드롭 이벤트
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });

        // 업로드 영역 클릭 시 파일 선택
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });
    }

    async handleFileSelect(file) {
        console.log('파일 선택됨:', file);
        
        // 파일 검증
        if (!this.validateFile(file)) {
            return;
        }

        // 에러 메시지 숨기기
        this.hideError();
        
        // 파일 처리 시작
        this.currentFile = file;
        await this.uploadFileToServer(file);
    }

    validateFile(file) {
        // 파일 존재 확인
        if (!file) {
            this.showError('파일이 선택되지 않았습니다.');
            return false;
        }

        // 파일 크기 확인
        if (file.size > this.maxFileSize) {
            this.showError(`파일 크기가 너무 큽니다. 최대 ${this.maxFileSize / (1024 * 1024)}MB까지 지원됩니다.`);
            return false;
        }

        // 파일 형식 확인
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!this.supportedFormats.includes(fileExtension)) {
            this.showError(`지원되지 않는 파일 형식입니다. 지원 형식: ${this.supportedFormats.join(', ').toUpperCase()}`);
            return false;
        }

        // MIME 타입 확인
        if (!file.type.startsWith('video/')) {
            this.showError('비디오 파일만 업로드할 수 있습니다.');
            return false;
        }

        return true;
    }

    async uploadFileToServer(file) {
        console.log('서버로 파일 업로드 시작:', file.name);
        
        // 진행률 표시 시작
        this.showProgress();
        this.updateProgress(0, '파일 업로드 중...');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            // 파일 업로드 API 호출
            const response = await fetch(`${this.apiBaseUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '파일 업로드에 실패했습니다.');
            }
            
            const result = await response.json();
            this.currentTaskId = result.task_id;
            
            console.log('파일 업로드 완료:', result);
            
            // 비디오 정보 표시
            this.showVideoInfo(result);
            
            // 업로드 완료 후 분석 시작
            this.updateProgress(100, '업로드 완료! AI 분석을 시작합니다...');
            setTimeout(() => {
                this.hideProgress();
                this.showVideoPlayer(file, result.metadata);
            }, 1000);
            
        } catch (error) {
            console.error('업로드 오류:', error);
            this.showError(error.message);
            this.hideProgress();
        }
    }

    showVideoInfo(uploadResult) {
        const metadata = uploadResult.metadata;
        
        this.videoInfo.innerHTML = `
            <h3>비디오 정보</h3>
            <div class="info-grid">
                <div class="info-item">
                    <strong>파일명:</strong> ${uploadResult.filename}
                </div>
                <div class="info-item">
                    <strong>길이:</strong> ${this.formatDuration(metadata.duration)}
                </div>
                <div class="info-item">
                    <strong>해상도:</strong> ${metadata.width} × ${metadata.height}
                </div>
                <div class="info-item">
                    <strong>프레임 수:</strong> ${metadata.frame_count.toLocaleString()}
                </div>
                <div class="info-item">
                    <strong>FPS:</strong> ${metadata.fps.toFixed(2)}
                </div>
                <div class="info-item">
                    <strong>파일 크기:</strong> ${this.formatFileSize(metadata.file_size)}
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="fogifyEditor.startAnalysis()">
                    AI 얼굴 분석 시작
                </button>
                <button class="btn btn-secondary" onclick="fogifyEditor.resetUpload()">
                    다른 파일 선택
                </button>
            </div>
        `;
    }

    showVideoPlayer(file, metadata) {
        // 파일 URL 생성
        const fileURL = URL.createObjectURL(file);
        
        // 비디오 플레이어 설정
        this.videoPlayer.src = fileURL;
        
        // 업로드 섹션 숨기고 비디오 섹션 표시
        this.uploadSection.style.display = 'none';
        this.videoSection.style.display = 'block';
        
        console.log('비디오 플레이어 표시됨');
    }

    async startAnalysis() {
        if (!this.currentTaskId) {
            this.showError('분석할 작업이 없습니다. 먼저 파일을 업로드하세요.');
            return;
        }

        console.log('AI 분석 시작:', this.currentTaskId);
        
        try {
            // WebSocket 연결 시작
            this.connectWebSocket();
            
            // 분석 시작 API 호출
            const response = await fetch(`${this.apiBaseUrl}/analyze/${this.currentTaskId}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '분석 시작에 실패했습니다.');
            }
            
            const result = await response.json();
            console.log('분석 시작됨:', result);
            
            // 진행률 표시
            this.showProgress();
            this.updateProgress(0, 'AI 얼굴 분석을 시작합니다...');
            
        } catch (error) {
            console.error('분석 시작 오류:', error);
            this.showError(error.message);
        }
    }

    connectWebSocket() {
        const wsUrl = `ws://localhost:8000/ws/${this.currentTaskId}`;
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            console.log('WebSocket 연결됨');
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('WebSocket 메시지:', data);
            
            switch (data.type) {
                case 'progress':
                    this.updateProgress(data.progress, data.message);
                    break;
                case 'complete':
                    this.onAnalysisComplete(data.result);
                    break;
                case 'error':
                    this.showError(data.message);
                    this.hideProgress();
                    break;
            }
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket 오류:', error);
            this.showError('실시간 연결에 문제가 발생했습니다.');
        };
        
        this.websocket.onclose = () => {
            console.log('WebSocket 연결 해제됨');
        };
    }

    onAnalysisComplete(result) {
        console.log('분석 완료:', result);
        
        this.hideProgress();
        
        // 분석 결과 표시
        const detectionInfo = document.createElement('div');
        detectionInfo.className = 'analysis-result';
        detectionInfo.innerHTML = `
            <h4>🎯 AI 분석 결과</h4>
            <div class="result-stats">
                <div class="stat-item">
                    <strong>감지된 얼굴:</strong> ${result.detection_count}개 구간
                </div>
                <div class="stat-item">
                    <strong>총 프레임:</strong> ${result.total_frames.toLocaleString()}개
                </div>
                <div class="stat-item">
                    <strong>처리 시간:</strong> 완료
                </div>
            </div>
            <div class="next-steps">
                <button class="btn btn-success" onclick="fogifyEditor.showEditInterface()">
                    모자이크 편집하기
                </button>
            </div>
        `;
        
        this.videoInfo.appendChild(detectionInfo);
        
        // WebSocket 연결 해제
        if (this.websocket) {
            this.websocket.close();
        }
    }

    showEditInterface() {
        alert('모자이크 편집 인터페이스는 다음 단계에서 구현됩니다!\n\n현재까지 완성된 기능:\n✅ 파일 업로드\n✅ AI 얼굴 감지\n\n다음 단계:\n🔲 모자이크 편집 인터페이스\n🔲 타임라인 네비게이션\n🔲 실시간 미리보기');
    }

    resetUpload() {
        // 비디오 리소스 정리
        if (this.videoPlayer.src) {
            URL.revokeObjectURL(this.videoPlayer.src);
            this.videoPlayer.src = '';
        }
        
        // WebSocket 연결 해제
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        // 상태 초기화
        this.currentFile = null;
        this.currentTaskId = null;
        this.fileInput.value = '';
        
        // UI 초기화
        this.hideError();
        this.hideProgress();
        this.uploadSection.style.display = 'block';
        this.videoSection.style.display = 'none';
        
        console.log('업로드 초기화됨');
    }

    showProgress() {
        this.uploadProgress.style.display = 'block';
    }

    hideProgress() {
        this.uploadProgress.style.display = 'none';
    }

    updateProgress(percent, message = '') {
        const rounded = Math.round(percent);
        this.progressFill.style.width = `${rounded}%`;
        this.progressText.textContent = message || `${rounded}%`;
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        console.error('에러:', message);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    // 유틸리티 함수들
    formatDuration(seconds) {
        if (isNaN(seconds)) return '알 수 없음';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// CSS 스타일 추가 (분석 결과용)
const analysisStyles = `
<style>
.analysis-result {
    margin-top: 1.5rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.05));
    border: 1px solid var(--success-color);
    border-radius: var(--radius);
}

.analysis-result h4 {
    color: var(--success-color);
    margin-bottom: 1rem;
    font-size: 1.125rem;
}

.result-stats {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(16, 185, 129, 0.2);
}

.stat-item:last-child {
    border-bottom: none;
}

.next-steps {
    text-align: center;
}

.btn-success {
    background: var(--success-color);
    color: white;
}

.btn-success:hover {
    background: #059669;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.server-status {
    position: fixed;
    top: 1rem;
    right: 1rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
    z-index: 1000;
}

.server-online {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
    border: 1px solid rgba(16, 185, 129, 0.3);
}

.server-offline {
    background: rgba(239, 68, 68, 0.1);
    color: var(--error-color);
    border: 1px solid rgba(239, 68, 68, 0.3);
}
</style>
`;

// 스타일 추가
document.head.insertAdjacentHTML('beforeend', analysisStyles);

// 서버 상태 확인
async function checkServerStatus() {
    try {
        const response = await fetch('http://localhost:8000/');
        if (response.ok) {
            const data = await response.json();
            showServerStatus('online', `서버 온라인 ${data.model_loaded ? '(모델 로드됨)' : '(모델 로딩 중)'}`);
        } else {
            showServerStatus('offline', '서버 오프라인');
        }
    } catch (error) {
        showServerStatus('offline', '서버 연결 실패');
    }
}

function showServerStatus(status, message) {
    let statusEl = document.getElementById('serverStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'serverStatus';
        statusEl.className = 'server-status';
        document.body.appendChild(statusEl);
    }
    
    statusEl.className = `server-status server-${status}`;
    statusEl.textContent = message;
}

// 애플리케이션 초기화
const fogifyEditor = new FogifyEditor();

// 전역 함수로 노출 (HTML에서 호출용)
window.fogifyEditor = fogifyEditor;

// 서버 상태 확인 (5초마다)
checkServerStatus();
setInterval(checkServerStatus, 5000);

console.log('Fogify.ai 편집기 (API 연동 버전) 초기화 완료');