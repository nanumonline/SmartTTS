-- DB에 영어로 저장된 name_ko를 한글로 업데이트
-- voice_data->>'name' 또는 현재 name_ko 값을 기반으로 한글 이름으로 변환

-- 1. 접두사가 없는 영어 이름들을 한글로 변환
UPDATE public.tts_voice_catalog
SET name_ko = CASE name_ko
  -- 단순 영어 이름
  WHEN 'Takumi' THEN '타쿠미'
  WHEN 'Steelyn' THEN '스틸린'
  WHEN 'Bodhi' THEN '보디'
  WHEN 'Thanatos' THEN '타나토스'
  WHEN 'Kevin' THEN '케빈'
  WHEN 'Honoka' THEN '호노카'
  WHEN 'Geomec' THEN '지오맥'
  WHEN 'Jun' THEN '준'
  WHEN 'Rikoming' THEN '리코밍'
  WHEN 'Desphara' THEN '데스파라'
  WHEN 'Tara' THEN '타라'
  WHEN 'Rachel' THEN '레이첼'
  WHEN 'Freddie' THEN '프레디'
  WHEN 'Audrey' THEN '오드리'
  WHEN 'Ben' THEN '벤'
  WHEN 'Helga' THEN '헬가'
  WHEN 'Bin' THEN '빈'
  WHEN 'Anna' THEN '안나'
  WHEN 'Hercules' THEN '헤라클레스'
  WHEN 'Toma' THEN '토마'
  WHEN 'Snar' THEN '스나르'
  WHEN 'Sophia' THEN '소피아'
  WHEN 'Aya' THEN '아야'
  WHEN 'Selena' THEN '셀레나'
  WHEN 'Aiden' THEN '에이든'
  WHEN 'Shoto' THEN '쇼토'
  WHEN 'Walt' THEN '월트'
  WHEN 'Kai' THEN '카이'
  WHEN 'Nix' THEN '닉스'
  WHEN 'Nora' THEN '노라'
  WHEN 'Evan' THEN '에반'
  WHEN 'Wayne' THEN '웨인'
  WHEN 'Daeun' THEN '다은'
  WHEN 'Lun' THEN '룬'
  WHEN 'Mai' THEN '마이'
  WHEN 'Cindy' THEN '신디'
  WHEN 'Coco' THEN '코코'
  WHEN 'Lauren' THEN '로렌'
  WHEN 'Serin' THEN '세린'
  WHEN 'Molk' THEN '몰크'
  WHEN 'Misa' THEN '미사'
  WHEN 'Kaori' THEN '카오리'
  WHEN 'Shade' THEN '셰이드'
  WHEN 'Amantha' THEN '아만사'
  WHEN 'Kazuki' THEN '카즈키'
  WHEN 'Andrew' THEN '앤드류'
  WHEN 'Sota' THEN '소타'
  WHEN 'Siwoo' THEN '시우'
  WHEN 'Ryota' THEN '료타'
  WHEN 'Orca Fondo' THEN '오르카 폰도'
  WHEN 'Misook' THEN '미숙'
  WHEN 'Holt' THEN '홀트'
  WHEN 'Viper' THEN '바이퍼'
  WHEN 'Bella' THEN '벨라'
  WHEN 'Harrison' THEN '해리슨'
  WHEN 'Diego' THEN '디에고'
  WHEN 'Jack' THEN '잭'
  WHEN 'Mason' THEN '메이슨'
  WHEN 'Minwoo' THEN '민우'
  WHEN 'Satyrus' THEN '사티루스'
  WHEN 'Juliet' THEN '줄리엣'
  WHEN 'Molly' THEN '몰리'
  WHEN 'Kotaro' THEN '코타로'
  WHEN 'Gautama' THEN '가우타마'
  WHEN 'Yumi' THEN '유미'
  WHEN 'Valiant' THEN '발리언트'
  WHEN 'Diana' THEN '다이아나'
  WHEN 'Quinn George' THEN '퀸 조지'
  WHEN 'Tony' THEN '토니'
  WHEN 'Sion' THEN '시온'
  WHEN 'Tilly' THEN '틸리'
  WHEN 'Hanbi' THEN '한비'
  WHEN 'Sakura' THEN '사쿠라'
  WHEN 'Sangchul' THEN '상철'
  WHEN 'Se-A' THEN '세아'
  WHEN 'Angelina' THEN '안젤리나'
  WHEN 'Youngchul' THEN '영철'
  WHEN 'Youngho' THEN '영호'
  WHEN 'Soonja' THEN '순자'
  WHEN 'Anika' THEN '아니카'
  WHEN 'Mika' THEN '미카'
  WHEN 'Suho' THEN '수호'
  WHEN 'Billy' THEN '빌리'
  WHEN 'Eddie' THEN '에디'
  WHEN 'Lang' THEN '랑'
  WHEN 'Yannom' THEN '얀놈'
  WHEN 'Chunsik' THEN '춘식'
  WHEN 'Nate' THEN '네이트'
  WHEN 'Mansu' THEN '만수'
  WHEN 'Youngsoo' THEN '영수'
  WHEN 'Jihu' THEN '지후'
  WHEN 'Jamie' THEN '제이미'
  WHEN 'The Kid' THEN '더 키드'
  WHEN 'TMT' THEN '티엠티'
  WHEN 'Gingerbread' THEN '진저브레드'
  WHEN 'Ato' THEN '아토'
  WHEN 'NyangNyangi' THEN '냥냥이'
  WHEN 'Mok-Sensei' THEN '목센세'
  WHEN 'GenZZZ' THEN '젠지지지'
  WHEN 'Father Jacob' THEN '아버지 야콥'
  WHEN 'Ppang BuJang' THEN '빵 부장'
  ELSE name_ko  -- 변환할 수 없는 이름은 그대로 유지
