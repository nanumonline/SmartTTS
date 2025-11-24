/**
 * 샘플 오디오 생성 스크립트
 * TTS API를 사용하여 샘플 오디오 파일을 생성합니다
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 샘플 텍스트 및 음성 설정
// 실제 사용 가능한 voice ID를 사용하세요
const samples = [
  {
    filename: "sample1-policy.mp3",
    text: "안녕하세요. 오늘은 새로운 정책 발표를 안내드리겠습니다. 본 정책은 시민 여러분의 편의를 위해 마련되었으며, 효과적인 시행을 위해 지속적으로 개선해 나가겠습니다. 많은 관심과 협조 부탁드립니다.",
    voiceId: "Alex", // 앵커 스타일 남성 (실제 사용 가능한 voice ID로 변경 필요)
    description: "정책 발표 샘플"
  },
  {
    filename: "sample2-announcement.mp3",
    text: "안녕하세요. 중요한 공지사항을 전달드립니다. 내일부터 새로운 서비스가 시작됩니다. 자세한 내용은 홈페이지를 참고해 주시기 바랍니다. 문의사항이 있으시면 언제든지 연락 주시기 바랍니다.",
    voiceId: "Amy", // 아나운서 스타일 여성 (실제 사용 가능한 voice ID로 변경 필요)
    description: "공지사항 샘플"
  },
  {
    filename: "sample3-presentation.mp3",
    text: "안녕하세요. 오늘 발표할 내용은 연구 결과에 대한 것입니다. 본 연구는 지난 1년간의 데이터를 분석하여 도출된 결과입니다. 주요 내용은 다음과 같습니다. 첫째, 환경 개선 효과가 확인되었습니다. 둘째, 시민 만족도가 향상되었습니다.",
    voiceId: "David", // 전문가 스타일 남성 (실제 사용 가능한 voice ID로 변경 필요)
    description: "전문 발표 샘플"
  }
];

async function generateSample(sample) {
  console.log(`\n[${sample.description}] 생성 중...`);
  console.log(`텍스트: ${sample.text.substring(0, 50)}...`);
  console.log(`음성 ID: ${sample.voiceId}`);

  try {
    const response = await supabase.functions.invoke('supertone-proxy/text-to-speech/' + sample.voiceId, {
      method: 'POST',
      body: {
        text: sample.text,
        language: "ko",
        style: "neutral",
        model: "sona_speech_1",
        voice_settings: {
          speed: 1.0,
          pitch_shift: 0,
          pitch_variance: 1,
        },
      },
    });

    if (response.error) {
      throw new Error(response.error.message || '음원 생성 실패');
    }

    // 응답이 JSON인 경우 (base64 인코딩된 오디오)
    if (response.data && typeof response.data === 'object') {
      const audioData = response.data.audioData || response.data.audio_base64 || response.data.audio;
      if (audioData) {
        // base64 디코딩
        const base64Data = audioData.includes(',') ? audioData.split(',')[1] : audioData;
        const buffer = Buffer.from(base64Data, 'base64');
        
        // 파일 저장
        const outputDir = path.join(__dirname, '..', 'public', 'samples');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, sample.filename);
        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ 생성 완료: ${outputPath}`);
        return true;
      }
    }

    // 응답이 Blob인 경우
    if (response.data instanceof Blob || Buffer.isBuffer(response.data)) {
      const outputDir = path.join(__dirname, '..', 'public', 'samples');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, sample.filename);
      fs.writeFileSync(outputPath, Buffer.from(response.data));
      console.log(`✅ 생성 완료: ${outputPath}`);
      return true;
    }

    throw new Error('알 수 없는 응답 형식');
  } catch (error) {
    console.error(`❌ 생성 실패: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('샘플 오디오 생성 시작...\n');

  const results = [];
  for (const sample of samples) {
    const success = await generateSample(sample);
    results.push({ sample: sample.filename, success });
    
    // API 호출 간격 (1초)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== 생성 결과 ===');
  results.forEach(({ sample, success }) => {
    console.log(`${success ? '✅' : '❌'} ${sample}`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n총 ${successCount}/${samples.length}개 샘플 생성 완료`);
}

main().catch(console.error);

