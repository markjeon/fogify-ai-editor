// Fogify.ai 비디오 모자이크 편집기
// 파일 업로드 및 기본 기능

class FogifyEditor {
    constructor() {
        this.currentFile = null;
        this.supportedFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
        this.maxFileSize = 500 * 1024 * 1024; // 500MB
        
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

    handleFileSelect(file) {
        console.log('파일 선택됨:', file);
        
        // 파일 검증
        if (!this.validateFile(file)) {
            return;
        }

        // 에러 메시지 숨기기
        this.hideError();
        
        // 파일 처리 시작
        this.currentFile = file;
        this.processFile(file);
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

    processFile(file) {
        console.log('파일 처리 시작:', file.name);
        
        // 진행률 표시 시작
        this.showProgress();
        
        // 파일 읽기 시뮬레이션 (실제로는 여기서 비디오 메타데이터를 추출)
        this.simulateFileProcessing(file);
    }

    simulateFileProcessing(file) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                this.onFileProcessed(file);
            }
            this.updateProgress(progress);
        }, 200);
    }

    onFileProcessed(file) {
        console.log('파일 처리 완료:', file.name);
        
        // 진행률 숨기기
        setTimeout(() => {
            this.hideProgress();
            this.showVideoPlayer(file);
        }, 500);
    }

    showVideoPlayer(file) {
        // 파일 URL 생성
        const fileURL = URL.createObjectURL(file);
        
        // 비디오 플레이어 설정
        this.videoPlayer.src = fileURL;
        
        // 비디오 메타데이터 로드 이벤트
        this.videoPlayer.addEventListener('loadedmetadata', () => {
            this.displayVideoInfo(file);
        });
        
        // 업로드 섹션 숨기고 비디오 섹션 표시
        this.uploadSection.style.display = 'none';
        this.videoSection.style.display = 'block';
        
        console.log('비디오 플레이어 표시됨');
    }

    displayVideoInfo(file) {
        const video = this.videoPlayer;
        const duration = this.formatDuration(video.duration);
        const fileSize = this.formatFileSize(file.size);
        
        this.videoInfo.innerHTML = `
            <h3>비디오 정보</h3>
            <div class="info-grid">
                <div class="info-item">
                    <strong>파일명:</strong> ${file.name}
                </div>
                <div class="info-item">
                    <strong>길이:</strong> ${duration}
                </div>
                <div class="info-item">
                    <strong>해상도:</strong> ${video.videoWidth} × ${video.videoHeight}
                </div>
                <div class="info-item">
                    <strong>파일 크기:</strong> ${fileSize}
                </div>
                <div class="info-item">
                    <strong>형식:</strong> ${file.type}
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="fogifyEditor.startAnalysis()">
                    AI 분석 시작
                </button>
                <button class="btn btn-secondary" onclick="fogifyEditor.resetUpload()">
                    다른 파일 선택
                </button>
            </div>
        `;
    }

    startAnalysis() {
        console.log('AI 분석 시작');
        alert('AI 분석 기능은 다음 단계에서 구현됩니다.');
    }

    resetUpload() {
        // 비디오 리소스 정리
        if (this.videoPlayer.src) {
            URL.revokeObjectURL(this.videoPlayer.src);
            this.videoPlayer.src = '';
        }
        
        // 상태 초기화
        this.currentFile = null;
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
        this.updateProgress(0);
    }

    hideProgress() {
        this.uploadProgress.style.display = 'none';
    }

    updateProgress(percent) {
        const rounded = Math.round(percent);
        this.progressFill.style.width = `${rounded}%`;
        this.progressText.textContent = `${rounded}%`;
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

// CSS 스타일 추가 (인라인)
const additionalStyles = `
<style>
.info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin: 1rem 0;
}

.info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
}

.info-item:last-child {
    border-bottom: none;
}

.action-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
}

.btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    font-size: 1rem;
    flex: 1;
    min-width: 140px;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.btn-secondary {
    background: var(--surface);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
}

.btn-secondary:hover {
    background: var(--border-color);
    transform: translateY(-1px);
}

@media (max-width: 480px) {
    .action-buttons {
        flex-direction: column;
    }
    
    .btn {
        width: 100%;
    }
}
</style>
`;

// 스타일 추가
document.head.insertAdjacentHTML('beforeend', additionalStyles);

// 애플리케이션 초기화
const fogifyEditor = new FogifyEditor();

// 전역 함수로 노출 (HTML에서 호출용)
window.fogifyEditor = fogifyEditor;

console.log('Fogify.ai 편집기 초기화 완료');