END
WHERE name_ko IS NOT NULL 
  AND name_ko != ''
  AND name_ko ~ '^[^가-힣]+$'  -- 한글이 없는 경우만
  AND name_ko !~ '^\[[^\]]+\]'  -- 접두사가 없는 경우만
  AND name_ko IN (
    'Takumi', 'Steelyn', 'Bodhi', 'Thanatos', 'Kevin', 'Honoka', 'Geomec', 'Jun', 
    'Rikoming', 'Desphara', 'Tara', 'Rachel', 'Freddie', 'Audrey', 'Ben', 'Helga', 
    'Bin', 'Anna', 'Hercules', 'Toma', 'Snar', 'Sophia', 'Aya', 'Selena', 'Aiden', 
    'Shoto', 'Walt', 'Kai', 'Nix', 'Nora', 'Evan', 'Wayne', 'Daeun', 'Lun', 'Mai', 
    'Cindy', 'Coco', 'Lauren', 'Serin', 'Molk', 'Misa', 'Kaori', 'Shade', 'Amantha', 
    'Kazuki', 'Andrew', 'Sota', 'Siwoo', 'Ryota', 'Orca Fondo', 'Misook', 'Holt', 
    'Viper', 'Bella', 'Harrison', 'Diego', 'Jack', 'Mason', 'Minwoo', 'Satyrus', 
    'Juliet', 'Molly', 'Kotaro', 'Gautama', 'Yumi', 'Valiant', 'Diana', 'Quinn George',
    'Tony', 'Sion', 'Tilly', 'Hanbi', 'Sakura', 'Sangchul', 'Se-A', 'Angelina',
    'Youngchul', 'Youngho', 'Soonja', 'Anika', 'Mika', 'Suho', 'Billy', 'Eddie',
    'Lang', 'Yannom', 'Chunsik', 'Nate', 'Mansu', 'Youngsoo', 'Jihu', 'Jamie',
    'The Kid', 'TMT', 'Gingerbread', 'Ato', 'NyangNyangi', 'Mok-Sensei', 'GenZZZ',
    'Father Jacob', 'Ppang BuJang'
  );

