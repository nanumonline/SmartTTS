import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface TagCloud3DProps {
  tags: Array<[string, number]>;
  selectedTag: string;
  onTagClick: (tag: string) => void;
  getTagSize: (count: number) => string;
  getTagColor: (tag: string) => string;
  height: string;
}

export default function TagCloud3D({
  tags,
  selectedTag,
  onTagClick,
  getTagSize,
  getTagColor,
  height,
}: TagCloud3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, rotationX: 0, rotationY: 0 });
  const [autoRotate, setAutoRotate] = useState(true);
  const [hasMoved, setHasMoved] = useState(false); // 드래그인지 클릭인지 구분

  // 구의 반지름 (컨테이너 높이의 35%)
  const containerHeight = typeof height === 'string' ? parseInt(height) : 200;
  const radius = containerHeight * 0.35;

  // 태그를 구의 표면에 균등하게 배치하는 함수 (Fibonacci sphere 알고리즘 사용)
  const getTagPosition = (index: number, total: number) => {
    // Golden angle을 사용하여 균등 분포
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const theta = goldenAngle * index;
    const y = 1 - (2 * index) / total; // -1 ~ 1
    const radiusAtY = Math.sqrt(1 - y * y);
    
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    return {
      x: x * radius,
      y: y * radius,
      z: z * radius,
      // 구의 표면에 수직인 방향 벡터 (태그 회전용)
      normalX: x,
      normalY: y,
      normalZ: z,
    };
  };

  // 태그가 구의 표면에 붙어있도록 회전 각도 계산
  const getTagRotation = (normalX: number, normalY: number, normalZ: number, rotationX: number, rotationY: number) => {
    // 현재 구의 회전을 고려한 법선 벡터
    const cosX = Math.cos(rotationX * Math.PI / 180);
    const sinX = Math.sin(rotationX * Math.PI / 180);
    const cosY = Math.cos(rotationY * Math.PI / 180);
    const sinY = Math.sin(rotationY * Math.PI / 180);
    
    // Y축 회전 적용
    let nx = normalX * cosY - normalZ * sinY;
    let ny = normalY;
    let nz = normalX * sinY + normalZ * cosY;
    
    // X축 회전 적용
    const finalNy = ny * cosX - nz * sinX;
    const finalNz = ny * sinX + nz * cosX;
    
    // 태그가 카메라를 향하도록 회전 (하지만 구의 표면에 붙어있도록)
    const angleY = Math.atan2(nx, finalNz) * (180 / Math.PI);
    const angleX = -Math.asin(finalNy) * (180 / Math.PI);
    
    return { angleX, angleY };
  };

  // 마우스 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    // 태그 버튼을 클릭한 경우는 드래그로 처리하지 않음
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return; // 버튼 클릭은 드래그로 처리하지 않음
    }
    
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({
      x: e.clientX - rotation.y,
      y: e.clientY - rotation.x,
      rotationX: rotation.x,
      rotationY: rotation.y,
    });
  };

  // 마우스 드래그 중
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // 일정 거리 이상 움직였을 때만 드래그로 간주
    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (moveDistance > 5) {
      setHasMoved(true);
      setAutoRotate(false);
    }

    setRotation({
      x: dragStart.rotationX + deltaY * 0.5,
      y: dragStart.rotationY + deltaX * 0.5,
    });
  };

  // 마우스 드래그 종료
  const handleMouseUp = () => {
    // 드래그가 아니었으면 (클릭이었으면) 자동 회전 유지
    if (!hasMoved) {
      setAutoRotate(true);
    }
    setIsDragging(false);
    setHasMoved(false);
  };

  // 터치 이벤트 처리
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const target = e.target as HTMLElement;
      if (target.closest('button')) {
        return; // 버튼 터치는 드래그로 처리하지 않음
      }
      
      setIsDragging(true);
      setHasMoved(false);
      setDragStart({
        x: e.touches[0].clientX - rotation.y,
        y: e.touches[0].clientY - rotation.x,
        rotationX: rotation.x,
        rotationY: rotation.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - dragStart.x;
    const deltaY = e.touches[0].clientY - dragStart.y;
    
    // 일정 거리 이상 움직였을 때만 드래그로 간주
    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (moveDistance > 5) {
      setHasMoved(true);
      setAutoRotate(false);
    }

    setRotation({
      x: dragStart.rotationX + deltaY * 0.5,
      y: dragStart.rotationY + deltaX * 0.5,
    });
  };

  const handleTouchEnd = () => {
    // 드래그가 아니었으면 (클릭이었으면) 자동 회전 유지
    if (!hasMoved) {
      setAutoRotate(true);
    }
    setIsDragging(false);
    setHasMoved(false);
  };

  // 자동 회전
  useEffect(() => {
    if (!autoRotate) return;

    const interval = setInterval(() => {
      setRotation((prev) => ({
        x: prev.x,
        y: prev.y + 0.5,
      }));
    }, 50);

    return () => clearInterval(interval);
  }, [autoRotate]);

  // 전역 마우스 이벤트 리스너
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      // 일정 거리 이상 움직였을 때만 드래그로 간주
      const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (moveDistance > 5) {
        setHasMoved(true);
        setAutoRotate(false);
      }

      setRotation({
        x: dragStart.rotationX + deltaY * 0.5,
        y: dragStart.rotationY + deltaX * 0.5,
      });
    };

    const handleGlobalMouseUp = () => {
      // 드래그가 아니었으면 (클릭이었으면) 자동 회전 유지
      if (!hasMoved) {
        setAutoRotate(true);
      }
      setIsDragging(false);
      setHasMoved(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, hasMoved]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        position: 'relative',
        perspective: '1200px',
        perspectiveOrigin: '50% 50%',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100%',
          height: '100%',
          transform: `translate(-50%, -50%) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transformStyle: 'preserve-3d',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {tags.map(([tag, count], index) => {
          const position = getTagPosition(index, tags.length);
          const { x, y, z, normalX, normalY, normalZ } = position;
          const tagColor = getTagColor(tag);
          const tagSize = getTagSize(count);
          const isSelected = selectedTag === tag;
          
          // 구의 표면에 붙어있도록 회전 각도 계산
          const { angleX, angleY } = getTagRotation(normalX, normalY, normalZ, rotation.x, rotation.y);
          
          // z 좌표에 따라 opacity와 scale 조정 (뒤쪽 태그는 약간 투명하게)
          const depth = (z + radius) / (2 * radius); // 0 ~ 1
          const opacity = 0.5 + depth * 0.5; // 0.5 ~ 1.0
          const scale = 0.85 + depth * 0.15; // 0.85 ~ 1.0
          
          // z-index는 z 좌표에 따라 설정 (뒤쪽이 작은 값)
          const zIndex = Math.round(z + radius * 2);

          return (
            <div
              key={tag}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(${scale})`,
                transformStyle: 'preserve-3d',
                pointerEvents: 'auto',
                zIndex: zIndex,
                opacity: isSelected ? 1 : opacity,
                transition: isDragging ? 'none' : 'opacity 0.2s ease-out, transform 0.2s ease-out',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(tag);
              }}
            >
              <Button
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                className="rounded-full transition-all hover:scale-110 whitespace-nowrap"
                style={{
                  fontSize: tagSize,
                  fontWeight: isSelected ? 600 : 400,
                  backgroundColor: isSelected ? tagColor : 'transparent',
                  borderColor: tagColor,
                  color: isSelected ? 'white' : tagColor,
                  boxShadow: isSelected
                    ? `0 0 15px ${tagColor}, 0 0 30px ${tagColor}40`
                    : `0 2px 8px rgba(0,0,0,0.2)`,
                  borderWidth: isSelected ? '2px' : '1px',
                  pointerEvents: 'auto',
                  transform: 'translateZ(0)', // 구의 표면에 붙어있도록
                }}
              >
                {tag} ({count})
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
