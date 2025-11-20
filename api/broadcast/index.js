/**
 * TTS 방송 송출 API 엔드포인트 (Node.js/Express)
 * 
 * 사용법:
 * POST https://tts.nanum.online/api/broadcast
 * 
 * Headers:
 * - Content-Type: audio/mpeg (또는 audio/wav 등)
 * - Content-Length: 파일 크기
 * - X-API-Key: (선택사항) API 키 인증
 * 
 * Body: 오디오 파일 바이너리 데이터
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, X-API-Key');
  res.header('Access-Control-Max-Age', '3600');
  
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 미들웨어: raw body 파싱 (최대 50MB)
app.use('/api/broadcast', express.raw({ 
  type: '*/*', 
  limit: '50mb' 
}));

// 디렉토리 설정
const baseDir = __dirname;
const logDir = path.join(baseDir, 'logs');
const audioDir = path.join(baseDir, 'audio');

// 디렉토리 생성
[logDir, audioDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 로그 작성 함수
function writeLog(message) {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logDir, `broadcast_${today}.log`);
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync(logFile, logEntry, 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

// API 키 검증 (선택사항 - 필요시 활성화)
/*
function validateApiKey(req) {
  const apiKey = req.get('X-API-Key') || '';
  const validApiKey = process.env.BROADCAST_API_KEY || 'your-secret-api-key-here';
  
  if (!validApiKey || apiKey === validApiKey) {
    return true;
  }
  return false;
}
*/

// 방송 송출 엔드포인트
app.post('/api/broadcast', (req, res) => {
  try {
    // API 키 검증 (선택사항)
    /*
    if (!validateApiKey(req)) {
      writeLog('ERROR: Invalid API key');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }
    */

    // 오디오 데이터 받기
    const audioData = req.body;
    const contentType = req.get('Content-Type') || 'audio/mpeg';
    const contentLength = req.get('Content-Length') || (audioData ? audioData.length : 0);
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    // 입력 데이터 검증
    if (!audioData || audioData.length === 0) {
      writeLog(`ERROR: No audio data received from ${clientIp}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No audio data received'
      });
    }

    writeLog(`Received broadcast: ${contentLength} bytes, Type: ${contentType}, IP: ${clientIp}`);

    // 파일 확장자 결정
    let extension = 'mp3';
    const contentTypeLower = contentType.toLowerCase();
    if (contentTypeLower.includes('wav')) {
      extension = 'wav';
    } else if (contentTypeLower.includes('ogg')) {
      extension = 'ogg';
    } else if (contentTypeLower.includes('mpeg') || contentTypeLower.includes('mp3')) {
      extension = 'mp3';
    }

    // 오디오 파일 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `broadcast_${timestamp}.${extension}`;
    const audioFile = path.join(audioDir, filename);

    try {
      fs.writeFileSync(audioFile, audioData);
      writeLog(`Saved audio file: ${filename} (${audioData.length} bytes)`);
    } catch (error) {
      writeLog(`ERROR: Failed to save audio file - ${error.message}`);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to save audio file'
      });
    }

    // ============================================
    // 여기서 실제 방송 송출 로직을 구현하세요
    // ============================================

    // 예시 1: 외부 API 호출
    /*
    const https = require('https');
    const broadcastApiUrl = 'https://your-broadcast-system.com/api/play';
    
    const postData = audioData;
    const url = new URL(broadcastApiUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': postData.length,
        'Authorization': 'Bearer YOUR_API_TOKEN'
      }
    };

    const broadcastReq = https.request(options, (broadcastRes) => {
      let responseData = '';
      broadcastRes.on('data', (chunk) => {
        responseData += chunk;
      });
      broadcastRes.on('end', () => {
        if (broadcastRes.statusCode === 200) {
          writeLog('Broadcast API call successful');
        } else {
          writeLog(`ERROR: Broadcast API returned ${broadcastRes.statusCode}`);
        }
      });
    });

    broadcastReq.on('error', (error) => {
      writeLog(`ERROR: Broadcast API request failed - ${error.message}`);
    });

    broadcastReq.write(postData);
    broadcastReq.end();
    */

    // 예시 2: 파일 시스템 경로로 복사
    /*
    const broadcastPath = '/path/to/broadcast/system/audio/';
    if (fs.existsSync(broadcastPath)) {
      try {
        fs.copyFileSync(audioFile, path.join(broadcastPath, filename));
        writeLog(`Copied to broadcast path: ${broadcastPath}`);
      } catch (error) {
        writeLog(`ERROR: Failed to copy to broadcast path - ${error.message}`);
      }
    }
    */

    // 예시 3: 로컬 방송 장비 제어
    /*
    const { exec } = require('child_process');
    const command = `ffmpeg -i ${audioFile} -f alsa default 2>&1`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        writeLog(`ERROR: Broadcast execution failed - ${error.message}`);
      } else {
        writeLog('Broadcast executed successfully');
      }
    });
    */

    // 성공 응답 반환
    return res.status(200).json({
      success: true,
      message: 'Broadcast received successfully',
      timestamp: new Date().toISOString(),
      file_size: contentLength,
      content_type: contentType,
      saved_file: filename,
      server_time: Date.now()
    });

  } catch (error) {
    writeLog(`ERROR: Unexpected error - ${error.message}`);
    console.error('Broadcast endpoint error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  }
});

// 헬스 체크 엔드포인트 (선택사항)
app.get('/api/broadcast/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'TTS Broadcasting API',
    version: '1.0.0'
  });
});

// 테스트 엔드포인트 (선택사항)
// /api/broadcast/test 와 /api/broadcast/test.php 모두 지원
app.get('/api/broadcast/test', (req, res) => {
  const testResults = {
    status: 'ok',
    message: 'API endpoint is working',
    timestamp: new Date().toISOString(),
    directories: {
      logs: fs.existsSync(logDir) ? 'exists' : 'missing',
      audio: fs.existsSync(audioDir) ? 'exists' : 'missing'
    },
    permissions: {
      logs: fs.existsSync(logDir) ? (fs.statSync(logDir).mode & parseInt('777', 8)).toString(8) : 'N/A',
      audio: fs.existsSync(audioDir) ? (fs.statSync(audioDir).mode & parseInt('777', 8)).toString(8) : 'N/A'
    }
  };

  res.status(200).json(testResults);
});

// test.php 경로도 동일하게 처리 (PHP 파일로 접근하는 경우 대비)
app.get('/api/broadcast/test.php', (req, res) => {
  const testResults = {
    status: 'ok',
    message: 'API endpoint is working',
    timestamp: new Date().toISOString(),
    note: 'This is the Node.js version endpoint. Use /api/broadcast/test for consistency.',
    directories: {
      logs: fs.existsSync(logDir) ? 'exists' : 'missing',
      audio: fs.existsSync(audioDir) ? 'exists' : 'missing'
    },
    permissions: {
      logs: fs.existsSync(logDir) ? (fs.statSync(logDir).mode & parseInt('777', 8)).toString(8) : 'N/A',
      audio: fs.existsSync(audioDir) ? (fs.statSync(audioDir).mode & parseInt('777', 8)).toString(8) : 'N/A'
    }
  };

  res.status(200).json(testResults);
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  writeLog(`ERROR: ${err.message}`);
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 서버 시작
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Broadcasting API server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/broadcast/health`);
    writeLog(`Server started on port ${PORT}`);
  });
}

module.exports = app;