-- 2. 접두사가 있는 영어 이름들을 한글로 변환 (접두사도 한글로 변환)
-- [New] → [신규], [Meme] → [밈], [Choice] → [선택]
UPDATE public.tts_voice_catalog
SET name_ko = CASE 
  WHEN name_ko = '[New] Ppang BuJang' THEN '[신규] 빵 부장'
  WHEN name_ko = '[Meme] TMT' THEN '[밈] 티엠티'
  WHEN name_ko = '[Meme] Tony' THEN '[밈] 토니'
  WHEN name_ko = '[Choice] Hanbi' THEN '[선택] 한비'
  WHEN name_ko = '[Choice] Sakura' THEN '[선택] 사쿠라'
  WHEN name_ko = '[New] Sangchul' THEN '[신규] 상철'
  WHEN name_ko = '[Choice] Tilly' THEN '[선택] 틸리'
  WHEN name_ko = '[Choice] Se-A' THEN '[선택] 세아'
  WHEN name_ko = '[Meme] Sion' THEN '[밈] 시온'
  WHEN name_ko = '[Choice] Angelina' THEN '[선택] 안젤리나'
  WHEN name_ko = '[New] Youngchul' THEN '[신규] 영철'
  WHEN name_ko = '[New] Youngho' THEN '[신규] 영호'
  WHEN name_ko = '[New] Soonja' THEN '[신규] 순자'
  WHEN name_ko = '[Meme] Jamie The Kid' THEN '[밈] 제이미 더 키드'
  WHEN name_ko = '[Meme] Anika' THEN '[밈] 아니카'
  WHEN name_ko = '[Choice] Mika' THEN '[선택] 미카'
  WHEN name_ko = '[Choice] Suho' THEN '[선택] 수호'
  WHEN name_ko = '[Meme] Father Jacob' THEN '[밈] 아버지 야콥'
  WHEN name_ko = '[Choice] Billy' THEN '[선택] 빌리'
  WHEN name_ko = '[Choice] Eddie' THEN '[선택] 에디'
  WHEN name_ko = '[Meme] Mok-Sensei' THEN '[밈] 목센세'
  WHEN name_ko = '[Choice] Lang' THEN '[선택] 랑'
  WHEN name_ko = '[Choice] Yannom' THEN '[선택] 얀놈'
  WHEN name_ko = '[Meme] GenZZZ' THEN '[밈] 젠지지지'
  WHEN name_ko = '[Choice] Chunsik' THEN '[선택] 춘식'
  WHEN name_ko = '[New] Nate' THEN '[신규] 네이트'
  WHEN name_ko = '[Meme] Gingerbread' THEN '[밈] 진저브레드'
  WHEN name_ko = '[Meme] Ato' THEN '[밈] 아토'
  WHEN name_ko = '[Choice] Jihu' THEN '[선택] 지후'
  WHEN name_ko = '[Meme] NyangNyangi' THEN '[밈] 냥냥이'
  WHEN name_ko = '[New] Youngsoo' THEN '[신규] 영수'
  WHEN name_ko = '[New] Mansu' THEN '[신규] 만수'
  -- 기존 한글로 변환된 것도 접두사만 업데이트
  WHEN name_ko ~ '^\[New\] ' THEN REPLACE(name_ko, '[New] ', '[신규] ')
  WHEN name_ko ~ '^\[Meme\] ' THEN REPLACE(name_ko, '[Meme] ', '[밈] ')
  WHEN name_ko ~ '^\[Choice\] ' THEN REPLACE(name_ko, '[Choice] ', '[선택] ')
  ELSE name_ko  -- 변환할 수 없는 이름은 그대로 유지
END
WHERE name_ko IS NOT NULL 
  AND name_ko != ''
  AND name_ko ~ '^\[[^\]]+\]';  -- 접두사가 있는 경우

-- 3. voice_data->>'name'을 기반으로 name_ko 업데이트 (name_ko가 여전히 영어인 경우)
-- 접두사 처리
UPDATE public.tts_voice_catalog
SET name_ko = CASE 
      WHEN voice_data->>'name' ~ '^\[[^\]]+\]' THEN
        -- 접두사가 있는 경우 (접두사도 한글로 변환: [New] → [신규], [Meme] → [밈], [Choice] → [선택])
        (SELECT CASE 
          WHEN voice_data->>'name' LIKE '[New] %' THEN
            '[신규] ' || CASE TRIM(SUBSTRING(voice_data->>'name' FROM 7))
              WHEN 'Ppang BuJang' THEN '빵 부장'
              WHEN 'Sangchul' THEN '상철'
              WHEN 'Youngchul' THEN '영철'
              WHEN 'Youngho' THEN '영호'
              WHEN 'Soonja' THEN '순자'
              WHEN 'Nate' THEN '네이트'
              WHEN 'Youngsoo' THEN '영수'
              WHEN 'Mansu' THEN '만수'
              ELSE TRIM(SUBSTRING(voice_data->>'name' FROM 7))
            END
          WHEN voice_data->>'name' LIKE '[Choice] %' THEN
            '[선택] ' || CASE TRIM(SUBSTRING(voice_data->>'name' FROM 10))
              WHEN 'Hanbi' THEN '한비'
              WHEN 'Sakura' THEN '사쿠라'
              WHEN 'Tilly' THEN '틸리'
              WHEN 'Se-A' THEN '세아'
              WHEN 'Angelina' THEN '안젤리나'
              WHEN 'Mika' THEN '미카'
              WHEN 'Suho' THEN '수호'
              WHEN 'Billy' THEN '빌리'
              WHEN 'Eddie' THEN '에디'
              WHEN 'Lang' THEN '랑'
              WHEN 'Yannom' THEN '얀놈'
              WHEN 'Chunsik' THEN '춘식'
              WHEN 'Jihu' THEN '지후'
              ELSE TRIM(SUBSTRING(voice_data->>'name' FROM 10))
            END
          WHEN voice_data->>'name' LIKE '[Meme] %' THEN
            '[밈] ' || CASE TRIM(SUBSTRING(voice_data->>'name' FROM 8))
              WHEN 'TMT' THEN '티엠티'
              WHEN 'Tony' THEN '토니'
              WHEN 'Sion' THEN '시온'
              WHEN 'Jamie The Kid' THEN '제이미 더 키드'
              WHEN 'Anika' THEN '아니카'
              WHEN 'Father Jacob' THEN '아버지 야콥'
              WHEN 'Mok-Sensei' THEN '목센세'
              WHEN 'GenZZZ' THEN '젠지지지'
              WHEN 'Gingerbread' THEN '진저브레드'
              WHEN 'Ato' THEN '아토'
              WHEN 'NyangNyangi' THEN '냥냥이'
              ELSE TRIM(SUBSTRING(voice_data->>'name' FROM 8))
            END
          ELSE voice_data->>'name'
    END)
  ELSE
    -- 접두사가 없는 경우
    CASE voice_data->>'name'
      WHEN 'Takumi' THEN '타쿠미'
      WHEN 'Steelyn' THEN '스틸린'
      WHEN 'Bodhi' THEN '보디'
      WHEN 'Thanatos' THEN '타나토스'
      WHEN 'Kevin' THEN '케빈'
      WHEN 'Honoka' THEN '호노카'
      WHEN 'Geomec' THEN '지오맥'
      WHEN 'Jun' THEN '준'
      WHEN 'Rikoming' THEN '리코밍'
      WHEN 'Desphara' THEN '데스파라'
      WHEN 'Tara' THEN '타라'
      WHEN 'Rachel' THEN '레이첼'
      WHEN 'Freddie' THEN '프레디'
      WHEN 'Audrey' THEN '오드리'
      WHEN 'Ben' THEN '벤'
      WHEN 'Helga' THEN '헬가'
      WHEN 'Bin' THEN '빈'
      WHEN 'Anna' THEN '안나'
      WHEN 'Hercules' THEN '헤라클레스'
      WHEN 'Toma' THEN '토마'
      WHEN 'Snar' THEN '스나르'
      WHEN 'Sophia' THEN '소피아'
      WHEN 'Aya' THEN '아야'
      WHEN 'Selena' THEN '셀레나'
      WHEN 'Aiden' THEN '에이든'
      WHEN 'Shoto' THEN '쇼토'
      WHEN 'Walt' THEN '월트'
      WHEN 'Kai' THEN '카이'
      WHEN 'Nix' THEN '닉스'
      WHEN 'Nora' THEN '노라'
      WHEN 'Evan' THEN '에반'
      WHEN 'Wayne' THEN '웨인'
      WHEN 'Daeun' THEN '다은'
      WHEN 'Lun' THEN '룬'
      WHEN 'Mai' THEN '마이'
      WHEN 'Cindy' THEN '신디'
      WHEN 'Coco' THEN '코코'
      WHEN 'Lauren' THEN '로렌'
      WHEN 'Serin' THEN '세린'
      WHEN 'Molk' THEN '몰크'
      WHEN 'Misa' THEN '미사'
      WHEN 'Kaori' THEN '카오리'
      WHEN 'Shade' THEN '셰이드'
      WHEN 'Amantha' THEN '아만사'
      WHEN 'Kazuki' THEN '카즈키'
      WHEN 'Andrew' THEN '앤드류'
      WHEN 'Sota' THEN '소타'
      WHEN 'Siwoo' THEN '시우'
      WHEN 'Ryota' THEN '료타'
      WHEN 'Orca Fondo' THEN '오르카 폰도'
      WHEN 'Misook' THEN '미숙'
      WHEN 'Holt' THEN '홀트'
      WHEN 'Viper' THEN '바이퍼'
      WHEN 'Bella' THEN '벨라'
      WHEN 'Harrison' THEN '해리슨'
      WHEN 'Diego' THEN '디에고'
      WHEN 'Jack' THEN '잭'
      WHEN 'Mason' THEN '메이슨'
      WHEN 'Minwoo' THEN '민우'
      WHEN 'Satyrus' THEN '사티루스'
      WHEN 'Juliet' THEN '줄리엣'
      WHEN 'Molly' THEN '몰리'
      WHEN 'Kotaro' THEN '코타로'
      WHEN 'Gautama' THEN '가우타마'
      WHEN 'Yumi' THEN '유미'
      WHEN 'Valiant' THEN '발리언트'
      WHEN 'Diana' THEN '다이아나'
      WHEN 'Quinn George' THEN '퀸 조지'
      ELSE voice_data->>'name'
    END
END
WHERE name_ko IS NOT NULL 
  AND name_ko != ''
  AND name_ko !~ '[가-힣]'  -- name_ko에 한글이 없는 경우
  AND voice_data->>'name' IS NOT NULL
  AND voice_data->>'name' != '';

